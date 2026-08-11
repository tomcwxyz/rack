# rack

**Build your AI working practices once, then use and test them across different AI tools.**

Rack is a local-first desktop application for authoring, assembling, compiling and checking portable AI working practices. It is being developed by The Good Ship as an open-source application with an optional managed service.

## Status

Rack is in active pre-release development. The repository contains a working local application rather than only a scaffold.

A user can:

- choose a guided starting route for Writing and communications, Research and knowledge work, or Coding and technical work;
- review every proposed instruction before Rack writes local files;
- browse a bundled Starter library of reusable instructions and six starting templates;
- inspect exact Starter source, licence and attribution before copying anything into a Rack;
- keep canonical instructions and Set-ups as inspectable Markdown and YAML;
- maintain context, voice, boundary and repeatable-task instructions through guided forms;
- maintain Set-up domains, instruction selection and destination token budgets through a guided form;
- review the exact source diff before a guided change is saved;
- fall back to advanced source editing, with external-change protection;
- compile a Set-up deterministically;
- preview, copy and export generated instructions;
- install managed local builds with provenance manifests, retained backups and drift detection;
- build for a generic prompt, portable `AGENTS.md`, Claude Code, OpenCode and Codex;
- perform the same build, check and Starter-library operations through the CLI.

The accepted v0.1 specification, Architecture Decision Records and implementation notes live in [`docs/`](docs/).

### Current development focus

Iterations 1–8 established the local source format, compiler, managed builds, portable destinations, all three creation routes, loss-aware maintenance and the bundled Starter library. Iteration 9 established the optional managed-service boundary and privacy-safe synchronous checks. Iteration 10 added durable Reliable checks through Vercel Workflows. Iteration 11 added the provider-neutral model registry and metadata-only paid-evaluation preflight. Iteration 12 adds the first explicit confirmed paid Quick execution boundary: exact resolved-model/cost confirmation, atomic workspace budget reservation, a pre-call provider ledger, provider-neutral Vercel AI SDK execution and conservative settlement. Successful generation is not yet a behavioural verdict; rubric-backed Quick evaluation is the next slice. Local Rack use remains account-free and does not depend on the service.

## Product shape

Rack has three guided starting routes:

- Writing and communications — the most polished pilot route;
- Research and knowledge work;
- Coding and technical work.

Every route works without an account or model connection. It creates a small starting assembly rather than a locked template: the resulting Markdown and YAML source remains editable through guided or advanced maintenance.

The bundled Starter library is another way into that same source model. Starter content is inspectable Markdown/YAML, copied into `modules/starter/` only after explicit review. Existing changed IDs are treated as conflicts; Rack never silently replaces local source.

The canonical Rack project is stored locally. Generated destination packages are replaceable output under `.rack/generated/` and are never treated as canonical source.

The optional managed service receives only explicit managed requests. It does not store Rack projects. Raw managed request/output content has a maximum 24-hour retention window; durable evaluation, provider-call and reliable-workflow records contain identifiers/status/accounting metadata rather than prompt/output text. Paid model evaluation starts with a metadata-only preflight and requires a separate explicit confirmation whose resolved model and maximum retry exposure still match current deployment configuration and workspace limits.

Supported destinations are:

- generic prompt;
- portable `AGENTS.md`;
- Claude Code;
- OpenCode;
- Codex.

Hermes Agent and OpenClaw remain planned Preview destinations.

## Repository

This is a pnpm/Turborepo monorepo.

- `apps/desktop` — Tauri and React desktop application, guided creation, maintenance and Starter library;
- `apps/service` — optional Vercel managed-service functions, evaluation preflight/confirmation, reliable Workflows and retention boundary;
- `packages/schemas` — source and generated-manifest schemas;
- `packages/core` — project parsing, source patching, compilation, adapters, build state and Starter import planning;
- `packages/starter` — separately licensed bundled Starter catalogue, source, templates and deterministic metadata;
- `packages/registry` — provider-neutral stable model aliases, deployment mappings, capabilities and pricing metadata;
- `packages/eval` — deterministic managed-evaluation planning and cost preflight;
- `packages/model-runner` — provider-neutral model execution over direct Vercel AI SDK provider/OpenAI-compatible adapters;
- `packages/managed` — managed-service contracts, quick/reliable checks, evaluation preflight/confirmation and desktop-consumable client;
- `packages/database` — Drizzle schema/migrations and Neon persistence with authenticated, workflow and retention RLS boundaries;
- `packages/cli` — `rack validate`, `rack build`, `rack check` and `rack library`;
- `test-fixtures` — accepted source and golden destination packages;
- `docs` — specification, ADRs and iteration notes.

## Development

The repository requires Node.js 22.12 or newer, pnpm 10.15 and a Rust/Tauri development environment for desktop work.

```bash
pnpm install
pnpm check
pnpm build
```

Run the desktop application in development:

```bash
pnpm dev:desktop
```

Build and inspect a fixture through the CLI:

```bash
pnpm --filter @rack/cli dev -- build test-fixtures/coding-basic \
  --profile coding \
  --target claude-code \
  --install

pnpm --filter @rack/cli dev -- check test-fixtures/coding-basic \
  --profile coding \
  --target claude-code
```

Browse and review the Starter library through the CLI:

```bash
pnpm --filter @rack/cli dev -- library list --route research
pnpm --filter @rack/cli dev -- library show @rack-starter/method.source-assessment
pnpm --filter @rack/cli dev -- library add --template evidence-review \
  --path test-fixtures/research-basic \
  --profile research
```

The managed service is optional. Its deployment/environment and privacy boundary are documented in [`apps/service/README.md`](apps/service/README.md) and the iteration notes under [`docs/`](docs/).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for repository conventions and pull-request checks.

## Continuous integration

Linux type checks, tests and builds run on pull requests and pushes. Windows desktop smoke checks run only when desktop dependency paths change. macOS smoke checks run after desktop-related changes reach `main` or through a deliberate manual full-suite run. Server-only managed-service changes do not trigger paid desktop runners. Work should be prepared locally and pushed as a coherent review batch rather than as a series of small CI-triggering commits.

## Licence

Code is licensed under Apache-2.0. Starter modules and example knowledge content are licensed under CC BY 4.0 unless a file declares otherwise. The `@rack/starter` package carries the Starter content licence and attribution boundary explicitly.

The Rack name and marks are retained by The Good Ship.
