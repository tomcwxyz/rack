-- Rack managed-service foundation.
-- Run with the migration/owner connection. Application traffic must use a non-owner role.

DO $$
BEGIN
  CREATE ROLE rack_retention NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE rack_workspaces (
  id uuid PRIMARY KEY,
  kind text NOT NULL DEFAULT 'personal',
  owner_user_id text NOT NULL,
  name text NOT NULL DEFAULT 'My Rack',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rack_workspaces_personal_only CHECK (kind = 'personal')
);
CREATE UNIQUE INDEX rack_workspaces_owner_unique ON rack_workspaces(owner_user_id);

CREATE TABLE rack_workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT rack_membership_v01_owner_only CHECK (role = 'owner')
);

CREATE TABLE rack_managed_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  kind text NOT NULL,
  rack_fingerprint text NOT NULL,
  profile_id text NOT NULL,
  target text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE rack_managed_payloads (
  run_id uuid PRIMARY KEY REFERENCES rack_managed_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  request_body jsonb NOT NULL,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT rack_payload_max_24h CHECK (expires_at <= created_at + interval '24 hours')
);
CREATE INDEX rack_managed_payloads_expiry_idx ON rack_managed_payloads(expires_at);

CREATE TABLE rack_evaluation_summaries (
  run_id uuid PRIMARY KEY REFERENCES rack_managed_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES rack_workspaces(id) ON DELETE CASCADE,
  schema_version text NOT NULL,
  rack_fingerprint text NOT NULL,
  profile_id text NOT NULL,
  target text NOT NULL,
  passed boolean NOT NULL,
  score integer NOT NULL,
  estimated_instruction_tokens integer NOT NULL,
  errors integer NOT NULL,
  warnings integer NOT NULL,
  information integer NOT NULL,
  findings jsonb NOT NULL,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rack_summary_score_range CHECK (score BETWEEN 0 AND 100)
);

ALTER TABLE rack_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_managed_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_managed_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_evaluation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY rack_workspaces_owner ON rack_workspaces
  FOR ALL TO authenticated
  USING (owner_user_id = (SELECT auth.user_id()))
  WITH CHECK (owner_user_id = (SELECT auth.user_id()));

CREATE POLICY rack_memberships_self ON rack_workspace_memberships
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.user_id()))
  WITH CHECK (user_id = (SELECT auth.user_id()));

CREATE POLICY rack_runs_workspace_owner ON rack_managed_runs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (
    user_id = (SELECT auth.user_id())
    AND EXISTS (
      SELECT 1 FROM rack_workspaces workspace
      WHERE workspace.id = workspace_id
        AND workspace.owner_user_id = (SELECT auth.user_id())
    )
  );

CREATE POLICY rack_payload_workspace_owner ON rack_managed_payloads
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ));

CREATE POLICY rack_summary_workspace_owner ON rack_evaluation_summaries
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rack_workspaces workspace
    WHERE workspace.id = workspace_id
      AND workspace.owner_user_id = (SELECT auth.user_id())
  ));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rack_workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rack_workspace_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rack_managed_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rack_managed_payloads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rack_evaluation_summaries TO authenticated;

GRANT USAGE ON SCHEMA public TO rack_retention;
GRANT SELECT (expires_at), DELETE ON rack_managed_payloads TO rack_retention;
CREATE POLICY rack_payload_retention_delete ON rack_managed_payloads
  FOR DELETE TO rack_retention
  USING (expires_at <= now());
