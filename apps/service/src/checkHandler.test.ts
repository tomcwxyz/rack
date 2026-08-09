import { describe, expect, it } from "vitest";
import type { ManagedStore } from "@rack/database";
import { ManagedAuthenticationError } from "./auth.js";
import { createCheckHandler } from "./checkHandler.js";

const environment = {
  databaseUrl: "postgresql://example",
  retentionDatabaseUrl: "postgresql://retention",
  neonAuthJwksUrl: "https://example.test/jwks.json",
  cronSecret: "test-secret-that-is-long-enough",
};

const body = {
  schemaVersion: "0.1",
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt",
  instructions: "Use evidence and write clearly.",
};

describe("managed check handler", () => {
  it("rejects an unauthenticated request", async () => {
    const handler = createCheckHandler({
      environment,
      verifyAuth: async () => {
        throw new ManagedAuthenticationError("A valid sign-in is required.");
      },
    });
    const response = await handler(
      new Request("https://rack.test/api/check", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects content outside the shared service contract", async () => {
    const handler = createCheckHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
    });
    const response = await handler(
      new Request("https://rack.test/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, unexpected: "no" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("persists through the injected store and returns the summary", async () => {
    let persistedRequest: unknown;
    const store: ManagedStore = {
      async saveQuickCheck(request, summary) {
        persistedRequest = request;
        return {
          runId: "00000000-0000-4000-8000-000000000001",
          workspaceId: "00000000-0000-4000-8000-000000000002",
          summary,
          transientContentExpiresAt: "2026-08-10T05:00:00.000Z",
        };
      },
    };
    const handler = createCheckHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      storeFor: () => store,
      now: () => new Date("2026-08-09T05:00:00.000Z"),
    });
    const response = await handler(
      new Request("https://rack.test/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { summary: unknown };
    expect(persistedRequest).toEqual(body);
    expect(JSON.stringify(result.summary)).not.toContain(body.instructions);
  });
});
