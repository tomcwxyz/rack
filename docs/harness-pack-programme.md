# Harness Pack Programme

**Status:** active research and implementation programme  
**Updated:** 21 September 2026

RACK should learn from genuine AI harnesses without becoming another harness runtime.

The useful distinction is:

- **working practice** — portable methods, boundaries, roles, hand-off patterns and verification expectations which RACK can represent as inspectable practice;
- **capability requirement** — a declarative need such as a pre-completion check, restricted tool access, a subagent role or transient context hand-off;
- **runtime mechanism** — hooks, installers, shell commands, MCP processes, telemetry, agent lifecycle state and host-specific executable code.

Starter Packs may contain the first two. They must not smuggle in the third. Runtime mechanisms remain RACK-owned, reviewed adapter/executor behaviour.

Honey for Devs is the first reference implementation of this boundary.

## What makes a useful harness source

Prioritise projects which demonstrate at least one of:

1. the same practice translated across multiple AI hosts;
2. explicit capability differences rather than pretending every host behaves the same;
3. mechanical completion or verification gates;
4. skills, subagents or roles with a clear purpose and bounded permissions;
5. repository-aware practice rather than generic prompt collections;
6. inspectable provenance and a licence that permits adaptation.

Do not treat popularity or pack size as evidence that a practice belongs in RACK.

## Initial source audit

This is a research shortlist, not an import queue. Every source needs a specific revision and licence review before any RACK adaptation is bundled.

### Honey for Devs · reference implementation

Source: https://github.com/Green-PT/honey-for-devs

Already adapted as an attributed RACK Starter Pack.

Useful practice:

- minimum necessary code;
- cause-level fixes;
- context economy;
- deliberate shortcuts with explicit ceilings;
- concise engineering communication;
- efficient agent hand-off;
- protection against false economy;
- a separate lean-review task.

Boundary already proved: Honey runtime hooks, installers, persistent state and helper tooling are not bundled.

### wshobson/agents · high priority research

Source: https://github.com/wshobson/agents

Why it matters: it maintains one large source of skills, agents and commands while explicitly translating them across Claude Code, Codex, Cursor, OpenCode, Antigravity and Pi. Its capability matrix makes host degradation visible.

RACK should study:

- capability vocabulary for skills, subagents, commands and host differences;
- how one semantic role survives different native agent formats;
- when a command becomes a skill or prompt template on another host;
- conformance tests which prove translation rather than assuming it.

Do not import the marketplace wholesale. The interesting RACK material is the portability model and a small number of clearly reusable practices.

### madebywild/agent-harness · high priority research

Source: https://github.com/madebywild/agent-harness

Why it matters: it separates canonical harness source from generated provider outputs and maps prompt sections, skills, MCP, subagents and hooks across Codex, Claude, Copilot and Cursor.

RACK should study:

- canonical-source versus generated-output boundaries;
- capability-aware routing;
- project or monorepo target scoping;
- declarative MCP/subagent/hook needs which can be mapped by a RACK-owned adapter.

This is especially relevant to the next capability-aware application work.

### jhlee0409/omni-harness-kit · high priority research

Source: https://github.com/jhlee0409/omni-harness-kit

Why it matters: it introspects a repository and creates a harness shaped by the actual stack, including a compact AGENTS spine, stack-specific agent material and verification hooks based on real test/lint commands.

RACK should study:

- deriving suggested practice from observed repository facts;
- keeping repo detection deterministic and separate from model judgement;
- turning existing project checks into a reviewed verification plan;
- generating only the practice/capabilities which are relevant to the repository.

Do not bundle its detection scripts or hooks as Starter content. If RACK needs equivalent behaviour, it should be implemented as RACK-owned inspection and verifier machinery.

### Intense-Visions/harness-engineering · targeted research

Source: https://github.com/Intense-Visions/harness-engineering

Why it matters: it treats a harness as mechanical constraints as well as guidance, with verification gates, protected configuration, skills, personas, hooks and MCP integration across several clients.

RACK should study:

- the difference between an instruction and an enforceable completion boundary;
- capability declarations for pre/post tool or completion hooks;
- quality gates which can degrade safely on hosts without equivalent hooks;
- how to explain those differences to a person before installation.

RACK should not inherit adoption tracking, telemetry or executable hook behaviour from an external pack.

### epicsagas/epic-harness · research only

Source: https://github.com/epicsagas/epic-harness

Why it matters: it combines hooks, skills, agents, memory and an autonomous spec-to-PR workflow across multiple tools.

Useful as a stress test for the RACK boundary:

- which parts are durable working practice;
- which parts belong to an execution runtime;
- which learning should become a reviewed proposal rather than self-modifying canonical practice.

Its self-evolving/runtime state should remain outside Starter content.

### ernestngenest/nez-harness · portability reference

Source: https://github.com/ernestngenest/nez-harness

Why it matters: it keeps parallel Claude Code, Codex and OpenCode profiles and mirrors a large skill set across compatible skill formats.

RACK should study the practical friction of keeping personal practice portable across hosts. It is more useful as a portability reference than as a source to import wholesale.

## Candidate RACK-native packs

The programme should produce a small number of coherent packs, not one pack per upstream repository.

### Repository-aware coding

For an unfamiliar or established codebase.

Likely ingredients:

- inspect repository conventions before changing;
- derive context from manifests/config without executing them;
- reuse existing abstractions and dependencies;
- identify the repository's real test/typecheck/build commands;
- create a reviewed verification plan;
- preserve compatibility and security boundaries.

Primary research sources: RACK existing practice, omni-harness-kit, Honey.

### Verification-first delivery

For consequential technical changes.

Likely ingredients:

- define completion evidence before implementation;
- run deterministic checks through trusted RACK executors;
- use fresh semantic judgement only for questions deterministic tools cannot answer;
- fail closed on missing or malformed evidence;
- require human review for explicitly uncertain or irreversible changes.

Primary research sources: RACK/Ship Check work, harness-engineering, madebywild/agent-harness.

### Cross-agent hand-off

For work moving between models, tools or subagents.

Likely ingredients:

- stable identifiers rather than positional hand-offs;
- concise state, decisions, changed files, evidence and unresolved risks;
- explicit permission/tool boundaries for specialist agents;
- preserve provenance when a role is translated to another host;
- report capability degradation rather than silently dropping behaviour.

Primary research sources: existing RACK/Honey practice, wshobson/agents.

### Safe autonomous coding

For longer agentic implementation loops.

Likely ingredients:

- bounded scope and explicit stop conditions;
- inspect → plan → implement → verify;
- protected configuration and secret boundaries;
- no completion claim without configured evidence;
- escalation for destructive, migration, authentication or money-related changes;
- no automatic mutation of canonical RACK practice from runtime learning.

Primary research sources: Honey, harness-engineering, epic-harness, existing RACK verification.

## Capability vocabulary to add

Starter Packs should eventually be able to declare needs in neutral language without providing executable implementations.

Candidate capability families:

- `practice.standing-guidance`
- `practice.on-demand-skill`
- `agent.specialist-role`
- `agent.tool-boundary`
- `context.transient-task`
- `verification.pre-completion`
- `verification.repository-checks`
- `verification.semantic-judgement`
- `verification.human-review`
- `lifecycle.pre-tool`
- `lifecycle.post-tool`
- `lifecycle.pre-completion`

These are research names, not yet schema commitments.

A host adapter should resolve each requested capability as one of:

- **native** — the host has a safe native representation;
- **RACK-provided** — RACK can provide the behaviour outside the host;
- **human** — the requirement remains an explicit human review step;
- **degraded** — a weaker but clearly described form is available;
- **unavailable** — RACK must say it cannot preserve the practice on this host.

## Implementation sequence

1. **Audit** — pin upstream revision, confirm licence, identify specific practices/capabilities and reject runtime-only material.
2. **Adapt** — write small attributed RACK-native modules with plain-language purpose and no executable payload.
3. **Compose** — add or improve a coherent Starter Pack; do not expose a grab-bag of imported modules as the product.
4. **Map capabilities** — record which parts are instruction-only versus mechanically enforceable and how supported hosts resolve them.
5. **Conformance test** — use the same Pack, task and fixture across Claude Code, Codex and OpenCode and record degradation.
6. **Pilot** — watch whether the Pack improves real work and whether people keep, adapt or remove its practices.
7. **Review** — only then consider promoting useful capability identifiers or principles into canonical schema.

## Product rule

A person should be able to choose a useful pack because its promise makes sense to them.

They should not have to know whether the implementation underneath becomes an AGENTS instruction, a skill, a native hook, a RACK verification gate or a human review step.

RACK must know that difference, preserve it and show it when it affects consequences.
