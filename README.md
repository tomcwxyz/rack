# rack

**Build your AI working practices once, then use and test them across different AI tools.**

Rack is a local-first desktop application for authoring, assembling, compiling and checking portable AI working practices. It is being developed by The Good Ship as an open-source application with an optional managed service.

## Status

Rack is at the implementation-foundation stage. The accepted v0.1 specification, Architecture Decision Records and implementation backlog live in [`docs/`](docs/).

## Initial product shape

Rack will provide three guided starting routes:

- Writing and communications
- Research and knowledge work
- Coding and technical work

The canonical Rack project is stored locally as inspectable Markdown and YAML. Initial supported destinations are generic prompts, `AGENTS.md`, Claude Code, OpenCode and Codex. Hermes Agent and OpenClaw begin as Preview destinations.

## Development

The repository is a pnpm/Turborepo monorepo. The desktop application uses Tauri, React and TypeScript. Shared packages own the schemas, project model, compiler, renderers, adapters, checks and CLI.

The initial scaffold is being added now. See [`CONTRIBUTING.md`](CONTRIBUTING.md) once it lands.

## Licence

Code is licensed under Apache-2.0. Starter modules and example knowledge content are licensed under CC BY 4.0 unless a file declares otherwise.

The Rack name and marks are retained by The Good Ship.
