import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  managedRunIdSchema,
  providerCallCostBasisSchema,
  providerCallStatusSchema,
  quickRubricJudgementSchema,
  resolvedModelIdentitySchema,
  reliableEvaluationConfirmRequestSchema,
  reliableEvaluationStatusResponseSchema,
  type ProviderCallCostBasis,
  type ProviderCallStatus,
  type QuickRubricJudgement,
  type ReliableEvaluationConfirmRequest,
  type ReliableEvaluationStatusResponse,
  type ResolvedModelIdentity,
} from "@rack/managed";
import type { VerifiedAuthClaims } from "./store.js";

export type ReliableEvaluationReservationInput = {
  workspaceId: string;
  confirmation: ReliableEvaluationConfirmRequest;
  generator: ResolvedModelIdentity;
  judge: ResolvedModelIdentity;
  judgeIndependent: boolean;
  acceptedMaximumRetryCostMicrousd: number;
  estimatedCostMicrousd: number;
  transientExpiresAt: string;
};

export type ReliableProviderCall = {
  callKey: string;
  status: "claimed" | ProviderCallStatus;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicrousd: number;
  costBasis: ProviderCallCostBasis | null;
  output: string | null;
  judgement: QuickRubricJudgement | null;
};

export type ReliableProviderSettlementInput = {
  callKey: string;
  status: ProviderCallStatus;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicrousd: number;
  costBasis: ProviderCallCostBasis;
  output: string | null;
  judgement: QuickRubricJudgement | null;
};

export type ReliableEvaluationStore = {
  reserve: (
    input: ReliableEvaluationReservationInput,
  ) => Promise<{ runId: string; replayed: boolean }>;
  failBeforeStart: (runId: string) => Promise<void>;
  getStatus: (runId: string) => Promise<ReliableEvaluationStatusResponse | null>;
};

export type ReliableEvaluationWorkflowStore = {
  getStatus: () => Promise<ReliableEvaluationStatusResponse | null>;
  loadConfirmation: () => Promise<ReliableEvaluationConfirmRequest>;
  markRunning: () => Promise<void>;
  getCall: (callKey: string) => Promise<ReliableProviderCall | null>;
  claimCall: (callKey: string, model: ResolvedModelIdentity) => Promise<boolean>;
  settleCall: (input: ReliableProviderSettlementInput) => Promise<void>;
  complete: (input: {
    candidateScore: number;
    baselineScore: number;
    candidatePassRate: number;
    baselinePassRate: number;
  }) => Promise<ReliableEvaluationStatusResponse>;
  incomplete: () => Promise<ReliableEvaluationStatusResponse>;
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
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid Reliable evaluation timestamp.");
  return parsed.toISOString();
};

const asJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const claimsJson = (claims: VerifiedAuthClaims): string => {
  if (!claims.sub.trim()) throw new Error("Authenticated claims require a subject.");
  return JSON.stringify(claims);
};

type StatusRow = Record<string, unknown>;

const parseStatus = (row: StatusRow | undefined): ReliableEvaluationStatusResponse | null => {
  if (!row) return null;
  const status = String(row.status);
  if (status !== "queued" && status !== "running" && status !== "completed" && status !== "incomplete") {
    throw new Error(`Unknown Reliable evaluation status: ${status}`);
  }
  const transientExpiresAt = asIso(row.transient_expires_at);
  const transientContentAvailable = row.transient_available === true;
  if (status === "queued" || status === "running") {
    return reliableEvaluationStatusResponseSchema.parse({
      schemaVersion: "0.1",
      runId: row.run_id,
      status,
      summary: null,
      transientContentAvailable,
      transientContentExpiresAt: transientExpiresAt,
    });
  }

  const generator = resolvedModelIdentitySchema.parse({
    alias: row.generator_alias,
    providerId: row.provider_id,
    modelId: row.model_id,
  });
  const judge = resolvedModelIdentitySchema.parse({
    alias: row.judge_alias,
    providerId: row.judge_provider_id,
    modelId: row.judge_model_id,
  });
  const candidateScore = nullableInteger(row.behavioural_score, "Reliable candidate score");
  const previousAcceptedScore = nullableInteger(
    row.previous_accepted_score,
    "Reliable previous accepted score",
  );
  return reliableEvaluationStatusResponseSchema.parse({
    schemaVersion: "0.1",
    runId: row.run_id,
    status,
    summary: {
      schemaVersion: "0.1",
      generator,
      judge,
      judgeIndependent: row.judge_independent === true,
      behaviouralVerdict:
        row.behavioural_verdict === true
          ? true
          : row.behavioural_verdict === false
            ? false
            : null,
      candidateScore,
      baselineScore: nullableInteger(row.baseline_score, "Reliable baseline score"),
      candidatePassRate: nullableInteger(
        row.candidate_pass_rate,
        "Reliable candidate pass rate",
      ),
      baselinePassRate: nullableInteger(
        row.baseline_pass_rate,
        "Reliable baseline pass rate",
      ),
      previousAcceptedScore,
      regressionDelta:
        candidateScore === null || previousAcceptedScore === null
          ? null
          : candidateScore - previousAcceptedScore,
      regressionPassed:
        row.regression_passed === true
          ? true
          : row.regression_passed === false
            ? false
            : null,
      candidateJudgements: safeInteger(
        row.candidate_judgements ?? 0,
        "Reliable candidate judgement count",
      ),
      baselineJudgements: safeInteger(
        row.baseline_judgements ?? 0,
        "Reliable baseline judgement count",
      ),
      settledCostMicrousd: safeInteger(
        row.settled_cost_microusd ?? 0,
        "Reliable settled cost",
      ),
      checkedAt: asIso(row.completed_at),
    },
    transientContentAvailable,
    transientContentExpiresAt: transientExpiresAt,
  });
};

const statusQueryText = (runId: string) => ({ runId });

export const createNeonReliableEvaluationStore = (options: {
  databaseUrl: string;
  authClaims: VerifiedAuthClaims;
}): ReliableEvaluationStore => {
  const sql = neon(options.databaseUrl);
  const serialisedClaims = claimsJson(options.authClaims);
  const withClaims = <T>(query: T) =>
    sql.transaction([
      sql`select set_config('request.jwt.claims', ${serialisedClaims}, true)`,
      query as never,
    ]);
  const queryStatus = (runId: string) => {
    void statusQueryText(runId);
    return sql`
      select
        evaluation.run_id,
        evaluation.status,
        evaluation.generator_alias,
        evaluation.provider_id,
        evaluation.model_id,
        evaluation.judge_alias,
        evaluation.judge_provider_id,
        evaluation.judge_model_id,
        evaluation.judge_independent,
        evaluation.behavioural_verdict,
        evaluation.behavioural_score,
        evaluation.baseline_score,
        evaluation.previous_accepted_score,
        evaluation.candidate_pass_rate,
        evaluation.baseline_pass_rate,
        evaluation.regression_passed,
        evaluation.settled_cost_microusd,
        evaluation.transient_expires_at,
        evaluation.completed_at,
        (select count(*)::integer from rack_provider_calls call
          where call.run_id = evaluation.run_id
            and call.call_key like 'judge-candidate-%'
            and call.status = 'completed') as candidate_judgements,
        (select count(*)::integer from rack_provider_calls call
          where call.run_id = evaluation.run_id
            and call.call_key like 'judge-baseline-%'
            and call.status = 'completed') as baseline_judgements,
        (payload.run_id is not null and payload.expires_at > now()) as transient_available
      from rack_model_evaluation_runs evaluation
      left join rack_managed_payloads payload on payload.run_id = evaluation.run_id
      where evaluation.run_id = ${runId}::uuid and evaluation.mode = 'reliable'
      limit 1
    `;
  };

  return {
    async reserve(input) {
      const runId = randomUUID();
      const confirmation = reliableEvaluationConfirmRequestSchema.parse(input.confirmation);
      const generator = resolvedModelIdentitySchema.parse(input.generator);
      const judge = resolvedModelIdentitySchema.parse(input.judge);
      const [, rows] = await withClaims(sql`
        select * from rack_reserve_reliable_evaluation(
          ${input.workspaceId}::uuid,
          ${runId}::uuid,
          ${confirmation.idempotencyKey}::uuid,
          ${confirmation.preflight.rackFingerprint},
          ${confirmation.preflight.profileId},
          ${confirmation.preflight.target},
          ${generator.alias},
          ${generator.providerId},
          ${generator.modelId},
          ${judge.alias},
          ${judge.providerId},
          ${judge.modelId},
          ${input.judgeIndependent},
          ${safeInteger(input.acceptedMaximumRetryCostMicrousd, "Accepted Reliable maximum cost")}::bigint,
          ${safeInteger(input.estimatedCostMicrousd, "Estimated Reliable cost")}::bigint,
          ${JSON.stringify(confirmation)}::jsonb,
          ${input.transientExpiresAt}::timestamptz
        )
      `);
      const row = (rows as unknown as { reserved_run_id: string; replayed: boolean }[])[0];
      if (!row?.reserved_run_id) throw new Error("Could not reserve the Reliable evaluation.");
      return { runId: managedRunIdSchema.parse(row.reserved_run_id), replayed: row.replayed === true };
    },

    async failBeforeStart(inputRunId) {
      const runId = managedRunIdSchema.parse(inputRunId);
      await withClaims(sql`select rack_fail_reliable_before_start(${runId}::uuid)`);
    },

    async getStatus(inputRunId) {
      const runId = managedRunIdSchema.parse(inputRunId);
      const [, rows] = await withClaims(queryStatus(runId));
      return parseStatus((rows as unknown as StatusRow[])[0]);
    },
  };
};

export const createNeonReliableEvaluationWorkflowStore = (options: {
  databaseUrl: string;
  runId: string;
}): ReliableEvaluationWorkflowStore => {
  const sql = neon(options.databaseUrl);
  const runId = managedRunIdSchema.parse(options.runId);
  const withRunScope = <T>(query: T) =>
    sql.transaction([
      sql`select set_config('rack.workflow_run_id', ${runId}, true)`,
      query as never,
    ]);
  const queryStatus = () => sql`
    select
      evaluation.run_id,
      evaluation.status,
      evaluation.generator_alias,
      evaluation.provider_id,
      evaluation.model_id,
      evaluation.judge_alias,
      evaluation.judge_provider_id,
      evaluation.judge_model_id,
      evaluation.judge_independent,
      evaluation.behavioural_verdict,
      evaluation.behavioural_score,
      evaluation.baseline_score,
      evaluation.previous_accepted_score,
      evaluation.candidate_pass_rate,
      evaluation.baseline_pass_rate,
      evaluation.regression_passed,
      evaluation.settled_cost_microusd,
      evaluation.transient_expires_at,
      evaluation.completed_at,
      (select count(*)::integer from rack_provider_calls call
        where call.run_id = evaluation.run_id
          and call.call_key like 'judge-candidate-%'
          and call.status = 'completed') as candidate_judgements,
      (select count(*)::integer from rack_provider_calls call
        where call.run_id = evaluation.run_id
          and call.call_key like 'judge-baseline-%'
          and call.status = 'completed') as baseline_judgements,
      (payload.run_id is not null and payload.expires_at > now()) as transient_available
    from rack_model_evaluation_runs evaluation
    left join rack_managed_payloads payload on payload.run_id = evaluation.run_id
    where evaluation.run_id = ${runId}::uuid and evaluation.mode = 'reliable'
    limit 1
  `;

  const getStatus = async (): Promise<ReliableEvaluationStatusResponse | null> => {
    const [, rows] = await withRunScope(queryStatus());
    return parseStatus((rows as unknown as StatusRow[])[0]);
  };

  return {
    getStatus,

    async loadConfirmation() {
      const [, rows] = await withRunScope(sql`
        select request_body
        from rack_managed_payloads
        where run_id = ${runId}::uuid and expires_at > now()
        limit 1
      `);
      const row = (rows as unknown as { request_body: unknown }[])[0];
      if (!row) throw new Error("Reliable evaluation content is unavailable or expired.");
      return reliableEvaluationConfirmRequestSchema.parse(asJson(row.request_body));
    },

    async markRunning() {
      await withRunScope(sql`
        update rack_model_evaluation_runs
        set status = 'running'
        where run_id = ${runId}::uuid and mode = 'reliable' and status in ('queued', 'running')
      `);
      await withRunScope(sql`
        update rack_managed_runs
        set status = 'running'
        where id = ${runId}::uuid and kind = 'model-evaluation' and status in ('queued', 'running')
      `);
    },

    async getCall(inputCallKey) {
      const callKey = inputCallKey.trim();
      if (!callKey) throw new Error("Reliable provider call requires a call key.");
      const [, rows] = await withRunScope(sql`
        select
          call.call_key,
          call.status,
          call.response_id,
          call.input_tokens,
          call.output_tokens,
          call.cost_microusd,
          call.cost_basis,
          payload.response_body -> ${callKey} ->> 'output' as output,
          payload.response_body -> ${callKey} -> 'judgement' as judgement
        from rack_provider_calls call
        left join rack_managed_payloads payload on payload.run_id = call.run_id
        where call.run_id = ${runId}::uuid and call.call_key = ${callKey}
        limit 1
      `);
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) return null;
      const textStatus = String(row.status);
      const status = textStatus === "claimed" ? "claimed" : providerCallStatusSchema.parse(textStatus);
      const rawBasis = row.cost_basis;
      const judgement = quickRubricJudgementSchema.safeParse(asJson(row.judgement));
      return {
        callKey: String(row.call_key),
        status,
        responseId: row.response_id == null ? null : String(row.response_id),
        inputTokens: nullableInteger(row.input_tokens, "Reliable call input tokens"),
        outputTokens: nullableInteger(row.output_tokens, "Reliable call output tokens"),
        costMicrousd: safeInteger(row.cost_microusd ?? 0, "Reliable call cost"),
        costBasis: rawBasis == null ? null : providerCallCostBasisSchema.parse(rawBasis),
        output: row.output == null ? null : String(row.output),
        judgement: judgement.success ? judgement.data : null,
      } satisfies ReliableProviderCall;
    },

    async claimCall(inputCallKey, inputModel) {
      const callKey = inputCallKey.trim();
      if (!callKey) throw new Error("Reliable provider call requires a call key.");
      const model = resolvedModelIdentitySchema.parse(inputModel);
      const [, rows] = await withRunScope(sql`
        select rack_claim_reliable_provider_call(
          ${runId}::uuid,
          ${callKey},
          ${model.alias},
          ${model.providerId},
          ${model.modelId}
        ) as claimed
      `);
      return (rows as unknown as { claimed: boolean }[])[0]?.claimed === true;
    },

    async settleCall(input) {
      const status = providerCallStatusSchema.parse(input.status);
      const costBasis = providerCallCostBasisSchema.parse(input.costBasis);
      const judgement = input.judgement === null ? null : JSON.stringify(input.judgement);
      await withRunScope(sql`
        select rack_settle_reliable_provider_call(
          ${runId}::uuid,
          ${input.callKey},
          ${status},
          ${input.responseId},
          ${input.inputTokens},
          ${input.outputTokens},
          ${safeInteger(input.costMicrousd, "Reliable provider settlement cost")}::bigint,
          ${costBasis},
          ${input.output},
          ${judgement}::jsonb
        )
      `);
    },

    async complete(input) {
      await withRunScope(sql`
        select rack_complete_reliable_evaluation(
          ${runId}::uuid,
          ${input.candidateScore},
          ${input.baselineScore},
          ${input.candidatePassRate},
          ${input.baselinePassRate}
        )
      `);
      const stored = await getStatus();
      if (!stored || stored.status !== "completed") {
        throw new Error("Reliable evaluation could not be completed.");
      }
      return stored;
    },

    async incomplete() {
      await withRunScope(sql`select rack_incomplete_reliable_evaluation(${runId}::uuid)`);
      const stored = await getStatus();
      if (!stored || stored.status !== "incomplete") {
        throw new Error("Reliable evaluation could not be marked incomplete.");
      }
      return stored;
    },
  };
};
