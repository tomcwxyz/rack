# ADR-020 — Supported host package shapes

**Status:** Accepted  
**Date:** 5 August 2026

## Context

Rack's portable prompt and generic `AGENTS.md` outputs prove the semantic compiler and destination-neutral build model. Claude Code, OpenCode and Codex each have project instruction conventions that can carry more of a Rack Set-up without requiring Rack to run the host or handle its credentials.

The formats are actively evolving. The adapter boundary must therefore be explicit and versioned, with deterministic golden outputs and no hidden permission or tool activation.

## Decision

Use the following v0.1 package shapes:

### Claude Code

- `CLAUDE.md` for standing project instructions;
- `.claude/skills/<task-command>/SKILL.md` for repeatable tasks with command names;
- task skills are user-invoked by default through `disable-model-invocation: true`;
- no `allowed-tools`, model, permission, hook or MCP configuration is generated.

### OpenCode

- `AGENTS.md` for standing project instructions;
- `.opencode/commands/<task-command>.md` for repeatable tasks;
- `$ARGUMENTS` is exposed as additional task material;
- no agent, model, permission or tool configuration is generated.

### Codex

- one root `AGENTS.md` containing standing instructions and repeatable tasks as documented procedures;
- command names remain reference labels rather than installed commands;
- the output notes that nested `AGENTS.md` files may provide narrower instructions.

Every package includes tool declarations as expectations only. Rack never installs, starts, authenticates or grants access to tools through these adapters.

## Capability declarations

Modules may explicitly require a destination capability such as `commands`, `skills` or `tools`. A missing capability blocks the build unless the Set-up contains an explicit waiver for that module and destination. Waivers remain visible warnings.

Rack does not infer a hard capability requirement merely because a task has a command name or a tools module declares a server.

## Consequences

- host adapters remain useful without becoming host configuration managers;
- Claude Code and OpenCode can load repeatable tasks on demand;
- Codex remains a deterministic single-file package;
- host format changes are isolated behind adapter versions;
- adding Preview adapters later does not weaken the security boundary.
