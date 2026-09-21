import {
  makeExternalStarterEntry,
  type ExternalStarterSource,
} from "./external.js";
import type { StarterTemplate } from "./catalogue.js";

export const HONEY_UPSTREAM_REVISION =
  "61f25a5b728ae16be18ebf1700a6a6454f5bb591";

export const HONEY_SOURCE: ExternalStarterSource = {
  name: "Honey for Devs",
  publisher: "Green-PT",
  origin: `green-pt/honey-for-devs@${HONEY_UPSTREAM_REVISION.slice(0, 12)}`,
  license: "MIT",
  url: "https://github.com/Green-PT/honey-for-devs",
  revision: HONEY_UPSTREAM_REVISION,
  copyright: "Copyright (c) 2026 Green-PT",
  note: "Runtime hooks, installers, ESON/PX tooling and host-specific state are deliberately not bundled by RACK.",
};

export const honeyStarterCatalogue = [
  makeExternalStarterEntry({
    type: "method",
    slug: "honey.method.minimum-code",
    title: "Minimum code that needs to exist",
    description: "Prefer no new code, reuse and platform capabilities before writing the smallest necessary implementation.",
    routes: ["coding"],
    tags: ["coding", "honey", "method", "scope", "simplicity"],
    source: HONEY_SOURCE,
    harness: { stages: ["understand", "reuse", "choose", "verify"] },
    body: `Understand the real change surface before editing. Prefer, in order: solving the need without new code, reusing sound code already in the repository, using the language or platform's standard capability, using a dependency the project already has, then writing the smallest coherent new implementation. A new file, abstraction, parameter, layer or dependency needs a present requirement rather than an imagined future one. Keep a runnable check for non-trivial behaviour.`,
  }),
  makeExternalStarterEntry({
    type: "method",
    slug: "honey.method.fix-causes",
    title: "Fix causes, not symptoms",
    description: "Trace the failing flow and choose the narrowest shared correction that actually removes the defect.",
    routes: ["coding"],
    tags: ["coding", "honey", "method", "debugging", "scope"],
    source: HONEY_SOURCE,
    harness: { stages: ["trace", "callers", "cause", "verify"] },
    body: `Treat a bug report as evidence of a symptom, not necessarily the location of the defect. Trace the relevant flow and inspect callers before choosing the patch site. When one bounded correction at a shared boundary fixes the named path and equivalent sibling paths safely, prefer it to repeated guards at individual call sites. Do not broaden the change beyond behaviour supported by the evidence.`,
  }),
  makeExternalStarterEntry({
    type: "method",
    slug: "honey.method.context-economy",
    title: "Read only useful coding context",
    description: "Locate first, read narrowly and keep deterministic bulk work out of model context.",
    routes: ["coding"],
    tags: ["coding", "honey", "method", "context", "tokens"],
    source: HONEY_SOURCE,
    harness: { stages: ["locate", "read", "compute", "reuse-context"] },
    body: `Find the relevant symbol, path or declaration before reading large files. Read the smallest surrounding range that preserves the behaviour and constraints needed for the task; use an outline before full bodies when a large unfamiliar file needs orientation. Do deterministic work such as counting, sorting, deduplication and diffing in code or tools rather than asking the model to infer it from bulk text. Do not repeatedly pull unchanged material into context when it is already available and trustworthy.`,
  }),
  makeExternalStarterEntry({
    type: "craft",
    slug: "honey.craft.deliberate-shortcuts",
    title: "Name deliberate shortcuts",
    description: "When a simpler implementation has a known ceiling, record the ceiling and the trigger for revisiting it.",
    routes: ["coding"],
    tags: ["coding", "honey", "craft", "simplicity", "debt"],
    source: HONEY_SOURCE,
    harness: { craft_domain: "software" },
    body: `A deliberate simplification is acceptable when its operating limit is understood. Record the relevant ceiling and a concrete trigger that would make the trade-off worth revisiting, close to the code or in the repository's established decision/debt mechanism. Do not create vague future-work notes merely to justify an unsafe or incomplete implementation.`,
  }),
  makeExternalStarterEntry({
    type: "voice",
    slug: "honey.voice.concise-engineering",
    title: "Concise engineering communication",
    description: "Keep technical answers compact while preserving exact code, identifiers, commands and material caveats.",
    routes: ["coding"],
    tags: ["coding", "honey", "voice", "concise", "tokens"],
    source: HONEY_SOURCE,
    harness: {
      lexicon: {
        rules: [
          "Answer the technical question before adding supporting explanation.",
          "Explain non-obvious reasoning rather than narrating code that already says what it does.",
          "Keep identifiers, paths, commands, versions and error messages exact.",
        ],
      },
    },
    body: `Remove conversational padding, repeated setup and prose that only paraphrases readable code. Keep enough explanation to preserve correctness, trade-offs and learning where those are part of the task. Brevity must not turn copyable code, commands, identifiers or material uncertainty into shorthand the reader has to reconstruct.`,
  }),
  makeExternalStarterEntry({
    type: "method",
    slug: "honey.method.agent-wire",
    title: "Efficient agent-to-agent hand-off",
    description: "Use compact, stable structured hand-offs when the next reader is another agent rather than a person.",
    routes: ["coding"],
    tags: ["coding", "honey", "method", "agents", "handoff", "tokens"],
    source: HONEY_SOURCE,
    harness: { stages: ["aggregate", "structure", "identify", "validate"] },
    body: `When another agent is the receiver, aggregate deterministic facts before the hand-off and prefer compact structured data over conversational recap. Address records by stable keys rather than position. Avoid repeated field names where a conventional compact representation remains unambiguous. Keep authentication, money, migrations, destructive actions and other irreversible or safety-sensitive material explicit and schema-checked rather than compressed for token savings. Do not expose an agent-only wire format as a human-facing answer.`,
  }),
  makeExternalStarterEntry({
    type: "guardrail",
    slug: "honey.guardrail.no-false-economy",
    title: "Do not optimise away correctness",
    description: "Code and token restraint must not remove safety, accessibility, verification or requested product quality.",
    routes: ["coding"],
    tags: ["coding", "honey", "guardrail", "safety", "quality"],
    source: HONEY_SOURCE,
    harness: {
      criticality: "required",
      rules: [
        {
          id: "preserve-trust-boundaries",
          statement: "Do not remove validation, error handling, authentication, authorisation, escaping or secret-handling behaviour merely to reduce code or tokens.",
        },
        {
          id: "preserve-user-quality",
          statement: "Do not remove accessibility basics or required visual and interaction quality from a user-facing deliverable in the name of minimalism.",
        },
        {
          id: "preserve-proof",
          statement: "Do not remove meaningful tests, checks or explicitly requested behaviour merely to make the implementation smaller.",
        },
      ],
    },
    body: `Minimal means avoiding waste, not leaving required work unfinished. Preserve the boundaries that prevent data loss, security failures, inaccessible interfaces and unverified behaviour. If correctness needs more code or explanation, spend it deliberately.`,
  }),
  makeExternalStarterEntry({
    type: "task",
    slug: "honey.task.lean-review",
    title: "Lean code review",
    description: "Review a diff specifically for removable over-engineering and verbosity, separately from correctness review.",
    routes: ["coding"],
    tags: ["coding", "honey", "task", "review", "simplicity"],
    source: HONEY_SOURCE,
    schemaVersion: "0.2",
    harness: {
      trigger: { command: "lean-review", label: "Lean code review" },
      inputs: [
        { name: "change", label: "Change or diff", type: "markdown", required: true },
      ],
      stages: [
        { id: "scope", label: "Understand the intended change" },
        { id: "waste", label: "Find code or prose that need not exist" },
        { id: "carve-outs", label: "Protect required safety, quality and verification" },
        { id: "cuts", label: "Report concrete cuts without inventing findings" },
      ],
      enforcement: ["instruction", "rubric_eval"],
      verification: [
        {
          id: "lean-review-boundary",
          kind: "judgement",
          label: "Lean review stays within its remit",
          question: "Does the review identify only defensible simplifications or removable verbosity, avoid treating required safety, accessibility, UX quality or verification as bloat, and avoid presenting this simplification review as a correctness review?",
          evidence: ["diff", "output"],
          on_fail: "block",
          on_uncertain: "human_review",
        },
      ],
    },
    body: `Review the supplied change only for avoidable implementation or explanation: speculative options and abstractions, duplicated helpers, needless new dependencies, dead code, commented-out code and comments that merely narrate obvious code. Give concrete file or symbol references and the simplification to make. Do not manufacture a finding when the extra code is justified. This task complements rather than replaces correctness, security and test review.`,
  }),
].sort((left, right) => left.title.localeCompare(right.title));

export const honeyStarterTemplates: readonly StarterTemplate[] = [
  {
    id: "honey-lean-coding",
    title: "Lean agentic coding · Honey",
    description: "Honey-inspired coding practice for smaller changes, lower context/output cost and explicit protection of correctness and verification.",
    promise: "Start with a deliberately lean agentic coding practice: less unnecessary code and context, without trading away safety, quality or verification.",
    bestFor: ["Agentic coding", "Token- and context-conscious implementation", "Repositories prone to over-engineering"],
    route: "coding",
    moduleIds: [
      "@rack-starter/context.repository",
      "@rack-starter/method.inspect-plan-implement",
      "@rack-starter/honey.method.minimum-code",
      "@rack-starter/honey.method.fix-causes",
      "@rack-starter/honey.method.context-economy",
      "@rack-starter/craft.dependency-discipline",
      "@rack-starter/craft.remove-before-add",
      "@rack-starter/honey.craft.deliberate-shortcuts",
      "@rack-starter/honey.voice.concise-engineering",
      "@rack-starter/honey.method.agent-wire",
      "@rack-starter/honey.guardrail.no-false-economy",
      "@rack-starter/craft.testing",
      "@rack-starter/guardrail.security",
      "@rack-starter/guardrail.compatibility",
      "@rack-starter/guardrail.change-verification",
      "@rack-starter/task.implement-change",
      "@rack-starter/honey.task.lean-review",
    ],
  },
];
