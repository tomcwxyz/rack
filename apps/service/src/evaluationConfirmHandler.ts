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
    throw new Error("A settled evaluation requires a completed provider-call ledger entry.");
  }
  return evaluationConfirmResponseSchema.parse({
    schemaVersion: "0.1",
    runId: stored.runId,
    workspaceId: stored.workspaceId,
    status: stored.status,
    replayed,
    generator: stored.generator,
    behaviouralVerdict: null,
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
  });
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

      const expiresAt = transientExpiry(now()).toISOString();
      const reservation = await executionStore.reserveQuickEvaluation({
        workspaceId,
        idempotencyKey: confirmation.idempotencyKey,
        rackFingerprint: confirmation.preflight.rackFingerprint,
        profileId: confirmation.preflight.profileId,
        target: confirmation.preflight.target,
        generator: currentPreflight.generator,
        acceptedMaximumRetryCostMicrousd:
          confirmation.acceptedMaximumRetryCostMicrousd,
        estimatedCostMicrousd: currentPreflight.costMicrousd.generator,
        instructions: confirmation.instructions,
        casePrompt: confirmation.casePrompt,
        transientExpiresAt: expiresAt,
      });

      if (reservation.replayed) {
        const stored = await executionStore.getQuickEvaluation(reservation.runId);
        if (!stored) {
          return serviceError("internal-error", "The existing evaluation run could not be read.", 500);
        }
        if (stored.status === "running") {
          return serviceError(
            "invalid-request",
            "This paid provider call is already claimed. Rack will not repeat it automatically.",
            409,
          );
        }
        return json(responseFromStored(stored, true));
      }

      let providerResult: Awaited<ReturnType<ModelRunner["generate"]>>;
      try {
        providerResult = await runner.generate({
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
        const incomplete = await executionStore.getQuickEvaluation(reservation.runId);
        if (!incomplete) {
          return serviceError("internal-error", "The incomplete evaluation run could not be read.", 500);
        }
        return json(responseFromStored(incomplete, false));
      }

      const usageCost = providerUsageCost(generator, providerResult.usage);
      if (
        usageCost &&
        usageCost.costMicrousd > confirmation.acceptedMaximumRetryCostMicrousd
      ) {
        await executionStore.settleQuickEvaluation({
          runId: reservation.runId,
          providerCallStatus: "failed",
          responseId: providerResult.responseId,
          inputTokens: usageCost.inputTokens,
          outputTokens: usageCost.outputTokens,
          costMicrousd: confirmation.acceptedMaximumRetryCostMicrousd,
          costBasis: "failed-conservative",
          output: null,
        });
      } else {
        await executionStore.settleQuickEvaluation({
          runId: reservation.runId,
          providerCallStatus: "completed",
          responseId: providerResult.responseId,
          inputTokens: usageCost?.inputTokens ?? null,
          outputTokens: usageCost?.outputTokens ?? null,
          costMicrousd: usageCost?.costMicrousd ?? currentPreflight.costMicrousd.generator,
          costBasis: usageCost ? "provider-usage" : "planned-allowance",
          output: providerResult.text,
        });
      }

      const completed = await executionStore.getQuickEvaluation(reservation.runId);
      if (!completed) {
        return serviceError("internal-error", "The completed evaluation run could not be read.", 500);
      }
      return json(responseFromStored(completed, false));
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
          "Evaluation limits changed while reserving paid work. Run preflight again.",
          409,
        );
      }
      return serviceError("internal-error", "Confirmed model execution could not be completed.", 500);
    }
  };
};
