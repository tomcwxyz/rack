import { describe, expect, it, vi } from "vitest";
import type { DurableEvaluationSummary } from "@rack/managed";
import {
  createReliableCheckStartHandler,
  createReliableCheckStatusHandler,
  type ReliableCheckStartStore,
} from "./reliableCheckHandler.js";

const environment = {
  databaseUrl: "postgresql://example",
  workflowDatabaseUrl: "postgresql://workflow",
  retentionDatabaseUrl: "postgresql://retention",
  neonAuthJwksUrl: "https://example.test/jwks.json",
  cronSecret: "test-secret-that-is-long-enough",
};
const runId = "00000000-0000-4000-8000-000000000001";
const body = {
  schemaVersion: "0.1" as const,
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt" as const,
  instructions: "Private instructions that must not enter the workflow log.",
};

const created = {
  runId,
  workspaceId: "00000000-0000-4000-8000-000000000002",
  status: "queued" as const,
  transientContentExpiresAt: "2026-08-10T05:00:00.000Z",
};

describe("reliable check handlers", () => {
  it("queues only the Rack run ID and returns 202", async () => {
    const markReliableCheckFailed = vi.fn(async () => undefined);
    const store: ReliableCheckStartStore = {
      createReliableCheck: async () => created,
      markReliableCheckFailed,
    };
    const startWorkflow = vi.fn(async () => ({ workflowRunId: "wrun_test" }));
    const handler = createReliableCheckStartHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      storeFor: () => store,
      startWorkflow,
    });

    const response = await handler(
      new Request("https://rack.test/api/check/reliable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(202);
    expect(startWorkflow).toHaveBeenCalledWith(runId);
    expect(JSON.stringify(startWorkflow.mock.calls)).not.toContain(body.instructions);
    expect(JSON.stringify(result)).not.toContain(body.instructions);
    expect(markReliableCheckFailed).not.toHaveBeenCalled();
  });

  it("marks the Rack run failed if Workflow SDK cannot queue it", async () => {
    const markReliableCheckFailed = vi.fn(async () => undefined);
    const store: ReliableCheckStartStore = {
      createReliableCheck: async () => created,
      markReliableCheckFailed,
    };
    const handler = createReliableCheckStartHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      storeFor: () => store,
      startWorkflow: async () => {
        throw new Error("queue unavailable");
      },
    });

    const response = await handler(
      new Request("https://rack.test/api/check/reliable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(500);
    expect(markReliableCheckFailed).toHaveBeenCalledWith(runId);
  });

  it("returns a content-free completed status", async () => {
    const summary: DurableEvaluationSummary = {
      schemaVersion: "0.1",
      rackFingerprint: body.rackFingerprint,
      profileId: body.profileId,
      target: body.target,
      passed: true,
      score: 100,
      estimatedInstructionTokens: 12,
      counts: { errors: 0, warnings: 0, information: 0 },
      findings: [],
      checkedAt: "2026-08-09T05:01:00.000Z",
    };
    const handler = createReliableCheckStatusHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      storeFor: () => ({
        getReliableCheck: async () => ({ runId, status: "completed", summary }),
      }),
    });

    const response = await handler(
      new Request(`https://rack.test/api/check/reliable-status?runId=${runId}`),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.status).toBe("completed");
    expect(JSON.stringify(result)).not.toContain(body.instructions);
  });

  it("does not reveal whether another workspace owns a run", async () => {
    const handler = createReliableCheckStatusHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      storeFor: () => ({ getReliableCheck: async () => null }),
    });
    const response = await handler(
      new Request(`https://rack.test/api/check/reliable-status?runId=${runId}`),
    );
    expect(response.status).toBe(404);
  });
});
