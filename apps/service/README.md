# Rack managed service

This is the optional v0.1 managed-service boundary. Rack projects remain canonical local Markdown/YAML; this application receives only explicit managed-check requests.

## Runtime shape

The Vercel project root is `apps/service`. Plain TypeScript files under `api/` are deployed as Vercel Functions. The service uses Web `Request`/`Response` handlers rather than a web framework.

`POST /api/check` verifies a Neon Auth JWT against the branch JWKS, runs a synchronous quick check, writes raw request content only to the transient payload table, and persists a separate content-free evaluation summary.

`POST /api/check/reliable` verifies the same identity, creates one queued Rack run and transient payload, then starts `reliableCheckWorkflow` through Workflow SDK. The HTTP request returns `202` with the Rack run ID and Vercel workflow run ID; it does not wait for evaluation.

`GET /api/check/reliable/:runId` is rewritten to the status function. RLS makes an unknown run and another user's run indistinguishable to the caller. Completed responses contain the same strict content-free summary schema as quick checks.

`GET /api/retention` is invoked hourly by Vercel Cron. Vercel supplies `CRON_SECRET` as a bearer token. The endpoint connects with a dedicated database login that is granted membership in `rack_retention`; the database policy only permits deletion of payload rows whose `expires_at` has passed.

The hourly cron schedule requires a Vercel plan that supports sub-daily cron execution. If deployment is moved to a platform/plan without that guarantee, retention scheduling must be replaced before managed content is accepted.

## Reliable workflow privacy boundary

Workflow SDK persists workflow inputs and step outputs so it can replay runs durably. Rack therefore never passes instructions, sample output or the authenticated user ID to Workflow SDK.

The workflow input is only the random Rack run UUID. A step opens `RACK_WORKFLOW_DATABASE_URL`, sets that UUID transaction-locally as `rack.workflow_run_id`, and Postgres RLS limits the `rack_workflow` role to:

- selecting/updating that one `reliable-check` run;
- reading that run's payload only while `expires_at > now()`;
- inserting/selecting that run's evaluation summary.

The workflow step returns only `DurableEvaluationSummary`, which cannot contain prompt, instruction or generated-output fields. A retry first checks for an existing completed summary, and summary insertion uses the run ID primary key with `ON CONFLICT DO NOTHING`.

The current `^4.6.2` Workflow SDK range resolves to 4.8.1 in Rack's lockfile. Workflow SDK 4.x uses Vercel's managed workflow backend in `iad1`. That is acceptable for this slice because Rack places only the random run UUID and content-free summary in the workflow event log; managed source/output content stays in the configured Neon database and its 24-hour transient boundary. Reassess Workflow SDK 5.x regional execution before the pilot if stricter workflow-metadata residency is required.

## Database roles

Use four separate connections/roles:

1. `RACK_MIGRATION_DATABASE_URL`: owner/migration only, used outside the deployed service to apply migrations.
2. `RACK_DATABASE_URL`: non-owner authenticated runtime role. It must not have `BYPASSRLS`; verified JWT claims are set transaction-locally before user-facing queries.
3. `RACK_WORKFLOW_DATABASE_URL`: narrow login role with membership in `rack_workflow` only. Workflow steps set a single Rack run UUID transaction-locally; it has no workspace, membership or payload-write grant.
4. `RACK_RETENTION_DATABASE_URL`: narrow login role with membership in `rack_retention` only.

Never deploy the migration/owner connection string as an application runtime variable.

## Auth

Neon Auth is the identity provider. Configure email magic-link and Google/Microsoft providers in Neon, then expose the branch JWKS URL as `NEON_AUTH_JWKS_URL`. `NEON_AUTH_ISSUER` and `NEON_AUTH_AUDIENCE` can be set when those claims are fixed for the environment.

The desktop/native sign-in UX is deliberately outside this service package. `@rack/managed/client` accepts an access-token callback so local-only Rack use does not depend on auth or network availability.

## Local workflow development

Workflow SDK's Local World is bundled and requires no separate queue/database. Run the service with Vercel's local development command, then inspect workflow runs from another terminal:

```bash
pnpm --filter @rack/service workflow:web
```

The local Workflow SDK store is development-only. Production Vercel deployments automatically use Vercel's managed Workflow backend and queue integration.

## Privacy boundary

- request instructions and optional sample output are stored only in `rack_managed_payloads`;
- payload expiry is capped at 24 hours in both application logic and a Postgres check constraint;
- workflow retries never update `created_at` or `expires_at`;
- durable summaries contain counts, finding codes/titles, score and fingerprints but no prompt/instruction/output text;
- the service does not upload or store a Rack project;
- analytics are not part of this request path.
