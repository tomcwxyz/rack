# Initial implementation backlog

> **Historical backlog.** These milestones describe the original implementation sequence and are substantially complete. The active roadmap is now [`docs/roadmap.md`](../roadmap.md).

## Delivery milestones

The original M0–M4 sequence is retained here as implementation history rather than the current priority order.

- **M0 — Engineering foundation:** repository, decisions, schemas and fixtures support parallel implementation.
- **M1 — Guided vertical slice:** a non-technical user can create, edit and export a small Writing Rack locally.
- **M2 — Multi-destination alpha:** the same Set-up builds to Supported destinations with previews, diffs and drift detection.
- **M3 — Managed-service alpha:** invited users can use managed drafting and checks safely through Neon-backed services.
- **M4 — Pilot release:** signed builds are ready for the six-week structured pilot.

## First four implementation iterations

### Iteration 1 — Format to screen

- monorepo and CI;
- canonical schemas;
- project scaffold and fixtures;
- Tauri desktop shell;
- CLI foundation;
- open a Rack and display its instructions.

### Iteration 2 — Writing vertical slice

- dependency and profile resolution;
- guided Writing route;
- module cards and simple editors;
- prompt renderer;
- preview and copy.

### Iteration 3 — Safe maintenance

- conflicts, digests and budgets;
- file watching, recovery and authorised folders;
- advanced editor and task designer;
- install plans, backups and drift detection.

### Iteration 4 — Supported destinations

- shared instruction, Agent Skill and command renderers;
- `AGENTS.md`, Claude Code, OpenCode and Codex adapters;
- golden fixtures and destination previews.

## Backlog rules

- Project-format changes require schema-version review.
- Destination-output changes require adapter-version review and a golden diff.
- Retention, telemetry or remote-content changes require privacy review.
- Imported executable content remains outside v0.1.
- Preview destinations do not block pilot release unless they threaten files, privacy or Supported destinations.
