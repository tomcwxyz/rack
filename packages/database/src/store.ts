import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  durableEvaluationSummarySchema,
  managedRunIdSchema,
  quickCheckRequestSchema,
  reliableCheckRunStatusSchema,
  reliableCheckStatusResponseSchema,
  transientExpiry,
  type DurableEvaluationSummary,
  type QuickCheckRequest,
  type QuickCheckResponse,
  type ReliableCheckStatusResponse,
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

export type NeonReliableWorkflowStoreOptions = {
  databaseUrl: string;
  runId: string;
  now?: () => Date;
};

export type ReliableCheckCreated = {
  runId: string;
  workspaceId: string;
  status: "queued";
  transientContentExpiresAt: string;
};

export type ManagedStore = {
  saveQuickCheck: (
    request: QuickCheckRequest,
    summary: DurableEvaluationSummary,
  ) => Promise<QuickCheckResponse>;
  createReliableCheck: (request: QuickCheckRequest) => Promise<ReliableCheckCreated>;
  getReliableCheck: (runId: string) => Promise<ReliableCheckStatusResponse | null>;
  markReliableCheckFailed: (runId: string) => Promise<void>;
};

export type ReliableWorkflowStore = {
  getStatus: () => Promise<ReliableCheckStatusResponse | null>;
  loadRequest: () => Promise<QuickCheckRequest>;
  markRunning: () => Promise<void>;
  complete: (
    summary: DurableEvaluationSummary,
  ) => Promise<DurableEvaluationSummary>;
  markFailed: () => Promise<void>;
};

const claimsJson = (claims: VerifiedAuthClaims): string => {
  if (!claims.sub.trim()) throw new Error("Authenticated claims require a subject.");
  return JSON.stringify(claims);
};

const asIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid stored managed timestamp.");
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

type ReliableStatusRow = {
  run_id: string;
  status: string;
  schema_version: string | null;
  rack_fingerprint: string | null;
  profile_id: string | null;
  target: string | null;
  passed: boolean | null;
  score: number | null;
  estimated_instruction_tokens: number | null;
  errors: number | null;
  warnings: number | null;
  information: number | null;
  findings: unknown;
  checked_at: unknown;
};

const parseReliableStatusRow = (
  row: ReliableStatusRow | undefined,
): ReliableCheckStatusResponse | null => {
  if (!row) return null;
  const status = reliableCheckRunStatusSchema.parse(row.status);
  if (status !== "completed") {
    return reliableCheckStatusResponseSchema.parse({
      runId: row.run_id,
      status,
      summary: null,
    });
  }

  if (
    row.schema_version === null ||
    row.rack_fingerprint === null ||
    row.profile_id === null ||
    row.target === null ||
    row.passed === null ||
    row.score === null ||
    row.estimated_instruction_tokens === null ||
    row.errors === null ||
    row.warnings === null ||
    row.information === null ||
    row.checked_at === null
  ) {
    throw new Error("Completed reliable check has no durable summary.");
  }

  const summary = durableEvaluationSummarySchema.parse({
    schemaVersion: row.schema_version,
    rackFingerprint: row.rack_fingerprint,
    profileId: row.profile_id,
    target: row.target,
    passed: row.passed,
    score: row.score,
    estimatedInstructionTokens: row.estimated_instruction_tokens,
    counts: {
      errors: row.errors,
      warnings: row.warnings,
      information: row.information,
    },
    findings: asJson(row.findings),
    checkedAt: asIso(row.checked_at),
  });

  return reliableCheckStatusResponseSchema.parse({
    runId: row.run_id,
    status,
    summary,
  });
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

  const getReliableCheck = async (
    inputRunId: string,
  ): Promise<ReliableCheckStatusResponse | null> => {
    const runId = managedRunIdSchema.parse(inputRunId);
    const [, rows] = await withClaims(sql`
      select
        run.id as run_id,
        run.status,
        summary.schema_version,
        summary.rack_fingerprint,
        summary.profile_id,
        summary.target,
        summary.passed,
        summary.score,
        summary.estimated_instruction_tokens,
        summary.errors,
        summary.warnings,
        summary.information,
        summary.findings,
        summary.checked_at
      from rack_managed_runs run
      left join rack_evaluation_summaries summary on summary.run_id = run.id
      where run.id = ${runId}::uuid
        and run.kind = 'reliable-check'
      limit 1
    `);
    return parseReliableStatusRow((rows as unknown as ReliableStatusRow[])[0]);
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

    async createReliableCheck(input) {
      const request = quickCheckRequestSchema.parse(input);
      const workspaceId = await resolveWorkspace();
      const runId = randomUUID();
      const createdAt = now();
      const expiresAt = transientExpiry(createdAt);
      const requestJson = JSON.stringify(request);

      await sql.transaction([
        sql`select set_config('request.jwt.claims', ${serialisedClaims}, true)`,
        sql`
          insert into rack_managed_runs (
            id, workspace_id, user_id, kind, rack_fingerprint, profile_id, target,
            status, created_at
          ) values (
            ${runId}::uuid, ${workspaceId}::uuid, (select auth.user_id()), 'reliable-check',
            ${request.rackFingerprint}, ${request.profileId}, ${request.target}, 'queued',
            ${createdAt.toISOString()}::timestamptz
          )
        `,
        sql`
          insert into rack_managed_payloads (
            run_id, workspace_id, request_body, response_body, created_at, expires_at
          ) values (
            ${runId}::uuid, ${workspaceId}::uuid, ${requestJson}::jsonb, null,
            ${createdAt.toISOString()}::timestamptz, ${expiresAt.toISOString()}::timestamptz
          )
        `,
      ]);

      return {
        runId,
        workspaceId,
        status: "queued",
        transientContentExpiresAt: expiresAt.toISOString(),
      };
    },

    getReliableCheck,

    async markReliableCheckFailed(inputRunId) {
      const runId = managedRunIdSchema.parse(inputRunId);
      const failedAt = now().toISOString();
      await withClaims(sql`
        update rack_managed_runs
        set status = 'failed', completed_at = ${failedAt}::timestamptz
        where id = ${runId}::uuid
          and kind = 'reliable-check'
          and status <> 'completed'
      `);
    },
  };
};

export const createNeonReliableWorkflowStore = (
  options: NeonReliableWorkflowStoreOptions,
): ReliableWorkflowStore => {
  const sql = neon(options.databaseUrl);
  const runId = managedRunIdSchema.parse(options.runId);
  const now = options.now ?? (() => new Date());

  const withRunScope = <T>(query: T) =>
    sql.transaction([
      sql`select set_config('rack.workflow_run_id', ${runId}, true)`,
      query as never,
    ]);

  const getStatus = async (): Promise<ReliableCheckStatusResponse | null> => {
    const [, rows] = await withRunScope(sql`
      select
        run.id as run_id,
        run.status,
        summary.schema_version,
        summary.rack_fingerprint,
        summary.profile_id,
        summary.target,
        summary.passed,
        summary.score,
        summary.estimated_instruction_tokens,
        summary.errors,
        summary.warnings,
        summary.information,
        summary.findings,
        summary.checked_at
      from rack_managed_runs run
      left join rack_evaluation_summaries summary on summary.run_id = run.id
      where run.id = ${runId}::uuid
        and run.kind = 'reliable-check'
      limit 1
    `);
    return parseReliableStatusRow((rows as unknown as ReliableStatusRow[])[0]);
  };

  return {
    getStatus,

    async loadRequest() {
      const [, rows] = await withRunScope(sql`
        select payload.request_body
        from rack_managed_payloads payload
        where payload.run_id = ${runId}::uuid
          and payload.expires_at > now()
        limit 1
      `);
      const row = (rows as unknown as { request_body: unknown }[])[0];
      if (!row) throw new Error("Reliable check content is unavailable or expired.");
      return quickCheckRequestSchema.parse(asJson(row.request_body));
    },

    async markRunning() {
      await withRunScope(sql`
        update rack_managed_runs
        set status = 'running'
        where id = ${runId}::uuid
          and kind = 'reliable-check'
          and status in ('queued', 'running')
      `);
    },

    async complete(inputSummary) {
      const summary = durableEvaluationSummarySchema.parse(inputSummary);
      const findingsJson = JSON.stringify(summary.findings);

      await sql.transaction([
        sql`select set_config('rack.workflow_run_id', ${runId}, true)`,
        sql`
          insert into rack_evaluation_summaries (
            run_id, workspace_id, schema_version, rack_fingerprint, profile_id, target,
            passed, score, estimated_instruction_tokens, errors, warnings, information,
            findings, checked_at
          )
          select
            run.id, run.workspace_id, ${summary.schemaVersion}, ${summary.rackFingerprint},
            ${summary.profileId}, ${summary.target}, ${summary.passed}, ${summary.score},
            ${summary.estimatedInstructionTokens}, ${summary.counts.errors},
            ${summary.counts.warnings}, ${summary.counts.information}, ${findingsJson}::jsonb,
            ${summary.checkedAt}::timestamptz
          from rack_managed_runs run
          where run.id = ${runId}::uuid and run.kind = 'reliable-check'
          on conflict (run_id) do nothing
        `,
        sql`
          update rack_managed_runs
          set status = 'completed', completed_at = ${summary.checkedAt}::timestamptz
          where id = ${runId}::uuid
            and kind = 'reliable-check'
            and status <> 'completed'
        `,
      ]);

      const stored = await getStatus();
      if (!stored || stored.status !== "completed") {
        throw new Error("Reliable check could not be completed.");
      }
      return stored.summary;
    },

    async markFailed() {
      const failedAt = now().toISOString();
      await withRunScope(sql`
        update rack_managed_runs
        set status = 'failed', completed_at = ${failedAt}::timestamptz
        where id = ${runId}::uuid
          and kind = 'reliable-check'
          and status <> 'completed'
      `);
    },
  };
};

export const purgeExpiredManagedPayloads = async (
  retentionDatabaseUrl: string,
): Promise<void> => {
  const sql = neon(retentionDatabaseUrl);
  await sql`delete from rack_managed_payloads where expires_at <= now()`;
};
