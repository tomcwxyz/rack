import {
  createNeonManagedStore,
  type ManagedStore,
  type VerifiedAuthClaims,
} from "@rack/database";
import { quickCheckRequestSchema, runQuickCheck } from "@rack/managed";
import { ManagedAuthenticationError, verifyManagedRequest } from "./auth.js";
import type { ServiceEnvironment } from "./env.js";
import { json, serviceError } from "./http.js";

export type CheckHandlerDependencies = {
  environment: ServiceEnvironment;
  verifyAuth?: (
    request: Request,
    environment: ServiceEnvironment,
  ) => Promise<VerifiedAuthClaims>;
  storeFor?: (claims: VerifiedAuthClaims) => Pick<ManagedStore, "saveQuickCheck">;
  now?: () => Date;
};

export const createCheckHandler = (dependencies: CheckHandlerDependencies) => {
  const verifyAuth = dependencies.verifyAuth ?? verifyManagedRequest;
  const now = dependencies.now ?? (() => new Date());
  const storeFor =
    dependencies.storeFor ??
    ((claims: VerifiedAuthClaims) =>
      createNeonManagedStore({
        databaseUrl: dependencies.environment.databaseUrl,
        authClaims: claims,
        now,
      }));

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return serviceError("method-not-allowed", "Use POST for managed checks.", 405);
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
      return serviceError("invalid-request", "Send a valid JSON check request.", 400);
    }
    const parsed = quickCheckRequestSchema.safeParse(input);
    if (!parsed.success) {
      return serviceError(
        "invalid-request",
        "The managed check request does not match the Rack service contract.",
        400,
      );
    }

    try {
      const summary = runQuickCheck(parsed.data, now());
      const result = await storeFor(claims).saveQuickCheck(parsed.data, summary);
      return json(result);
    } catch {
      return serviceError(
        "internal-error",
        "The managed check could not be completed.",
        500,
      );
    }
  };
};
