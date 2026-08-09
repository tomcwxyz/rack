-- Reliable-check workflow role and tightened personal membership boundary.
-- Apply as the migration owner; deployed workflow execution uses a separate login role.

DO $$
BEGIN
  CREATE ROLE rack_workflow NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS rack_memberships_self ON rack_workspace_memberships;
CREATE POLICY rack_memberships_self ON rack_workspace_memberships
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.user_id())
    AND EXISTS (
      SELECT 1 FROM rack_workspaces workspace
      WHERE workspace.id = rack_workspace_memberships.workspace_id
        AND workspace.owner_user_id = (SELECT auth.user_id())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND EXISTS (
      SELECT 1 FROM rack_workspaces workspace
      WHERE workspace.id = rack_workspace_memberships.workspace_id
        AND workspace.owner_user_id = (SELECT auth.user_id())
    )
  );

CREATE POLICY rack_runs_reliable_workflow ON rack_managed_runs
  FOR ALL TO rack_workflow
  USING (
    id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND kind = 'reliable-check'
  )
  WITH CHECK (
    id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND kind = 'reliable-check'
  );

CREATE POLICY rack_payload_reliable_workflow_read ON rack_managed_payloads
  FOR SELECT TO rack_workflow
  USING (
    run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND expires_at > now()
  );

CREATE POLICY rack_summary_reliable_workflow ON rack_evaluation_summaries
  FOR ALL TO rack_workflow
  USING (run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid)
  WITH CHECK (
    run_id = nullif(current_setting('rack.workflow_run_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM rack_managed_runs run
      WHERE run.id = rack_evaluation_summaries.run_id
        AND run.workspace_id = rack_evaluation_summaries.workspace_id
        AND run.kind = 'reliable-check'
    )
  );

GRANT USAGE ON SCHEMA public TO rack_workflow;
GRANT SELECT (id, workspace_id, kind, status) ON rack_managed_runs TO rack_workflow;
GRANT UPDATE (status, completed_at) ON rack_managed_runs TO rack_workflow;
GRANT SELECT (run_id, request_body, expires_at) ON rack_managed_payloads TO rack_workflow;
GRANT SELECT, INSERT ON rack_evaluation_summaries TO rack_workflow;
