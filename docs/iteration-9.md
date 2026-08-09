# Iteration 9 — Managed service foundation and privacy-safe checks

## Outcome

Rack gains its first optional managed-service boundary without changing the local-first source model. A managed quick check accepts an explicit compiled-instruction payload, verifies a Neon Auth identity, stores raw request material only in a separately expiring payload row, and persists a durable evaluation summary that cannot contain prompt, instruction or generated-output text.

The service is deliberately small: plain TypeScript Vercel Functions, shared contracts, a Neon/Drizzle database package and a desktop-consumable client. Local Rack creation, editing, Starter imports and destination builds do not depend on any of it.

## Package boundaries

`@rack/managed` owns the public service contract, deterministic quick-check logic, privacy-safe durable summary schema, retention calculation and a small HTTP client. The package can be consumed by desktop code without importing server/database dependencies.

`@rack/database` owns the Drizzle schema, migrations and Neon persistence boundary. Application traffic uses a non-owner authenticated role. A second narrow role, `rack_retention`, can only delete transient payloads after their expiry time.

`apps/service` is the Vercel deployment root. It contains three functions:

- `GET /api/health` — unauthenticated liveness only;
- `POST /api/check` — authenticated synchronous quick check;
- `GET /api/retention` — Vercel Cron-only deletion of expired payloads.

No framework is required for this service slice; Vercel's Node runtime compiles TypeScript functions under `/api` and exposes Web `Request`/`Response` handlers.

## Managed request contract

A quick check receives:

- a SHA-256 Rack/source fingerprint;
- Set-up ID and destination;
- compiled instructions;
- optional sample output;
- optional recommended/maximum token budget.

It does not receive a Rack project archive or canonical Markdown/YAML tree.

The first quick check is deterministic and synchronous. It checks token-budget pressure, unfinished placeholder content and common credential/private-key patterns. This establishes the managed evaluation plumbing without pretending a heuristic check is an AI quality judgement. Reliable/model-backed checks remain a later Vercel Workflows slice.

## Durable versus transient data

Raw request and response bodies live only in `rack_managed_payloads`. Application logic caps their expiry at 24 hours and Postgres repeats that limit as a check constraint, so a buggy caller cannot request longer retention.

`rack_evaluation_summaries` stores only structured, content-free fields:

- Rack fingerprint, Set-up and destination;
- pass/fail and score;
- token estimate and severity counts;
- finding code, severity and generic title;
- check timestamp.

The Zod summary schema is strict. Tests demonstrate that adding an `instructions` field is rejected and that the original instruction text does not appear in the serialised summary.

## Retention

Vercel Cron calls `/api/retention` hourly and supplies `CRON_SECRET` as a bearer token. The function connects with `RACK_RETENTION_DATABASE_URL`, which must be a dedicated login granted membership in `rack_retention` only. RLS allows that role to delete a payload only when `expires_at <= now()`.

The hourly schedule is part of the 24-hour privacy promise and therefore requires a Vercel plan/runtime that supports sub-daily cron. If that deployment assumption changes, another sub-24-hour scheduler must replace it before managed content is accepted.

## Authentication and RLS

The service verifies bearer JWTs against the Neon Auth branch JWKS using `jose`. It can also enforce issuer/audience when those are fixed for an environment. Verified claims are serialised into a transaction-local `request.jwt.claims` value before queries; RLS policies use `auth.user_id()`.

The application connection must use a role without `BYPASSRLS`; in particular it must not use `neondb_owner` at runtime. Owner credentials are reserved for migrations and are not service environment variables.

The v0.1 data model creates one personal workspace per authenticated user and an owner membership row. Memberships exist in the schema so team support does not require replacing the ownership model later, but v0.1 policies and UI remain personal-only.

## Auth UX boundary

This iteration does not force a sign-in surface into the local app. `@rack/managed/client` takes a `getAccessToken()` callback. A later desktop/auth slice can implement Neon Auth email magic-link and Google/Microsoft sign-in around that callback while local-only Rack remains account-free.

## Deliberately deferred

- model-provider calls and managed drafting;
- Vercel Workflows for reliable checks;
- team workspaces and invitations;
- managed project/file storage;
- billing and pilot entitlements;
- remote analytics tied to managed content.
