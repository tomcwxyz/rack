import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  durableEvaluationSummarySchema,
  quickCheckRequestSchema,
  transientExpiry,
  type DurableEvaluationSummary,
  type QuickCheckRequest,
  type QuickCheckResponse,
} from "@rack/managed";

export type VerifiedAuthClaims = {
  sub: string;
  [claim: string]: unknown;
};

export type NeonManagedStoreOptions = {
  databaseUrl: string;
  authClaims: VerifiedAuthClaims;
  now?: () => Date;
};

export type ManagedStore = {
  saveQuickCheck: (
    request: QuickCheckRequest,
    summary: DurableEvaluationSummary,
  ) => Promise<QuickCheckResponse>;
};

const claimsJson = (claims: VerifiedAuthClaims): string => {
  if (!claims.sub.trim()) throw new Error("Authenticated claims require a subject.");
  return JSON.stringify(claims);
};

export const createNeonManagedStore = (
  options: NeonManagedStoreOptions,
): ManagedStore => {
  const sql = neon(options.databaseUrl);
  const serialisedClaims = claimsJson(options.authClaims);
  const now = options.now ?? (() => new Date());

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
      on conflict (owner_user_id) do update
        set owner_user_id = excluded.owner_user_id
      returning id
    `);
    const row = (rows as unknown as { id: string }[])[0];
    if (!row?.id) throw new Error("Could not resolve the personal workspace.");

    await withClaims(sql`
      insert into rack_workspace_memberships (workspace_id, user_id, role)
      values (${row.id}::uuid, (select auth.user_id()), 'owner')
      on conflict (workspace_id, user_id) do nothing
    `);
    return row.id;
  };

  return {
    async saveQuickCheck(input, inputSummary) {
      const request = quickCheckRequestSchema.parse(input);
      const summary = durableEvaluationSummarySchema.parse(inputSummary);
      const workspaceId = await resolveWorkspace();
      const runId = randomUUID();
      const createdAt = now();
      const expiresAt = transientExpiry(createdAt);
      const requestJson = JSON.stringify(request);
      const responseJson = JSON.stringify({ summary });
      const findingsJson = JSON.stringify(summary.findings);

      await sql.transaction([
        sql`select set_config('request.jwt.claims', ${serialisedClaims}, true)`,
        sql`
          insert into rack_managed_runs (
            id, workspace_id, user_id, kind, rack_fingerprint, profile_id, target,
            status, created_at, completed_at
          ) values (
            ${runId}::uuid, ${workspaceId}::uuid, (select auth.user_id()), 'quick-check',
            ${request.rackFingerprint}, ${request.profileId}, ${request.target},
            ${summary.passed ? "passed" : "needs-attention"}, ${createdAt.toISOString()}::timestamptz,
            ${summary.checkedAt}::timestamptz
          )
        `,
        sql`
          insert into rack_managed_payloads (
            run_id, workspace_id, request_body, response_body, created_at, expires_at
          ) values (
            ${runId}::uuid, ${workspaceId}::uuid, ${requestJson}::jsonb, ${responseJson}::jsonb,
            ${createdAt.toISOString()}::timestamptz, ${expiresAt.toISOString()}::timestamptz
          )
        `,
        sql`
          insert into rack_evaluation_summaries (
            run_id, workspace_id, schema_version, rack_fingerprint, profile_id, target,
            passed, score, estimated_instruction_tokens, errors, warnings, information,
            findings, checked_at
          ) values (
            ${runId}::uuid, ${workspaceId}::uuid, ${summary.schemaVersion},
            ${summary.rackFingerprint}, ${summary.profileId}, ${summary.target},
            ${summary.passed}, ${summary.score}, ${summary.estimatedInstructionTokens},
            ${summary.counts.errors}, ${summary.counts.warnings}, ${summary.counts.information},
            ${findingsJson}::jsonb, ${summary.checkedAt}::timestamptz
          )
        `,
      ]);

      return {
        runId,
        workspaceId,
        summary,
        transientContentExpiresAt: expiresAt.toISOString(),
      };
    },
  };
};

export const purgeExpiredManagedPayloads = async (
  retentionDatabaseUrl: string,
): Promise<void> => {
  const sql = neon(retentionDatabaseUrl);
  await sql`delete from rack_managed_payloads where expires_at <= now()`;
};
