import { describe, expect, it } from "vitest";
import {
  buildHostRuntimePlan,
  renderTransientHostInput,
} from "../src/hostRuntime.js";
import type { ContextSnapshot } from "../src/contextSources.js";

const snapshot: ContextSnapshot = {
  id: "packet-1",
  sourceId: "topo",
  subject: "project:rack",
  purpose: "review implementation",
  objects: [
    {
      type: "topo.memory_claim",
      id: "claim-1",
      value: { key: "locale", value: "en-GB" },
    },
  ],
  evidenceRefs: [],
  generatedAt: "2026-09-01T12:00:00Z",
  expiresAt: null,
  scope: "private",
  boundary: "inside",
  permissions: ["local-use-only"],
  provenance: {},
  extensions: {},
};

describe("transient host runtime planning", () => {
  it("supports stdin-only read-only hand-off for Claude Code and Codex", () => {
    for (const hostId of ["claude-code", "codex"] as const) {
      const plan = buildHostRuntimePlan(hostId);
      expect(plan?.status).toBe("available");
      expect(plan?.contextDelivery).toBe("stdin");
      expect(plan?.taskDelivery).toBe("stdin");
      expect(plan?.writesProjectFiles).toBe(false);
      expect(plan?.persistsContextInRack).toBe(false);
      expect(plan?.requiresConfirmation).toBe(true);
    }
  });

  it("keeps OpenCode planned until a clean transient channel is proven", () => {
    expect(buildHostRuntimePlan("opencode")?.status).toBe("planned");
  });

  it("supports a task without additional TOPO context", () => {
    const input = renderTransientHostInput(null, "Review the current change.");
    expect(input).toContain("Review the current change.");
    expect(input).toContain("No additional TOPO context");
  });

  it("renders task and reviewed context without changing the packet", () => {
    const input = renderTransientHostInput(snapshot, "Review the current change.");
    expect(input).toContain("Review the current change.");
    expect(input).toContain("Relationship boundary: inside");
    expect(input).toContain('"value": "en-GB"');
    expect(snapshot.objects).toHaveLength(1);
  });

  it("refuses context without task-use permission", () => {
    expect(() =>
      renderTransientHostInput({ ...snapshot, permissions: [] }, "Review it."),
    ).toThrow(/does not grant permission/);
  });
});
