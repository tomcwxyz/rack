import { z } from "zod";
import {
  practiceAuthoritySchema,
  practiceExperimentSchema,
} from "./practice.js";

export const schemaVersionSchema = z.literal("0.1");
export const moduleSchemaVersionSchema = z.enum(["0.1", "0.2"]);
export const slugSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, "Expected a lowercase slug.");
export const moduleIdSchema = z.string().regex(
  /^(?:@[a-z][a-z0-9-]*\/)?[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/,
  "Expected a local ID such as voice.tone or a scoped ID such as @rack-starter/voice.plain.",
);
export const semanticVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "Expected a semantic version such as 0.1.0.",
);
export const moduleTypeSchema = z.enum([
  "context", "voice", "method", "craft", "guardrail", "task", "tools",
]);
export const destinationIdSchema = z.enum([
  "prompt", "agents-md", "claude-code", "opencode", "codex", "hermes-agent", "openclaw",
]);
export const adapterCapabilityIdSchema = z.enum([
  "commands",
  "skills",
  "tools",
  "bootstrapContext",
  "hostPolicies",
  "multipleFiles",
  "onDemandModules",
]);

export const enforcementModeSchema = z.enum([
  "instruction",
  "output_check",
  "rubric_eval",
  "adversarial_eval",
  "host_policy",
  "human_review",
]);

export const verificationEvidenceSchema = z.enum([
  "output",
  "diff",
  "test-results",
  "build-results",
  "task-input",
  "source",
]);

export const verificationFailureActionSchema = z.enum([
  "block",
  "warn",
  "human_review",
]);

const verificationBase = {
  id: slugSchema,
  label: z.string().min(1).max(160),
  evidence: z.array(verificationEvidenceSchema).default([]),
};

export const verificationStepSchema = z.discriminatedUnion("kind", [
  z.object({
    ...verificationBase,
    kind: z.literal("automatic"),
    check: slugSchema,
    requirement: z.string().min(1).max(2_000),
    on_fail: verificationFailureActionSchema.default("block"),
  }).strict(),
  z.object({
    ...verificationBase,
    kind: z.literal("judgement"),
    question: z.string().min(1).max(4_000),
    on_fail: verificationFailureActionSchema.default("block"),
    on_uncertain: verificationFailureActionSchema.default("human_review"),
  }).strict(),
  z.object({
    ...verificationBase,
    kind: z.literal("human"),
    prompt: z.string().min(1).max(4_000),
    required_for_completion: z.boolean().default(true),
  }).strict(),
]);

const dependencySchema = z.object({ id: moduleIdSchema, version: z.string().optional() }).strict();
const sourceSchema = z.object({
  origin: z.string().default("local"),
  license: z.string().nullable().default(null),
  forked_from: moduleIdSchema.optional(),
}).strict();
const emitSchema = z.object({
  priority: z.number().int().min(0).max(1000).default(50),
  targets: z.union([z.literal("all"), z.array(slugSchema)]).default("all"),
}).strict();
const capabilitiesSchema = z.object({
  required: z.array(adapterCapabilityIdSchema).default([]),
}).strict();
const commonHarness = {
  schema_version: moduleSchemaVersionSchema,
  id: moduleIdSchema,
  version: semanticVersionSchema,
  applies_to: z.union([z.literal("all"), z.array(slugSchema)]).default("all"),
  requires: z.array(dependencySchema).default([]),
  criticality: z.enum(["required", "recommended", "optional"]).default("recommended"),
  authority: practiceAuthoritySchema.optional(),
  experiment: practiceExperimentSchema.optional(),
  enforcement: z.array(enforcementModeSchema).min(1).default(["instruction"]),
  verification: z.array(verificationStepSchema).optional(),
  capabilities: capabilitiesSchema.default({ required: [] }),
  emit: emitSchema.default({ priority: 50, targets: "all" }),
  source: sourceSchema.default({ origin: "local", license: null }),
};
const base = {
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  tags: z.array(slugSchema).default([]),
};

const contextModule = z.object({
  type: z.literal("context"), ...base,
  harness: z.object({
    ...commonHarness,
    context_kind: z.enum(["organisation", "audience", "domain", "project", "reference"]).default("reference"),
  }).strict(),
}).strict();

const voiceModule = z.object({
  type: z.literal("voice"), ...base,
  harness: z.object({
    ...commonHarness,
    lexicon: z.object({
      never: z.array(z.object({
        term: z.string().min(1),
        match: z.enum(["word", "phrase", "substring", "regex"]).default("phrase"),
        scope: z.enum(["all_output", "authored_prose", "selected_fields"]).default("authored_prose"),
        exceptions: z.array(z.string()).default([]),
      }).strict()).default([]),
      prefer: z.array(z.object({
        use: z.string().min(1),
        instead_of: z.array(z.string().min(1)).min(1),
        strength: z.enum(["preference", "required"]).default("preference"),
      }).strict()).default([]),
      avoid: z.array(z.object({ term: z.string().min(1), reason: z.string().optional() }).strict()).default([]),
      rules: z.array(z.string().min(1)).default([]),
    }).strict().default({ never: [], prefer: [], avoid: [], rules: [] }),
  }).strict(),
}).strict();

const methodModule = z.object({
  type: z.literal("method"), ...base,
  harness: z.object({ ...commonHarness, stages: z.array(slugSchema).default([]) }).strict(),
}).strict();

const craftModule = z.object({
  type: z.literal("craft"), ...base,
  harness: z.object({ ...commonHarness, craft_domain: slugSchema }).strict(),
}).strict();

const guardrailModule = z.object({
  type: z.literal("guardrail"), ...base,
  harness: z.object({
    ...commonHarness,
    rules: z.array(z.object({
      id: slugSchema, statement: z.string().min(1), refusal: z.string().optional(),
    }).strict()).default([]),
  }).strict(),
}).strict();

const taskModule = z.object({
  type: z.literal("task"), ...base,
  harness: z.object({
    ...commonHarness,
    trigger: z.object({ command: slugSchema.optional(), label: z.string().min(1) }).strict(),
    inputs: z.array(z.object({
      name: slugSchema,
      label: z.string().min(1),
      type: z.enum(["string", "markdown", "number", "boolean"]),
      required: z.boolean().default(false),
    }).strict()).default([]),
    stages: z.array(z.object({ id: slugSchema, label: z.string().min(1) }).strict()).default([]),
    acceptance: z.object({
      suites: z.array(slugSchema).default([]),
      required_for_verification: z.boolean().default(true),
    }).strict().optional(),
  }).strict(),
}).strict();

const toolsModule = z.object({
  type: z.literal("tools"), ...base,
  harness: z.object({
    ...commonHarness,
    servers: z.array(z.object({
      id: slugSchema,
      name: z.string().min(1),
      transport: z.enum(["url", "stdio"]),
      url: z.url().optional(),
      command: z.string().optional(),
      authentication: z.object({
        kind: z.enum(["none", "environment"]).default("none"),
        variable: z.string().optional(),
      }).strict().optional(),
    }).strict()).default([]),
  }).strict(),
}).strict();

const moduleFrontmatterBaseSchema = z.discriminatedUnion("type", [
  contextModule, voiceModule, methodModule, craftModule, guardrailModule, taskModule, toolsModule,
]);

export const moduleFrontmatterSchema = moduleFrontmatterBaseSchema.superRefine(
  (module, context) => {
    if (module.harness.schema_version === "0.1") {
      if (module.harness.authority !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["harness", "authority"],
          message: "authority requires module schema_version 0.2.",
        });
      }
      if (module.harness.experiment !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["harness", "experiment"],
          message: "experiment requires module schema_version 0.2.",
        });
      }
      if ((module.harness.verification?.length ?? 0) > 0) {
        context.addIssue({
          code: "custom",
          path: ["harness", "verification"],
          message: "verification requires module schema_version 0.2.",
        });
      }
    }

    for (const [index, step] of (module.harness.verification ?? []).entries()) {
      const requiredMode =
        step.kind === "automatic"
          ? "output_check"
          : step.kind === "judgement"
            ? "rubric_eval"
            : "human_review";
      if (!module.harness.enforcement.includes(requiredMode)) {
        context.addIssue({
          code: "custom",
          path: ["harness", "verification", index, "kind"],
          message: `${step.kind} verification requires enforcement to include ${requiredMode}.`,
        });
      }
    }

    if (module.harness.experiment !== undefined) {
      if (module.harness.authority?.mode === "binding") {
        context.addIssue({
          code: "custom",
          path: ["harness", "experiment"],
          message: "An experiment cannot use binding authority.",
        });
      }
      if (!module.harness.authority?.review_after) {
        context.addIssue({
          code: "custom",
          path: ["harness", "authority", "review_after"],
          message: "An experiment requires authority.review_after.",
        });
      }
    }
  },
);

const destinationConfig = z.object({ enabled: z.boolean().default(false) }).passthrough();
export const rackManifestSchema = z.object({
  schema_version: schemaVersionSchema,
  name: slugSchema,
  version: semanticVersionSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  author: z.object({ name: z.string().min(1), organisation: z.string().optional() }).strict(),
  license: z.string().nullable().default(null),
  okf_root: z.string().default("modules"),
  default_profile: slugSchema,
  profiles: z.array(slugSchema).min(1),
  targets: z.object({
    prompt: destinationConfig.optional(),
    "agents-md": destinationConfig.optional(),
    "claude-code": destinationConfig.optional(),
    opencode: destinationConfig.optional(),
    codex: destinationConfig.optional(),
    "hermes-agent": destinationConfig.optional(),
    openclaw: destinationConfig.optional(),
  }).strict().default({}),
  evaluation: z.object({ config: z.string().default("eval/config.yaml") })
    .strict().default({ config: "eval/config.yaml" }),
}).strict();

const budgetSchema = z.object({
  recommended_tokens: z.number().int().positive(),
  maximum_tokens: z.number().int().positive(),
}).strict().refine(
  (value) => value.maximum_tokens >= value.recommended_tokens,
  "maximum_tokens must be greater than or equal to recommended_tokens.",
);
export const profileSchema = z.object({
  schema_version: schemaVersionSchema,
  id: slugSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  domains: z.array(slugSchema).min(1),
  include: z.array(moduleIdSchema).default([]),
  exclude: z.array(moduleIdSchema).default([]),
  overrides: z.object({
    emit_priority: z.record(moduleIdSchema, z.number().int()).default({}),
    target_waivers: z.record(z.string(), z.array(moduleIdSchema)).default({}),
  }).strict().default({ emit_priority: {}, target_waivers: {} }),
  budgets: z.record(z.string(), budgetSchema).default({}),
}).strict();

export type RackManifest = z.infer<typeof rackManifestSchema>;
export type RackProfile = z.infer<typeof profileSchema>;
export type RackModuleFrontmatter = z.infer<typeof moduleFrontmatterSchema>;
export type RackModule = RackModuleFrontmatter & { path: string; body: string };
export type DestinationId = z.infer<typeof destinationIdSchema>;
export type AdapterCapabilityId = z.infer<typeof adapterCapabilityIdSchema>;
export type EnforcementMode = z.infer<typeof enforcementModeSchema>;
export type VerificationEvidence = z.infer<typeof verificationEvidenceSchema>;
export type VerificationFailureAction = z.infer<typeof verificationFailureActionSchema>;
export type VerificationStep = z.infer<typeof verificationStepSchema>;

export * from "./practice.js";
