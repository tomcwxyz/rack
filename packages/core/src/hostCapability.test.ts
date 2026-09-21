import { describe, expect, it } from "vitest";
import {
  buildHostCapabilityPlan,
  resolveHostCapability,
  type HostCapabilityNeed,
} from "./hostCapability.js";

const coreNeeds: HostCapabilityNeed[] = [
  { id: "practice.standing-guidance" },
  { id: "practice.on-demand-skill", count: 2 },
  { id: "context.transient-task" },
  { id: "verification.pre-completion", count: 3 },
  { id: "verification.human-review", count: 1 },
];

describe("host capability application", () => {
  it("maps Claude Code without silently losing the selected practice", () => {
    const plan = buildHostCapabilityPlan("claude-code", coreNeeds);

    expect(plan).not.toBeNull();
    expect(plan?.hasUnavailable).toBe(false);
    expect(plan?.hasDegradation).toBe(false);
    expect(plan?.outcomes.map((item) => [item.id, item.resolution])).toEqual([
      ["practice.standing-guidance", "native"],
      ["practice.on-demand-skill", "native"],
      ["context.transient-task", "rack-provided"],
      ["verification.pre-completion", "rack-provided"],
      ["verification.human-review", "human"],
    ]);
    expect(plan?.outcomes.every((item) => item.preserved)).toBe(true);
  });

  it("makes Codex command degradation explicit rather than dropping tasks", () => {
    const task = resolveHostCapability("codex", {
      id: "practice.on-demand-skill",
      count: 2,
    });

    expect(task?.resolution).toBe("degraded");
    expect(task?.preserved).toBe(true);
    expect(task?.summary).toContain("documented procedures");
    expect(task?.consequence).toContain("AGENTS.md");
  });

  it("does not claim OpenCode has a proved transient task channel", () => {
    const context = resolveHostCapability("opencode", {
      id: "context.transient-task",
    });

    expect(context?.resolution).toBe("unavailable");
    expect(context?.preserved).toBe(false);
    expect(context?.consequence).toContain("will not silently persist");
  });

  it("keeps completion verification with RACK until a native host gate exists", () => {
    for (const hostId of ["claude-code", "codex", "opencode"] as const) {
      const verification = resolveHostCapability(hostId, {
        id: "verification.pre-completion",
      });
      expect(verification?.resolution).toBe("rack-provided");
      expect(verification?.preserved).toBe(true);
    }
  });

  it("deduplicates repeated needs while preserving first-use detail", () => {
    const plan = buildHostCapabilityPlan("claude-code", [
      { id: "practice.standing-guidance", detail: "first" },
      { id: "practice.standing-guidance", detail: "second" },
    ]);

    expect(plan?.outcomes).toHaveLength(1);
    expect(plan?.outcomes[0]?.detail).toBe("first");
  });
});
