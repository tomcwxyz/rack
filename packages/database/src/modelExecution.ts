import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  managedRunIdSchema,
  providerCallCostBasisSchema,
  providerCallStatusSchema,
  resolvedModelIdentitySchema,
  type ProviderCallCostBasis,
  type ProviderCallStatus,
  type ResolvedModelIdentity,
} from "@rack/managed";
import type { VerifiedAuthClaims } from "./store.js";

export type QuickEvaluationReservationInput = {
  workspaceId: string;
  idempotencyKey: string;
  rackFingerprint: string;
  profileId: string;
  target: string;
  generator: ResolvedModelIdentity;
  acceptedMaximumRetryCostMicrousd: number;
  estimatedCostMicrousd: number;
  instructions: string;
  casePrompt: string;
  transientExpiresAt: string;
};

export type QuickEvaluationSettlementInput = {
  runId: string;
  providerCallStatus: ProviderCallStatus;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicrousd: number;
  costBasis: ProviderCallCostBasis;
  output: string | null;
};

export type StoredQuickEvaluation = {
  runId: string;
  workspaceId: string;
  status: "running" | "completed" | "incomplete";
  generator: ResolvedModelIdentity;
  behaviouralVerdict: null;
  output: string | null;
  transientContentAvailable: boolean;
  transientContentExpiresAt: string;
  providerCall: {
    status: "claimed" | ProviderCallStatus;
    responseId: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    costMicrousd: number;
    costBasis: ProviderCallCostBasis | null;
  };
};

export type ModelExecutionStore = {
  reserveQuickEvaluation: (
    input: QuickEvaluationReservationInput,
  ) => Promise<{ runId: string; workspaceId: string; replayed: boolean }>;
  getQuickEvaluation: (runId: string) => Promise<StoredQuickEvaluation | null>;
  settleQuickEvaluation: (input: QuickEvaluationSettlementInput) => Promise<void>;
};

const claimsJson = (claims: VerifiedAuthClaims): string => {
  if (!claims.sub.trim()) throw new Error("Authenticated claims require a subject.");
  return JSON.stringify(claims);
};

const safeInteger = (value: unknown, label: string): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return parsed;
};

const nullableInteger = (value: unknown, label: string): number | null =>
  value === null || value === undefined ? null : safeInteger(value, label);

const asIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid stored evaluation timestamp.");
  return parsed.toISOString();
};

const parseStoredRow = (row: Record<string, unknown> | undefined): StoredQuickEvaluation | null => {
  if (!row) return null;
  const status = String(row.status);
  if (status !== "running" && status !== "completed" && status !== "incomplete") {
    throw new Error(`Unknown model-evaluation status: ${status}`);
  }
  const rawCallStatus = String(row.call_status);
  const callStatus =
    rawCallStatus === "claimed" ? "claimed" : providerCallStatusSchema.parse(rawCallStatus);
  const costBasis =
    row.cost_basis === null || row.cost_basis === undefined
      ? null
      : providerCallCostBasisSchema.parse(row.cost_basis);
  const generator = resolvedModelIdentitySchema.parse({
    alias: row.generator_alias,
    providerId: row.provider_id,
    modelId: row.model_id,
  });
  return {
    runId: managedRunIdSchema.parse(row.run_id),
    workspaceId: String(row.workspace_id),
    status,
    generator,
    behaviouralVerdict: null,
    output: row.output_text === null || row.output_text === undefined ? null : String(row.output_text),
    transientContentAvailable: row.transient_available === true,
    transientContentExpiresAt: asIso(row.transient_expires_at),
    providerCall: {
      status: callStatus,
      responseId: row.response_id === null || row.response_id === undefined ? null : String(row.response_id),
      inputTokens: nullableInteger(row.input_tokens, "Provider input tokens"),
      outputTokens: nullableInteger(row.output_tokens, "Provider output tokens"),
      costMicrousd: safeInteger(row.cost_microusd ?? 0, "Provider call cost"),
      costBasis,
    },
  };
};

export const createNeonModelExecutionStore = (options: {
  databaseUrl: string;
  authClaims: VerifiedAuthClaims;
}): ModelExecutionStore => {
  const sql = neon(options.databaseUrl);
  const serialisedClaims = claimsJson(options.authClaims);

  const withClaims = <T>(query: T) =>
    sql.transaction([
      sql`select set_config('request.jwt.claims', ${serialisedClaims}, true)`,
      query as never,
    ]);

  const getQuickEvaluation = async (inputRunId: string): Promise<StoredQuickEvaluation | null> => {
    const runId = managedRunIdSchema.parse(inputRunId);
    const [, rows] = await withClaims(sql`
      select
        evaluation.run_id,
        evaluation.workspace_id,
        evaluation.status,
        evaluation.generator_alias,
        evaluation.provider_id,
        evaluation.model_id,
        evaluation.transient_expires_at,
        call.status as call_status,
        call.response_id,
        call.input_tokens,
        call.output_tokens,
        call.cost_microusd,
        call.cost_basis,
        case
          when payload.run_id is not null and payload.expires_at > now()
            then payload.response_body ->> 'output'
          else null
        end as output_text,
        (payload.run_id is not null and payload.expires_at > now()) as transient_available
      from rack_model_evaluation_runs evaluation
      join rack_provider_calls call
        on call.run_id = evaluation.run_id and call.call_key = 'candidate-0'
      left join rack_managed_payloads payload on payload.run_id = evaluation.run_id
      where evaluation.run_id = ${runId}::uuid
      limit 1
    `);
    return parseStoredRow((rows as unknown as Record<string, unknown>[])[0]);
  };

  return {
    async reserveQuickEvaluation(input) {
      const generator = resolvedModelIdentitySchema.parse(input.generator);
      const runId = randomUUID();
      const acceptedMaximumRetryCostMicrousd = safeInteger(
        input.acceptedMaximumRetryCostMicrousd,
        "Accepted maximum retry cost",
      );
      const estimatedCostMicrousd = safeInteger(input.estimatedCostMicrousd, "Estimated run cost");
      const [, rows] = await withClaims(sql`
        select * from rack_reserve_quick_evaluation(
          ${input.workspaceId}::uuid,
          ${runId}::uuid,
          ${input.idempotencyKey}::uuid,
          ${input.rackFingerprint},
          ${input.profileId},
          ${input.target},
          ${generator.alias},
          ${generator.providerId},
          ${generator.modelId},
          ${acceptedMaximumRetryCostMicrousd}::bigint,
          ${estimatedCostMicrousd}::bigint,
          ${input.instructions},
          ${input.casePrompt},
          ${input.transientExpiresAt}::timestamptz
        )
      `);
      const row = (rows as unknown as { reserved_run_id: string; replayed: boolean }[])[0];
      if (!row?.reserved_run_id) throw new Error("Could not reserve the Quick evaluation.");
      return {
        runId: managedRunIdSchema.parse(row.reserved_run_id),
        workspaceId: input.workspaceId,
        replayed: row.replayed === true,
      };
    },

    getQuickEvaluation,

    async settleQuickEvaluation(input) {
      const runId = managedRunIdSchema.parse(input.runId);
      const status = providerCallStatusSchema.parse(input.providerCallStatus);
      const costBasis = providerCallCostBasisSchema.parse(input.costBasis);
      const costMicrousd = safeInteger(input.costMicrousd, "Provider settlement cost");
      await withClaims(sql`
        select rack_settle_quick_evaluation(
          ${runId}::uuid,
          ${status},
          ${input.responseId},
          ${input.inputTokens},
          ${input.outputTokens},
          ${costMicrousd}::bigint,
          ${costBasis},
          ${input.output}
        )
      `);
    },
  };
};
