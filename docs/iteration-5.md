# Iteration 5 — Supported host packages

Issue: #9

Iteration 5 extends Rack's destination adapter model to three supported coding hosts while preserving the local-only security boundary.

## Supported package shapes

### Claude Code

```text
CLAUDE.md
.claude/
  skills/
    <task-command>/
      SKILL.md
```

The main file contains standing instructions. Repeatable tasks with command names become project skills that are user-invoked by default. Rack does not add allowed tools, hooks, models, permissions or MCP configuration.

### OpenCode

```text
AGENTS.md
.opencode/
  commands/
    <task-command>.md
```

The main file contains standing instructions. Repeatable tasks become project commands and receive `$ARGUMENTS` as additional user material. Rack does not select an agent or model and does not grant permissions.

### Codex

```text
AGENTS.md
```

Codex receives standing instructions and repeatable tasks as documented procedures. Command names remain reference labels. The output states the directory scope and acknowledges that more deeply nested AGENTS.md files may provide narrower instructions.

## Shared safety behaviour

- tool declarations remain configuration expectations;
- no adapter starts, installs or authenticates a tool server;
- no adapter writes credentials, model choices or permission grants;
- modules can explicitly require adapter capabilities;
- missing required capabilities block unless a Set-up contains a visible waiver;
- all files are covered by deterministic manifests, token estimates, backups and drift checks;
- desktop writes validate safe relative paths before creating nested package folders.

The desktop preview now shows every file in a generated package rather than hiding command and skill files behind the first artifact.
