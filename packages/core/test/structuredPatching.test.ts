import { describe, expect, it } from "vitest";
import {
  patchGuardrailModuleSource,
  patchTaskModuleSource,
  readGuardrailModuleDraft,
  readTaskModuleDraft,
} from "../src/structuredPatching.js";

const guardrailSource = `---
type: guardrail
title: Evidence boundaries
description: Keep claims grounded.
future_field: keep-me
harness:
  schema_version: "0.1"
  id: guardrail.evidence
  version: 0.1.0
  criticality: required
  rules:
    - id: cite-claims
      statement: Cite material factual claims.
      refusal: Say when evidence is unavailable.
  future_setting: true
---
Do not invent sources.
`;

const taskSource = `---
type: task
title: Draft a briefing
description: Produce a short evidence-led briefing.
harness:
  schema_version: "0.1"
  id: task.briefing
  version: 0.1.0
  trigger:
    command: draft-briefing
    label: Draft a briefing
  inputs:
    - name: source-material
      label: Source material
      type: markdown
      required: true
  stages:
    - id: review
      label: Review the source material
  acceptance:
    suites: [briefing]
    required_for_verification: true
  future_setting: keep-me
---
Draft a concise briefing for the intended audience.
`;

describe("guided boundary source patching", () => {
  it("reads and patches rules without discarding unrelated fields", () => {
    const draft = readGuardrailModuleDraft(guardrailSource);
    const result = patchGuardrailModuleSource(guardrailSource, {
      ...draft,
      rules: [
        ...draft.rules,
        {
          id: "mark-uncertainty",
          statement: "Mark uncertainty explicitly.",
          refusal: "Do not turn estimates into facts.",
        },
      ],
    });

    expect(result.content).toContain("future_field: keep-me");
    expect(result.content).toContain("future_setting: true");
    expect(result.content).toContain("id: guardrail.evidence");
    expect(result.content).toContain("id: mark-uncertainty");
    expect(readGuardrailModuleDraft(result.content).rules).toHaveLength(2);
  });
});

describe("guided task source patching", () => {
  it("updates trigger, inputs and stages while retaining acceptance", () => {
    const draft = readTaskModuleDraft(taskSource);
    const result = patchTaskModuleSource(taskSource, {
      ...draft,
      command: "prepare-briefing",
      label: "Prepare a briefing",
      inputs: [
        ...draft.inputs,
        {
          name: "audience",
          label: "Audience",
          type: "string",
          required: false,
        },
      ],
      stages: [
        ...draft.stages,
        { id: "draft", label: "Draft the briefing" },
      ],
    });

    expect(result.content).toContain("command: prepare-briefing");
    expect(result.content).toContain("required_for_verification: true");
    expect(result.content).toContain("future_setting: keep-me");
    expect(readTaskModuleDraft(result.content).inputs).toHaveLength(2);
    expect(readTaskModuleDraft(result.content).stages).toHaveLength(2);
  });

  it("rejects duplicate input names", () => {
    const draft = readTaskModuleDraft(taskSource);
    expect(() =>
      patchTaskModuleSource(taskSource, {
        ...draft,
        inputs: [...draft.inputs, { ...draft.inputs[0]! }],
      }),
    ).toThrow(/unique/);
  });
});
