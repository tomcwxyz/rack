import { sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/neon";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { QuickCheckFinding } from "@rack/managed";

export const retentionRole = pgRole("rack_retention").existing();
export const workflowRole = pgRole("rack_workflow").existing();

export const workspaces = pgTable(
  "rack_workspaces",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull().default("personal"),
    ownerUserId: text("owner_user_id").notNull(),
    name: text("name").notNull().default("My Rack"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("rack_workspaces_owner_unique").on(table.ownerUserId),
    check("rack_workspaces_personal_only", sql`${table.kind} = 'personal'`),
    pgPolicy("rack_workspaces_owner", {
      for: "all",
      to: authenticatedRole,
      using: sql`${table.ownerUserId} = (select auth.user_id())`,
      withCheck: sql`${table.ownerUserId} = (select auth.user_id())`,
    }),
  ],
).enableRLS();

const ownsWorkspace = (workspaceId: AnyPgColumn) => sql`exists (
  select 1 from rack_workspaces workspace
  where workspace.id = ${workspaceId}
    and workspace.owner_user_id = (select auth.user_id())
)`;

const currentWorkflowRunId = sql`nullif(current_setting('rack.workflow_run_id', true), '')::uuid`;

export const workspaceMemberships = pgTable(
  "rack_workspace_memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    check("rack_membership_v01_owner_only", sql`${table.role} = 'owner'`),
    pgPolicy("rack_memberships_self", {
      for: "all",
      to: authenticatedRole,
      using: sql`${table.userId} = (select auth.user_id()) and ${ownsWorkspace(table.workspaceId)}`,
      withCheck: sql`${table.userId} = (select auth.user_id()) and ${ownsWorkspace(table.workspaceId)}`,
    }),
  ],
).enableRLS();

export const managedRuns = pgTable(
  "rack_managed_runs",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    kind: text("kind").notNull(),
    rackFingerprint: text("rack_fingerprint").notNull(),
    profileId: text("profile_id").notNull(),
    target: text("target").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    pgPolicy("rack_runs_workspace_owner", {
      for: "all",
      to: authenticatedRole,
      using: ownsWorkspace(table.workspaceId),
      withCheck: sql`${ownsWorkspace(table.workspaceId)} and (${table.userId} is null or ${table.userId} = (select auth.user_id()))`,
    }),
    pgPolicy("rack_runs_retention_read", {
      for: "select",
      to: retentionRole,
      using: sql`${table.userId} is not null and ${table.createdAt} <= now() - interval '24 hours'`,
    }),
    pgPolicy("rack_runs_retention_anonymise", {
      for: "update",
      to: retentionRole,
      using: sql`${table.userId} is not null and ${table.createdAt} <= now() - interval '24 hours'`,
      withCheck: sql`${table.userId} is null`,
    }),
    pgPolicy("rack_runs_reliable_workflow", {
      for: "all",
      to: workflowRole,
      using: sql`${table.id} = ${currentWorkflowRunId} and ${table.kind} = 'reliable-check'`,
      withCheck: sql`${table.id} = ${currentWorkflowRunId} and ${table.kind} = 'reliable-check'`,
    }),
    pgPolicy("rack_runs_model_eval_workflow", {
      for: "all",
      to: workflowRole,
      using: sql`${table.id} = ${currentWorkflowRunId} and ${table.kind} = 'model-evaluation'`,
      withCheck: sql`${table.id} = ${currentWorkflowRunId} and ${table.kind} = 'model-evaluation'`,
    }),
  ],
).enableRLS();

export const workspaceEvaluationLimits = pgTable(
  "rack_workspace_evaluation_limits",
  {
    workspaceId: uuid("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    hardBudgetMicrousd: bigint("hard_budget_microusd", { mode: "number" }).notNull(),
    spentMicrousd: bigint("spent_microusd", { mode: "number" }).notNull().default(0),
    reservedMicrousd: bigint("reserved_microusd", { mode: "number" }).notNull().default(0),
    perRunCapMicrousd: bigint("per_run_cap_microusd", { mode: "number" }).notNull(),
    concurrencyLimit: integer("concurrency_limit").notNull(),
    maxProviderAttemptsPerCall: integer("max_provider_attempts_per_call").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("rack_eval_budget_nonnegative", sql`${table.hardBudgetMicrousd} >= 0 and ${table.spentMicrousd} >= 0 and ${table.reservedMicrousd} >= 0 and ${table.perRunCapMicrousd} >= 0`),
    check("rack_eval_concurrency_positive", sql`${table.concurrencyLimit} > 0`),
    check("rack_eval_attempts_range", sql`${table.maxProviderAttemptsPerCall} between 1 and 5`),
    pgPolicy("rack_eval_limits_workspace_owner", {
      for: "all",
      to: authenticatedRole,
      using: ownsWorkspace(table.workspaceId),
      withCheck: ownsWorkspace(table.workspaceId),
    }),
    pgPolicy("rack_eval_limits_workflow", {
      for: "select",
      to: workflowRole,
      using: sql`exists (
        select 1 from rack_model_evaluation_runs evaluation
        where evaluation.run_id = ${currentWorkflowRunId}
          and evaluation.workspace_id = ${table.workspaceId}
      )`,
    }),
    pgPolicy("rack_eval_limits_workflow_update", {
      for: "update",
      to: workflowRole,
      using: sql`exists (
        select 1 from rack_model_evaluation_runs evaluation
        where evaluation.run_id = ${currentWorkflowRunId}
          and evaluation.workspace_id = ${table.workspaceId}
      )`,
      withCheck: sql`exists (
        select 1 from rack_model_evaluation_runs evaluation
        where evaluation.run_id = ${currentWorkflowRunId}
          and evaluation.workspace_id = ${table.workspaceId}
      )`,
    }),
  ],
).enableRLS();

export const modelEvaluationRuns = pgTable(
  "rack_model_evaluation_runs",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => managedRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    mode: text("mode").notNull().default("quick"),
    generatorAlias: text("generator_alias").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    judgeAlias: text("judge_alias"),
    judgeProviderId: text("judge_provider_id"),
    judgeModelId: text("judge_model_id"),
    judgeIndependent: boolean("judge_independent"),
    acceptedMaximumRetryMicrousd: bigint("accepted_maximum_retry_microusd", {
      mode: "number",
    }).notNull(),
    estimatedCostMicrousd: bigint("estimated_cost_microusd", { mode: "number" }).notNull(),
    settledCostMicrousd: bigint("settled_cost_microusd", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("running"),
    behaviouralVerdict: boolean("behavioural_verdict"),
    behaviouralScore: integer("behavioural_score"),
    baselineScore: integer("baseline_score"),
    previousAcceptedScore: integer("previous_accepted_score"),
    candidatePassRate: integer("candidate_pass_rate"),
    baselinePassRate: integer("baseline_pass_rate"),
    regressionPassed: boolean("regression_passed"),
    transientExpiresAt: timestamp("transient_expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    uniqueIndex("rack_model_eval_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
    check("rack_model_eval_mode", sql`${table.mode} in ('quick', 'reliable')`),
    check("rack_model_eval_cost_nonnegative", sql`${table.acceptedMaximumRetryMicrousd} >= 0 and ${table.estimatedCostMicrousd} >= 0 and ${table.settledCostMicrousd} >= 0`),
    check("rack_model_eval_status", sql`${table.status} in ('queued', 'running', 'completed', 'incomplete')`),
    check(
      "rack_model_eval_score_ranges",
      sql`(${table.behaviouralScore} is null or ${table.behaviouralScore} between 0 and 100)
        and (${table.baselineScore} is null or ${table.baselineScore} between 0 and 100)
        and (${table.previousAcceptedScore} is null or ${table.previousAcceptedScore} between 0 and 100)
        and (${table.candidatePassRate} is null or ${table.candidatePassRate} between 0 and 100)
        and (${table.baselinePassRate} is null or ${table.baselinePassRate} between 0 and 100)`,
    ),
    pgPolicy("rack_model_eval_workspace_owner", {
      for: "all",
      to: authenticatedRole,
      using: ownsWorkspace(table.workspaceId),
      withCheck: ownsWorkspace(table.workspaceId),
    }),
    pgPolicy("rack_model_eval_workflow", {
      for: "all",
      to: workflowRole,
      using: sql`${table.runId} = ${currentWorkflowRunId}`,
      withCheck: sql`${table.runId} = ${currentWorkflowRunId}`,
    }),
  ],
).enableRLS();

export const providerCalls = pgTable(
  "rack_provider_calls",
  {
    runId: uuid("run_id")
      .notNull()
      .references(() => managedRuns.id, { onDelete: "cascade" }),
    callKey: text("call_key").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    generatorAlias: text("generator_alias").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    status: text("status").notNull().default("claimed"),
    responseId: text("response_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costMicrousd: bigint("cost_microusd", { mode: "number" }).notNull().default(0),
    costBasis: text("cost_basis"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.callKey] }),
    check("rack_provider_call_status", sql`${table.status} in ('claimed', 'completed', 'failed')`),
    check("rack_provider_call_cost_nonnegative", sql`${table.costMicrousd} >= 0`),
    check(
      "rack_provider_call_cost_basis",
      sql`${table.costBasis} is null or ${table.costBasis} in ('provider-usage', 'planned-allowance', 'failed-conservative')`,
    ),
    pgPolicy("rack_provider_call_workspace_owner", {
      for: "all",
      to: authenticatedRole,
      using: ownsWorkspace(table.workspaceId),
      withCheck: ownsWorkspace(table.workspaceId),
    }),
    pgPolicy("rack_provider_calls_workflow", {
      for: "all",
      to: workflowRole,
      using: sql`${table.runId} = ${currentWorkflowRunId}`,
      withCheck: sql`${table.runId} = ${currentWorkflowRunId}`,
    }),
  ],
).enableRLS();

export const managedPayloads = pgTable(
  "rack_managed_payloads",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => managedRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestBody: jsonb("request_body").notNull(),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    check(
      "rack_payload_max_24h",
      sql`${table.expiresAt} <= ${table.createdAt} + interval '24 hours'`,
    ),
    pgPolicy("rack_payload_workspace_owner", {
      for: "all",
      to: authenticatedRole,
      using: ownsWorkspace(table.workspaceId),
      withCheck: ownsWorkspace(table.workspaceId),
    }),
    pgPolicy("rack_payload_reliable_workflow_read", {
      for: "select",
      to: workflowRole,
      using: sql`${table.runId} = ${currentWorkflowRunId} and ${table.expiresAt} > now()`,
    }),
    pgPolicy("rack_payload_model_eval_workflow_update", {
      for: "update",
      to: workflowRole,
      using: sql`${table.runId} = ${currentWorkflowRunId} and ${table.expiresAt} > now()`,
      withCheck: sql`${table.runId} = ${currentWorkflowRunId} and ${table.expiresAt} > now()`,
    }),
    pgPolicy("rack_payload_retention_delete", {
      for: "delete",
      to: retentionRole,
      using: sql`${table.expiresAt} <= now()`,
    }),
  ],
).enableRLS();

export const evaluationSummaries = pgTable(
  "rack_evaluation_summaries",
  {
    runId: uuid("run_id")
      .primaryKey()
      .references(() => managedRuns.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    schemaVersion: text("schema_version").notNull(),
    rackFingerprint: text("rack_fingerprint").notNull(),
    profileId: text("profile_id").notNull(),
    target: text("target").notNull(),
    passed: boolean("passed").notNull(),
    score: integer("score").notNull(),
    estimatedInstructionTokens: integer("estimated_instruction_tokens").notNull(),
    errors: integer("errors").notNull(),
    warnings: integer("warnings").notNull(),
    information: integer("information").notNull(),
    findings: jsonb("findings").$type<QuickCheckFinding[]>().notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("rack_summary_score_range", sql`${table.score} between 0 and 100`),
    pgPolicy("rack_summary_workspace_owner", {
      for: "all",
      to: authenticatedRole,
      using: ownsWorkspace(table.workspaceId),
      withCheck: ownsWorkspace(table.workspaceId),
    }),
    pgPolicy("rack_summary_reliable_workflow", {
      for: "all",
      to: workflowRole,
      using: sql`${table.runId} = ${currentWorkflowRunId}`,
      withCheck: sql`${table.runId} = ${currentWorkflowRunId} and exists (
        select 1 from rack_managed_runs run
        where run.id = ${table.runId}
          and run.workspace_id = ${table.workspaceId}
          and run.kind = 'reliable-check'
      )`,
    }),
  ],
).enableRLS();
