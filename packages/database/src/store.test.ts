import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const foundationMigration = new URL(
  "../drizzle/0001_managed_service/migration.sql",
  import.meta.url,
);
const reliableMigration = new URL(
  "../drizzle/0002_reliable_checks/migration.sql",
  import.meta.url,
);
const evaluationLimitsMigration = new URL(
  "../drizzle/0003_evaluation_limits/migration.sql",
  import.meta.url,
);
const practiceEvaluationPrivacyMigration = new URL(
  "../drizzle/0008_practice_evaluation_privacy/migration.sql",
  import.meta.url,
);

describe("managed database boundary", () => {
  it("keeps the 24-hour retention limit and row policies in the foundation migration", async () => {
    const sql = await readFile(fileURLToPath(foundationMigration), "utf8");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("auth.user_id()");
    expect(sql).toContain("rack_retention");
    expect(sql).not.toContain("BYPASSRLS");
  });

  it("scopes workflow access to one run and does not grant payload writes", async () => {
    const sql = await readFile(fileURLToPath(reliableMigration), "utf8");
    expect(sql).toContain("rack_workspace_memberships.workspace_id");
    expect(sql).toContain("workspace.owner_user_id = (SELECT auth.user_id())");
    expect(sql).toContain("CREATE ROLE rack_workflow NOLOGIN");
    expect(sql).toContain("current_setting('rack.workflow_run_id', true)");
    expect(sql).toContain(
      "GRANT SELECT (run_id, request_body, expires_at) ON rack_managed_payloads TO rack_workflow",
    );
    expect(sql).not.toContain("GRANT INSERT ON rack_managed_payloads TO rack_workflow");
    expect(sql).not.toContain("BYPASSRLS");
  });

  it("keeps evaluation budgets as owner-scoped metadata without provider execution", async () => {
    const sql = await readFile(fileURLToPath(evaluationLimitsMigration), "utf8");
    expect(sql).toContain("rack_workspace_evaluation_limits");
    expect(sql).toContain("hard_budget_microusd");
    expect(sql).toContain("reserved_microusd");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("workspace.owner_user_id = (SELECT auth.user_id())");
    expect(sql).not.toContain("rack_workflow");
    expect(sql).not.toContain("provider_call");
  });

  it("scrubs initiator identity after the transient evaluation window", async () => {
    const sql = await readFile(
      fileURLToPath(practiceEvaluationPrivacyMigration),
      "utf8",
    );
    expect(sql).toContain("ALTER COLUMN user_id DROP NOT NULL");
    expect(sql).toContain("user_id IS NULL");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("rack_runs_retention_anonymise");
    expect(sql).toContain("UPDATE (user_id)");
    expect(sql).not.toContain("BYPASSRLS");
  });
});
