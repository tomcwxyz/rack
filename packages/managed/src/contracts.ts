import { destinationIdSchema, slugSchema } from "@rack/schemas";
import { z } from "zod";

export const MANAGED_SCHEMA_VERSION = "0.1" as const;
export const MAX_TRANSIENT_RETENTION_HOURS = 24;

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
    runId: z.uuid(),
    workspaceId: z.uuid(),
    summary: durableEvaluationSummarySchema,
    transientContentExpiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const managedServiceErrorSchema = z
  .object({
    error: z.object({
      code: z.enum([
        "unauthorised",
        "invalid-request",
        "method-not-allowed",
        "service-not-configured",
        "internal-error",
      ]),
      message: z.string().min(1).max(300),
    }),
  })
  .strict();

export type QuickCheckRequest = z.infer<typeof quickCheckRequestSchema>;
export type QuickCheckFinding = z.infer<typeof quickCheckFindingSchema>;
export type DurableEvaluationSummary = z.infer<
  typeof durableEvaluationSummarySchema
>;
export type QuickCheckResponse = z.infer<typeof quickCheckResponseSchema>;
export type ManagedServiceError = z.infer<typeof managedServiceErrorSchema>;
