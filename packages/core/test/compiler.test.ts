import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  parseProjectSnapshot,
  resolveProfile,
  type ProjectSnapshot,
} from "../src/index.js";

const projectSnapshot = (exclude: string[] = []): ProjectSnapshot => ({
  root: "/writing",
  manifest: {
    path: "rack.yaml",
    content: `
schema_version: "0.1"
name: writing-rack
version: 0.1.0
title: Writing Rack
author: { name: Example Author }
default_profile: writing
profiles: [writing]
`,
  },
  modules: [
    {
      path: "modules/context/organisation.md",
      content: `---
type: context
title: Organisation context
description: Context for clear project updates.
harness:
  schema_version: "0.1"
  id: context.organisation
  version: 0.1.0
  context_kind: organisation
  applies_to: [writing]
---
Write for social purpose organisations.
`,
    },
    {
      path: "modules/voice/tone.md",
      content: `---
type: voice
title: Plain British voice
description: Warm, direct British English.
harness:
  schema_version: "0.1"
  id: voice.tone
  version: 0.1.0
  applies_to: [writing]
  requires:
    - id: context.organisation
  lexicon:
    rules:
      - Use British English.
      - Prefer short, direct sentences.
---
Make the important point early.
`,
    },
    {
      path: "modules/guardrails/evidence.md",
      content: `---
type: guardrail
title: Evidence boundary
description: Be honest about the evidence available.
harness:
  schema_version: "0.1"
  id: guardrail.evidence
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: do-not-invent
      statement: Do not invent sources or quotations.
---
Separate evidence from inference.
`,
    },
    {
      path: "modules/tasks/project-update.md",
      content: `---
type: task
title: Draft a project update
description: Turn notes into a useful partner update.
harness:
  schema_version: "0.1"
  id: task.project-update
  version: 0.1.0
  applies_to: [writing]
  requires:
    - id: voice.tone
    - id: guardrail.evidence
  trigger:
    command: project-update
    label: Draft a project update
  inputs:
    - name: notes
      label: Notes and developments
      type: markdown
      required: true
  stages:
    - id: gather
      label: Gather the meaningful changes
    - id: draft
      label: Draft the update
---
Lead with what changed and end with the next action.
`,
    },
  ],
  profiles: [
    {
      path: "profiles/writing.yaml",
      content: `
schema_version: "0.1"
id: writing
title: Writing
description: A focused writing Set-up.
domains: [writing]
include: [task.project-update]
exclude: [${exclude.join(", ")}]
`,
    },
  ],
});

describe("profile compilation", () => {
  it("resolves dependency closure in a deterministic order", () => {
    const project = parseProjectSnapshot(projectSnapshot());
    const result = resolveProfile(project, "writing");

    expect(result.diagnostics).toEqual([]);
    expect(result.compiled?.modules.map((module) => module.harness.id)).toEqual([
      "guardrail.evidence",
      "context.organisation",
      "voice.tone",
      "task.project-update",
    ]);
    expect(result.compiled?.requiredModuleIds).toEqual([
      "guardrail.evidence",
    ]);
  });

  it("blocks a Set-up that excludes a required dependency", () => {
    const project = parseProjectSnapshot(
      projectSnapshot(["guardrail.evidence"]),
    );
    const result = resolveProfile(project, "writing");

    expect(result.compiled).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-PROFILE-003",
        severity: "error",
        moduleIds: ["task.project-update", "guardrail.evidence"],
      }),
    );
  });

  it("renders the same prompt from the same source", () => {
    const project = parseProjectSnapshot(projectSnapshot());
    const first = buildPrompt(project, "writing");
    const second = buildPrompt(project, "writing");

    expect(first.artifact?.content).toBe(second.artifact?.content);
    expect(first.artifact?.content).toContain("# Writing");
    expect(first.artifact?.content).toContain("## Context");
    expect(first.artifact?.content).toContain("## Boundaries");
    expect(first.artifact?.content).toContain(
      "<!-- rack:task.project-update@0.1.0; criticality:recommended -->",
    );
    expect(first.artifact?.content.endsWith("\n")).toBe(true);
  });
});
