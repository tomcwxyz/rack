import { sql } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/neon";
import {
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
      using: sql`${table.userId} = (select auth.user_id())`,
      withCheck: sql`${table.userId} = (select auth.user_id())`,
    }),
  ],
).enableRLS();

const ownsWorkspace = (workspaceId: AnyPgColumn) => sql`exists (
  select 1 from rack_workspaces workspace
  where workspace.id = ${workspaceId}
    and workspace.owner_user_id = (select auth.user_id())
)`;

export const managedRuns = pgTable(
  "rack_managed_runs",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
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
      withCheck: sql`${ownsWorkspace(table.workspaceId)} and ${table.userId} = (select auth.user_id())`,
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
  ],
).enableRLS();
