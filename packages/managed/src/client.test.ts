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
});
