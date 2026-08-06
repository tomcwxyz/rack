import { describe, expect, it } from "vitest";
import {
  patchSetupSource,
  readSetupDraft,
} from "../src/profilePatching.js";

const source = `# Keep this Set-up comment
schema_version: "0.1"
id: writing
title: Writing
description: Everyday writing work.
domains: [writing]
include:
  - context.organisation
  - voice.plain
exclude: []
overrides:
  emit_priority: {}
  target_waivers: {}
budgets:
  prompt:
    recommended_tokens: 1200
    maximum_tokens: 2200
future_field: keep-me
`;

describe("guided Set-up patching", () => {
  it("preserves advanced and unknown settings while changing owned fields", () => {
    const draft = readSetupDraft(source);
    const result = patchSetupSource(source, {
      ...draft,
      title: "Writing and communications",
      include: [...draft.include, "guardrail.evidence"],
      exclude: ["task.research"],
      budgets: [
        ...draft.budgets,
        {
          target: "claude-code",
          recommendedTokens: 1600,
          maximumTokens: 2600,
        },
      ],
    });

    expect(result.content).toContain("# Keep this Set-up comment");
    expect(result.content).toContain("id: writing");
    expect(result.content).toContain("target_waivers: {}");
    expect(result.content).toContain("future_field: keep-me");
    expect(result.content).toContain("guardrail.evidence");
    expect(result.content).toContain("claude-code:");
    expect(readSetupDraft(result.content).budgets).toHaveLength(2);
  });

  it("rejects an instruction included and excluded at the same time", () => {
    const draft = readSetupDraft(source);
    expect(() =>
      patchSetupSource(source, {
        ...draft,
        exclude: [draft.include[0]!],
      }),
    ).toThrow(/both included and excluded/);
  });
});
