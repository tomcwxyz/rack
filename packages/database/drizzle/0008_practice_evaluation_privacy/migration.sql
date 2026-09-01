-- ADR 024: managed evaluation may authenticate a person without making that
-- person the durable subject of evaluation.
--
-- The initiating user id is needed while an authenticated request is created,
-- but durable evaluation state is about the Rack practice/work item. After the
-- maximum transient-content window the initiator link is removed.

ALTER TABLE rack_managed_runs
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN rack_managed_runs.user_id IS
  'Transient initiator identity for authenticated managed work. Scrubbed after 24 hours; not an evaluation subject or reporting dimension.';

DROP POLICY IF EXISTS rack_runs_workspace_owner ON rack_managed_runs;

CREATE POLICY rack_runs_workspace_owner ON rack_managed_runs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (
    (user_id IS NULL OR user_id = (SELECT auth.user_id()))
    AND EXISTS (
      SELECT 1 FROM rack_workspaces workspace
      WHERE workspace.id = workspace_id
        AND workspace.owner_user_id = (SELECT auth.user_id())
    )
  );

GRANT SELECT (user_id, created_at) ON rack_managed_runs TO rack_retention;
GRANT UPDATE (user_id) ON rack_managed_runs TO rack_retention;

CREATE POLICY rack_runs_retention_read ON rack_managed_runs
  FOR SELECT TO rack_retention
  USING (
    user_id IS NOT NULL
    AND created_at <= now() - interval '24 hours'
  );

CREATE POLICY rack_runs_retention_anonymise ON rack_managed_runs
  FOR UPDATE TO rack_retention
  USING (
    user_id IS NOT NULL
    AND created_at <= now() - interval '24 hours'
  )
  WITH CHECK (user_id IS NULL);
