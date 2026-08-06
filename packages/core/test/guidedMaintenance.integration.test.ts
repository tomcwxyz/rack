import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  parseProjectSnapshot,
  patchContextModuleSource,
  patchGuardrailModuleSource,
  patchSetupSource,
  patchTaskModuleSource,
  patchVoiceModuleSource,
  readContextModuleDraft,
  readGuardrailModuleDraft,
  readSetupDraft,
  readTaskModuleDraft,
  readVoiceModuleDraft,
  type ProjectSnapshot,
} from "../src/index.js";

const snapshot: ProjectSnapshot = {
  root: "/writing-round-trip",
  manifest: {
    path: "rack.yaml",
    content: `schema_version: "0.1"
name: writing-round-trip
version: 0.1.0
title: Writing Round Trip
description: A representative guided-maintenance fixture.
author:
  name: Example Author
default_profile: writing
profiles: [writing]
targets:
  prompt:
    enabled: true
`,
  },
  modules: [
    {
      path: "modules/context/organisation.md",
      content: `---
# This comment must survive a guided change.
type: context
title: Organisation context
description: What the assistant should know about the organisation.
harness:
  schema_version: "0.1"
  id: context.organisation
  version: 0.1.0
  context_kind: organisation
  applies_to: [writing]
---
The organisation works with small social-purpose organisations.
`,
    },
    {
      path: "modules/voice/plain.md",
      content: `---
type: voice
title: Plain British voice
description: Warm and direct British English.
harness:
  schema_version: "0.1"
  id: voice.plain
  version: 0.1.0
  applies_to: [writing]
  lexicon:
    rules:
      - Use British English.
    avoid:
      - term: leverage
        reason: Usually vague.
---
Make the important point early.
`,
    },
    {
      path: "modules/guardrails/evidence.md",
      content: `---
type: guardrail
title: Evidence boundary
description: Keep claims grounded.
harness:
  schema_version: "0.1"
  id: guardrail.evidence
  version: 0.1.0
  applies_to: [writing]
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: do-not-invent
      statement: Do not invent sources or quotations.
      refusal: Say when evidence is unavailable.
---
Separate evidence from inference.
`,
    },
    {
      path: "modules/tasks/briefing.md",
      content: `---
type: task
title: Draft a briefing
description: Produce a concise evidence-led briefing.
harness:
  schema_version: "0.1"
  id: task.briefing
  version: 0.1.0
  applies_to: [writing]
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
---
Draft for the intended audience and distinguish evidence from inference.
`,
    },
  ],
  profiles: [
    {
      path: "profiles/writing.yaml",
      content: `# This Set-up comment must survive.
schema_version: "0.1"
id: writing
title: Writing
description: Everyday writing and communications.
domains: [writing]
include:
  - context.organisation
  - voice.plain
  - guardrail.evidence
  - task.briefing
exclude: []
overrides:
  emit_priority: {}
  target_waivers: {}
budgets:
  prompt:
    recommended_tokens: 1400
    maximum_tokens: 2400
`,
    },
  ],
};

describe("guided maintenance project round trip", () => {
  it("patches representative source, reparses it and builds the Set-up", () => {
    const [context, voice, boundary, task] = snapshot.modules;

    const contextResult = patchContextModuleSource(context!.content, {
      ...readContextModuleDraft(context!.content),
      body: "The organisation works with small charities and public-purpose teams.",
    });
    const voiceResult = patchVoiceModuleSource(voice!.content, {
      ...readVoiceModuleDraft(voice!.content),
      rules: ["Use British English.", "Prefer plain, direct sentences."],
    });
    const boundaryResult = patchGuardrailModuleSource(boundary!.content, {
      ...readGuardrailModuleDraft(boundary!.content),
      rules: [
        ...readGuardrailModuleDraft(boundary!.content).rules,
        {
          id: "mark-uncertainty",
          statement: "Mark uncertainty explicitly.",
          refusal: "Do not present estimates as established facts.",
        },
      ],
    });
    const taskResult = patchTaskModuleSource(task!.content, {
      ...readTaskModuleDraft(task!.content),
      command: "prepare-briefing",
      stages: [
        ...readTaskModuleDraft(task!.content).stages,
        { id: "draft", label: "Draft the briefing" },
      ],
    });
    const setupResult = patchSetupSource(snapshot.profiles[0]!.content, {
      ...readSetupDraft(snapshot.profiles[0]!.content),
      title: "Writing and communications",
      budgets: [
        {
          target: "prompt",
          recommendedTokens: 1600,
          maximumTokens: 2600,
        },
      ],
    });

    expect(contextResult.content).toContain(
      "# This comment must survive a guided change.",
    );
    expect(setupResult.content).toContain("# This Set-up comment must survive.");
    expect(taskResult.content).toContain("required_for_verification: true");

    const project = parseProjectSnapshot({
      ...snapshot,
      modules: [
        { ...context!, content: contextResult.content },
        { ...voice!, content: voiceResult.content },
        { ...boundary!, content: boundaryResult.content },
        { ...task!, content: taskResult.content },
      ],
      profiles: [{ ...snapshot.profiles[0]!, content: setupResult.content }],
    });

    expect(project.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const build = buildPrompt(project, "writing");
    expect(build.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    expect(build.compiled?.modules).toHaveLength(4);
    expect(build.artifact?.content).toContain("small charities");
    expect(build.artifact?.content).toContain("Mark uncertainty explicitly");
    expect(build.artifact?.content).toContain("**Command:** /prepare-briefing");
  });
});
