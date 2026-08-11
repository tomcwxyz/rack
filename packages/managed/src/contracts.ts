import { destinationIdSchema, slugSchema } from "@rack/schemas";
import { z } from "zod";

export const MANAGED_SCHEMA_VERSION = "0.1" as const;
export const MAX_TRANSIENT_RETENTION_HOURS = 24;
export const managedRunIdSchema = z.uuid();

export const rackFingerprintSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "Expected a sha256: fingerprint.");

export const quickCheckBudgetSchema = z
  .object({
    recommendedTokens: z.number().int().positive(),
    maximumTokens: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) => value.maximumTokens >= value.recommendedTokens,
    "maximumTokens must be greater than or equal to recommendedTokens.",
  );

export const quickCheckRequestSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    rackFingerprint: rackFingerprintSchema,
    profileId: slugSchema,
    target: destinationIdSchema,
    instructions: z.string().min(1).max(250_000),
    sampleOutput: z.string().max(250_000).optional(),
    budget: quickCheckBudgetSchema.optional(),
  })
  .strict();

export const reliableCheckRequestSchema = quickCheckRequestSchema;

export const quickCheckFindingSchema = z
  .object({
    code: z.enum([
      "budget-recommended",
      "budget-maximum",
      "placeholder-content",
      "possible-secret",
      "sample-possible-secret",
    ]),
    severity: z.enum(["info", "warning", "error"]),
    title: z.string().min(1).max(120),
  })
  .strict();

export const quickCheckCountsSchema = z
  .object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    information: z.number().int().nonnegative(),
  })
  .strict();

export const durableEvaluationSummarySchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    rackFingerprint: rackFingerprintSchema,
    profileId: slugSchema,
    target: destinationIdSchema,
    passed: z.boolean(),
    score: z.number().int().min(0).max(100),
    estimatedInstructionTokens: z.number().int().nonnegative(),
    counts: quickCheckCountsSchema,
    findings: z.array(quickCheckFindingSchema).max(30),
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const quickCheckResponseSchema = z
  .object({
    runId: managedRunIdSchema,
    workspaceId: z.uuid(),
    summary: durableEvaluationSummarySchema,
    transientContentExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const reliableCheckRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const reliableCheckStartResponseSchema = z
  .object({
    runId: managedRunIdSchema,
    workflowRunId: z.string().min(1).max(200),
    status: z.literal("queued"),
    transientContentExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const reliableCheckPendingStatusSchema = z
  .object({
    runId: managedRunIdSchema,
    status: z.enum(["queued", "running"]),
    summary: z.null(),
  })
  .strict();

const reliableCheckCompletedStatusSchema = z
  .object({
    runId: managedRunIdSchema,
    status: z.literal("completed"),
    summary: durableEvaluationSummarySchema,
  })
  .strict();

const reliableCheckFailedStatusSchema = z
  .object({
    runId: managedRunIdSchema,
    status: z.literal("failed"),
    summary: z.null(),
  })
  .strict();

export const reliableCheckStatusResponseSchema = z.union([
  reliableCheckPendingStatusSchema,
  reliableCheckCompletedStatusSchema,
  reliableCheckFailedStatusSchema,
]);

export const evaluationModeSchema = z.enum(["quick", "reliable"]);
const tokenEstimateSchema = z.number().int().nonnegative().max(1_000_000);
const moneySchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const evaluationPreflightRequestSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    mode: evaluationModeSchema,
    rackFingerprint: rackFingerprintSchema,
    profileId: slugSchema,
    target: destinationIdSchema,
    generatorAlias: slugSchema,
    judgeAlias: slugSchema.optional(),
    caseCount: z.number().int().positive().max(100),
    judgeCallsPerOutput: z.number().int().nonnegative().max(5),
    candidateInputTokensPerCase: tokenEstimateSchema,
    baselineInputTokensPerCase: tokenEstimateSchema.optional(),
    generatorOutputTokensPerCall: tokenEstimateSchema,
    judgePromptTokensPerCase: tokenEstimateSchema,
    judgeOutputTokensPerCall: tokenEstimateSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.mode === "quick") {
      if (request.judgeAlias !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["judgeAlias"],
          message: "Quick evaluation uses the selected generator model for configured rubric judging.",
        });
      }
      if (request.baselineInputTokensPerCase !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["baselineInputTokensPerCase"],
          message: "Quick evaluation does not run a baseline.",
        });
      }
    } else {
      if (!request.judgeAlias) {
        context.addIssue({
          code: "custom",
          path: ["judgeAlias"],
          message: "Reliable evaluation requires a recorded judge alias.",
        });
      }
      if (request.baselineInputTokensPerCase === undefined) {
        context.addIssue({
          code: "custom",
          path: ["baselineInputTokensPerCase"],
          message: "Reliable evaluation requires a baseline input-token estimate.",
        });
      }
      if (request.judgeCallsPerOutput < 1) {
        context.addIssue({
          code: "custom",
          path: ["judgeCallsPerOutput"],
          message: "Reliable evaluation requires at least one rubric judge call per output.",
        });
      }
    }
  });

export const evaluationPreflightLimitsSchema = z
  .object({
    perRunCapMicrousd: moneySchema,
    workspaceRemainingMicrousd: moneySchema,
    activePaidRuns: z.number().int().nonnegative().max(1_000),
    concurrencyLimit: z.number().int().positive().max(1_000),
    maxProviderAttemptsPerCall: z.number().int().positive().max(5),
  })
  .strict();

export const evaluationPreflightWarningSchema = z
  .object({
    code: z.enum(["judge-not-independent"]),
    message: z.string().min(1).max(240),
  })
  .strict();

export const evaluationPreflightBlockerSchema = z
  .object({
    code: z.enum([
      "per-run-cap",
      "workspace-budget",
      "concurrency",
      "generator-output-limit",
      "judge-output-limit",
    ]),
    message: z.string().min(1).max(240),
  })
  .strict();

export const resolvedModelIdentitySchema = z
  .object({
    alias: slugSchema,
    providerId: slugSchema,
    modelId: z.string().min(1).max(200),
  })
  .strict();

export const evaluationPreflightResponseSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    mode: evaluationModeSchema,
    indicative: z.boolean(),
    requiresExplicitConfirmation: z.literal(true),
    eligibleForConfirmation: z.boolean(),
    generatorAlias: slugSchema,
    judgeAlias: slugSchema,
    generator: resolvedModelIdentitySchema,
    judge: resolvedModelIdentitySchema,
    judgeIndependent: z.boolean().nullable(),
    repetitions: z.number().int().positive(),
    baselineEnabled: z.boolean(),
    comparePreviousAcceptedRun: z.boolean(),
    regressionGate: z.boolean(),
    calls: z
      .object({
        candidateGenerator: z.number().int().nonnegative(),
        baselineGenerator: z.number().int().nonnegative(),
        judge: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
    tokens: z
      .object({
        generatorInput: z.number().int().nonnegative(),
        generatorOutput: z.number().int().nonnegative(),
        judgeInput: z.number().int().nonnegative(),
        judgeOutput: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
    costMicrousd: z
      .object({
        generator: moneySchema,
        judge: moneySchema,
        estimated: moneySchema,
        maximumRetry: moneySchema,
      })
      .strict(),
    limits: evaluationPreflightLimitsSchema,
    warnings: z.array(evaluationPreflightWarningSchema),
    blockers: z.array(evaluationPreflightBlockerSchema),
  })
  .strict();

export const quickRubricJudgementSchema = z
  .object({
    verdict: z.enum(["pass", "fail"]),
    score: z.number().int().min(0).max(100),
    reason: z.string().min(1).max(1_000),
    evidence: z.array(z.string().min(1).max(500)).max(5),
  })
  .strict();

export const evaluationConfirmRequestSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    preflight: evaluationPreflightRequestSchema,
    acceptedGenerator: resolvedModelIdentitySchema,
    acceptedJudge: resolvedModelIdentitySchema.optional(),
    acceptedMaximumRetryCostMicrousd: moneySchema,
    idempotencyKey: z.uuid(),
    instructions: z.string().min(1).max(250_000),
    casePrompt: z.string().min(1).max(250_000),
    rubric: z.string().min(1).max(50_000).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.preflight.mode !== "quick") {
      context.addIssue({
        code: "custom",
        path: ["preflight", "mode"],
        message: "Confirmed execution currently supports Quick evaluation only.",
      });
    }
    if (request.preflight.caseCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["preflight", "caseCount"],
        message: "Confirmed Quick execution currently supports exactly one case.",
      });
    }
    if (request.preflight.judgeCallsPerOutput > 1) {
      context.addIssue({
        code: "custom",
        path: ["preflight", "judgeCallsPerOutput"],
        message: "Confirmed Quick execution currently supports at most one rubric judge call.",
      });
    }
    if (request.preflight.judgeCallsPerOutput === 1) {
      if (!request.acceptedJudge) {
        context.addIssue({
          code: "custom",
          path: ["acceptedJudge"],
          message: "Rubric-backed Quick evaluation requires the accepted resolved judge identity.",
        });
      }
      if (!request.rubric) {
        context.addIssue({
          code: "custom",
          path: ["rubric"],
          message: "Rubric-backed Quick evaluation requires a rubric.",
        });
      }
    } else {
      if (request.acceptedJudge !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["acceptedJudge"],
          message: "Generation-only Quick execution does not accept a judge identity.",
        });
      }
      if (request.rubric !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["rubric"],
          message: "Generation-only Quick execution does not accept a rubric.",
        });
      }
    }
  });

export const evaluationExecutionStatusSchema = z.enum(["completed", "incomplete"]);
export const providerCallStatusSchema = z.enum(["completed", "failed"]);
export const providerCallCostBasisSchema = z.enum([
  "provider-usage",
  "planned-allowance",
  "failed-conservative",
]);

const settledProviderCallSchema = z
  .object({
    status: providerCallStatusSchema,
    responseId: z.string().min(1).max(500).nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    costMicrousd: moneySchema,
    costBasis: providerCallCostBasisSchema,
  })
  .strict();

export const evaluationConfirmResponseSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    runId: managedRunIdSchema,
    workspaceId: z.uuid(),
    status: evaluationExecutionStatusSchema,
    replayed: z.boolean(),
    generator: resolvedModelIdentitySchema,
    judge: resolvedModelIdentitySchema.nullable(),
    behaviouralVerdict: z.boolean().nullable(),
    behaviouralScore: z.number().int().min(0).max(100).nullable(),
    judgement: quickRubricJudgementSchema.nullable(),
    output: z.string().max(250_000).nullable(),
    transientContentAvailable: z.boolean(),
    transientContentExpiresAt: z.iso.datetime({ offset: true }),
    providerCall: settledProviderCallSchema,
    judgeCall: settledProviderCallSchema.nullable(),
  })
  .strict();

export const managedServiceErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        "unauthorised",
        "invalid-request",
        "not-found",
        "method-not-allowed",
        "service-not-configured",
        "internal-error",
      ]),
      message: z.string().min(1).max(300),
    }),
  })
  .strict();

export type QuickCheckRequest = z.infer<typeof quickCheckRequestSchema>;
export type ReliableCheckRequest = z.infer<typeof reliableCheckRequestSchema>;
export type QuickCheckFinding = z.infer<typeof quickCheckFindingSchema>;
export type DurableEvaluationSummary = z.infer<
  typeof durableEvaluationSummarySchema
>;
export type QuickCheckResponse = z.infer<typeof quickCheckResponseSchema>;
export type ReliableCheckRunStatus = z.infer<typeof reliableCheckRunStatusSchema>;
export type ReliableCheckStartResponse = z.infer<
  typeof reliableCheckStartResponseSchema
>;
export type ReliableCheckStatusResponse = z.infer<
  typeof reliableCheckStatusResponseSchema
>;
export type EvaluationMode = z.infer<typeof evaluationModeSchema>;
export type EvaluationPreflightRequest = z.infer<typeof evaluationPreflightRequestSchema>;
export type EvaluationPreflightLimits = z.infer<typeof evaluationPreflightLimitsSchema>;
export type EvaluationPreflightResponse = z.infer<typeof evaluationPreflightResponseSchema>;
export type ResolvedModelIdentity = z.infer<typeof resolvedModelIdentitySchema>;
export type QuickRubricJudgement = z.infer<typeof quickRubricJudgementSchema>;
export type EvaluationConfirmRequest = z.infer<typeof evaluationConfirmRequestSchema>;
export type EvaluationExecutionStatus = z.infer<typeof evaluationExecutionStatusSchema>;
export type ProviderCallStatus = z.infer<typeof providerCallStatusSchema>;
export type ProviderCallCostBasis = z.infer<typeof providerCallCostBasisSchema>;
export type EvaluationConfirmResponse = z.infer<typeof evaluationConfirmResponseSchema>;
export type ManagedServiceError = z.infer<typeof managedServiceErrorSchema>;
