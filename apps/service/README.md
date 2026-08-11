# Rack managed service

This is the optional v0.1 managed-service boundary. Rack projects remain canonical local Markdown/YAML; this application receives only explicit managed requests.

## Runtime shape

The Vercel project root is `apps/service`. Plain TypeScript files under `api/` are deployed as Vercel Functions. The service uses Web `Request`/`Response` handlers rather than a web framework.

`POST /api/check` verifies a Neon Auth JWT, runs a synchronous deterministic quick check, stores raw request material only in the transient payload table, and persists a separate content-free summary.

`POST /api/check/reliable` creates a queued transient check and starts `reliableCheckWorkflow`. `GET /api/check/reliable/:runId` reads its owner-scoped status. Workflow inputs contain only the random Rack run UUID; raw content remains in the expiring Neon payload.

`POST /api/evaluate/preflight` is the metadata-only paid-evaluation planning boundary. It accepts IDs, counts and token estimates, resolves deployment-owned model aliases/pricing, reads workspace cost/concurrency limits under RLS and returns call/token/cost metadata plus the exact resolved provider/model identities. It cannot start or reserve a model run.

`POST /api/evaluate/confirm` is a separate explicit paid-work boundary. The first execution slice supports one Quick case and no rubric judge. It recomputes preflight against current model/pricing/limit configuration, requires the accepted resolved generator identity and maximum retry exposure to match, checks the supplied content against the accepted input allowance, then atomically reserves budget and claims a provider-call ledger row before any provider request can start.

`GET /api/retention` is invoked hourly by Vercel Cron and deletes only expired transient payload rows through a narrow retention database role.

## Model registry, provider runner and evaluation limits

`RACK_MODEL_REGISTRY_JSON` defines stable aliases independently from provider/model mappings. Production parsing requires two distinct managed provider IDs. Registry entries may also represent BYOK and OpenAI-compatible/local endpoints; Rack does not require AI Gateway.

Prices are supplied as integer micro-USD per million tokens. Provider prices are not compiled into the application.

`RACK_MODEL_RUNNER_JSON` maps deployment-owned provider IDs to direct Vercel AI SDK provider adapters. Provider secrets are referenced by environment-variable name and are not embedded in the JSON. The shared `@rack/model-runner` interface also supports OpenAI-compatible endpoints and per-request API keys so BYOK/local execution can remain a separate direct path rather than making the managed service mandatory.

The managed confirmation endpoint currently executes only registry entries whose connection is `managed`. It does not accept or persist user API keys.

`RACK_EVALUATION_LIMITS_JSON` seeds each workspace's owner-scoped hard budget, per-run cap, concurrency limit and maximum provider attempts on first preflight use. Existing workspace values are not silently overwritten by later deployment-default changes.

Preflight compares maximum retry exposure — not just one-attempt estimated cost — with the hard limits. Confirmation repeats those checks transactionally while the workspace limit row is locked. The accepted maximum retry exposure is reserved before the run and released into spent cost during settlement.

## Paid-call safety and idempotency

Confirmed execution deliberately favours avoiding duplicate paid work over automatic recovery:

- a `(run_id, call_key)` provider-call row is inserted with `claimed` status in the same reservation transaction that creates the model-evaluation run;
- the provider network call happens only after that transaction succeeds;
- the Vercel AI SDK runner sets `maxRetries: 0`, so Rack owns retry/cost policy;
- replaying the same workspace/idempotency key returns a settled result when one exists;
- if the call is still `claimed`, Rack refuses to call the provider again automatically because the previous process may have reached the provider before failing;
- successful calls settle from provider usage when available, otherwise from the planned one-attempt allowance;
- provider failure settles conservatively and produces an `incomplete` evaluation, never a behavioural failure or pass.

A successful Iteration 12 generation also has `behaviouralVerdict: null`. Rubric judging is the next evaluation slice.

## Reliable workflow privacy boundary

Workflow SDK persists workflow inputs and step outputs so it can replay runs durably. Rack therefore never passes instructions, sample output or the authenticated user ID to Workflow SDK.

The workflow input is only the random Rack run UUID. A step opens `RACK_WORKFLOW_DATABASE_URL`, sets that UUID transaction-locally as `rack.workflow_run_id`, and Postgres RLS limits the `rack_workflow` role to the single reliable-check run, its still-unexpired payload, and its content-free summary.

Stable Workflow metadata remains a separate residency boundary; only run identifiers/content-free summaries enter it.

## Database roles

Use separate connections/roles:

1. `RACK_MIGRATION_DATABASE_URL`: owner/migration only; never deployed as an application runtime variable.
2. `RACK_DATABASE_URL`: non-owner authenticated runtime role participating in Neon RLS. Confirmed paid execution uses SECURITY INVOKER database functions through this same role.
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

- managed instruction, case and generated-output content lives only in `rack_managed_payloads` and is capped at 24 hours;
- evaluation preflight accepts no raw managed content;
- durable model-evaluation and provider-call rows contain identifiers, model resolution, response/usage/cost metadata and status, not prompt/output text;
- workflow retries never extend transient-content expiry;
- durable quick/reliable summaries contain no prompt/instruction/output text;
- the service does not upload or store a Rack project;
- analytics are separate from managed content and are not part of these request paths.
