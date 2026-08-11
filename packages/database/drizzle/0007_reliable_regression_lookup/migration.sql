-- The workflow RLS role can only see its current evaluation row. Regression comparison
-- deliberately needs one durable field from earlier passing Reliable runs, so expose
-- that lookup through a narrowly scoped SECURITY DEFINER helper rather than widening
-- workflow table visibility.

CREATE OR REPLACE FUNCTION rack_previous_accepted_reliable_score(p_run_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_workspace uuid;
  current_profile text;
  current_target text;
  result integer;
BEGIN
  IF p_run_id IS DISTINCT FROM nullif(current_setting('rack.workflow_run_id', true), '')::uuid THEN
    RAISE EXCEPTION 'rack-eval: workflow scope mismatch';
  END IF;

  SELECT evaluation.workspace_id, run.profile_id, run.target
  INTO current_workspace, current_profile, current_target
  FROM rack_model_evaluation_runs evaluation
  JOIN rack_managed_runs run ON run.id = evaluation.run_id
  WHERE evaluation.run_id = p_run_id
    AND evaluation.mode = 'reliable';

  IF current_workspace IS NULL THEN
    RAISE EXCEPTION 'rack-eval: Reliable evaluation not found';
  END IF;

  SELECT prior.behavioural_score INTO result
  FROM rack_model_evaluation_runs prior
  JOIN rack_managed_runs prior_run ON prior_run.id = prior.run_id
  WHERE prior.workspace_id = current_workspace
    AND prior.mode = 'reliable'
    AND prior.status = 'completed'
    AND prior.behavioural_verdict = true
    AND prior.behavioural_score IS NOT NULL
    AND prior.run_id <> p_run_id
    AND prior_run.profile_id = current_profile
    AND prior_run.target = current_target
  ORDER BY prior.completed_at DESC
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION rack_previous_accepted_reliable_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_previous_accepted_reliable_score(uuid) TO rack_workflow;

CREATE OR REPLACE FUNCTION rack_complete_reliable_evaluation(
  p_run_id uuid,
  p_candidate_score integer,
  p_baseline_score integer,
  p_candidate_pass_rate integer,
  p_baseline_pass_rate integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
  previous_score integer;
  total_cost bigint;
  regression_ok boolean;
  final_verdict boolean;
BEGIN
  IF p_candidate_score NOT BETWEEN 0 AND 100 OR p_baseline_score NOT BETWEEN 0 AND 100
    OR p_candidate_pass_rate NOT BETWEEN 0 AND 100 OR p_baseline_pass_rate NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'rack-eval: invalid Reliable aggregate';
  END IF;

  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id AND mode = 'reliable'
  FOR UPDATE;
  IF NOT FOUND OR evaluation_row.status <> 'running' THEN RETURN; END IF;

  previous_score := rack_previous_accepted_reliable_score(p_run_id);
  regression_ok := previous_score IS NULL OR p_candidate_score >= previous_score;
  final_verdict := p_candidate_pass_rate = 100
    AND p_candidate_score >= p_baseline_score
    AND regression_ok;

  SELECT coalesce(sum(cost_microusd), 0) INTO total_cost
  FROM rack_provider_calls
  WHERE run_id = p_run_id AND status IN ('completed', 'failed');
  IF total_cost > evaluation_row.accepted_maximum_retry_microusd THEN
    RAISE EXCEPTION 'rack-eval: Reliable cost exceeds reservation';
  END IF;

  UPDATE rack_workspace_evaluation_limits
  SET reserved_microusd = greatest(0, reserved_microusd - evaluation_row.accepted_maximum_retry_microusd),
      spent_microusd = spent_microusd + total_cost,
      updated_at = now()
  WHERE workspace_id = evaluation_row.workspace_id;

  UPDATE rack_model_evaluation_runs
  SET settled_cost_microusd = total_cost,
      status = 'completed',
      behavioural_verdict = final_verdict,
      behavioural_score = p_candidate_score,
      baseline_score = p_baseline_score,
      previous_accepted_score = previous_score,
      candidate_pass_rate = p_candidate_pass_rate,
      baseline_pass_rate = p_baseline_pass_rate,
      regression_passed = CASE WHEN previous_score IS NULL THEN NULL ELSE regression_ok END,
      completed_at = now()
  WHERE run_id = p_run_id;

  UPDATE rack_managed_runs
  SET status = 'completed', completed_at = now()
  WHERE id = p_run_id;
END;
$$;
