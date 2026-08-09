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
});
