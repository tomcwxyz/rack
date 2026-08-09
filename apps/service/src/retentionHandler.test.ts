import { describe, expect, it, vi } from "vitest";
import { createRetentionHandler } from "./retentionHandler.js";

const environment = {
  databaseUrl: "postgresql://example",
  retentionDatabaseUrl: "postgresql://retention",
  neonAuthJwksUrl: "https://example.test/jwks.json",
  cronSecret: "test-secret-that-is-long-enough",
};

describe("retention handler", () => {
  it("requires Vercel cron authentication", async () => {
    const purge = vi.fn(async () => undefined);
    const handler = createRetentionHandler({ environment, purge });
    const response = await handler(new Request("https://rack.test/api/retention"));
    expect(response.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
  });

  it("uses only the dedicated retention connection", async () => {
    const purge = vi.fn(async () => undefined);
    const handler = createRetentionHandler({ environment, purge });
    const response = await handler(
      new Request("https://rack.test/api/retention", {
        headers: { authorization: `Bearer ${environment.cronSecret}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(purge).toHaveBeenCalledWith(environment.retentionDatabaseUrl);
  });
});
