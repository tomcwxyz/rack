import { describe, expect, it, vi } from "vitest";
import {
  createOosContextSource,
  parseOosContextPacket,
  rackOosManifest,
} from "./contextSources.js";

const packet = {
  specversion: "0.1-draft",
  id: "ctx-1",
  subject: "project:rack",
  purpose: "review implementation",
  requested_by: "rack",
  objects: [
    {
      type: "topo.memory_claim",
      id: "claim-1",
      value: {
        key: "writing.locale",
        value: "en-GB",
        confidence: 1,
      },
    },
  ],
  evidence_refs: ["source-1"],
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
    derived_from: ["claim-1"],
    extensions: {},
  },
  extensions: {},
};

describe("Organisational OS context source", () => {
  it("advertises only the OOS capability RACK currently implements", () => {
    expect(rackOosManifest.queries).toEqual(["context"]);
    expect(rackOosManifest.provides).toEqual([]);
    expect(rackOosManifest.emits).toEqual([]);
    expect(rackOosManifest.actions).toEqual([]);
  });

  it("normalises an OOS Context Packet without turning it into practice", () => {
    const snapshot = parseOosContextPacket(packet, {
      subject: "project:rack",
      purpose: "review implementation",
    });

    expect(snapshot).toMatchObject({
      id: "ctx-1",
      sourceId: "topo",
      subject: "project:rack",
      purpose: "review implementation",
      permissions: ["local-use-only"],
    });
    expect(snapshot.objects[0]).toEqual({
      type: "topo.memory_claim",
      id: "claim-1",
      value: {
        key: "writing.locale",
        value: "en-GB",
        confidence: 1,
      },
    });
  });

  it("requests purpose-bound context through an injected transport", async () => {
    const requestContext = vi.fn().mockResolvedValue(packet);
    const source = createOosContextSource({
      transport: { requestContext },
    });

    const snapshot = await source.resolve({
      subject: "project:rack",
      purpose: "review implementation",
      query: "What context matters for this review?",
      maxItems: 10,
      profileId: "coding",
    });

    expect(requestContext).toHaveBeenCalledWith({
      subject: "project:rack",
      purpose: "review implementation",
      requestedBy: "rack",
      wanted: {
        maxItems: 10,
        query: "What context matters for this review?",
      },
    });
    expect(snapshot.id).toBe("ctx-1");
  });

  it("rejects a packet for a different subject", () => {
    expect(() =>
      parseOosContextPacket(
        { ...packet, subject: "project:other" },
        {
          subject: "project:rack",
          purpose: "review implementation",
        },
      ),
    ).toThrow(/subject mismatch/);
  });

  it("rejects malformed cross-boundary data", () => {
    expect(() =>
      parseOosContextPacket({
        ...packet,
        objects: [{ type: "topo.memory_claim", id: "claim-1", value: "oops" }],
      }),
    ).toThrow(/objects\[0\]\.value/);
  });
});
