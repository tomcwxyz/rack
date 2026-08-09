import {
  createNeonManagedStore,
  type ManagedStore,
  type VerifiedAuthClaims,
} from "@rack/database";
import {
  managedRunIdSchema,
  reliableCheckRequestSchema,
  reliableCheckStartResponseSchema,
} from "@rack/managed";
import { ManagedAuthenticationError, verifyManagedRequest } from "./auth.js";
import type { ServiceEnvironment } from "./env.js";
import { json, serviceError } from "./http.js";

export type ReliableCheckStartStore = Pick<
  ManagedStore,
  "createReliableCheck" | "markReliableCheckFailed"
>;
export type ReliableCheckStatusStore = Pick<ManagedStore, "getReliableCheck">;

export type ReliableCheckStartHandlerDependencies = {
  environment: ServiceEnvironment;
  verifyAuth?: (
    request: Request,
    environment: ServiceEnvironment,
  ) => Promise<VerifiedAuthClaims>;
  storeFor?: (claims: VerifiedAuthClaims) => ReliableCheckStartStore;
  startWorkflow: (runId: string) => Promise<{ workflowRunId: string }>;
};

export type ReliableCheckStatusHandlerDependencies = {
  environment: ServiceEnvironment;
  verifyAuth?: (
    request: Request,
    environment: ServiceEnvironment,
  ) => Promise<VerifiedAuthClaims>;
  storeFor?: (claims: VerifiedAuthClaims) => ReliableCheckStatusStore;
};

const authenticated = async (
  request: Request,
  environment: ServiceEnvironment,
  verifyAuth: NonNullable<ReliableCheckStartHandlerDependencies["verifyAuth"]>,
): Promise<VerifiedAuthClaims | Response> => {
  try {
    return await verifyAuth(request, environment);
  } catch (error) {
    if (error instanceof ManagedAuthenticationError) {
      return serviceError("unauthorised", error.message, 401);
    }
    return serviceError("unauthorised", "A valid sign-in is required.", 401);
  }
};

export const createReliableCheckStartHandler = (
  dependencies: ReliableCheckStartHandlerDependencies,
) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const storeFor =
    dependencies.storeFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonManagedStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return serviceError("method-not-allowed", "Use POST to start a reliable check.", 405);
    }

    const auth = await authenticated(request, dependencies.environment, verifyAuth);
    if (auth instanceof Response) return auth;

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return serviceError("invalid-request", "Send a valid JSON reliable-check request.", 400);
    }
    const parsed = reliableCheckRequestSchema.safeParse(input);
    if (!parsed.success) {
      return serviceError(
        "invalid-request",
        "The reliable-check request does not match the Rack service contract.",
        400,
      );
    }

    const store = storeFor(auth);
    try {
      const created = await store.createReliableCheck(parsed.data);
      try {
        const workflow = await dependencies.startWorkflow(created.runId);
        return json(
          reliableCheckStartResponseSchema.parse({
            runId: created.runId,
            workflowRunId: workflow.workflowRunId,
            status: "queued",
            transientContentExpiresAt: created.transientContentExpiresAt,
          }),
          202,
        );
      } catch {
        await store.markReliableCheckFailed(created.runId);
        return serviceError(
          "internal-error",
          "The reliable check could not be queued.",
          500,
        );
      }
    } catch {
      return serviceError(
        "internal-error",
        "The reliable check could not be prepared.",
        500,
      );
    }
  };
};

export const createReliableCheckStatusHandler = (
  dependencies: ReliableCheckStatusHandlerDependencies,
) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const storeFor =
    dependencies.storeFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonManagedStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") {
      return serviceError("method-not-allowed", "Use GET for reliable-check status.", 405);
    }

    const auth = await authenticated(request, dependencies.environment, verifyAuth);
    if (auth instanceof Response) return auth;

    const rawRunId = new URL(request.url).searchParams.get("runId");
    const parsedRunId = managedRunIdSchema.safeParse(rawRunId);
    if (!parsedRunId.success) {
      return serviceError("invalid-request", "A valid Rack run ID is required.", 400);
    }

    try {
      const status = await storeFor(auth).getReliableCheck(parsedRunId.data);
      if (!status) {
        return serviceError("not-found", "Reliable check not found.", 404);
      }
      return json(status);
    } catch {
      return serviceError(
        "internal-error",
        "Reliable-check status could not be read.",
        500,
      );
    }
  };
};
