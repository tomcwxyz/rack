import {
  createNeonEvaluationLimitStore,
  createNeonModelExecutionStore,
  type EvaluationLimitDefaults,
  type EvaluationLimitStore,
  type ModelExecutionStore,
  type StoredQuickEvaluation,
  type VerifiedAuthClaims,
} from "@rack/database";
import { buildEvaluationPreflight } from "@rack/eval";
import {
  evaluationConfirmRequestSchema,
  evaluationConfirmResponseSchema,
  transientExpiry,
  type EvaluationConfirmResponse,
  type ResolvedModelIdentity,
} from "@rack/managed";
import type { ModelRunner, ModelRunnerUsage } from "@rack/model-runner";
import {
  resolveModelAlias,
  type ModelRegistry,
  type ModelRegistryEntry,
} from "@rack/registry";
import { ManagedAuthenticationError, verifyManagedRequest } from "./auth.js";
import {
  readEvaluationLimitDefaults,
  readEvaluationModelRegistry,
  readEvaluationModelRunner,
} from "./evaluationConfig.js";
import type { ServiceEnvironment } from "./env.js";
import { json, serviceError } from "./http.js";
import {
  buildQuickRubricPrompt,
  conservativeQuickRubricPromptAllowance,
  parseQuickRubricJudgement,
  QUICK_RUBRIC_JUDGE_SYSTEM,
} from "./quickRubric.js";

export type EvaluationConfirmHandlerDependencies = {
  environment: ServiceEnvironment;
  verifyAuth?: (
    request: Request,
    environment: ServiceEnvironment,
  ) => Promise<VerifiedAuthClaims>;
  registry?: () => ModelRegistry;
  limitDefaults?: () => EvaluationLimitDefaults;
  modelRunner?: () => ModelRunner;
  limitStoreFor?: (claims: VerifiedAuthClaims) => EvaluationLimitStore;
  executionStoreFor?: (claims: VerifiedAuthClaims) => ModelExecutionStore;
  now?: () => Date;
};

const sameIdentity = (
  left: ResolvedModelIdentity,
  right: ResolvedModelIdentity,
): boolean =>
  left.alias === right.alias &&
  left.providerId === right.providerId &&
  left.modelId === right.modelId;

const conservativeInputTokenAllowance = (instructions: string, casePrompt: string): number =>
  new TextEncoder().encode(`${instructions}\n\n${casePrompt}`).length;

const safeUsageTokens = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const tokenCostMicrousd = (tokens: number, rate: number): number => {
  const million = 1_000_000n;
  const value = (BigInt(tokens) * BigInt(rate) + million - 1n) / million;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Provider usage cost exceeds Rack's safe numeric range.");
  }
  return Number(value);
};

const providerUsageCost = (
  model: ModelRegistryEntry,
  usage: ModelRunnerUsage | null,
): { inputTokens: number; outputTokens: number; costMicrousd: number } | null => {
  const inputTokens = safeUsageTokens(usage?.inputTokens);
  const outputTokens = safeUsageTokens(usage?.outputTokens);
  if (inputTokens === null || outputTokens === null) return null;
  return {
    inputTokens,
    outputTokens,
    costMicrousd:
      tokenCostMicrousd(inputTokens, model.pricing.inputMicrousdPerMillionTokens) +
      tokenCostMicrousd(outputTokens, model.pricing.outputMicrousdPerMillionTokens),
  };
};

const responseFromStored = (
  stored: StoredQuickEvaluation,
  replayed: boolean,
): EvaluationConfirmResponse => {
  if (stored.status === "running") {
    throw new Error("A claimed provider call cannot be represented as a completed response.");
  }
  if (stored.providerCall.status === "claimed" || stored.providerCall.costBasis === null) {
    throw new Error("A settled evaluation requires a completed candidate-call ledger entry.");
  }
  if (
    stored.judgeCall &&
    (stored.judgeCall.status === "claimed" || stored.judgeCall.costBasis === null)
  ) {
    throw new Error("A settled evaluation requires a settled judge-call ledger entry.");
  }
  return evaluationConfirmResponseSchema.parse({
    schemaVersion: "0.1",
    runId: stored.runId,
    workspaceId: stored.workspaceId,
    status: stored.status,
    replayed,
    generator: stored.generator,
    judge: stored.judge,
    behaviouralVerdict: stored.behaviouralVerdict,
    behaviouralScore: stored.behaviouralScore,
    judgement: stored.judgement,
    output: stored.output,
    transientContentAvailable: stored.transientContentAvailable,
    transientContentExpiresAt: stored.transientContentExpiresAt,
    providerCall: {
      status: stored.providerCall.status,
      responseId: stored.providerCall.responseId,
      inputTokens: stored.providerCall.inputTokens,
      outputTokens: stored.providerCall.outputTokens,
      costMicrousd: stored.providerCall.costMicrousd,
      costBasis: stored.providerCall.costBasis,
    },
    judgeCall:
      stored.judgeCall === null
        ? null
        : {
            status: stored.judgeCall.status,
            responseId: stored.judgeCall.responseId,
            inputTokens: stored.judgeCall.inputTokens,
            outputTokens: stored.judgeCall.outputTokens,
            costMicrousd: stored.judgeCall.costMicrousd,
            costBasis: stored.judgeCall.costBasis,
          },
  });
};

const readSettled = async (
  store: ModelExecutionStore,
  runId: string,
  replayed: boolean,
): Promise<Response> => {
  const stored = await store.getQuickEvaluation(runId);
  if (!stored) {
    return serviceError("internal-error", "The evaluation run could not be read.", 500);
  }
  if (stored.status === "running") {
    return serviceError(
      "invalid-request",
      "This paid evaluation is already in progress or has an ambiguous claimed provider call. Rack will not repeat it automatically.",
      409,
    );
  }
  return json(responseFromStored(stored, replayed));
};

export const createEvaluationConfirmHandler = (
  dependencies: EvaluationConfirmHandlerDependencies,
) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const registry = dependencies.registry ?? readEvaluationModelRegistry;
  const limitDefaults = dependencies.limitDefaults ?? readEvaluationLimitDefaults;
  const modelRunner = dependencies.modelRunner ?? readEvaluationModelRunner;
  const now = dependencies.now ?? (() => new Date());
  const limitStoreFor =
    dependencies.limitStoreFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonEvaluationLimitStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));
  const executionStoreFor =
    dependencies.executionStoreFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonModelExecutionStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return serviceError("method-not-allowed", "Use POST for evaluation confirmation.", 405);
    }

    let claims: VerifiedAuthClaims;
    try {
      claims = await verifyAuth(request, dependencies.environment);
    } catch (error) {
      if (error instanceof ManagedAuthenticationError) {
        return serviceError("unauthorised", error.message, 401);
      }
      return serviceError("unauthorised", "A valid sign-in is required.", 401);
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return serviceError("invalid-request", "Send a valid JSON evaluation confirmation request.", 400);
    }
    const parsed = evaluationConfirmRequestSchema.safeParse(input);
    if (!parsed.success) {
      return serviceError(
        "invalid-request",
        "The evaluation confirmation request does not match the Rack service contract.",
        400,
      );
    }
    const confirmation = parsed.data;
    const rubricBacked = confirmation.preflight.judgeCallsPerOutput === 1;

    let modelRegistry: ModelRegistry;
    let defaults: EvaluationLimitDefaults;
    let runner: ModelRunner;
    try {
      modelRegistry = registry();
      defaults = limitDefaults();
      runner = modelRunner();
    } catch {
      return serviceError(
        "service-not-configured",
        "Managed model execution is not configured for this deployment.",
        503,
      );
    }

    const limitStore = limitStoreFor(claims);
    const executionStore = executionStoreFor(claims);

    try {
      const { workspaceId, ...limits } = await limitStore.getPreflightLimits(defaults);
      const currentPreflight = buildEvaluationPreflight(
        confirmation.preflight,
        modelRegistry,
        limits,
      );
      if (!currentPreflight.eligibleForConfirmation) {
        return serviceError(
          "invalid-request",
          "Evaluation limits changed. Run preflight again before confirming paid work.",
          409,
        );
      }
      if (
        !sameIdentity(currentPreflight.generator, confirmation.acceptedGenerator) ||
        currentPreflight.costMicrousd.maximumRetry !==
          confirmation.acceptedMaximumRetryCostMicrousd
      ) {
        return serviceError(
          "invalid-request",
          "The resolved model or maximum retry exposure changed. Run preflight again before confirming paid work.",
          409,
        );
      }
      if (
        rubricBacked &&
        (!confirmation.acceptedJudge ||
          !sameIdentity(currentPreflight.judge, confirmation.acceptedJudge))
      ) {
        return serviceError(
          "invalid-request",
          "The resolved judge changed. Run preflight again before confirming paid work.",
          409,
        );
      }

      const generator = resolveModelAlias(
        modelRegistry,
        currentPreflight.generator.alias,
        "generate",
      );
      if (generator.connection !== "managed") {
        return serviceError(
          "invalid-request",
          "The managed confirmation endpoint can only execute deployment-managed model connections.",
          400,
        );
      }
      const judge = rubricBacked
        ? resolveModelAlias(modelRegistry, currentPreflight.judge.alias, "judge")
        : null;
      if (judge && judge.connection !== "managed") {
        return serviceError(
          "invalid-request",
          "The managed confirmation endpoint can only execute deployment-managed judge connections.",
          400,
        );
      }

      const conservativeInputTokens = conservativeInputTokenAllowance(
        confirmation.instructions,
        confirmation.casePrompt,
      );
      if (conservativeInputTokens > confirmation.preflight.candidateInputTokensPerCase) {
        return serviceError(
          "invalid-request",
          "The confirmed input is larger than the preflight token allowance. Run preflight again with a larger input allowance.",
          409,
        );
      }
      if (
        rubricBacked &&
        conservativeQuickRubricPromptAllowance({
          rubric: confirmation.rubric!,
          casePrompt: confirmation.casePrompt,
        }) > confirmation.preflight.judgePromptTokensPerCase
      ) {
        return serviceError(
          "invalid-request",
          "The confirmed rubric/task is larger than the judge-prompt allowance. Run preflight again with a larger judge allowance.",
          409,
        );
      }

      const expiresAt = transientExpiry(now()).toISOString();
      const reservationInput = {
        workspaceId,
        idempotencyKey: confirmation.idempotencyKey,
        rackFingerprint: confirmation.preflight.rackFingerprint,
        profileId: confirmation.preflight.profileId,
        target: confirmation.preflight.target,
        generator: currentPreflight.generator,
        acceptedMaximumRetryCostMicrousd:
          confirmation.acceptedMaximumRetryCostMicrousd,
        estimatedCostMicrousd: currentPreflight.costMicrousd.estimated,
        instructions: confirmation.instructions,
        casePrompt: confirmation.casePrompt,
        transientExpiresAt: expiresAt,
      };
      const reservation = rubricBacked
        ? await executionStore.reserveQuickRubricEvaluation({
            ...reservationInput,
            rubric: confirmation.rubric!,
          })
        : await executionStore.reserveQuickEvaluation(reservationInput);

      if (reservation.replayed) {
        return readSettled(executionStore, reservation.runId, true);
      }

      let candidateResult: Awaited<ReturnType<ModelRunner["generate"]>>;
      try {
        candidateResult = await runner.generate({
          model: generator,
          instructions: confirmation.instructions,
          prompt: confirmation.casePrompt,
          maxOutputTokens: confirmation.preflight.generatorOutputTokensPerCall,
        });
      } catch {
        await executionStore.settleQuickEvaluation({
          runId: reservation.runId,
          providerCallStatus: "failed",
          responseId: null,
          inputTokens: null,
          outputTokens: null,
          costMicrousd: currentPreflight.costMicrousd.generator,
          costBasis: "failed-conservative",
          output: null,
        });
        return readSettled(executionStore, reservation.runId, false);
      }

      const candidateUsage = providerUsageCost(generator, candidateResult.usage);
      if (
        candidateUsage &&
        candidateUsage.costMicrousd > confirmation.acceptedMaximumRetryCostMicrousd
      ) {
        await executionStore.settleQuickEvaluation({
          runId: reservation.runId,
          providerCallStatus: "failed",
          responseId: candidateResult.responseId,
          inputTokens: candidateUsage.inputTokens,
          outputTokens: candidateUsage.outputTokens,
          costMicrousd: confirmation.acceptedMaximumRetryCostMicrousd,
          costBasis: "failed-conservative",
          output: null,
        });
        return readSettled(executionStore, reservation.runId, false);
      }

      const candidateCost = candidateUsage?.costMicrousd ?? currentPreflight.costMicrousd.generator;
      if (!rubricBacked) {
        await executionStore.settleQuickEvaluation({
          runId: reservation.runId,
          providerCallStatus: "completed",
          responseId: candidateResult.responseId,
          inputTokens: candidateUsage?.inputTokens ?? null,
          outputTokens: candidateUsage?.outputTokens ?? null,
          costMicrousd: candidateCost,
          costBasis: candidateUsage ? "provider-usage" : "planned-allowance",
          output: candidateResult.text,
        });
        return readSettled(executionStore, reservation.runId, false);
      }

      await executionStore.recordQuickCandidateForJudge({
        runId: reservation.runId,
        responseId: candidateResult.responseId,
        inputTokens: candidateUsage?.inputTokens ?? null,
        outputTokens: candidateUsage?.outputTokens ?? null,
        costMicrousd: candidateCost,
        costBasis: candidateUsage ? "provider-usage" : "planned-allowance",
        output: candidateResult.text,
      });

      const claimedJudge = await executionStore.claimQuickJudge(
        reservation.runId,
        currentPreflight.judge,
      );
      if (!claimedJudge) {
        return serviceError(
          "invalid-request",
          "The rubric judge call is already claimed. Rack will not repeat it automatically.",
          409,
        );
      }

      let judgeResult: Awaited<ReturnType<ModelRunner["generate"]>>;
      try {
        judgeResult = await runner.generate({
          model: judge!,
          instructions: QUICK_RUBRIC_JUDGE_SYSTEM,
          prompt: buildQuickRubricPrompt({
            rubric: confirmation.rubric!,
            casePrompt: confirmation.casePrompt,
            candidateOutput: candidateResult.text,
          }),
          maxOutputTokens: confirmation.preflight.judgeOutputTokensPerCall,
        });
      } catch {
        const remaining = Math.max(
          0,
          confirmation.acceptedMaximumRetryCostMicrousd - candidateCost,
        );
        await executionStore.settleQuickJudgement({
          runId: reservation.runId,
          providerCallStatus: "failed",
          responseId: null,
          inputTokens: null,
          outputTokens: null,
          costMicrousd: Math.min(currentPreflight.costMicrousd.judge, remaining),
          costBasis: "failed-conservative",
          judgeOutput: null,
          judgement: null,
          executionStatus: "incomplete",
          behaviouralVerdict: null,
        });
        return readSettled(executionStore, reservation.runId, false);
      }

      const judgeUsage = providerUsageCost(judge!, judgeResult.usage);
      const remaining = Math.max(
        0,
        confirmation.acceptedMaximumRetryCostMicrousd - candidateCost,
      );
      const requestedJudgeCost = judgeUsage?.costMicrousd ?? currentPreflight.costMicrousd.judge;
      if (requestedJudgeCost > remaining) {
        await executionStore.settleQuickJudgement({
          runId: reservation.runId,
          providerCallStatus: "completed",
          responseId: judgeResult.responseId,
          inputTokens: judgeUsage?.inputTokens ?? null,
          outputTokens: judgeUsage?.outputTokens ?? null,
          costMicrousd: remaining,
          costBasis: "failed-conservative",
          judgeOutput: judgeResult.text,
          judgement: null,
          executionStatus: "incomplete",
          behaviouralVerdict: null,
        });
        return readSettled(executionStore, reservation.runId, false);
      }

      const judgement = parseQuickRubricJudgement(judgeResult.text);
      await executionStore.settleQuickJudgement({
        runId: reservation.runId,
        providerCallStatus: "completed",
        responseId: judgeResult.responseId,
        inputTokens: judgeUsage?.inputTokens ?? null,
        outputTokens: judgeUsage?.outputTokens ?? null,
        costMicrousd: requestedJudgeCost,
        costBasis: judgeUsage ? "provider-usage" : "planned-allowance",
        judgeOutput: judgeResult.text,
        judgement,
        executionStatus: judgement ? "completed" : "incomplete",
        behaviouralVerdict: judgement ? judgement.verdict === "pass" : null,
      });
      return readSettled(executionStore, reservation.runId, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.startsWith("Unknown model alias:") ||
        message.includes("does not support") ||
        message.includes("must support judge")
      ) {
        return serviceError("invalid-request", message, 400);
      }
      if (message.includes("rack-eval:")) {
        return serviceError(
          "invalid-request",
          "Evaluation limits or paid-call state changed while reserving/executing work. Run preflight again or inspect the existing run.",
          409,
        );
      }
      return serviceError("internal-error", "Confirmed model evaluation could not be completed.", 500);
    }
  };
};
