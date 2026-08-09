import {
  createNeonEvaluationLimitStore,
  type EvaluationLimitDefaults,
  type EvaluationLimitStore,
  type VerifiedAuthClaims,
} from "@rack/database";
import { buildEvaluationPreflight } from "@rack/eval";
import { evaluationPreflightRequestSchema } from "@rack/managed";
import type { ModelRegistry } from "@rack/registry";
import { ManagedAuthenticationError, verifyManagedRequest } from "./auth.js";
import {
  readEvaluationLimitDefaults,
  readEvaluationModelRegistry,
} from "./evaluationConfig.js";
import type { ServiceEnvironment } from "./env.js";
import { json, serviceError } from "./http.js";

export type EvaluationPreflightHandlerDependencies = {
  environment: ServiceEnvironment;
  verifyAuth?: (
    request: Request,
    environment: ServiceEnvironment,
  ) => Promise<VerifiedAuthClaims>;
  registry?: () => ModelRegistry;
  limitDefaults?: () => EvaluationLimitDefaults;
  limitStoreFor?: (claims: VerifiedAuthClaims) => EvaluationLimitStore;
};

export const createEvaluationPreflightHandler = (
  dependencies: EvaluationPreflightHandlerDependencies,
) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const registry = dependencies.registry ?? readEvaluationModelRegistry;
  const limitDefaults = dependencies.limitDefaults ?? readEvaluationLimitDefaults;
  const limitStoreFor =
    dependencies.limitStoreFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonEvaluationLimitStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return serviceError("method-not-allowed", "Use POST for evaluation preflight.", 405);
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
      return serviceError("invalid-request", "Send a valid JSON evaluation preflight request.", 400);
    }
    const parsed = evaluationPreflightRequestSchema.safeParse(input);
    if (!parsed.success) {
      return serviceError(
        "invalid-request",
        "The evaluation preflight request does not match the Rack service contract.",
        400,
      );
    }

    let modelRegistry: ModelRegistry;
    let defaults: EvaluationLimitDefaults;
    try {
      modelRegistry = registry();
      defaults = limitDefaults();
    } catch {
      return serviceError(
        "service-not-configured",
        "Managed evaluation preflight is not configured for this deployment.",
        503,
      );
    }

    try {
      const { workspaceId: _workspaceId, ...limits } = await limitStoreFor(
        claims,
      ).getPreflightLimits(defaults);
      const preflight = buildEvaluationPreflight(parsed.data, modelRegistry, limits);
      return json(preflight);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.startsWith("Unknown model alias:") ||
        message.includes("does not support") ||
        message.includes("must support judge")
      ) {
        return serviceError("invalid-request", message, 400);
      }
      return serviceError("internal-error", "Evaluation preflight could not be calculated.", 500);
    }
  };
};
