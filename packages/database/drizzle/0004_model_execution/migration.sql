-- Confirmed Quick model execution, cost reservation and provider-call accounting.
-- Application traffic uses the authenticated role; functions remain SECURITY INVOKER
-- so existing workspace RLS is always part of the execution boundary.

CREATE TABLE rack_model_evaluation_runs (
  run_id uuid PRIMARY KEY REFERENCES rack_managed_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  mode text NOT NULL DEFAULT 'quick',
  generator_alias text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  accepted_maximum_retry_microusd bigint NOT NULL,
  estimated_cost_microusd bigint NOT NULL,
  settled_cost_microusd bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  behavioural_verdict boolean,
  transient_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT rack_model_eval_quick_only CHECK (mode = 'quick'),
  CONSTRAINT rack_model_eval_cost_nonnegative CHECK (
    accepted_maximum_retry_microusd >= 0
    AND estimated_cost_microusd >= 0
    AND settled_cost_microusd >= 0
  ),
  CONSTRAINT rack_model_eval_status CHECK (status IN ('running', 'completed', 'incomplete'))
);
CREATE UNIQUE INDEX rack_model_eval_idempotency_unique
  ON rack_model_evaluation_runs(workspace_id, idempotency_key);

CREATE TABLE rack_provider_calls (
  run_id uuid NOT NULL REFERENCES rack_managed_runs(id) ON DELETE CASCADE,
  call_key text NOT NULL,
  workspace_id uuid NOT NULL REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  generator_alias text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  response_id text,
  input_tokens integer,
  output_tokens integer,
  cost_microusd bigint NOT NULL DEFAULT 0,
  cost_basis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (run_id, call_key),
  CONSTRAINT rack_provider_call_status CHECK (status IN ('claimed', 'completed', 'failed')),
  CONSTRAINT rack_provider_call_cost_nonnegative CHECK (cost_microusd >= 0),
  CONSTRAINT rack_provider_call_cost_basis CHECK (
    cost_basis IS NULL OR cost_basis IN ('provider-usage', 'planned-allowance', 'failed-conservative')
  )
);

ALTER TABLE rack_model_evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_provider_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY rack_model_eval_workspace_owner ON rack_model_evaluation_runs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = rack_model_evaluation_runs.workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = rack_model_evaluation_runs.workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ));

CREATE POLICY rack_provider_call_workspace_owner ON rack_provider_calls
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = rack_provider_calls.workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = rack_provider_calls.workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ));

GRANT SELECT, INSERT, UPDATE ON rack_model_evaluation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rack_provider_calls TO authenticated;

CREATE OR REPLACE FUNCTION rack_reserve_quick_evaluation(
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
    jsonb_build_object('instructions', p_instructions, 'casePrompt', p_case_prompt),
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

CREATE OR REPLACE FUNCTION rack_settle_quick_evaluation(
  p_run_id uuid,
  p_call_status text,
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
  limits_row rack_workspace_evaluation_limits%ROWTYPE;
  next_status text;
BEGIN
  IF p_call_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'rack-eval: invalid provider status';
  END IF;
  IF p_cost_basis NOT IN ('provider-usage', 'planned-allowance', 'failed-conservative') THEN
    RAISE EXCEPTION 'rack-eval: invalid cost basis';
  END IF;
  IF p_cost_microusd < 0 THEN
    RAISE EXCEPTION 'rack-eval: invalid settlement cost';
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
    RAISE EXCEPTION 'rack-eval: settlement exceeds reservation';
  END IF;

  SELECT * INTO limits_row
  FROM rack_workspace_evaluation_limits
  WHERE workspace_id = evaluation_row.workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rack-eval: limits missing during settlement';
  END IF;

  UPDATE rack_workspace_evaluation_limits
  SET reserved_microusd = greatest(
        0,
        reserved_microusd - evaluation_row.accepted_maximum_retry_microusd
      ),
      spent_microusd = spent_microusd + p_cost_microusd,
      updated_at = now()
  WHERE workspace_id = evaluation_row.workspace_id;

  UPDATE rack_provider_calls
  SET status = p_call_status,
      response_id = p_response_id,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_microusd = p_cost_microusd,
      cost_basis = p_cost_basis,
      completed_at = now()
  WHERE run_id = p_run_id
    AND call_key = 'candidate-0'
    AND status = 'claimed';

  next_status := CASE WHEN p_call_status = 'completed' THEN 'completed' ELSE 'incomplete' END;

  UPDATE rack_model_evaluation_runs
  SET settled_cost_microusd = p_cost_microusd,
      status = next_status,
      behavioural_verdict = NULL,
      completed_at = now()
  WHERE run_id = p_run_id;

  UPDATE rack_managed_runs
  SET status = CASE WHEN p_call_status = 'completed' THEN 'completed' ELSE 'failed' END,
      completed_at = now()
  WHERE id = p_run_id;

  UPDATE rack_managed_payloads
  SET response_body = CASE
        WHEN p_output IS NULL THEN NULL
        ELSE jsonb_build_object('output', p_output)
      END
  WHERE run_id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION rack_reserve_quick_evaluation(
  uuid, uuid, uuid, text, text, text, text, text, text,
  bigint, bigint, text, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_reserve_quick_evaluation(
  uuid, uuid, uuid, text, text, text, text, text, text,
  bigint, bigint, text, text, timestamptz
) TO authenticated;

REVOKE ALL ON FUNCTION rack_settle_quick_evaluation(
  uuid, text, text, integer, integer, bigint, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rack_settle_quick_evaluation(
  uuid, text, text, integer, integer, bigint, text, text
) TO authenticated;
