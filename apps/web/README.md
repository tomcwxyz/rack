# RACK web pilot

A browser-first pilot for creating, using and reviewing portable RACK practices. It shares the **actual compiler and project proposal builders** with the desktop app. Browser use does not require a desktop install, sign-in, TOPO or managed service.

## Development

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @rack/web dev
pnpm --filter @rack/web check
pnpm --filter @rack/web build
```

## Pilot behaviour

1. Choose Writing, Research or Coding. Adjust the suggested approach and inspect the compiled instructions.
2. Copy the instructions, or export the canonical Rack project files as a portable TAR archive. Unpack into a folder to open in desktop RACK.
3. Optionally save an approach **in this browser only**, and return to it later. The pilot does not claim cloud synchronisation.
4. Optionally sign in with the configured Neon Auth endpoint and run a single managed AI trial. Each trial requires a cost preflight and explicit approval before any paid model call.
5. Review the practice with Keep / Change / Remove; feedback remains in this browser and never silently rewrites practice.

## Vercel

Create a Vercel project connected to `tomcwxyz/rack`, root directory `apps/web`, framework **Vite**, build command `pnpm --filter @rack/web build`, output `dist`, install command `pnpm install --frozen-lockfile`. Enable **Include source files outside the Root Directory** because the pilot shares the desktop's pure TypeScript creation helpers.

Only set `VITE_RACK_SERVICE_URL`, `VITE_NEON_AUTH_URL` and `VITE_RACK_QUICK_MODEL_ALIAS` after confirming the managed service's deployment and a permitted browser origin/CORS. Never expose provider keys or database URLs as `VITE_` variables. Restrict pilot access at the Vercel deployment level until privacy and model cost limits are verified.

The web app does not run local repository commands, inspect devices, install AI host files or retrieve TOPO context. Those remain desktop capabilities. Managed AI trial results are transient by the service's policy; browser-local practice/review data is kept separately on the tester's own device.
