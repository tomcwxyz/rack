import { describe, expect, it, vi } from "vitest";
import { createTopoCliContextTransport } from "./oosNode.js";

const packet = {
  specversion: "0.1-draft",
  id: "ctx-1",
  subject: "project:rack",
  purpose: "review implementation",
  requested_by: "rack",
  objects: [],
  evidence_refs: [],
  scope: "private",
  generated_at: "2026-08-31T09:00:00Z",
  expires_at: null,
  permissions: ["local-use-only"],
  provenance: {
    source_type: "application",
    source_id: "topo:context:ctx-1",
    created_by: { type: "system", id: "topo" },
    method: "generated",
    assertion_type: "interpretation",
    confidence: "high",
    created_at: "2026-08-31T09:00:00Z",
    derived_from: [],
    extensions: {},
  },
  extensions: {},
};

describe("TOPO CLI OOS transport", () => {
  it("invokes the TOPO protocol command without a shell", async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: JSON.stringify(packet),
      stderr: "",
    });

    const transport = createTopoCliContextTransport({
      command: "/opt/topo/bin/topo",
      storePath: "/tmp/topo.sqlite",
      execute,
    });

    const result = await transport.requestContext({
      subject: "project:rack",
      purpose: "review implementation",
      requestedBy: "rack",
      wanted: { maxItems: 12 },
    });

    expect(execute).toHaveBeenCalledWith(
      "/opt/topo/bin/topo",
      [
        "--store",
        "/tmp/topo.sqlite",
        "oos",
        "context",
        "--subject",
        "project:rack",
        "--purpose",
        "review implementation",
        "--requester",
        "rack",
        "--max-items",
        "12",
      ],
      expect.objectContaining({
        timeout: 10_000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      }),
    );
    expect(result).toEqual(packet);
  });

  it("does not silently discard an unsupported free-text query", async () => {
    const execute = vi.fn();
    const transport = createTopoCliContextTransport({ execute });

    await expect(
      transport.requestContext({
        subject: "project:rack",
        purpose: "review implementation",
        requestedBy: "rack",
        wanted: { query: "latest CRM context" },
      }),
    ).rejects.toThrow(/does not support free-text/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects non-JSON command output", async () => {
    const transport = createTopoCliContextTransport({
      execute: vi.fn().mockResolvedValue({
        stdout: "not-json",
        stderr: "",
      }),
    });

    await expect(
      transport.requestContext({
        subject: "project:rack",
        purpose: "review implementation",
        requestedBy: "rack",
      }),
    ).rejects.toThrow(/valid JSON/);
  });
});
