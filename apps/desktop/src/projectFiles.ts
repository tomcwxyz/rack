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

export type ResearchDraft = {
  rackTitle: string;
  authorName: string;
  organisationContext: string;
  researchQuestion: string;
  evidenceContext: string;
  methodGuidance: string;
  taskTitle: string;
  taskPurpose: string;
};

export type CodingDraft = {
  rackTitle: string;
  authorName: string;
  projectContext: string;
  technologyContext: string;
  codingPrinciples: string;
  safetyBoundaries: string;
  taskTitle: string;
  taskPurpose: string;
};

export type RackSourceFile = {
  path: string;
  content: string;
};

export type RackProposal = {
  folderName: string;
  files: RackSourceFile[];
};

export type WritingRackProposal = RackProposal;
export type ResearchRackProposal = RackProposal;
export type CodingRackProposal = RackProposal;

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

const parseTerms = (value: string): string[] =>
  [...new Set(value.split(/[,\n]/).map((term) => term.trim()).filter(Boolean))];

const evaluationConfig = `schema_version: "0.1"
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
`;

const indexFile = (title: string, route: string): RackSourceFile => ({
  path: "modules/index.md",
  content: `# ${title.trim()}\n\nCanonical instructions created through Rack's ${route} route.\n`,
});

const evalFile: RackSourceFile = {
  path: "eval/config.yaml",
  content: evaluationConfig,
};

export const buildWritingRackFiles = (
  draft: WritingDraft,
): WritingRackProposal => {
  const folderName = slugify(draft.rackTitle, "writing-rack");
  const command = slugify(draft.taskTitle, "writing-task");
  const avoidTerms = parseTerms(draft.avoidTerms);
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
    indexFile(draft.rackTitle, "Writing"),
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
    evalFile,
  ];

  return { folderName, files };
};

export const buildResearchRackFiles = (
  draft: ResearchDraft,
): ResearchRackProposal => {
  const folderName = slugify(draft.rackTitle, "research-rack");
  const command = slugify(draft.taskTitle, "research-task");

  const files: RackSourceFile[] = [
    {
      path: "rack.yaml",
      content: `schema_version: "0.1"
name: ${folderName}
version: 0.1.0
title: ${yamlString(draft.rackTitle)}
description: "A local Rack for careful research and knowledge work."
author:
  name: ${yamlString(draft.authorName || "Rack author")}
license: null
okf_root: modules
default_profile: research
profiles:
  - research
targets:
  prompt:
    enabled: true
  agents-md:
    enabled: true
evaluation:
  config: eval/config.yaml
`,
    },
    indexFile(draft.rackTitle, "Research"),
    {
      path: "modules/context/organisation.md",
      content: `---
type: context
title: Organisation and decision context
description: The organisation, project or decision this research should serve.
tags: [organisation, research]
harness:
  schema_version: "0.1"
  id: context.organisation
  version: 0.1.0
  context_kind: organisation
  applies_to: [research]
---

${draft.organisationContext.trim()}
`,
    },
    {
      path: "modules/context/research-question.md",
      content: `---
type: context
title: Research question
description: The question, decision or uncertainty this Rack is intended to investigate.
tags: [question, research]
harness:
  schema_version: "0.1"
  id: context.research-question
  version: 0.1.0
  context_kind: project
  applies_to: [research]
  requires:
    - id: context.organisation
---

${draft.researchQuestion.trim()}
`,
    },
    {
      path: "modules/context/evidence.md",
      content: `---
type: context
title: Evidence and source context
description: The evidence, sources and practical constraints that should shape the research.
tags: [evidence, sources]
harness:
  schema_version: "0.1"
  id: context.evidence
  version: 0.1.0
  context_kind: reference
  applies_to: [research]
---

${draft.evidenceContext.trim()}
`,
    },
    {
      path: "modules/method/research.md",
      content: `---
type: method
title: Research method
description: A repeatable way to frame, gather, assess and synthesise evidence.
tags: [method, research]
harness:
  schema_version: "0.1"
  id: method.research
  version: 0.1.0
  applies_to: [research]
  requires:
    - id: context.research-question
    - id: context.evidence
  stages: [frame, gather, assess, synthesise, gaps]
---

${draft.methodGuidance.trim()}
`,
    },
    {
      path: "modules/guardrails/evidence.md",
      content: `---
type: guardrail
title: Evidence and uncertainty boundaries
description: Protect against invented evidence, hidden assumptions and false certainty.
tags: [evidence, uncertainty]
harness:
  schema_version: "0.1"
  id: guardrail.evidence
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: cite-available-evidence
      statement: Ground factual claims in the evidence available for this task.
      refusal: Say when a claim cannot be supported and identify the evidence needed.
    - id: do-not-invent-sources
      statement: Do not invent sources, quotations, findings or certainty.
      refusal: Mark the gap rather than filling it with plausible detail.
    - id: separate-inference
      statement: Distinguish evidence, interpretation, inference and recommendation.
---

Treat missing, conflicting and weak evidence as part of the result rather than something to smooth away.
`,
    },
    {
      path: "modules/tasks/primary-research.md",
      content: `---
type: task
title: ${yamlString(draft.taskTitle)}
description: ${yamlString(draft.taskPurpose)}
tags: [research, task]
harness:
  schema_version: "0.1"
  id: task.primary-research
  version: 0.1.0
  applies_to: [research]
  requires:
    - id: method.research
    - id: guardrail.evidence
  trigger:
    command: ${command}
    label: ${yamlString(draft.taskTitle)}
  inputs:
    - name: research-question
      label: Question or decision to investigate
      type: string
      required: true
    - name: source-material
      label: Sources, notes or evidence
      type: markdown
      required: true
    - name: constraints
      label: Scope, time or access constraints
      type: markdown
      required: false
  stages:
    - id: frame
      label: Clarify the question, decision and useful answer
    - id: gather
      label: Gather the available evidence and identify missing sources
    - id: assess
      label: Assess relevance, quality, disagreement and uncertainty
    - id: synthesise
      label: Produce a proportionate synthesis
    - id: gaps
      label: State gaps, limits and sensible next steps
  acceptance:
    suites: [task-primary-research]
    required_for_verification: true
---

${draft.taskPurpose.trim()}
`,
    },
    {
      path: "profiles/research.yaml",
      content: `schema_version: "0.1"
id: research
title: Research and knowledge work
description: Decision context, a research question, evidence expectations, method and uncertainty boundaries.
domains: [research]
include:
  - context.organisation
  - context.research-question
  - context.evidence
  - method.research
  - guardrail.evidence
  - task.primary-research
exclude: []
overrides:
  emit_priority: {}
  target_waivers: {}
budgets:
  prompt:
    recommended_tokens: 12000
    maximum_tokens: 18000
  agents-md:
    recommended_tokens: 12000
    maximum_tokens: 18000
`,
    },
    evalFile,
  ];

  return { folderName, files };
};

export const buildCodingRackFiles = (
  draft: CodingDraft,
): CodingRackProposal => {
  const folderName = slugify(draft.rackTitle, "coding-rack");
  const command = slugify(draft.taskTitle, "coding-task");

  const files: RackSourceFile[] = [
    {
      path: "rack.yaml",
      content: `schema_version: "0.1"
name: ${folderName}
version: 0.1.0
title: ${yamlString(draft.rackTitle)}
description: "A local Rack for careful coding and technical work."
author:
  name: ${yamlString(draft.authorName || "Rack author")}
license: null
okf_root: modules
default_profile: coding
profiles:
  - coding
targets:
  prompt:
    enabled: true
  agents-md:
    enabled: true
  claude-code:
    enabled: true
  opencode:
    enabled: true
  codex:
    enabled: true
evaluation:
  config: eval/config.yaml
`,
    },
    indexFile(draft.rackTitle, "Coding"),
    {
      path: "modules/context/repository.md",
      content: `---
type: context
title: Repository and project context
description: The existing system, users and outcomes that technical changes should respect.
tags: [repository, project]
harness:
  schema_version: "0.1"
  id: context.repository
  version: 0.1.0
  context_kind: project
  applies_to: [code]
---

${draft.projectContext.trim()}
`,
    },
    {
      path: "modules/context/technology.md",
      content: `---
type: context
title: Technology and constraints
description: The stack, conventions, compatibility requirements and operational constraints.
tags: [technology, constraints]
harness:
  schema_version: "0.1"
  id: context.technology
  version: 0.1.0
  context_kind: domain
  applies_to: [code]
---

${draft.technologyContext.trim()}
`,
    },
    {
      path: "modules/craft/code.md",
      content: `---
type: craft
title: Implementation practice
description: How code and technical changes should be designed, structured and tested.
tags: [code, implementation]
harness:
  schema_version: "0.1"
  id: craft.code
  version: 0.1.0
  applies_to: [code]
  requires:
    - id: context.repository
    - id: context.technology
  craft_domain: code
---

${draft.codingPrinciples.trim()}
`,
    },
    {
      path: "modules/guardrails/code-safety.md",
      content: `---
type: guardrail
title: Safe technical changes
description: Protect existing behaviour, private information and the integrity of verification.
tags: [safety, code]
harness:
  schema_version: "0.1"
  id: guardrail.code-safety
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: protect-sensitive-data
      statement: Do not expose credentials, tokens, private data or confidential configuration.
      refusal: Stop and identify a safer way to inspect or test the system.
    - id: preserve-behaviour
      statement: Do not remove or change existing behaviour without making the consequence explicit.
      refusal: Explain the compatibility risk and ask for a decision when the change is consequential.
    - id: honest-verification
      statement: Do not claim that checks, builds or tests passed unless they were actually run.
      refusal: State which verification remains outstanding.
---

${draft.safetyBoundaries.trim()}
`,
    },
    {
      path: "modules/tasks/primary-coding.md",
      content: `---
type: task
title: ${yamlString(draft.taskTitle)}
description: ${yamlString(draft.taskPurpose)}
tags: [code, task]
harness:
  schema_version: "0.1"
  id: task.primary-coding
  version: 0.1.0
  applies_to: [code]
  requires:
    - id: craft.code
    - id: guardrail.code-safety
  trigger:
    command: ${command}
    label: ${yamlString(draft.taskTitle)}
  inputs:
    - name: feature-specification
      label: Feature, fix or technical specification
      type: markdown
      required: true
    - name: constraints
      label: Constraints and non-negotiable behaviour
      type: markdown
      required: false
  stages:
    - id: inspect
      label: Inspect the existing implementation and relevant tests
    - id: plan
      label: Identify the smallest coherent change
    - id: implement
      label: Make a componentised implementation
    - id: verify
      label: Run relevant checks and review the resulting diff
  acceptance:
    suites: [task-primary-coding]
    required_for_verification: true
---

${draft.taskPurpose.trim()}
`,
    },
    {
      path: "profiles/coding.yaml",
      content: `schema_version: "0.1"
id: coding
title: Coding and technical work
description: Repository context, technology constraints, implementation practice, safety boundaries and a repeatable task.
domains: [code]
include:
  - context.repository
  - context.technology
  - craft.code
  - guardrail.code-safety
  - task.primary-coding
exclude: []
overrides:
  emit_priority: {}
  target_waivers: {}
budgets:
  prompt:
    recommended_tokens: 12000
    maximum_tokens: 18000
  agents-md:
    recommended_tokens: 12000
    maximum_tokens: 18000
  claude-code:
    recommended_tokens: 14000
    maximum_tokens: 22000
  opencode:
    recommended_tokens: 14000
    maximum_tokens: 22000
  codex:
    recommended_tokens: 14000
    maximum_tokens: 22000
`,
    },
    evalFile,
  ];

  return { folderName, files };
};
