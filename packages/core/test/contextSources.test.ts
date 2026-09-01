import { describe, expect, it } from "vitest";
import {
  contextFlowDecision,
  parseOosContextPacket,
  type ContextScope,
} from "../src/contextSources.js";

const packet = (
  scope: ContextScope = "private",
  permissions = ["local-use-only"],
) => ({
  specversion: "0.1-draft",
  id: "packet-1",
  subject: "project:rack",
  purpose: "prepare implementation",
  requested_by: "rack",
  objects: [
    {
      type: "topo.memory_claim",
      id: "claim-1",
      value: {
        key: "writing.locale",
        value: "en-GB",
        sensitivity: "personal",
      },
    },
  ],
  evidence_refs: ["source-1"],
  scope,
  generated_at: "2026-09-01T10:00:00Z",
  expires_at: null,
  permissions,
  provenance: {
    source_type: "application",
    source_id: "topo:context:packet-1",
    created_by: { type: "system", id: "topo" },
    method: "generated",
    assertion_type: "interpretation",
    confidence: "high",
    created_at: "2026-09-01T10:00:00Z",
    derived_from: ["claim-1"],
    extensions: {},
  },
  extensions: {},
});

describe("purpose-bound context flow", () => {
  it("preserves transport scope and maps it to a non-hierarchical relationship boundary", () => {
    expect(parseOosContextPacket(packet("private")).boundary).toBe("inside");
    expect(parseOosContextPacket(packet("shared")).boundary).toBe("between");
    expect(parseOosContextPacket(packet("published")).boundary).toBe("around");
  });

  it("allows the reviewed snapshot only into transient task use", () => {
    const snapshot = parseOosContextPacket(packet());

    expect(contextFlowDecision(snapshot, "transient-task").allowed).toBe(true);

    for (const target of [
      "rack-source",
      "standing-host-practice",
      "shared-practice",
      "evaluation",
      "organisational-analytics",
    ] as const) {
      expect(contextFlowDecision(snapshot, target).allowed).toBe(false);
    }
  });

  it("fails closed when a packet does not grant task-use permission", () => {
    const snapshot = parseOosContextPacket(packet("private", []));
    const decision = contextFlowDecision(snapshot, "transient-task");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("does not grant permission");
  });

  it("rejects an unknown packet scope rather than guessing a boundary", () => {
    expect(() =>
      parseOosContextPacket({ ...packet(), scope: "organisation" }),
    ).toThrow(/scope must be private, shared or published/);
  });
});
