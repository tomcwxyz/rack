import { stringify } from "yaml";
import {
  moduleFrontmatterSchema,
  type RackModuleFrontmatter,
} from "@rack/schemas";

export const STARTER_CATALOGUE_VERSION = "0.2.0";
export const STARTER_CONTENT_LICENSE = "CC BY 4.0";
export const STARTER_SOURCE_ORIGIN = "rack-starter";
export const starterCatalogueMetadata = {
  schemaVersion: "0.1",
  id: "rack-starter",
  version: STARTER_CATALOGUE_VERSION,
  license: STARTER_CONTENT_LICENSE,
  origin: STARTER_SOURCE_ORIGIN,
} as const;

export type StarterRoute = "shared" | "writing" | "research" | "coding";

export type StarterAttribution = {
  name: string;
  url?: string;
  note?: string;
};

export type StarterEntry = {
  id: string;
  title: string;
  description: string;
  type: RackModuleFrontmatter["type"];
  routes: StarterRoute[];
  tags: string[];
  attribution?: StarterAttribution;
  source: string;
  digest: string;
  fileName: string;
};

export type StarterTemplate = {
  id: string;
  title: string;
  description: string;
  route: Exclude<StarterRoute, "shared">;
  moduleIds: string[];
};

type EntryInput = {
  type: RackModuleFrontmatter["type"];
  slug: string;
  title: string;
  description: string;
  routes: StarterRoute[];
  tags: string[];
  body: string;
  harness?: Record<string, unknown>;
  schemaVersion?: "0.1" | "0.2";
  attribution?: StarterAttribution;
};

const normaliseSource = (value: string): string =>
  value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

export const starterContentDigest = (value: string): string => {
  const source = normaliseSource(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    hash ^= BigInt(code & 0xff);
    hash = (hash * prime) & mask;
    hash ^= BigInt((code >>> 8) & 0xff);
    hash = (hash * prime) & mask;
  }

  return `fnv1a64-u16:${hash.toString(16).padStart(16, "0")}`;
};

export const starterSourcesEqual = (left: string, right: string): boolean =>
  normaliseSource(left).trimEnd() === normaliseSource(right).trimEnd();

const makeEntry = (input: EntryInput): StarterEntry => {
  const id = `@rack-starter/${input.slug}`;
  const frontmatter = moduleFrontmatterSchema.parse({
    type: input.type,
    title: input.title,
    description: input.description,
    tags: input.tags,
    harness: {
      schema_version: input.schemaVersion ?? "0.1",
      id,
      version: "0.1.0",
      source: {
        origin: STARTER_SOURCE_ORIGIN,
        license: STARTER_CONTENT_LICENSE,
      },
      ...(input.harness ?? {}),
    },
  });
  const attribution = input.attribution
    ? [
        `# Starter attribution: ${input.attribution.name}`,
        ...(input.attribution.url ? [`# Source: ${input.attribution.url}`] : []),
        ...(input.attribution.note ? [`# Note: ${input.attribution.note}`] : []),
      ].join("\n")
    : "";
  const source = `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}${attribution ? `\n${attribution}` : ""}\n---\n\n${input.body.trim()}\n`;

  return {
    id,
    title: input.title,
    description: input.description,
    type: input.type,
    routes: input.routes,
    tags: input.tags,
    attribution: input.attribution,
    source,
    digest: starterContentDigest(source),
    fileName: `${input.slug.replace(/\./g, "-")}.md`,
  };
};

const allRoutes: StarterRoute[] = ["shared", "writing", "research", "coding"];

export const starterCatalogue: readonly StarterEntry[] = [
  makeEntry({
    type: "context",
    slug: "context.organisation",
    title: "Organisation context",
    description: "Keep purpose, constraints and operating context visible in the work.",
    routes: allRoutes,
    tags: ["context", "organisation", "shared"],
    harness: { context_kind: "organisation", criticality: "recommended" },
    body: `Use the organisation's stated purpose, responsibilities and constraints as working context. Distinguish durable organisational facts from assumptions made for this task. If the source does not establish something, say so rather than filling the gap.`,
  }),
  makeEntry({
    type: "context",
    slug: "context.audience",
    title: "Audience context",
    description: "Shape language and detail around the people who will actually use the output.",
    routes: allRoutes,
    tags: ["context", "audience", "shared"],
    harness: { context_kind: "audience" },
    body: `Write for the stated audience, their likely level of knowledge and the action they need to take. Prefer useful explanation over display of expertise. Do not assume specialist terminology is understood unless the audience context says it is.`,
  }),
  makeEntry({
    type: "context",
    slug: "context.project",
    title: "Project context",
    description: "Anchor work in the current goal, stage, constraints and decisions already made.",
    routes: allRoutes,
    tags: ["context", "project", "shared"],
    harness: { context_kind: "project" },
    body: `Treat the current project goal, stage and agreed constraints as the primary frame. Preserve decisions that have already been made. Surface a genuine conflict instead of quietly reopening settled choices.`,
  }),
  makeEntry({
    type: "voice",
    slug: "voice.plain-language",
    title: "Plain language",
    description: "Prefer direct, everyday wording and explain necessary technical terms.",
    routes: allRoutes,
    tags: ["voice", "plain-language", "shared"],
    harness: {
      lexicon: {
        rules: [
          "Prefer short, concrete words when they carry the same meaning.",
          "Explain necessary specialist terms on first use.",
          "Use active constructions unless the actor is genuinely unknown or unimportant.",
        ],
        avoid: [
          { term: "utilise", reason: "Use 'use' unless the distinction matters." },
          { term: "leverage", reason: "Prefer a concrete verb that says what is happening." },
        ],
      },
    },
    attribution: {
      name: "GOV.UK content design guidance",
      url: "https://www.gov.uk/guidance/content-design/writing-for-gov-uk",
      note: "Rack adaptation of established plain-language practice.",
    },
    body: `Make the useful meaning easy to find. Remove padding, inflated phrasing and needless abstraction. Keep nuance where it matters; plain language is not the same as simplistic language.`,
  }),
  makeEntry({
    type: "voice",
    slug: "voice.accessible",
    title: "Accessible communication",
    description: "Structure prose so it is easier to scan, understand and act on.",
    routes: allRoutes,
    tags: ["voice", "accessibility", "shared"],
    harness: {
      lexicon: {
        rules: [
          "Put the main point before supporting detail.",
          "Use descriptive headings when the output is long enough to need them.",
          "Do not rely on colour, visual position or unexplained abbreviations to carry meaning.",
        ],
      },
    },
    body: `Optimise for comprehension rather than density. Break up long passages when the structure helps the reader, and keep labels specific enough to make sense out of context.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.evidence",
    title: "Evidence boundary",
    description: "Keep facts, inference and recommendations visibly separate.",
    routes: allRoutes,
    tags: ["guardrail", "evidence", "shared"],
    harness: {
      criticality: "required",
      rules: [
        { id: "mark-inference", statement: "Do not present inference or assumption as an established fact." },
        { id: "trace-claims", statement: "When a claim depends on supplied evidence, keep enough context to trace it back to that evidence." },
      ],
    },
    body: `Use the strongest available evidence without pretending it is stronger than it is. Where the evidence is partial, conflicting or absent, make that visible in the answer.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.privacy",
    title: "Privacy and sensitive information",
    description: "Use only the personal or confidential information genuinely needed for the task.",
    routes: allRoutes,
    tags: ["guardrail", "privacy", "shared"],
    harness: {
      criticality: "required",
      rules: [
        { id: "minimise-data", statement: "Do not repeat or expose sensitive information unless it is necessary to complete the requested work." },
        { id: "no-secrets", statement: "Never invent, expose or request credentials, secrets or private keys as part of ordinary output." },
      ],
    },
    body: `Minimise sensitive detail. Prefer describing what is needed over reproducing private material, and call out a risky handling step before proceeding with it.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.uncertainty",
    title: "Uncertainty",
    description: "Say what is known, what is uncertain and what would resolve the uncertainty.",
    routes: allRoutes,
    tags: ["guardrail", "uncertainty", "shared"],
    harness: {
      rules: [
        { id: "state-uncertainty", statement: "State material uncertainty rather than hiding it behind confident language." },
        { id: "resolution", statement: "Where useful, identify the smallest next check that would materially reduce uncertainty." },
      ],
    },
    body: `Use confidence proportionate to the evidence. Avoid generic caveats; name the uncertainty that actually affects the decision or output.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.question-first",
    title: "Question first",
    description: "Start from the question or decision before gathering or producing material.",
    routes: allRoutes,
    tags: ["method", "questions", "shared"],
    harness: { stages: ["question", "context", "work", "check"] },
    attribution: {
      name: "Data for Action — question-centred approach",
      note: "Adapted for reusable Rack instructions.",
    },
    body: `Begin by identifying the question that needs answering or the decision the work needs to support. Use that to decide what information, structure and level of detail are useful. Do not let the available data or material define the question by default.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.structure",
    title: "Useful structure",
    description: "Organise outputs around decisions, actions and the reader's path through the material.",
    routes: allRoutes,
    tags: ["craft", "structure", "shared"],
    harness: { craft_domain: "structure" },
    body: `Choose a structure that reflects how the output will be used. Lead with the conclusion or next action when that is what the reader needs, then provide the evidence or detail that supports it.`,
  }),

  makeEntry({
    type: "context",
    slug: "context.channel",
    title: "Channel and format",
    description: "Fit the writing to where it will be read or sent.",
    routes: ["writing"],
    tags: ["writing", "context", "format"],
    harness: { context_kind: "reference" },
    body: `Respect the conventions and constraints of the stated channel: email, chat, web copy, report, social post or another format. Preserve the substance while adjusting length, hierarchy and formality to the medium.`,
  }),
  makeEntry({
    type: "voice",
    slug: "voice.warm-editorial",
    title: "Warm editorial voice",
    description: "Sound human, capable and specific without corporate gloss.",
    routes: ["writing"],
    tags: ["writing", "voice", "editorial"],
    harness: {
      lexicon: {
        rules: [
          "Use a natural professional voice rather than marketing copy.",
          "Prefer specific observations to generic enthusiasm.",
          "Keep warmth in the phrasing without becoming over-familiar.",
        ],
        avoid: [
          { term: "game-changing", reason: "Use a specific description of the change instead." },
          { term: "delighted", reason: "Use only when the writer would genuinely choose it." },
        ],
      },
    },
    body: `Write like a thoughtful person who knows the subject and respects the reader's time. Let clarity and specificity do more work than adjectives.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.concise",
    title: "Concise drafting",
    description: "Remove repetition and padding without removing useful nuance.",
    routes: ["writing"],
    tags: ["writing", "craft", "concise"],
    harness: { craft_domain: "writing" },
    body: `Keep each sentence doing a job. Remove repeated setup, throat-clearing and conclusions that merely restate the paragraph above. Retain detail that changes meaning, confidence or the reader's next action.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.client-ready",
    title: "Client-ready writing",
    description: "Make recommendations clear, proportionate and easy to discuss with a client.",
    routes: ["writing"],
    tags: ["writing", "craft", "client"],
    harness: { craft_domain: "writing" },
    body: `Write so the reader can distinguish what you observed, what you recommend and what still needs discussion. Avoid pretending a rough estimate or early view is a settled commitment.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.draft-review",
    title: "Draft, then review",
    description: "Separate getting the substance right from polishing the final wording.",
    routes: ["writing"],
    tags: ["writing", "method", "review"],
    harness: { stages: ["purpose", "draft", "review", "polish"] },
    body: `Draft for substance first. Then review against audience, purpose, evidence and tone before polishing individual sentences. Do not polish a structure that is solving the wrong problem.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.no-invented-facts",
    title: "No invented details",
    description: "Do not make finished writing sound complete by filling factual gaps.",
    routes: ["writing"],
    tags: ["writing", "guardrail", "facts"],
    harness: {
      criticality: "required",
      rules: [
        { id: "no-invention", statement: "Do not invent names, dates, figures, quotes, links or commitments that are not established by the source or request." },
      ],
    },
    body: `A polished draft must remain truthful to the material supplied. Use a visible placeholder or a concise note when a missing detail is genuinely required.`,
  }),
  makeEntry({
    type: "task",
    slug: "task.rewrite",
    title: "Rewrite a draft",
    description: "Turn rough source material into a usable version while preserving meaning.",
    routes: ["writing"],
    tags: ["writing", "task", "rewrite"],
    harness: {
      trigger: { command: "rewrite", label: "Rewrite a draft" },
      inputs: [
        { name: "draft", label: "Draft or notes", type: "markdown", required: true },
        { name: "audience", label: "Audience", type: "string", required: false },
      ],
      stages: [
        { id: "intent", label: "Identify the intended meaning and action" },
        { id: "rewrite", label: "Rewrite for clarity and voice" },
        { id: "check", label: "Check facts, omissions and tone" },
      ],
    },
    body: `Preserve the author's actual point while improving structure, clarity and tone. Do not introduce new claims simply to make the draft sound more complete.`,
  }),
  makeEntry({
    type: "task",
    slug: "task.client-email",
    title: "Draft a client email",
    description: "Produce a clear email with the decision, request or next step easy to find.",
    routes: ["writing"],
    tags: ["writing", "task", "email"],
    harness: {
      trigger: { command: "client-email", label: "Draft a client email" },
      inputs: [
        { name: "purpose", label: "What the email needs to do", type: "string", required: true },
        { name: "notes", label: "Source notes", type: "markdown", required: true },
      ],
      stages: [
        { id: "purpose", label: "Make the purpose explicit" },
        { id: "draft", label: "Draft the shortest useful email" },
        { id: "next-step", label: "Make the next step clear" },
      ],
    },
    body: `Put the reason for writing early. Include enough context for the recipient to act, but do not bury the ask or decision in background detail.`,
  }),

  makeEntry({
    type: "context",
    slug: "context.research-question",
    title: "Research question",
    description: "Keep the investigation anchored in a specific uncertainty or decision.",
    routes: ["research"],
    tags: ["research", "context", "questions"],
    harness: { context_kind: "project" },
    body: `State the research question in a form that can guide evidence gathering and synthesis. Note what decision, judgement or next action the answer will inform.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.source-assessment",
    title: "Assess sources",
    description: "Check provenance, incentives, recency and corroboration before relying on a source.",
    routes: ["research"],
    tags: ["research", "method", "sources"],
    harness: { stages: ["provenance", "context", "corroboration", "use"] },
    attribution: {
      name: "SIFT / Mike Caulfield",
      url: "https://hapgood.us/2019/06/19/sift-the-four-moves/",
      note: "Rack adaptation using lateral reading and source tracing ideas.",
    },
    body: `Before relying on a source, check who produced it, what it is actually evidence of, whether stronger or more primary material is available, and whether independent sources support the important claim.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.triangulation",
    title: "Triangulate evidence",
    description: "Use independent evidence to test important claims and explain disagreement.",
    routes: ["research"],
    tags: ["research", "method", "evidence"],
    harness: { stages: ["claim", "sources", "compare", "resolve"] },
    body: `For material claims, look for independent evidence rather than counting repeated versions of the same source as corroboration. Where sources disagree, investigate the reason for the disagreement before averaging it away.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.synthesis",
    title: "Synthesis",
    description: "Combine evidence around the question rather than producing a source-by-source digest.",
    routes: ["research"],
    tags: ["research", "method", "synthesis"],
    harness: { stages: ["patterns", "differences", "answer", "gaps"] },
    body: `Organise findings around the research question, the patterns that matter and the differences that change the answer. Keep significant gaps and contradictions visible.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.citation-notes",
    title: "Traceable research notes",
    description: "Keep enough source detail to trace claims back to where they came from.",
    routes: ["research"],
    tags: ["research", "craft", "citations"],
    harness: { craft_domain: "research" },
    body: `Capture the source, the specific claim or evidence used, and any relevant date or scope. Do not attach a citation to a broader statement than the source actually supports.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.source-boundaries",
    title: "Source boundaries",
    description: "Do not stretch a source beyond its population, timeframe, geography or method.",
    routes: ["research"],
    tags: ["research", "guardrail", "sources"],
    harness: {
      criticality: "required",
      rules: [
        { id: "respect-scope", statement: "Do not generalise beyond a source's stated population, geography, timeframe or method without marking the inference." },
      ],
    },
    body: `Preserve the boundaries that determine what a source can support. Flag when a useful finding is suggestive rather than directly transferable to the question at hand.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.recency",
    title: "Recency and change",
    description: "Check whether time-sensitive claims are still current enough for the decision.",
    routes: ["research"],
    tags: ["research", "guardrail", "recency"],
    harness: {
      rules: [
        { id: "check-date", statement: "For claims that can change materially over time, establish the source date and whether a newer authoritative source is needed." },
      ],
    },
    body: `Treat freshness as part of source quality when the subject changes over time. An older source may still be useful for background, but it should not silently answer a current-state question.`,
  }),
  makeEntry({
    type: "task",
    slug: "task.research-brief",
    title: "Research a question",
    description: "Run a bounded investigation and return an evidence-led answer with gaps.",
    routes: ["research"],
    tags: ["research", "task", "brief"],
    harness: {
      trigger: { command: "research-brief", label: "Research a question" },
      inputs: [
        { name: "question", label: "Research question", type: "string", required: true },
        { name: "decision", label: "Decision this informs", type: "string", required: false },
      ],
      stages: [
        { id: "frame", label: "Frame the question and boundaries" },
        { id: "gather", label: "Gather relevant evidence" },
        { id: "assess", label: "Assess and compare sources" },
        { id: "synthesise", label: "Synthesise the answer" },
        { id: "gaps", label: "State uncertainty and remaining gaps" },
      ],
    },
    body: `Answer the question rather than merely listing sources. Keep the path from evidence to conclusion visible, and finish with gaps that genuinely affect the answer.`,
  }),
  makeEntry({
    type: "task",
    slug: "task.compare-options",
    title: "Compare options",
    description: "Compare alternatives against explicit criteria and evidence.",
    routes: ["research"],
    tags: ["research", "task", "comparison"],
    harness: {
      trigger: { command: "compare-options", label: "Compare options" },
      inputs: [
        { name: "options", label: "Options to compare", type: "markdown", required: true },
        { name: "criteria", label: "Decision criteria", type: "markdown", required: true },
      ],
      stages: [
        { id: "criteria", label: "Check the comparison criteria" },
        { id: "evidence", label: "Gather comparable evidence" },
        { id: "tradeoffs", label: "Explain trade-offs and uncertainty" },
        { id: "recommend", label: "Recommend only where the evidence supports it" },
      ],
    },
    body: `Use consistent criteria across options. Distinguish missing evidence from poor performance, and do not create false precision with scores that the evidence cannot support.`,
  }),

  makeEntry({
    type: "context",
    slug: "context.repository",
    title: "Repository context",
    description: "Work with the repository's existing structure, conventions and compatibility constraints.",
    routes: ["coding"],
    tags: ["coding", "context", "repository"],
    harness: { context_kind: "project" },
    body: `Treat the existing codebase as part of the specification. Inspect nearby components, tests, configuration and established patterns before introducing a new abstraction or dependency.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.inspect-plan-implement",
    title: "Inspect, plan, implement, verify",
    description: "Understand the change surface before editing and verify the result afterwards.",
    routes: ["coding"],
    tags: ["coding", "method", "implementation"],
    harness: { stages: ["inspect", "plan", "implement", "verify"] },
    body: `Inspect the relevant code and constraints first. Make the smallest coherent plan, implement in reviewable pieces, then run the strongest available checks. Do not claim verification that was not actually performed.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.componentise",
    title: "Componentise changes",
    description: "Keep implementation split into coherent units with clear responsibilities.",
    routes: ["coding"],
    tags: ["coding", "craft", "components"],
    harness: { craft_domain: "software" },
    body: `Prefer small components, modules or functions with a clear reason to change. Reuse an existing abstraction when it genuinely fits; do not force unrelated behaviour into a shared helper merely to reduce line count.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.testing",
    title: "Tests with the change",
    description: "Add or update tests at the behaviour boundary affected by the change.",
    routes: ["coding"],
    tags: ["coding", "craft", "testing"],
    harness: { craft_domain: "software" },
    body: `Test the behaviour that would regress if the implementation were wrong. Prefer focused tests that express the contract over broad snapshots that make failures hard to interpret.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.smallest-useful-change",
    title: "Smallest useful change",
    description: "Solve the requested problem without speculative architecture or unrelated refactoring.",
    routes: ["coding"],
    tags: ["coding", "method", "scope"],
    harness: { stages: ["scope", "reuse", "change", "verify"] },
    body: `Start with the smallest coherent change that satisfies the requested behaviour. Reuse sound existing code before adding abstractions, and do not broaden the implementation into speculative future needs. If an adjacent change is genuinely required, make that dependency explicit.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.dependency-discipline",
    title: "Dependency discipline",
    description: "Prefer existing code, platform capabilities and current dependencies before adding another dependency.",
    routes: ["coding"],
    tags: ["coding", "craft", "dependencies"],
    harness: { craft_domain: "software" },
    body: `Before adding a dependency, check whether the repository already contains a suitable abstraction, whether the language or platform provides the capability, and whether an existing dependency already covers the need. Add a new dependency only when it creates a clear maintenance or correctness benefit.`,
  }),
  makeEntry({
    type: "craft",
    slug: "craft.remove-before-add",
    title: "Remove before adding",
    description: "Check whether simplifying or removing code is better than introducing another layer.",
    routes: ["coding"],
    tags: ["coding", "craft", "simplicity"],
    harness: { craft_domain: "software" },
    body: `When changing an awkward path, first ask whether obsolete code, duplication or an unnecessary abstraction can be removed. Prefer a smaller understandable system over preserving accidental complexity. Do not remove compatibility, validation, security, migration or error-handling behaviour merely to reduce code.`,
  }),
  makeEntry({
    type: "method",
    slug: "method.agent-handoff",
    title: "Efficient agent hand-off",
    description: "Pass concise state, evidence and next actions between coding agents without losing important constraints.",
    routes: ["coding"],
    tags: ["coding", "method", "agents"],
    harness: { stages: ["state", "evidence", "next"] },
    body: `When another agent or AI tool will continue the work, hand over the current state, decisions, changed files, verification actually performed, unresolved risks and the next useful action. Prefer compact structured evidence over conversational recap, but never omit a boundary or uncertainty merely to save tokens.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.change-verification",
    title: "Verify consequential code changes",
    description: "Combine trusted repository checks with fresh semantic judgement before treating a consequential change as complete.",
    routes: ["coding"],
    tags: ["coding", "guardrail", "verification"],
    schemaVersion: "0.2",
    harness: {
      criticality: "required",
      enforcement: ["instruction", "output_check", "rubric_eval"],
      verification: [
        {
          id: "repository-checks",
          kind: "automatic",
          label: "Repository checks pass",
          check: "repository-checks",
          requirement: "Run the Rack-owned trusted repository verification path and require the configured tests, type checks and builds to complete successfully.",
          evidence: ["test-results", "build-results"],
          on_fail: "block",
        },
        {
          id: "scope-and-tests",
          kind: "judgement",
          label: "The change is scoped and meaningfully tested",
          question: "Does the implementation stay within the requested scope, preserve important compatibility and security boundaries, and include meaningful verification for the behaviour changed?",
          evidence: ["diff", "test-results", "build-results"],
          on_fail: "block",
          on_uncertain: "human_review",
        },
      ],
      rules: [
        { id: "no-unverified-claim", statement: "Do not describe a consequential code change as verified unless the stated checks were actually completed." },
      ],
    },
    body: `Use deterministic checks for facts software can establish and a fresh bounded judgement for semantic questions. Missing, malformed or unavailable verification is not a pass; surface it as incomplete or escalate it for review.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.security",
    title: "Security boundaries",
    description: "Do not weaken authentication, authorisation, secret handling or path safety to make a change work.",
    routes: ["coding"],
    tags: ["coding", "guardrail", "security"],
    harness: {
      criticality: "required",
      rules: [
        { id: "no-bypass", statement: "Do not bypass authentication, authorisation, validation or secret-handling controls to make an implementation pass." },
        { id: "validate-boundaries", statement: "Treat file, network and user-controlled inputs as trust boundaries and preserve the repository's validation pattern." },
      ],
    },
    body: `Keep security controls explicit in the implementation and review. A test or local environment is not a reason to normalise an unsafe production path.`,
  }),
  makeEntry({
    type: "guardrail",
    slug: "guardrail.compatibility",
    title: "Compatibility",
    description: "Preserve supported interfaces and platforms unless the change explicitly intends to break them.",
    routes: ["coding"],
    tags: ["coding", "guardrail", "compatibility"],
    harness: {
      rules: [
        { id: "preserve-contracts", statement: "Do not silently change public interfaces, file formats or supported-platform behaviour outside the requested scope." },
      ],
    },
    body: `Check the compatibility surface before changing shared schemas, APIs or generated formats. When a breaking change is required, make it explicit and update the corresponding tests and documentation.`,
  }),
  makeEntry({
    type: "task",
    slug: "task.implement-change",
    title: "Implement a code change",
    description: "Take a bounded change from inspection through implementation and verification.",
    routes: ["coding"],
    tags: ["coding", "task", "implementation"],
    harness: {
      trigger: { command: "implement-change", label: "Implement a code change" },
      inputs: [
        { name: "change", label: "Requested change", type: "markdown", required: true },
        { name: "constraints", label: "Constraints", type: "markdown", required: false },
      ],
      stages: [
        { id: "inspect", label: "Inspect relevant code and tests" },
        { id: "plan", label: "Plan the smallest coherent change" },
        { id: "implement", label: "Implement in clear components" },
        { id: "verify", label: "Run checks and report what was verified" },
      ],
    },
    body: `Keep the implementation inside the requested scope unless a dependency makes an adjacent change necessary. Explain that dependency rather than quietly broadening the work.`,
  }),
  makeEntry({
    type: "task",
    slug: "task.review-code",
    title: "Review a code change",
    description: "Review for correctness, regressions, maintainability and missing verification.",
    routes: ["coding"],
    tags: ["coding", "task", "review"],
    harness: {
      trigger: { command: "review-code", label: "Review a code change" },
      inputs: [
        { name: "change", label: "Change or diff", type: "markdown", required: true },
      ],
      stages: [
        { id: "intent", label: "Understand the intended behaviour" },
        { id: "correctness", label: "Check correctness and edge cases" },
        { id: "regressions", label: "Check compatibility and security" },
        { id: "tests", label: "Check verification and test coverage" },
      ],
    },
    body: `Prioritise findings that can change behaviour, safety or maintainability. Distinguish a concrete defect from a preference, and point to the affected behaviour rather than reviewing by taste alone.`,
  }),
].sort((left, right) => left.title.localeCompare(right.title));

export const starterTemplates: readonly StarterTemplate[] = [
  {
    id: "clear-writing",
    title: "Clear everyday writing",
    description: "A small shared writing set for clear, audience-aware drafting and rewriting.",
    route: "writing",
    moduleIds: [
      "@rack-starter/context.audience",
      "@rack-starter/voice.plain-language",
      "@rack-starter/voice.accessible",
      "@rack-starter/guardrail.no-invented-facts",
      "@rack-starter/task.rewrite",
    ],
  },
  {
    id: "client-communication",
    title: "Client communication",
    description: "Warm, concise client-facing writing with clear evidence and next steps.",
    route: "writing",
    moduleIds: [
      "@rack-starter/context.audience",
      "@rack-starter/context.channel",
      "@rack-starter/voice.warm-editorial",
      "@rack-starter/craft.client-ready",
      "@rack-starter/guardrail.no-invented-facts",
      "@rack-starter/task.client-email",
    ],
  },
  {
    id: "evidence-review",
    title: "Evidence review",
    description: "A source-aware research set for assessing, tracing and synthesising evidence.",
    route: "research",
    moduleIds: [
      "@rack-starter/context.research-question",
      "@rack-starter/method.source-assessment",
      "@rack-starter/method.triangulation",
      "@rack-starter/method.synthesis",
      "@rack-starter/craft.citation-notes",
      "@rack-starter/guardrail.source-boundaries",
      "@rack-starter/guardrail.recency",
    ],
  },
  {
    id: "decision-research",
    title: "Decision research",
    description: "Question-led research that compares options without hiding gaps or uncertainty.",
    route: "research",
    moduleIds: [
      "@rack-starter/method.question-first",
      "@rack-starter/guardrail.evidence",
      "@rack-starter/guardrail.uncertainty",
      "@rack-starter/method.source-assessment",
      "@rack-starter/task.compare-options",
    ],
  },
  {
    id: "careful-code-change",
    title: "Careful code change",
    description: "A practical coding set for small, componentised changes with real verification.",
    route: "coding",
    moduleIds: [
      "@rack-starter/context.repository",
      "@rack-starter/method.inspect-plan-implement",
      "@rack-starter/method.smallest-useful-change",
      "@rack-starter/craft.componentise",
      "@rack-starter/craft.dependency-discipline",
      "@rack-starter/craft.remove-before-add",
      "@rack-starter/craft.testing",
      "@rack-starter/guardrail.change-verification",
      "@rack-starter/guardrail.security",
      "@rack-starter/guardrail.compatibility",
      "@rack-starter/task.implement-change",
    ],
  },
  {
    id: "repository-review",
    title: "Repository review",
    description: "A focused set for reviewing code against intent, safety, compatibility and tests.",
    route: "coding",
    moduleIds: [
      "@rack-starter/context.repository",
      "@rack-starter/guardrail.security",
      "@rack-starter/guardrail.compatibility",
      "@rack-starter/craft.testing",
      "@rack-starter/guardrail.change-verification",
      "@rack-starter/task.review-code",
    ],
  },
  {
    id: "lean-code-change",
    title: "Lean code change",
    description: "A restrained implementation set that favours the smallest useful change, disciplined dependencies and explicit verification.",
    route: "coding",
    moduleIds: [
      "@rack-starter/context.repository",
      "@rack-starter/method.smallest-useful-change",
      "@rack-starter/craft.dependency-discipline",
      "@rack-starter/craft.remove-before-add",
      "@rack-starter/craft.testing",
      "@rack-starter/guardrail.security",
      "@rack-starter/guardrail.compatibility",
      "@rack-starter/guardrail.change-verification",
      "@rack-starter/task.implement-change",
    ],
  },
  {
    id: "agent-code-handoff",
    title: "Agent code hand-off",
    description: "A coding set for work that may move between AI tools or agents without losing decisions, evidence or safety boundaries.",
    route: "coding",
    moduleIds: [
      "@rack-starter/context.repository",
      "@rack-starter/method.inspect-plan-implement",
      "@rack-starter/method.agent-handoff",
      "@rack-starter/guardrail.security",
      "@rack-starter/guardrail.compatibility",
      "@rack-starter/guardrail.change-verification",
      "@rack-starter/task.implement-change",
      "@rack-starter/task.review-code",
    ],
  },
];

export type StarterSearch = {
  query?: string;
  route?: Exclude<StarterRoute, "shared">;
  type?: RackModuleFrontmatter["type"];
  tag?: string;
};

export const searchStarterCatalogue = (
  filters: StarterSearch = {},
): StarterEntry[] => {
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  const tag = filters.tag?.trim().toLocaleLowerCase() ?? "";

  return starterCatalogue.filter((entry) => {
    if (filters.route && !entry.routes.includes(filters.route)) return false;
    if (filters.type && entry.type !== filters.type) return false;
    if (tag && !entry.tags.includes(tag)) return false;
    if (!query) return true;

    const haystack = [
      entry.id,
      entry.title,
      entry.description,
      entry.type,
      ...entry.tags,
      ...entry.routes,
      entry.attribution?.name ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return query
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => haystack.includes(term));
  });
};

export const getStarterEntry = (id: string): StarterEntry | undefined =>
  starterCatalogue.find((entry) => entry.id === id);

export const getStarterTemplate = (id: string): StarterTemplate | undefined =>
  starterTemplates.find((template) => template.id === id);
