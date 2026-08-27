import {
  createNeonEvaluationLimitStore,
  createNeonReliableEvaluationStore,
  type EvaluationLimitDefaults,
  type EvaluationLimitStore,
  type ReliableEvaluationStore,
  type VerifiedAuthClaims,
} from "@rack/database";
import { buildEvaluationPreflight } from "@rack/eval";
import {
  RELIABLE_BASELINE_INSTRUCTIONS,
  reliableEvaluationConfirmRequestSchema,
  reliableEvaluationStartResponseSchema,
  transientExpiry,
  type ResolvedModelIdentity,
} from "@rack/managed";
import { resolveModelAlias, type ModelRegistry } from "@rack/registry";
import { ManagedAuthenticationError, verifyManagedRequest } from "./auth.js";
import {
  readEvaluationLimitDefaults,
  readEvaluationModelRegistry,
} from "./evaluationConfig.js";
import type { ServiceEnvironment } from "./env.js";
import { json, serviceError } from "./http.js";
import { conservativeQuickRubricPromptAllowance } from "./quickRubric.js";

export type ReliableEvaluationHandlerDependencies = {
  environment: ServiceEnvironment;
  verifyAuth?: (
    request: Request,
    environment: ServiceEnvironment,
  ) => Promise<VerifiedAuthClaims>;
  registry?: () => ModelRegistry;
  limitDefaults?: () => EvaluationLimitDefaults;
  limitStoreFor?: (claims: VerifiedAuthClaims) => EvaluationLimitStore;
  evaluationStoreFor?: (claims: VerifiedAuthClaims) => ReliableEvaluationStore;
  startWorkflow: (runId: string) => Promise<{ workflowRunId: string }>;
  now?: () => Date;
};

export type ReliableEvaluationStatusHandlerDependencies = Omit<
  ReliableEvaluationHandlerDependencies,
  "startWorkflow" | "registry" | "limitDefaults" | "limitStoreFor" | "now"
>;

const sameIdentity = (
  left: ResolvedModelIdentity,
  right: ResolvedModelIdentity,
): boolean =>
  left.alias === right.alias &&
  left.providerId === right.providerId &&
  left.modelId === right.modelId;

const conservativeInputTokenAllowance = (instructions: string, casePrompt: string): number =>
  new TextEncoder().encode(`${instructions}\n\n${casePrompt}`).length;

const authFailure = (error: unknown): Response =>
  error instanceof ManagedAuthenticationError
    ? serviceError("unauthorised", error.message, 401)
    : serviceError("unauthorised", "A valid sign-in is required.", 401);

export const createReliableEvaluationStartHandler = (
  dependencies: ReliableEvaluationHandlerDependencies,
) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const registry = dependencies.registry ?? readEvaluationModelRegistry;
  const limitDefaults = dependencies.limitDefaults ?? readEvaluationLimitDefaults;
  const now = dependencies.now ?? (() => new Date());
  const limitStoreFor =
    dependencies.limitStoreFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonEvaluationLimitStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));
  const evaluationStoreFor =
    dependencies.evaluationStoreFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonReliableEvaluationStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return serviceError("method-not-allowed", "Use POST to confirm a Reliable evaluation.", 405);
    }

    let claims: VerifiedAuthClaims;
    try {
      claims = await verifyAuth(request, dependencies.environment);
    } catch (error) {
      return authFailure(error);
    }

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return serviceError("invalid-request", "Send a valid JSON Reliable evaluation request.", 400);
    }
    const parsed = reliableEvaluationConfirmRequestSchema.safeParse(input);
    if (!parsed.success) {
      return serviceError(
        "invalid-request",
        "The Reliable evaluation request does not match the Rack service contract.",
        400,
      );
    }
    const confirmation = parsed.data;

    let modelRegistry: ModelRegistry;
    let defaults: EvaluationLimitDefaults;
    try {
      modelRegistry = registry();
      defaults = limitDefaults();
    } catch {
      return serviceError(
        "service-not-configured",
        "Managed Reliable evaluation is not configured for this deployment.",
        503,
      );
    }

    const limitStore = limitStoreFor(claims);
    const evaluationStore = evaluationStoreFor(claims);
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
          "Evaluation limits changed. Run preflight again before confirming Reliable paid work.",
          409,
        );
      }
      if (
        !sameIdentity(currentPreflight.generator, confirmation.acceptedGenerator) ||
        !sameIdentity(currentPreflight.judge, confirmation.acceptedJudge) ||
        currentPreflight.costMicrousd.maximumRetry !==
          confirmation.acceptedMaximumRetryCostMicrousd
      ) {
        return serviceError(
          "invalid-request",
          "The Reliable generator, judge or maximum retry exposure changed. Run preflight again before confirming paid work.",
          409,
        );
      }
      if (currentPreflight.judgeIndependent !== true) {
        return serviceError(
          "invalid-request",
          "Reliable requires an independent judge model. Choose a judge that resolves to a different provider/model and run preflight again.",
          409,
        );
      }

      const generator = resolveModelAlias(
        modelRegistry,
        currentPreflight.generator.alias,
        "generate",
      );
      const judge = resolveModelAlias(modelRegistry, currentPreflight.judge.alias, "judge");
      if (generator.connection !== "managed" || judge.connection !== "managed") {
        return serviceError(
          "invalid-request",
          "The managed Reliable endpoint can only execute deployment-managed generator and judge connections.",
          400,
        );
      }

      if (
        conservativeInputTokenAllowance(
          confirmation.instructions,
          confirmation.casePrompt,
        ) > confirmation.preflight.candidateInputTokensPerCase
      ) {
        return serviceError(
          "invalid-request",
          "The confirmed Rack input is larger than the preflight allowance. Run preflight again.",
          409,
        );
      }
      if (
        conservativeInputTokenAllowance(
          RELIABLE_BASELINE_INSTRUCTIONS,
          confirmation.casePrompt,
        ) > (confirmation.preflight.baselineInputTokensPerCase ?? 0)
      ) {
        return serviceError(
          "invalid-request",
          "The Reliable baseline input is larger than the preflight allowance. Run preflight again.",
          409,
        );
      }
      if (
        conservativeQuickRubricPromptAllowance({
          rubric: confirmation.rubric,
          casePrompt: confirmation.casePrompt,
        }) > confirmation.preflight.judgePromptTokensPerCase
      ) {
        return serviceError(
          "invalid-request",
          "The confirmed rubric/task is larger than the Reliable judge allowance. Run preflight again.",
          409,
        );
      }

      const expiresAt = transientExpiry(now()).toISOString();
      const reservation = await evaluationStore.reserve({
        workspaceId,
        confirmation,
        generator: currentPreflight.generator,
        judge: currentPreflight.judge,
        judgeIndependent: true,
        acceptedMaximumRetryCostMicrousd:
          confirmation.acceptedMaximumRetryCostMicrousd,
        estimatedCostMicrousd: currentPreflight.costMicrousd.estimated,
        transientExpiresAt: expiresAt,
      });
      if (reservation.replayed) {
        const stored = await evaluationStore.getStatus(reservation.runId);
        if (!stored) {
          return serviceError("internal-error", "The Reliable evaluation replay could not be read.", 500);
        }
        return json(
          reliableEvaluationStartResponseSchema.parse({
            schemaVersion: "0.1",
            runId: reservation.runId,
            workflowRunId: null,
            status: stored.status,
            replayed: true,
            transientContentExpiresAt: stored.transientContentExpiresAt,
          }),
          202,
        );
      }

      let workflowRunId: string;
      try {
        ({ workflowRunId } = await dependencies.startWorkflow(reservation.runId));
      } catch {
        await evaluationStore.failBeforeStart(reservation.runId);
        return serviceError(
          "internal-error",
          "Reliable evaluation could not be queued; no provider call was started.",
          500,
        );
      }

      return json(
        reliableEvaluationStartResponseSchema.parse({
          schemaVersion: "0.1",
          runId: reservation.runId,
          workflowRunId,
          status: "queued",
          replayed: false,
          transientContentExpiresAt: expiresAt,
        }),
        202,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("rack-eval:") || message.startsWith("Unknown model alias:")) {
        return serviceError("invalid-request", message, 409);
      }
      return serviceError("internal-error", "Reliable evaluation could not be reserved.", 500);
    }
  };
};

export const createReliableEvaluationStatusHandler = (
  dependencies: ReliableEvaluationStatusHandlerDependencies,
) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const evaluationStoreFor =
    dependencies.evaluationStoreFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonReliableEvaluationStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") {
      return serviceError("method-not-allowed", "Use GET for Reliable evaluation status.", 405);
    }
    let claims: VerifiedAuthClaims;
    try {
      claims = await verifyAuth(request, dependencies.environment);
    } catch (error) {
      return authFailure(error);
    }
    const runId = new URL(request.url).searchParams.get("runId")?.trim();
    if (!runId) return serviceError("invalid-request", "Reliable status requires runId.", 400);
    try {
      const stored = await evaluationStoreFor(claims).getStatus(runId);
      if (!stored) return serviceError("not-found", "Reliable evaluation was not found.", 404);
      return json(stored);
    } catch {
      return serviceError("invalid-request", "Reliable status requires a valid runId.", 400);
    }
  };
};
