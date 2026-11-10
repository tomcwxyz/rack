# RACK web pilot

A browser-first pilot for creating, using and reviewing portable RACK practices. It shares the **actual compiler and project proposal builders** with the desktop app. Browser use does not require a desktop install, sign-in, TOPO or managed service.

## Development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @rack/web dev
pnpm turbo run check --filter=@rack/web...
pnpm turbo run build --filter=@rack/web...
```

## Pilot behaviour

1. Choose Writing, Research or Coding. Adjust the suggested approach and inspect the compiled instructions.
2. Copy the instructions, or export the canonical Rack project files as a portable TAR archive. Unpack into a folder to open in desktop RACK.
3. Optionally save an approach **in this browser only**, and return to it later. The pilot does not claim cloud synchronisation.
4. Optionally sign in with the configured Neon Auth endpoint and run a single managed AI trial. Each trial requires a cost preflight and explicit approval before any paid model call.
5. Review the practice with Keep / Change / Remove; feedback remains in this browser and never silently rewrites practice.

## Vercel

Create a Vercel project connected to `tomcwxyz/rack`, root directory `apps/web`, framework **Vite**, build command `pnpm turbo run build --filter=@rack/web...`, output `dist`, install command `pnpm install --frozen-lockfile`. Enable **Include source files outside the Root Directory** because the pilot shares the desktop's pure TypeScript creation helpers.

Only set `VITE_RACK_MANAGED_ENABLED=true`, `VITE_NEON_AUTH_URL` and `VITE_RACK_QUICK_MODEL_ALIAS` after confirming the managed service and server-only `RACK_SERVICE_URL`. The web app uses a same-origin authenticated proxy. Never expose provider keys or database URLs as `VITE_` variables. Restrict pilot access at the Vercel deployment level until privacy and model cost limits are verified.

The web app does not run local repository commands, inspect devices, install AI host files or retrieve TOPO context. Those remain desktop capabilities. Managed AI trial results are transient by the service's policy; browser-local practice/review data is kept separately on the tester's own device.


## Managed service rollout (not enabled yet)

The web app deliberately defaults to `VITE_RACK_MANAGED_ENABLED=false`.
The infrastructure is provisioned, but creating a database and enabling Neon Auth does **not** automatically install RACK's existing managed-service schema, secure its database roles, configure provider accounts or allocate budgets.

The managed API is a separate Vercel project, not an `/api` route bundled into the static web app. It must be deployed with the existing `apps/service` schema, RLS migrations and its nonpublic environment variables. Follow `apps/service/README.md` for the full setup.

Deployment gate:
1. Apply and inspect versioned managed-service migrations on an isolated database; verify row-level security under an authenticated *non-owner* role, not only the database owner.
2. Configure `RACK_DATABASE_URL`, `RACK_WORKFLOW_DATABASE_URL`, `RACK_RETENTION_DATABASE_URL`, `NEON_AUTH_JWKS_URL`, `CRON_SECRET` and provider settings as server-side secrets on the service. Confirm the model runner/registry has an allowed model and hard caps.
3. Deploy the service to Vercel, check its authenticated `/api/check` and evaluation endpoints and confirm that anonymous and cross-workspace requests fail closed.
4. Set the *web* Vercel project's server-only `RACK_SERVICE_URL` to the tested service HTTPS URL; enable `VITE_NEON_AUTH_URL` and `VITE_RACK_MANAGED_ENABLED=true` only when the same-origin preflight/confirm checks work end to end.
5. Test the explicit estimated and maximum costs, rate limits, user budget exhaustion, idempotent retries and transient-retention behaviour. Do not enable public AI trials before this passes.

The browser trial currently reuses RACK's existing **single-generation Quick evaluation** contract; it is not a conversational chat experience, and a returned output is not an independent evidence-based verification.

## Shared creator

All three first-use routes are compiled by `@rack/creation` from `packages/creation`. The old desktop import paths remain as compatibility re-exports; browser code imports directly from the new shared package. Change practice generation in one place and run both desktop and browser test suites.
