# Rack v0.1 code-handoff specification

**Status:** accepted implementation baseline  
**Steward:** The Good Ship  
**Working name:** Rack  
**Descriptor:** Build your AI working practices

This repository is being initialised against the accepted Rack v0.1 product and technical specification. The complete working specification is maintained as a handoff artefact and will be imported verbatim as part of the first implementation pull request.

## Fixed product decisions

- Rack is a local-first Tauri desktop application with a shared TypeScript core and CLI.
- It has three guided starting routes: Writing and communications, Research and knowledge work, and Coding and technical work.
- The canonical Rack project is stored locally as Markdown and YAML.
- Profiles, labelled Set-ups in the simple interface, separate intended use from destination.
- Supported destinations are generic prompt, `AGENTS.md`, Claude Code, OpenCode and Codex.
- Hermes Agent and OpenClaw begin as Preview destinations.
- Shared renderers cover flat instructions, Agent Skills, commands and bootstrap context.
- Neon Postgres and Neon Auth support the optional managed service; Rack project files remain local.
- Quick checks are synchronous. Reliable checks use durable Vercel Workflows.
- Managed request and output content is deleted within 24 hours by default.
- The application, compiler, schemas, CLI and first-party adapters are Apache-2.0.
- Starter knowledge content is CC BY 4.0 unless otherwise declared.
- The interface follows the warm, editorial Good Ship product family rather than a developer-tool or chat-first aesthetic.
- Anonymous product analytics are optional and off by default.
- Windows and macOS are supported; Linux is experimental.

## Repository shape

```text
apps/
  desktop/
  service/
packages/
  schemas/
  core/
  compiler/
  renderers/
  adapters/
  eval/
  registry/
  database/
  auth/
  ui/
  cli/
starter-library/
docs/
```

## Implementation order

1. Canonical schemas, fixtures and shared core
2. Tauri desktop shell and guided Writing vertical slice
3. Profiles, prompt export, `AGENTS.md`, diff, backup and drift detection
4. Supported coding destinations
5. Starter library and pinned imports
6. Managed drafting and evaluation
7. Security, accessibility, signed distribution and structured pilot

Semantic changes to project formats, import trust, evaluation claims, privacy defaults or destination output require an Architecture Decision Record and appropriate version change.
