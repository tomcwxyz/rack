import { z } from "zod";
import {
  MANAGED_SCHEMA_VERSION,
  evaluationPreflightRequestSchema,
  quickRubricJudgementSchema,
  resolvedModelIdentitySchema,
  type EvaluationPreflightRequest,
  type QuickRubricJudgement,
  type ResolvedModelIdentity,
} from "./contracts.js";

export const RELIABLE_REPETITIONS = 5 as const;
export const RELIABLE_BASELINE_INSTRUCTIONS =
  "Complete the user's task using only the task itself. Do not assume any Rack-specific working practices that are not stated in the task.";

const moneySchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const runIdSchema = z.uuid();

export const reliableEvaluationConfirmRequestSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    preflight: evaluationPreflightRequestSchema,
    acceptedGenerator: resolvedModelIdentitySchema,
    acceptedJudge: resolvedModelIdentitySchema,
    acceptedMaximumRetryCostMicrousd: moneySchema,
    idempotencyKey: z.uuid(),
    instructions: z.string().min(1).max(250_000),
    casePrompt: z.string().min(1).max(250_000),
    rubric: z.string().min(1).max(50_000),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.preflight.mode !== "reliable") {
      context.addIssue({
        code: "custom",
        path: ["preflight", "mode"],
        message: "Reliable confirmation requires a Reliable preflight.",
      });
    }
    if (request.preflight.caseCount !== 1) {
      context.addIssue({
        code: "custom",
        path: ["preflight", "caseCount"],
        message: "Reliable v0.1 execution supports exactly one test case.",
      });
    }
    if (request.preflight.judgeCallsPerOutput !== 1) {
      context.addIssue({
        code: "custom",
        path: ["preflight", "judgeCallsPerOutput"],
        message: "Reliable v0.1 execution requires exactly one rubric judgement per output.",
      });
    }
  });

export const reliableEvaluationStartResponseSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    runId: runIdSchema,
    workflowRunId: z.string().min(1).max(200).nullable(),
    status: z.enum(["queued", "running", "completed", "incomplete"]),
    replayed: z.boolean(),
    transientContentExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const reliableEvaluationSummarySchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    generator: resolvedModelIdentitySchema,
    judge: resolvedModelIdentitySchema,
    judgeIndependent: z.boolean(),
    behaviouralVerdict: z.boolean().nullable(),
    candidateScore: z.number().int().min(0).max(100).nullable(),
    baselineScore: z.number().int().min(0).max(100).nullable(),
    candidatePassRate: z.number().int().min(0).max(100).nullable(),
    baselinePassRate: z.number().int().min(0).max(100).nullable(),
    previousAcceptedScore: z.number().int().min(0).max(100).nullable(),
    regressionDelta: z.number().int().min(-100).max(100).nullable(),
    regressionPassed: z.boolean().nullable(),
    candidateJudgements: z.number().int().min(0).max(RELIABLE_REPETITIONS),
    baselineJudgements: z.number().int().min(0).max(RELIABLE_REPETITIONS),
    settledCostMicrousd: moneySchema,
    checkedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const reliableEvaluationStatusResponseSchema = z
  .object({
    schemaVersion: z.literal(MANAGED_SCHEMA_VERSION),
    runId: runIdSchema,
    status: z.enum(["queued", "running", "completed", "incomplete"]),
    summary: reliableEvaluationSummarySchema.nullable(),
    transientContentAvailable: z.boolean(),
    transientContentExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const reliableEvaluationTransientCallSchema = z
  .object({
    callKey: z.string().min(1).max(100),
    output: z.string().max(250_000),
    judgement: quickRubricJudgementSchema.nullable(),
  })
  .strict();

export type ReliableEvaluationConfirmRequest = z.infer<
  typeof reliableEvaluationConfirmRequestSchema
>;
export type ReliableEvaluationStartResponse = z.infer<
  typeof reliableEvaluationStartResponseSchema
>;
export type ReliableEvaluationSummary = z.infer<typeof reliableEvaluationSummarySchema>;
export type ReliableEvaluationStatusResponse = z.infer<
  typeof reliableEvaluationStatusResponseSchema
>;
export type ReliableEvaluationTransientCall = z.infer<
  typeof reliableEvaluationTransientCallSchema
>;

export type ReliableEvaluationPlan = EvaluationPreflightRequest & {
  mode: "reliable";
};
export type ReliableResolvedIdentity = ResolvedModelIdentity;
export type ReliableRubricJudgement = QuickRubricJudgement;
