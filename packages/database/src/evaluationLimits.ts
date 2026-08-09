import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  evaluationPreflightLimitsSchema,
  type EvaluationPreflightLimits,
} from "@rack/managed";
import type { VerifiedAuthClaims } from "./store.js";

export type EvaluationLimitDefaults = {
  hardBudgetMicrousd: number;
  perRunCapMicrousd: number;
  concurrencyLimit: number;
  maxProviderAttemptsPerCall: number;
};

export type EvaluationLimitStore = {
  getPreflightLimits: (
    defaults: EvaluationLimitDefaults,
  ) => Promise<EvaluationPreflightLimits & { workspaceId: string }>;
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

const validateDefaults = (defaults: EvaluationLimitDefaults): EvaluationLimitDefaults => {
  const hardBudgetMicrousd = safeInteger(defaults.hardBudgetMicrousd, "Workspace hard budget");
  const perRunCapMicrousd = safeInteger(defaults.perRunCapMicrousd, "Per-run cap");
  const concurrencyLimit = safeInteger(defaults.concurrencyLimit, "Concurrency limit");
  const maxProviderAttemptsPerCall = safeInteger(
    defaults.maxProviderAttemptsPerCall,
    "Provider attempt limit",
  );
  if (concurrencyLimit < 1) throw new Error("Concurrency limit must be at least 1.");
  if (maxProviderAttemptsPerCall < 1 || maxProviderAttemptsPerCall > 5) {
    throw new Error("Provider attempt limit must be between 1 and 5.");
  }
  return {
    hardBudgetMicrousd,
    perRunCapMicrousd,
    concurrencyLimit,
    maxProviderAttemptsPerCall,
  };
};

export const createNeonEvaluationLimitStore = (options: {
  databaseUrl: string;
  authClaims: VerifiedAuthClaims;
}): EvaluationLimitStore => {
  const sql = neon(options.databaseUrl);
  const serialisedClaims = claimsJson(options.authClaims);

  const withClaims = <T>(query: T) =>
    sql.transaction([
      sql`select set_config('request.jwt.claims', ${serialisedClaims}, true)`,
      query as never,
    ]);

  const resolveWorkspace = async (): Promise<string> => {
    const workspaceId = randomUUID();
    const [, rows] = await withClaims(sql`
      insert into rack_workspaces (id, owner_user_id, kind, name)
      values (${workspaceId}::uuid, (select auth.user_id()), 'personal', 'My Rack')
      on conflict (owner_user_id) do update set owner_user_id = excluded.owner_user_id
      returning id
    `);
    const row = (rows as unknown as { id: string }[])[0];
    if (!row?.id) throw new Error("Could not resolve the personal workspace.");
    return row.id;
  };

  return {
    async getPreflightLimits(inputDefaults) {
      const defaults = validateDefaults(inputDefaults);
      const workspaceId = await resolveWorkspace();

      await withClaims(sql`
        insert into rack_workspace_evaluation_limits (
          workspace_id, hard_budget_microusd, per_run_cap_microusd,
          concurrency_limit, max_provider_attempts_per_call
        ) values (
          ${workspaceId}::uuid, ${defaults.hardBudgetMicrousd}::bigint,
          ${defaults.perRunCapMicrousd}::bigint, ${defaults.concurrencyLimit},
          ${defaults.maxProviderAttemptsPerCall}
        )
        on conflict (workspace_id) do nothing
      `);

      const [, rows] = await withClaims(sql`
        select
          limits.hard_budget_microusd,
          limits.spent_microusd,
          limits.reserved_microusd,
          limits.per_run_cap_microusd,
          limits.concurrency_limit,
          limits.max_provider_attempts_per_call,
          (
            select count(*)::integer
            from rack_managed_runs run
            where run.workspace_id = limits.workspace_id
              and run.kind = 'model-evaluation'
              and run.status in ('queued', 'running')
          ) as active_paid_runs
        from rack_workspace_evaluation_limits limits
        where limits.workspace_id = ${workspaceId}::uuid
        limit 1
      `);
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) throw new Error("Could not read workspace evaluation limits.");

      const hard = safeInteger(row.hard_budget_microusd, "Workspace hard budget");
      const spent = safeInteger(row.spent_microusd, "Workspace spent amount");
      const reserved = safeInteger(row.reserved_microusd, "Workspace reserved amount");
      const workspaceRemainingMicrousd = Math.max(0, hard - spent - reserved);
      const limits = evaluationPreflightLimitsSchema.parse({
        perRunCapMicrousd: safeInteger(row.per_run_cap_microusd, "Per-run cap"),
        workspaceRemainingMicrousd,
        activePaidRuns: safeInteger(row.active_paid_runs, "Active paid runs"),
        concurrencyLimit: safeInteger(row.concurrency_limit, "Concurrency limit"),
        maxProviderAttemptsPerCall: safeInteger(
          row.max_provider_attempts_per_call,
          "Provider attempt limit",
        ),
      });
      return { workspaceId, ...limits };
    },
  };
};
