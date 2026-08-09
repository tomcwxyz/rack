import { describe, expect, it, vi } from "vitest";
import { createManagedServiceClient } from "./client.js";

const request = {
  schemaVersion: "0.1" as const,
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt" as const,
  instructions: "Write clearly.",
};

describe("managed client", () => {
  it("does not make a request without an access token", async () => {
    const fetch = vi.fn();
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test",
      getAccessToken: async () => null,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await expect(client.quickCheck(request)).rejects.toThrow("Sign in");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts and polls a reliable check without changing the local request contract", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            runId: "00000000-0000-4000-8000-000000000001",
            workflowRunId: "wrun_test",
            status: "queued",
            transientContentExpiresAt: "2026-08-10T05:00:00.000Z",
          },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          runId: "00000000-0000-4000-8000-000000000001",
          status: "running",
          summary: null,
        }),
      );
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test/",
      getAccessToken: async () => "token",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    const started = await client.startReliableCheck(request);
    const status = await client.getReliableCheckStatus(started.runId);

    expect(started.workflowRunId).toBe("wrun_test");
    expect(status.status).toBe("running");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://managed.rack.test/api/check/reliable",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://managed.rack.test/api/check/reliable/00000000-0000-4000-8000-000000000001",
      expect.any(Object),
    );
  });
});
