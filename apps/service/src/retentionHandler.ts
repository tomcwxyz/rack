import { purgeExpiredManagedPayloads } from "@rack/database";
import type { ServiceEnvironment } from "./env.js";
import { json, serviceError } from "./http.js";

export type RetentionHandlerDependencies = {
  environment: ServiceEnvironment;
  purge?: (databaseUrl: string) => Promise<void>;
};

export const createRetentionHandler = (dependencies: RetentionHandlerDependencies) => {
  const purge = dependencies.purge ?? purgeExpiredManagedPayloads;

  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") {
      return serviceError("method-not-allowed", "Use GET for retention cleanup.", 405);
    }
    const expected = `Bearer ${dependencies.environment.cronSecret}`;
    if (request.headers.get("authorization") !== expected) {
      return serviceError("unauthorised", "Retention cleanup is not authorised.", 401);
    }

    try {
      await purge(dependencies.environment.retentionDatabaseUrl);
      return json({ ok: true });
    } catch {
      return serviceError("internal-error", "Retention cleanup failed.", 500);
    }
  };
};
