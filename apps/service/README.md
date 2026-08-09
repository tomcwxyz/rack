# Rack managed service

This is the optional v0.1 managed-service boundary. Rack projects remain canonical local Markdown/YAML; this application receives only an explicit managed-check request.

## Runtime shape

The Vercel project root is `apps/service`. Plain TypeScript files under `api/` are deployed as Vercel Functions. The service uses Web `Request`/`Response` handlers rather than a web framework.

`POST /api/check` verifies a Neon Auth JWT against the branch JWKS, runs a synchronous quick check, writes raw request content only to the transient payload table, and persists a separate content-free evaluation summary.

`GET /api/retention` is invoked hourly by Vercel Cron. Vercel supplies `CRON_SECRET` as a bearer token. The endpoint connects with a dedicated database login that is granted membership in `rack_retention`; the database policy only permits deletion of payload rows whose `expires_at` has passed.

The hourly cron schedule requires a Vercel plan that supports sub-daily cron execution. If deployment is moved to a platform/plan without that guarantee, retention scheduling must be replaced before managed content is accepted.

## Database roles

Use three separate connections:

1. `RACK_MIGRATION_DATABASE_URL`: owner/migration only, used outside the deployed service to apply Drizzle migrations.
2. `RACK_DATABASE_URL`: non-owner authenticated runtime role. It must not have `BYPASSRLS`; verified JWT claims are set transaction-locally before queries.
3. `RACK_RETENTION_DATABASE_URL`: narrow login role with membership in `rack_retention` only.

Never deploy the migration/owner connection string as an application runtime variable.

## Auth

Neon Auth is the identity provider. Configure email magic-link and Google/Microsoft providers in Neon, then expose the branch JWKS URL as `NEON_AUTH_JWKS_URL`. `NEON_AUTH_ISSUER` and `NEON_AUTH_AUDIENCE` can be set when those claims are fixed for the environment.

The desktop/native sign-in UX is deliberately outside this service package. `@rack/managed/client` accepts an access-token callback so local-only Rack use does not depend on auth or network availability.

## Privacy boundary

- request instructions and optional sample output are stored only in `rack_managed_payloads`;
- payload expiry is capped at 24 hours in both application logic and a Postgres check constraint;
- durable summaries contain counts, finding codes/titles, score and fingerprints but no prompt/instruction/output text;
- the service does not upload or store a Rack project;
- analytics are not part of this request path.
