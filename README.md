# rack

**Build your AI working practices once, then use and test them across different AI tools.**

Rack is a local-first desktop application for authoring, assembling, compiling and checking portable AI working practices. It is being developed by The Good Ship as an open-source application with an optional managed service.

## Status

Rack is in active pre-release development. The repository contains a working local vertical slice rather than only a scaffold.

A user can:

- create a Writing and communications Rack through a guided desktop flow;
- keep canonical instructions and Set-ups as inspectable Markdown and YAML;
- maintain context, voice, boundary and repeatable-task instructions through guided forms;
- review the exact source diff before a guided change is saved;
- fall back to advanced source editing, with external-change protection;
- compile a Set-up deterministically;
- preview, copy and export generated instructions;
- install managed local builds with provenance manifests, retained backups and drift detection;
- build for a generic prompt, portable `AGENTS.md`, Claude Code, OpenCode and Codex;
- perform the same build and check operations through the CLI.

The accepted v0.1 specification, Architecture Decision Records and implementation notes live in [`docs/`](docs/).

### Current development focus

Iteration 6 is adding structured maintenance to the desktop application. Context, voice, boundary and task editing are implemented on the active development branch. Set-up maintenance, stronger round-trip fixtures and final keyboard/focus work remain before that iteration is complete.

## Product shape

Rack has three planned guided starting routes:

- Writing and communications — implemented first;
- Research and knowledge work;
- Coding and technical work.

The canonical Rack project is stored locally. Generated destination packages are replaceable output under `.rack/generated/` and are never treated as canonical source.

Supported destinations are:

- generic prompt;
- portable `AGENTS.md`;
- Claude Code;
- OpenCode;
- Codex.

Hermes Agent and OpenClaw remain planned Preview destinations.

## Repository

This is a pnpm/Turborepo monorepo.

- `apps/desktop` — Tauri and React desktop application;
- `packages/schemas` — source and generated-manifest schemas;
- `packages/core` — project parsing, source patching, compilation, adapters and build state;
- `packages/cli` — `rack validate`, `rack build` and `rack check`;
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

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for repository conventions and pull-request checks.

## Licence

Code is licensed under Apache-2.0. Starter modules and example knowledge content are licensed under CC BY 4.0 unless a file declares otherwise.

The Rack name and marks are retained by The Good Ship.
