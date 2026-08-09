-- Workspace-level paid evaluation limits and accounting state.
-- Preflight reads this metadata only; paid execution/reservation is introduced later.

CREATE TABLE rack_workspace_evaluation_limits (
  workspace_id uuid PRIMARY KEY REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  hard_budget_microusd bigint NOT NULL,
  spent_microusd bigint NOT NULL DEFAULT 0,
  reserved_microusd bigint NOT NULL DEFAULT 0,
  per_run_cap_microusd bigint NOT NULL,
  concurrency_limit integer NOT NULL,
  max_provider_attempts_per_call integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rack_eval_budget_nonnegative CHECK (
    hard_budget_microusd >= 0 AND spent_microusd >= 0 AND reserved_microusd >= 0 AND per_run_cap_microusd >= 0
  ),
  CONSTRAINT rack_eval_concurrency_positive CHECK (concurrency_limit > 0),
  CONSTRAINT rack_eval_attempts_range CHECK (max_provider_attempts_per_call BETWEEN 1 AND 5)
);

ALTER TABLE rack_workspace_evaluation_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY rack_eval_limits_workspace_owner ON rack_workspace_evaluation_limits
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = rack_workspace_evaluation_limits.workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = rack_workspace_evaluation_limits.workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ));

GRANT SELECT, INSERT, UPDATE ON rack_workspace_evaluation_limits TO authenticated;
