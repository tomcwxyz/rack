-- Reliable model-backed evaluation: five candidate runs, five no-Rack baselines,
-- recorded judging and regression gating. Detailed prompt/output/judgement content
-- remains in the existing transient payload table; durable rows retain only
-- identities, aggregate scores, verdicts and accounting metadata.

ALTER TABLE rack_model_evaluation_runs
  DROP CONSTRAINT IF EXISTS rack_model_eval_quick_only;
ALTER TABLE rack_model_evaluation_runs
  ADD CONSTRAINT rack_model_eval_mode CHECK (mode IN ('quick', 'reliable'));

ALTER TABLE rack_model_evaluation_runs
  DROP CONSTRAINT IF EXISTS rack_model_eval_status;
ALTER TABLE rack_model_evaluation_runs
  ADD CONSTRAINT rack_model_eval_status CHECK (status IN ('queued', 'running', 'completed', 'incomplete'));

ALTER TABLE rack_model_evaluation_runs
  ADD COLUMN judge_alias text,
  ADD COLUMN judge_provider_id text,
  ADD COLUMN judge_model_id text,
  ADD COLUMN judge_independent boolean,
  ADD COLUMN behavioural_score integer,
  ADD COLUMN baseline_score integer,
  ADD COLUMN previous_accepted_score integer,
  ADD COLUMN candidate_pass_rate integer,
  ADD COLUMN baseline_pass_rate integer,
  ADD COLUMN regression_passed boolean;

ALTER TABLE rack_model_evaluation_runs
  ADD CONSTRAINT rack_model_eval_score_ranges CHECK (
    (behavioural_score IS NULL OR behavioural_score BETWEEN 0 AND 100)
    AND (baseline_score IS NULL OR baseline_score BETWEEN 0 AND 100)
    AND (previous_accepted_score IS NULL OR previous_accepted_score BETWEEN 0 AND 100)
    AND (candidate_pass_rate IS NULL OR candidate_pass_rate BETWEEN 0 AND 100)
    AND (baseline_pass_rate IS NULL OR baseline_pass_rate BETWEEN 0 AND 100)
  );

CREATE POLICY rack_runs_model_eval_workflow ON rack_managed_runs
  FOR ALL TO rack_workflow
  USING (
    id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND kind = 'model-evaluation'
  )
  WITH CHECK (
    id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND kind = 'model-evaluation'
  );

CREATE POLICY rack_model_eval_workflow ON rack_model_evaluation_runs
  FOR ALL TO rack_workflow
  USING (run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid)
  WITH CHECK (run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid);

CREATE POLICY rack_provider_calls_workflow ON rack_provider_calls
  FOR ALL TO rack_workflow
  USING (run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid)
  WITH CHECK (run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid);

CREATE POLICY rack_payload_model_eval_workflow_update ON rack_managed_payloads
  FOR UPDATE TO rack_workflow
  USING (
    run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND expires_at > now()
  )
  WITH CHECK (
    run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND expires_at > now()
  );

CREATE POLICY rack_eval_limits_workflow ON rack_workspace_evaluation_limits
  FOR SELECT TO rack_workflow
  USING (EXISTS (
    SELECT 1 FROM rack_model_evaluation_runs evaluation
    WHERE evaluation.run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
      AND evaluation.workspace_id = rack_workspace_evaluation_limits.workspace_id
  ));
CREATE POLICY rack_eval_limits_workflow_update ON rack_workspace_evaluation_limits
  FOR UPDATE TO rack_workflow
  USING (EXISTS (
    SELECT 1 FROM rack_model_evaluation_runs evaluation
    WHERE evaluation.run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
      AND evaluation.workspace_id = rack_workspace_evaluation_limits.workspace_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rack_model_evaluation_runs evaluation
    WHERE evaluation.run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
      AND evaluation.workspace_id = rack_workspace_evaluation_limits.workspace_id
  ));

GRANT SELECT (id, workspace_id, kind, rack_fingerprint, profile_id, target, status, created_at, completed_at)
  ON rack_managed_runs TO rack_workflow;
GRANT UPDATE (status, completed_at) ON rack_managed_runs TO rack_workflow;
GRANT SELECT, UPDATE ON rack_model_evaluation_runs TO rack_workflow;
GRANT SELECT, INSERT, UPDATE ON rack_provider_calls TO rack_workflow;
GRANT SELECT (run_id, workspace_id, request_body, response_body, expires_at)
  ON rack_managed_payloads TO rack_workflow;
GRANT UPDATE (response_body) ON rack_managed_payloads TO rack_workflow;
GRANT SELECT, UPDATE (reserved_microusd, spent_microusd, updated_at)
  ON rack_workspace_evaluation_limits TO rack_workflow;

CREATE OR REPLACE FUNCTION rack_reserve_reliable_evaluation(
  p_workspace_id uuid,
  p_run_id uuid,
  p_idempotency_key uuid,
  p_rack_fingerprint text,
  p_profile_id text,
  p_target text,
  p_generator_alias text,
  p_generator_provider_id text,
  p_generator_model_id text,
  p_judge_alias text,
  p_judge_provider_id text,
  p_judge_model_id text,
  p_judge_independent boolean,
  p_accepted_maximum_retry_microusd bigint,
  p_estimated_cost_microusd bigint,
  p_confirmation jsonb,
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

  IF NOT FOUND THEN RAISE EXCEPTION 'rack-eval: limits missing'; END IF;

  SELECT run_id INTO existing_run
  FROM rack_model_evaluation_runs
  WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;
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
    p_rack_fingerprint, p_profile_id, p_target, 'queued'
  );

  INSERT INTO rack_model_evaluation_runs (
    run_id, workspace_id, idempotency_key, mode,
    generator_alias, provider_id, model_id,
    judge_alias, judge_provider_id, judge_model_id, judge_independent,
    accepted_maximum_retry_microusd, estimated_cost_microusd,
    status, transient_expires_at
  ) VALUES (
    p_run_id, p_workspace_id, p_idempotency_key, 'reliable',
    p_generator_alias, p_generator_provider_id, p_generator_model_id,
    p_judge_alias, p_judge_provider_id, p_judge_model_id, p_judge_independent,
    p_accepted_maximum_retry_microusd, p_estimated_cost_microusd,
    'queued', p_expires_at
  );

  INSERT INTO rack_managed_payloads (
    run_id, workspace_id, request_body, response_body, expires_at
  ) VALUES (
    p_run_id, p_workspace_id, p_confirmation, '{}'::jsonb, p_expires_at
  );

  RETURN QUERY SELECT p_run_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION rack_fail_reliable_before_start(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
BEGIN
  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id AND mode = 'reliable'
  FOR UPDATE;
  IF NOT FOUND OR evaluation_row.status <> 'queued' THEN RETURN; END IF;

  UPDATE rack_workspace_evaluation_limits
  SET reserved_microusd = greatest(0, reserved_microusd - evaluation_row.accepted_maximum_retry_microusd),
      updated_at = now()
  WHERE workspace_id = evaluation_row.workspace_id;

  UPDATE rack_model_evaluation_runs
  SET status = 'incomplete', completed_at = now()
  WHERE run_id = p_run_id;
  UPDATE rack_managed_runs
  SET status = 'failed', completed_at = now()
  WHERE id = p_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION rack_claim_reliable_provider_call(
  p_run_id uuid,
  p_call_key text,
  p_alias text,
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
  inserted integer;
BEGIN
  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id AND mode = 'reliable'
  FOR UPDATE;
  IF NOT FOUND OR evaluation_row.status <> 'running' THEN RETURN false; END IF;

  INSERT INTO rack_provider_calls (
    run_id, call_key, workspace_id, generator_alias, provider_id, model_id, status
  ) VALUES (
    p_run_id, p_call_key, evaluation_row.workspace_id,
    p_alias, p_provider_id, p_model_id, 'claimed'
  )
  ON CONFLICT (run_id, call_key) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted = 1;
END;
$$;

CREATE OR REPLACE FUNCTION rack_settle_reliable_provider_call(
  p_run_id uuid,
  p_call_key text,
  p_status text,
  p_response_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_microusd bigint,
  p_cost_basis text,
  p_output text,
  p_judgement jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
  already_settled bigint;
  changed integer;
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN RAISE EXCEPTION 'rack-eval: invalid provider status'; END IF;
  IF p_cost_basis NOT IN ('provider-usage', 'planned-allowance', 'failed-conservative') THEN
    RAISE EXCEPTION 'rack-eval: invalid cost basis';
  END IF;
  IF p_cost_microusd < 0 THEN RAISE EXCEPTION 'rack-eval: invalid provider cost'; END IF;

  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id AND mode = 'reliable'
  FOR UPDATE;
  IF NOT FOUND OR evaluation_row.status <> 'running' THEN RETURN; END IF;

  SELECT coalesce(sum(cost_microusd), 0) INTO already_settled
  FROM rack_provider_calls
  WHERE run_id = p_run_id AND status IN ('completed', 'failed');
  IF already_settled + p_cost_microusd > evaluation_row.accepted_maximum_retry_microusd THEN
    RAISE EXCEPTION 'rack-eval: settlement exceeds reservation';
  END IF;

  UPDATE rack_provider_calls
  SET status = p_status,
      response_id = p_response_id,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_microusd = p_cost_microusd,
      cost_basis = p_cost_basis,
      completed_at = now()
  WHERE run_id = p_run_id AND call_key = p_call_key AND status = 'claimed';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'rack-eval: provider call is not claimable'; END IF;

  UPDATE rack_managed_payloads
  SET response_body = coalesce(response_body, '{}'::jsonb)
    || jsonb_build_object(
      p_call_key,
      jsonb_build_object('output', p_output, 'judgement', p_judgement)
    )
  WHERE run_id = p_run_id;
END;
$$;

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

  SELECT prior.behavioural_score INTO previous_score
  FROM rack_model_evaluation_runs prior
  JOIN rack_managed_runs prior_run ON prior_run.id = prior.run_id
  JOIN rack_managed_runs current_run ON current_run.id = p_run_id
  WHERE prior.workspace_id = evaluation_row.workspace_id
    AND prior.mode = 'reliable'
    AND prior.status = 'completed'
    AND prior.behavioural_verdict = true
    AND prior.behavioural_score IS NOT NULL
    AND prior.run_id <> p_run_id
    AND prior_run.profile_id = current_run.profile_id
    AND prior_run.target = current_run.target
  ORDER BY prior.completed_at DESC
  LIMIT 1;

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

CREATE OR REPLACE FUNCTION rack_incomplete_reliable_evaluation(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  evaluation_row rack_model_evaluation_runs%ROWTYPE;
  settled bigint;
  remaining bigint;
BEGIN
  SELECT * INTO evaluation_row
  FROM rack_model_evaluation_runs
  WHERE run_id = p_run_id AND mode = 'reliable'
  FOR UPDATE;
  IF NOT FOUND OR evaluation_row.status NOT IN ('queued', 'running') THEN RETURN; END IF;

  SELECT coalesce(sum(cost_microusd), 0) INTO settled
  FROM rack_provider_calls
  WHERE run_id = p_run_id AND status IN ('completed', 'failed');

  IF EXISTS (SELECT 1 FROM rack_provider_calls WHERE run_id = p_run_id AND status = 'claimed') THEN
    remaining := greatest(0, evaluation_row.accepted_maximum_retry_microusd - settled);
    UPDATE rack_provider_calls
    SET status = 'failed', cost_microusd = remaining,
        cost_basis = 'failed-conservative', completed_at = now()
    WHERE run_id = p_run_id AND status = 'claimed';
    settled := evaluation_row.accepted_maximum_retry_microusd;
  END IF;

  UPDATE rack_workspace_evaluation_limits
  SET reserved_microusd = greatest(0, reserved_microusd - evaluation_row.accepted_maximum_retry_microusd),
      spent_microusd = spent_microusd + settled,
      updated_at = now()
  WHERE workspace_id = evaluation_row.workspace_id;

  UPDATE rack_model_evaluation_runs
  SET settled_cost_microusd = settled,
      status = 'incomplete', behavioural_verdict = NULL, completed_at = now()
  WHERE run_id = p_run_id;
  UPDATE rack_managed_runs
  SET status = 'failed', completed_at = now()
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION rack_reserve_reliable_evaluation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text,
  boolean, bigint, bigint, jsonb, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_reserve_reliable_evaluation(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, text,
  boolean, bigint, bigint, jsonb, timestamptz
) TO authenticated;

REVOKE ALL ON FUNCTION rack_fail_reliable_before_start(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_fail_reliable_before_start(uuid) TO authenticated;

REVOKE ALL ON FUNCTION rack_claim_reliable_provider_call(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_claim_reliable_provider_call(uuid, text, text, text, text) TO rack_workflow;

REVOKE ALL ON FUNCTION rack_settle_reliable_provider_call(
  uuid, text, text, text, integer, integer, bigint, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_settle_reliable_provider_call(
  uuid, text, text, text, integer, integer, bigint, text, text, jsonb
) TO rack_workflow;

REVOKE ALL ON FUNCTION rack_complete_reliable_evaluation(uuid, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_complete_reliable_evaluation(uuid, integer, integer, integer, integer) TO rack_workflow;

REVOKE ALL ON FUNCTION rack_incomplete_reliable_evaluation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_incomplete_reliable_evaluation(uuid) TO rack_workflow;
