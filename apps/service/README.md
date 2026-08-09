# Rack managed service

This is the optional v0.1 managed-service boundary. Rack projects remain canonical local Markdown/YAML; this application receives only explicit managed requests.

## Runtime shape

The Vercel project root is `apps/service`. Plain TypeScript files under `api/` are deployed as Vercel Functions. The service uses Web `Request`/`Response` handlers rather than a web framework.

`POST /api/check` verifies a Neon Auth JWT, runs a synchronous deterministic quick check, stores raw request material only in the transient payload table, and persists a separate content-free summary.

`POST /api/check/reliable` creates a queued transient check and starts `reliableCheckWorkflow`. `GET /api/check/reliable/:runId` reads its owner-scoped status. Workflow inputs contain only the random Rack run UUID; raw content remains in the expiring Neon payload.

`POST /api/evaluate/preflight` is a separate paid-evaluation planning boundary. It accepts only IDs, counts and token estimates, resolves deployment-owned model aliases/pricing, reads workspace cost/concurrency limits under RLS and returns call/token/cost metadata. It cannot start, reserve or bill a model run.

`GET /api/retention` is invoked hourly by Vercel Cron and deletes only expired transient payload rows through a narrow retention database role.

## Model registry and evaluation limits

`RACK_MODEL_REGISTRY_JSON` defines stable aliases independently from provider/model mappings. Production parsing requires two distinct managed provider IDs. Registry entries may also represent BYOK and OpenAI-compatible/local endpoints; Rack does not require AI Gateway.

Prices are supplied as integer micro-USD per million tokens. Provider prices are not compiled into the application.

`RACK_EVALUATION_LIMITS_JSON` seeds each workspace's owner-scoped hard budget, per-run cap, concurrency limit and maximum provider attempts on first preflight use. Existing workspace values are not silently overwritten by later deployment-default changes.

Preflight compares the maximum retry exposure — not just one-attempt estimated cost — with the hard limits.

## Reliable workflow privacy boundary

Workflow SDK persists workflow inputs and step outputs so it can replay runs durably. Rack therefore never passes instructions, sample output or the authenticated user ID to Workflow SDK.

The workflow input is only the random Rack run UUID. A step opens `RACK_WORKFLOW_DATABASE_URL`, sets that UUID transaction-locally as `rack.workflow_run_id`, and Postgres RLS limits the `rack_workflow` role to the single reliable-check run, its still-unexpired payload, and its content-free summary.

The current `^4.6.2` Workflow SDK range resolves to 4.8.1 in Rack's lockfile. Stable 4.x Workflow metadata remains a separate residency boundary; only run identifiers/content-free summaries enter it.

## Database roles

Use separate connections/roles:

1. `RACK_MIGRATION_DATABASE_URL`: owner/migration only; never deployed as an application runtime variable.
2. `RACK_DATABASE_URL`: non-owner authenticated runtime role participating in Neon RLS.
3. `RACK_WORKFLOW_DATABASE_URL`: narrow login role with membership in `rack_workflow` only.
4. `RACK_RETENTION_DATABASE_URL`: narrow login role with membership in `rack_retention` only.

## Auth

Neon Auth is the identity provider. Configure email magic-link and Google/Microsoft providers in Neon, then expose the branch JWKS URL as `NEON_AUTH_JWKS_URL`. `NEON_AUTH_ISSUER` and `NEON_AUTH_AUDIENCE` can be set when fixed for the environment.

Desktop/native sign-in remains outside this service package. `@rack/managed/client` accepts an access-token callback so local-only Rack use does not depend on auth or network availability.

## Local workflow development

Workflow SDK's Local World is bundled. Inspect local workflow runs with:

```bash
pnpm --filter @rack/service workflow:web
```

## Privacy boundary

- managed instruction/sample-output content lives only in `rack_managed_payloads` and is capped at 24 hours;
- evaluation preflight accepts no raw managed content;
- workflow retries never extend transient-content expiry;
- durable quick/reliable summaries contain no prompt/instruction/output text;
- the service does not upload or store a Rack project;
- analytics are separate from managed content and are not part of these request paths.
