import { describe, expect, it } from "vitest";
import {
  buildHostInstallationPlan,
  getHostIntegrationForDestination,
  listHostIntegrations,
} from "../src/index.js";

describe("host integration planning", () => {
  it("keeps a single compatibility map for supported, preview and research hosts", () => {
    const ids = listHostIntegrations().map((item) => item.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("codex");
    expect(ids).toContain("opencode");
    expect(ids).toContain("hermes-agent");
    expect(ids).toContain("openclaw");
    expect(ids).toContain("copilot-cli");
    expect(ids).toContain("gemini-cli");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps existing destinations to their host integration", () => {
    expect(getHostIntegrationForDestination("claude-code")?.displayName).toBe("Claude Code");
    expect(getHostIntegrationForDestination("codex")?.delivery.onDemandPractice).toBe(
      "not-supported",
    );
    expect(getHostIntegrationForDestination("hermes-agent")?.status).toBe("preview");
  });

  it("creates a reviewed plan that never writes transient context or canonical Rack source", () => {
    const plan = buildHostInstallationPlan("claude-code", [
      {
        target: "claude-code",
        path: "CLAUDE.md",
        mediaType: "text/markdown",
        content: "standing",
        moduleIds: ["context.repository"],
      },
      {
        target: "claude-code",
        path: ".claude/skills/review-code/SKILL.md",
        mediaType: "text/markdown",
        content: "skill",
        moduleIds: ["task.review-code"],
      },
    ]);

    expect(plan).not.toBeNull();
    expect(plan?.reviewRequired).toBe(true);
    expect(plan?.canonicalSourceChanged).toBe(false);
    expect(plan?.transientContextWritten).toBe(false);
    expect(plan?.actions).toEqual([
      { path: "CLAUDE.md", purpose: "standing-practice" },
      {
        path: ".claude/skills/review-code/SKILL.md",
        purpose: "on-demand-practice",
      },
    ]);
  });
});
