import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationUrl = new URL("../drizzle/0001_managed_service/migration.sql", import.meta.url);

describe("managed database boundary", () => {
  it("keeps the 24-hour retention limit and row policies in the migration", async () => {
    const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
    expect(sql).toContain("interval '24 hours'");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("auth.user_id()");
    expect(sql).toContain("rack_retention");
    expect(sql).not.toContain("BYPASSRLS");
  });
});
