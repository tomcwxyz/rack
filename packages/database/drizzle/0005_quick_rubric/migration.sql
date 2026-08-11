-- Rubric-backed Quick evaluation. This extends the Iteration 12 paid-call
-- boundary without changing the durable content policy: candidate/judge text
-- remains in rack_managed_payloads, while provider ledgers and the final
-- boolean verdict remain durable.

CREATE OR REPLACE FUNCTION rack_reserve_quick_rubric_evaluation(
  p_workspace_id uuid,
  p_run_id uuid,
  p_idempotency_key uuid,
  p_rack_fingerprint text,
  p_profile_id text,
  p_target text,
  p_generator_alias text,
  p_provider_id text,
  p_model_id text,
  p_accepted_maximum_retry_microusd bigint,
  p_estimated_cost_microusd bigint,
  p_instructions text,
  p_case_prompt text,
  p_rubric text,
  p_expires_at timestamptz
)
RETURNS TABLE(reserved_run_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  limits_row rack_workspace_evaluation_limits%ROWTYPE;
  existing_run uuid;
  active_paid_runs integer;
BEGIN
  SELECT * INTO limits_row
  FROM rack_workspace_evaluation_limits
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rack-eval: limits missing';
  END IF;

  SELECT run_id INTO existing_run
  FROM rack_model_evaluation_runs
  WHERE workspace_id = p_workspace_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN QUERY SELECT existing_run, true;
    RETURN;
  END IF;

  IF p_accepted_maximum_retry_microusd < 0 OR p_estimated_cost_microusd < 0 THEN
    RAISE EXCEPTION 'rack-eval: invalid cost';
  END IF;

  IF p_accepted_maximum_retry_microusd > limits_row.per_run_cap_microusd THEN
    RAISE EXCEPTION 'rack-eval: per-run cap changed';
  END IF;

  IF p_accepted_maximum_retry_microusd >
    (limits_row.hard_budget_microusd - limits_row.spent_microusd - limits_row.reserved_microusd) THEN
    RAISE EXCEPTION 'rack-eval: workspace budget changed';
  END IF;

  SELECT count(*)::integer INTO active_paid_runs
  FROM rack_managed_runs run
  WHERE run.workspace_id = p_workspace_id
    AND run.kind = 'model-evaluation'
    AND run.status IN ('queued', 'running');

  IF active_paid_runs >= limits_row.concurrency_limit THEN
    RAISE EXCEPTION 'rack-eval: concurrency changed';
  END IF;

  UPDATE rack_workspace_evaluation_limits
  SET reserved_microusd = reserved_microusd + p_accepted_maximum_retry_microusd,
      updated_at = now()
  WHERE workspace_id = p_workspace_id;

  INSERT INTO rack_managed_runs (
    id, workspace_id, user_id, kind, rack_fingerprint, profile_id, target, status
  ) VALUES (
    p_run_id, p_workspace_id, (SELECT auth.user_id()), 'model-evaluation',
    p_rack_fingerprint, p_profile_id, p_target, 'running'
  );

  INSERT INTO rack_model_evaluation_runs (
    run_id, workspace_id, idempotency_key, mode,
    generator_alias, provider_id, model_id,
    accepted_maximum_retry_microusd, estimated_cost_microusd,
    status, transient_expires_at
  ) VALUES (
    p_run_id, p_workspace_id, p_idempotency_key, 'quick',
    p_generator_alias, p_provider_id, p_model_id,
    p_accepted_maximum_retry_microusd, p_estimated_cost_microusd,
    'running', p_expires_at
  );

  INSERT INTO rack_managed_payloads (
    run_id, workspace_id, request_body, expires_at
  ) VALUES (
    p_run_id,
    p_workspace_id,
    jsonb_build_object(
      'instructions', p_instructions,
      'casePrompt', p_case_prompt,
      'rubric', p_rubric
    ),
    p_expires_at
  );

  INSERT INTO rack_provider_calls (
    run_id, call_key, workspace_id, generator_alias, provider_id, model_id, status
  ) VALUES (
    p_run_id, 'candidate-0', p_workspace_id,
    p_generator_alias, p_provider_id, p_model_id, 'claimed'
  );

  RETURN QUERY SELECT p_run_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION rack_record_quick_candidate_for_judge(
  p_run_id uuid,
  p_response_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_microusd bigint,
  p_cost_basis text,
  p_output text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
  changed integer;
BEGIN
  IF p_cost_basis NOT IN ('provider-usage', 'planned-allowance') THEN
    RAISE EXCEPTION 'rack-eval: invalid candidate cost basis';
  END IF;
  IF p_cost_microusd < 0 THEN
    RAISE EXCEPTION 'rack-eval: invalid candidate cost';
  END IF;

  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rack-eval: run not found';
  END IF;
  IF evaluation_row.status <> 'running' THEN
    RETURN;
  END IF;
  IF p_cost_microusd > evaluation_row.accepted_maximum_retry_microusd THEN
    RAISE EXCEPTION 'rack-eval: candidate exceeds reservation';
  END IF;

  UPDATE rack_provider_calls
  SET status = 'completed',
      response_id = p_response_id,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_microusd = p_cost_microusd,
      cost_basis = p_cost_basis,
      completed_at = now()
  WHERE run_id = p_run_id
    AND call_key = 'candidate-0'
    AND status = 'claimed';
  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed <> 1 THEN
    RAISE EXCEPTION 'rack-eval: candidate call is not claimable';
  END IF;

  UPDATE rack_managed_payloads
  SET response_body = coalesce(response_body, '{}'::jsonb)
    || jsonb_build_object('output', p_output)
  WHERE run_id = p_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION rack_claim_quick_judge(
  p_run_id uuid,
  p_judge_alias text,
  p_provider_id text,
  p_model_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
  candidate_status text;
  inserted integer;
BEGIN
  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rack-eval: run not found';
  END IF;
  IF evaluation_row.status <> 'running' THEN
    RETURN false;
  END IF;

  SELECT status INTO candidate_status
  FROM rack_provider_calls
  WHERE run_id = p_run_id AND call_key = 'candidate-0';

  IF candidate_status <> 'completed' THEN
    RAISE EXCEPTION 'rack-eval: candidate is not complete';
  END IF;

  INSERT INTO rack_provider_calls (
    run_id, call_key, workspace_id, generator_alias, provider_id, model_id, status
  ) VALUES (
    p_run_id, 'judge-0', evaluation_row.workspace_id,
    p_judge_alias, p_provider_id, p_model_id, 'claimed'
  )
  ON CONFLICT (run_id, call_key) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  RETURN inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION rack_settle_quick_judgement(
  p_run_id uuid,
  p_call_status text,
  p_response_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_microusd bigint,
  p_cost_basis text,
  p_judge_output text,
  p_judgement_json jsonb,
  p_execution_status text,
  p_behavioural_verdict boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
  limits_row rack_workspace_evaluation_limits%ROWTYPE;
  candidate_cost bigint;
  total_cost bigint;
  changed integer;
BEGIN
  IF p_call_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'rack-eval: invalid judge provider status';
  END IF;
  IF p_cost_basis NOT IN ('provider-usage', 'planned-allowance', 'failed-conservative') THEN
    RAISE EXCEPTION 'rack-eval: invalid judge cost basis';
  END IF;
  IF p_execution_status NOT IN ('completed', 'incomplete') THEN
    RAISE EXCEPTION 'rack-eval: invalid execution status';
  END IF;
  IF p_cost_microusd < 0 THEN
    RAISE EXCEPTION 'rack-eval: invalid judge cost';
  END IF;
  IF p_execution_status = 'completed' AND (
    p_call_status <> 'completed'
    OR p_behavioural_verdict IS NULL
    OR p_judgement_json IS NULL
  ) THEN
    RAISE EXCEPTION 'rack-eval: completed judgement requires a parsed verdict';
  END IF;
  IF p_execution_status = 'incomplete' AND p_behavioural_verdict IS NOT NULL THEN
    RAISE EXCEPTION 'rack-eval: incomplete judgement cannot have a behavioural verdict';
  END IF;

  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rack-eval: run not found';
  END IF;
  IF evaluation_row.status <> 'running' THEN
    RETURN;
  END IF;

  SELECT cost_microusd INTO candidate_cost
  FROM rack_provider_calls
  WHERE run_id = p_run_id
    AND call_key = 'candidate-0'
    AND status = 'completed';

  IF candidate_cost IS NULL THEN
    RAISE EXCEPTION 'rack-eval: candidate cost is unavailable';
  END IF;

  total_cost := candidate_cost + p_cost_microusd;
  IF total_cost > evaluation_row.accepted_maximum_retry_microusd THEN
    RAISE EXCEPTION 'rack-eval: judgement exceeds reservation';
  END IF;

  SELECT * INTO limits_row
  FROM rack_workspace_evaluation_limits
  WHERE workspace_id = evaluation_row.workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rack-eval: limits missing during judgement settlement';
  END IF;

  UPDATE rack_provider_calls
  SET status = p_call_status,
      response_id = p_response_id,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_microusd = p_cost_microusd,
      cost_basis = p_cost_basis,
      completed_at = now()
  WHERE run_id = p_run_id
    AND call_key = 'judge-0'
    AND status = 'claimed';
  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed <> 1 THEN
    RAISE EXCEPTION 'rack-eval: judge call is not claimable';
  END IF;

  UPDATE rack_workspace_evaluation_limits
  SET reserved_microusd = greatest(
        0,
        reserved_microusd - evaluation_row.accepted_maximum_retry_microusd
      ),
      spent_microusd = spent_microusd + total_cost,
      updated_at = now()
  WHERE workspace_id = evaluation_row.workspace_id;

  UPDATE rack_model_evaluation_runs
  SET settled_cost_microusd = total_cost,
      status = p_execution_status,
      behavioural_verdict = CASE
        WHEN p_execution_status = 'completed' THEN p_behavioural_verdict
        ELSE NULL
      END,
      completed_at = now()
  WHERE run_id = p_run_id;

  UPDATE rack_managed_runs
  SET status = CASE WHEN p_execution_status = 'completed' THEN 'completed' ELSE 'failed' END,
      completed_at = now()
  WHERE id = p_run_id;

  UPDATE rack_managed_payloads
  SET response_body = coalesce(response_body, '{}'::jsonb)
    || jsonb_build_object(
      'judgeOutput', p_judge_output,
      'judgement', p_judgement_json
    )
  WHERE run_id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION rack_reserve_quick_rubric_evaluation(
  uuid, uuid, uuid, text, text, text, text, text, text,
  bigint, bigint, text, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_reserve_quick_rubric_evaluation(
  uuid, uuid, uuid, text, text, text, text, text, text,
  bigint, bigint, text, text, text, timestamptz
) TO authenticated;

REVOKE ALL ON FUNCTION rack_record_quick_candidate_for_judge(
  uuid, text, integer, integer, bigint, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_record_quick_candidate_for_judge(
  uuid, text, integer, integer, bigint, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION rack_claim_quick_judge(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_claim_quick_judge(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION rack_settle_quick_judgement(
  uuid, text, text, integer, integer, bigint, text, text, jsonb, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_settle_quick_judgement(
  uuid, text, text, integer, integer, bigint, text, text, jsonb, text, boolean
) TO authenticated;
