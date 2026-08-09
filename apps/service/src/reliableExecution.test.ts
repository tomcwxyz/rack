import { describe, expect, it, vi } from "vitest";
import type { ReliableWorkflowStore } from "@rack/database";
import type {
  DurableEvaluationSummary,
  ReliableCheckStatusResponse,
} from "@rack/managed";
import { executeReliableCheck } from "./reliableExecution.js";

const runId = "00000000-0000-4000-8000-000000000001";
const request = {
  schemaVersion: "0.1" as const,
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt" as const,
  instructions: "TODO write clearly without leaking sk-aaaaaaaaaaaaaaaaaaaaaaaa",
};

describe("reliable check execution", () => {
  it("is idempotent after a durable summary is stored", async () => {
    let status: ReliableCheckStatusResponse = { runId, status: "queued", summary: null };
    const loadRequest = vi.fn(async () => request);
    const complete = vi.fn(async (summary: DurableEvaluationSummary) => {
      status = { runId, status: "completed", summary };
      return summary;
    });
    const store: ReliableWorkflowStore = {
      getStatus: async () => status,
      loadRequest,
      markRunning: async () => {
        status = { runId, status: "running", summary: null };
      },
      complete,
      markFailed: async () => undefined,
    };

    const first = await executeReliableCheck(
      store,
      new Date("2026-08-09T05:00:00.000Z"),
    );
    const second = await executeReliableCheck(
      store,
      new Date("2026-08-09T06:00:00.000Z"),
    );

    expect(first).toEqual(second);
    expect(loadRequest).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(first)).not.toContain(request.instructions);
  });

  it("does not reopen a failed run", async () => {
    const loadRequest = vi.fn(async () => request);
    const store: ReliableWorkflowStore = {
      getStatus: async () => ({ runId, status: "failed", summary: null }),
      loadRequest,
      markRunning: async () => undefined,
      complete: async (summary) => summary,
      markFailed: async () => undefined,
    };

    await expect(executeReliableCheck(store)).rejects.toThrow("already failed");
    expect(loadRequest).not.toHaveBeenCalled();
  });
});
