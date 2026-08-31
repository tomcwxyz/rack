# rack

**Build your AI working practices once, then use and test them across different AI tools.**

Rack is a local-first desktop application for authoring, assembling, compiling and checking portable AI working practices. It is being developed by The Good Ship as an open-source application with an optional managed service.

## Status

Rack is in active pre-release development. The repository contains a working local application rather than only a scaffold.

A user can:

- choose a guided starting route for Writing and communications, Research and knowledge work, or Coding and technical work;
- import existing Word, PowerPoint, spreadsheet, OpenDocument, RTF, EPUB, CSV and text-based PDF material locally as editable Markdown during creation or context maintenance;
- review every proposed instruction before Rack writes local files;
- browse a bundled Starter library of reusable instructions and six starting templates;
- inspect exact Starter source, licence and attribution before copying anything into a Rack;
- keep canonical instructions and Set-ups as inspectable Markdown and YAML;
- maintain context, voice, boundary and repeatable-task instructions through guided forms;
- maintain Set-up domains, local/shared instruction selection and destination token budgets through a guided form;
- review the exact source diff before a guided change is saved;
- fall back to advanced source editing, with external-change protection;
- attach an inspectable shared-practice file and keep an accepted local snapshot;
- distinguish binding shared practice from adaptable defaults which can be changed or left out locally;
- review incoming shared-practice updates, including tightening changes, before they apply;
- mark practice for later review and describe adaptable instructions as experiments with explicit learning questions;
- publish selected local practice as a validated shared-practice file from either the desktop or CLI;
- compile a Set-up deterministically;
- preview, copy and export generated instructions;
- install managed local builds with provenance manifests, retained backups and drift detection;
- build for a generic prompt, portable `AGENTS.md`, Claude Code, OpenCode and Codex;
- run indicative Quick checks and repeated independently judged Reliable checks through the optional managed service;
- define and inspect target-neutral Verification Plans which distinguish automatic checks, bounded AI judgement and human review from ordinary prompt guidance;
- verify supplied work against configured semantic practice through a fresh bounded model call, with metadata-only cost preflight and explicit paid confirmation;
- perform build, check, Starter-library and shared-practice publishing operations through the CLI.

The accepted v0.1 specification, Architecture Decision Records and implementation notes live in [`docs/`](docs/).

### Current development focus

Iterations 1–8 established local source, compilation, portable destinations, guided creation/maintenance and the Starter library. Iterations 9–15 established the optional managed evaluation boundary: privacy-safe storage, model registry/preflight, explicit paid confirmation, rubric-backed Quick checks and Reliable repeated candidate/baseline evaluation with an independent judge and regression gate.

Iterations 16–29 extend Rack from individual working practice into inspectable organisational practice and a supported private-pilot distribution path without introducing a central control plane. Rack now has separate criticality and authority semantics, deterministic source resolution, shared-practice files, accepted-snapshot update review, binding and adaptable defaults, review dates, experiments, plain-language/accessibility guardrails, safe publishing through CLI and desktop, local opt-out/adaptation of shared defaults, and signed pilot release tooling.

Iteration 30 adds the first verification-planning layer. Active practice can distinguish AI guidance from automatic checks, bounded AI judgement and human review through an inspectable, target-neutral plan.

Iteration 31 adds the first executable semantic gate. A user can select one configured judgement question, supply only the evidence it requires, review cost metadata, explicitly confirm the paid call and receive pass, fail or uncertain from a fresh bounded model context. Malformed or failed execution remains incomplete rather than being treated as a pass.

The current focus is to exercise the organisational-practice model with real pilot practice while completing deterministic verification and host integration. Local use remains account-free; managed evaluation and managed semantic verification remain optional.

## Product shape

Rack has three guided starting routes:

- Writing and communications — the most polished pilot route;
- Research and knowledge work;
- Coding and technical work.

Every route works without an account or model connection. It creates a small starting assembly rather than a locked template: the resulting Markdown and YAML source remains editable through guided or advanced maintenance.

The bundled Starter library is another way into that same source model. Starter content is inspectable Markdown/YAML, copied into `modules/starter/` only after explicit review. Existing changed IDs are treated as conflicts; Rack never silently replaces local source.

The canonical Rack project is stored locally. Generated destination packages are replaceable output under `.rack/generated/` and are never treated as canonical source.

Shared practice is a separate composition layer rather than copied organisational source. A Rack can accept a plain `.rack.yaml` publication distributed through an existing shared location. Binding instructions apply to relevant Set-ups; adaptable instructions arrive as defaults and can be adapted or left out locally. Incoming file changes are reviewed before they replace the accepted snapshot. The publisher does not receive opt-out, adaptation or compliance telemetry.

Publishing follows the reverse boundary: Rack only publishes explicitly selected **local** instructions. It does not silently republish received practice or a complete Set-up.

The optional managed service receives only explicit managed requests. It does not store Rack projects. Raw managed request/output/judge content has a maximum 24-hour retention window; durable evaluation, provider-call and reliable-workflow records contain identifiers/status/accounting metadata and a nullable behavioural verdict rather than prompt/output text. Paid model evaluation starts with a metadata-only preflight and requires a separate explicit confirmation whose resolved model and maximum retry exposure still match current deployment configuration and workspace limits.

Quick model-backed evaluation is explicitly indicative: one repetition, no baseline or regression gate, and the selected model judges its own candidate output when a rubric is configured.

Reliable evaluation is the stronger behavioural check: repeated candidate and baseline runs, an independent judge model/context, pass-rate comparison and a regression gate. Both paths remain optional managed actions; local authoring, composition and builds do not depend on the service.

Supported destinations are:

- generic prompt;
- portable `AGENTS.md`;
- Claude Code;
- OpenCode;
- Codex.

Hermes Agent and OpenClaw remain planned Preview destinations.

## Repository

This is a pnpm/Turborepo monorepo.

- `apps/desktop` — Tauri and React desktop application, guided creation, maintenance, Starter library and optional managed Checks UI;
- `apps/service` — optional Vercel managed-service functions, evaluation preflight/confirmation, reliable Workflows and retention boundary;
- `packages/schemas` — source and generated-manifest schemas;
- `packages/core` — project parsing, source patching, compilation, practice-source resolution, shared-practice publication/update comparison, review signals, adapters, build state and Starter import planning;
- `packages/starter` — separately licensed bundled Starter catalogue, source, templates and deterministic metadata;
- `packages/registry` — provider-neutral stable model aliases, deployment mappings, capabilities and pricing metadata;
- `packages/eval` — deterministic managed-evaluation planning and cost preflight;
- `packages/model-runner` — provider-neutral model execution over direct Vercel AI SDK provider/OpenAI-compatible adapters;
- `packages/managed` — managed-service contracts, quick/reliable checks, evaluation preflight/confirmation and desktop-consumable client;
- `packages/database` — Drizzle schema/migrations and Neon persistence with authenticated, workflow and retention RLS boundaries;
- `packages/cli` — validation, builds, checks, Starter-library workflows and shared-practice inspect/export;
- `packages/copy-rules` — plain-language, British English and interface-copy regression rules;
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

Inspect or publish shared practice:

```bash
pnpm --filter @rack/cli dev -- practice inspect organisation.rack.yaml

pnpm --filter @rack/cli dev -- practice export . \
  --id example-org \
  --version 1.0.0 \
  --title "Example organisation practice" \
  --publisher "Practice team" \
  --module guardrail.evidence
```

The managed service is optional. Its deployment/environment and privacy boundary are documented in [`apps/service/README.md`](apps/service/README.md) and the iteration notes under [`docs/`](docs/).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for repository conventions and pull-request checks.

## Continuous integration

Linux type checks, tests and builds run on pull requests and pushes. Windows desktop smoke checks run only when desktop dependency paths change. macOS smoke checks run after desktop-related changes reach `main` or through a deliberate manual full-suite run. Server-only managed-service changes do not trigger paid desktop runners. Work should be prepared locally and pushed as a coherent review batch rather than as a series of small CI-triggering commits.

## Licence

Code is licensed under Apache-2.0. Starter modules and example knowledge content are licensed under CC BY 4.0 unless a file declares otherwise. The `@rack/starter` package carries the Starter content licence and attribution boundary explicitly.

The Rack name and marks are retained by The Good Ship.
