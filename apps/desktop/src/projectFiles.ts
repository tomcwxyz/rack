export type WritingDraft = {
  rackTitle: string;
  authorName: string;
  organisationContext: string;
  audienceContext: string;
  voiceGuidance: string;
  avoidTerms: string;
  taskTitle: string;
  taskPurpose: string;
};

export type RackSourceFile = {
  path: string;
  content: string;
};

export type WritingRackProposal = {
  folderName: string;
  files: RackSourceFile[];
};

const yamlString = (value: string): string => JSON.stringify(value.trim());

export const slugify = (value: string, fallback = "rack"): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  const safe = slug || fallback;
  return /^[a-z]/.test(safe) ? safe : `rack-${safe}`;
};

const parseAvoidTerms = (value: string): string[] =>
  [...new Set(value.split(/[,\n]/).map((term) => term.trim()).filter(Boolean))];

export const buildWritingRackFiles = (
  draft: WritingDraft,
): WritingRackProposal => {
  const folderName = slugify(draft.rackTitle, "writing-rack");
  const command = slugify(draft.taskTitle, "writing-task");
  const avoidTerms = parseAvoidTerms(draft.avoidTerms);
  const avoidYaml =
    avoidTerms.length === 0
      ? "    avoid: []"
      : [
          "    avoid:",
          ...avoidTerms.flatMap((term) => [
            `      - term: ${yamlString(term)}`,
            "        reason: \"The author chose to avoid this wording.\"",
          ]),
        ].join("\n");

  const files: RackSourceFile[] = [
    {
      path: "rack.yaml",
      content: `schema_version: "0.1"
name: ${folderName}
version: 0.1.0
title: ${yamlString(draft.rackTitle)}
description: "A local Rack for repeatable writing and communications work."
author:
  name: ${yamlString(draft.authorName || "Rack author")}
license: null
okf_root: modules
default_profile: writing
profiles:
  - writing
targets:
  prompt:
    enabled: true
evaluation:
  config: eval/config.yaml
`,
    },
    {
      path: "modules/index.md",
      content: `# ${draft.rackTitle.trim()}\n\nCanonical instructions created through Rack's Writing route.\n`,
    },
    {
      path: "modules/context/organisation.md",
      content: `---
type: context
title: Organisation context
description: The organisation, work or setting this Rack should understand.
tags: [organisation, writing]
harness:
  schema_version: "0.1"
  id: context.organisation
  version: 0.1.0
  context_kind: organisation
  applies_to: [writing]
---

${draft.organisationContext.trim()}
`,
    },
    {
      path: "modules/context/audience.md",
      content: `---
type: context
title: Audience context
description: The people this writing normally needs to serve.
tags: [audience, writing]
harness:
  schema_version: "0.1"
  id: context.audience
  version: 0.1.0
  context_kind: audience
  applies_to: [writing]
---

${draft.audienceContext.trim()}
`,
    },
    {
      path: "modules/voice/tone.md",
      content: `---
type: voice
title: Voice and language
description: How the writing should sound and which language to avoid.
tags: [voice, writing]
harness:
  schema_version: "0.1"
  id: voice.tone
  version: 0.1.0
  applies_to: [writing]
  requires:
    - id: context.organisation
    - id: context.audience
  lexicon:
    never: []
    prefer: []
${avoidYaml}
    rules:
      - ${yamlString(draft.voiceGuidance)}
---

Use this guidance as a consistent voice, while adapting the level of detail to the audience and task.
`,
    },
    {
      path: "modules/guardrails/evidence.md",
      content: `---
type: guardrail
title: Evidence boundaries
description: Be honest about evidence, uncertainty and missing information.
tags: [evidence, trust]
harness:
  schema_version: "0.1"
  id: guardrail.evidence
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: do-not-invent-sources
      statement: Do not invent sources, quotations, evidence or certainty.
      refusal: Say what is unknown and what information would be needed.
    - id: separate-inference
      statement: Distinguish evidence, interpretation and recommendation.
---

Do not make weak information appear stronger through confident prose.
`,
    },
    {
      path: "modules/tasks/primary-writing.md",
      content: `---
type: task
title: ${yamlString(draft.taskTitle)}
description: ${yamlString(draft.taskPurpose)}
tags: [writing, task]
harness:
  schema_version: "0.1"
  id: task.primary-writing
  version: 0.1.0
  applies_to: [writing]
  requires:
    - id: voice.tone
    - id: guardrail.evidence
  trigger:
    command: ${command}
    label: ${yamlString(draft.taskTitle)}
  inputs:
    - name: source-material
      label: Notes or source material
      type: markdown
      required: true
    - name: audience
      label: Intended audience
      type: string
      required: false
  stages:
    - id: understand
      label: Understand the purpose and source material
    - id: draft
      label: Produce a useful first draft
    - id: check
      label: Check claims, voice and next actions
  acceptance:
    suites: [task-primary-writing]
    required_for_verification: true
---

${draft.taskPurpose.trim()}
`,
    },
    {
      path: "profiles/writing.yaml",
      content: `schema_version: "0.1"
id: writing
title: Writing and communications
description: Organisation and audience context, voice, evidence boundaries and a repeatable writing task.
domains: [writing]
include:
  - context.organisation
  - context.audience
  - voice.tone
  - guardrail.evidence
  - task.primary-writing
exclude: []
overrides:
  emit_priority: {}
  target_waivers: {}
budgets:
  prompt:
    recommended_tokens: 10000
    maximum_tokens: 16000
`,
    },
    {
      path: "eval/config.yaml",
      content: `schema_version: "0.1"
defaults:
  mode: agentic
  repetitions:
    quick: 1
    reliable: 5
  baseline: true
  temperature: 0.2
  timeout_seconds: 120
models: []
gate:
  required_rules: must_hold
  minimum_pass_rate: 0.8
  regression_threshold: 0.10
`,
    },
  ];

  return { folderName, files };
};
