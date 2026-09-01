# Iteration 33 — richer Starter practice and host hand-off foundation

## Outcome

Start Phase 3's expanded practice, host-integration and verification tracks without weakening Rack's local-first or explicit-review boundaries.

This slice does three things together:

1. improves the Coding Starter catalogue so useful restraint and verification are available as ordinary practice;
2. establishes one compatibility model for AI coding hosts and a read-only local discovery boundary;
3. establishes the Rack-owned verifier registry boundary before any local repository code is executed.

## Coding Starter expansion

The Starter catalogue moves from 35 modules and six templates to 40 modules and eight templates.

New Coding practice covers:

- smallest useful change;
- dependency discipline;
- remove before adding;
- efficient agent hand-off;
- structured verification of consequential changes.

The new **Verify consequential code changes** guardrail uses module schema 0.2 and demonstrates both:

- an automatic \`repository-checks\` step; and
- a fresh semantic judgement over diff/test/build evidence.

Missing or unavailable verification is explicitly not a pass.

Two new Coding templates are included:

- **Lean code change**;
- **Agent code hand-off**.

The existing **Careful code change** and **Repository review** templates also gain the stronger verification practice.

## Host integration model

Rack now has a host compatibility registry separate from destination rendering.

The first map covers:

- Claude Code;
- Codex;
- OpenCode;
- Hermes Agent;
- OpenClaw;
- GitHub Copilot CLI;
- Gemini CLI;
- Cursor;
- Windsurf.

Each host records:

- current Rack support status;
- safe local detection probes;
- standing-practice support;
- on-demand-practice support;
- transient-context support;
- verification-gate support;
- intended installation mode.

The model keeps four surfaces separate:

**standing practice · on-demand practice · transient context · completion verification**

This prevents a host's ability to load one instruction file from being mistaken for complete integration support.

## Read-only desktop discovery

The Tauri desktop can now detect likely installed coding hosts.

Discovery:

- checks ordinary executable files on PATH;
- checks a small set of known home-directory markers;
- ignores symlinked command/directory probes;
- returns only evidence labels such as \`command:claude\` or \`home:.claude\`;
- does not return absolute home paths;
- does not install, configure, authenticate or launch a host.

The Preview and export surface now reports whether the selected supported host is detected locally.

## Installation planning boundary

Core can create a host installation plan from generated Rack artefacts.

A plan:

- classifies generated files as standing or on-demand practice;
- requires review;
- never mutates canonical Rack source;
- never treats transient TOPO context as an installed file;
- warns when a host is Preview/research or artefacts target another destination.

Actual host installation is deliberately deferred until Rack has a reviewed write/restore contract for each host.

## Trusted verifier registry

Rack now has an explicit verifier registry with \`repository-checks\` as the first identifier.

The registry currently marks repository execution as **planned**, not available.

That distinction is intentional. Before it becomes executable Rack must:

1. inspect the repository and derive the exact trusted checks;
2. show those checks to the person;
3. require explicit local confirmation in the pilot;
4. execute only Rack-owned verifier implementations;
5. capture bounded results;
6. treat unavailable, failed and incomplete execution as not passed.

Starter/shared practice can name \`repository-checks\`; it cannot provide a shell command or verifier implementation.

## Compatibility research

Projects such as Honey for Devs are useful research for real host conventions: native skills, extensions, commands and project-rule locations differ materially between tools.

Rack adopts the compatibility-map and host-aware hand-off principle, not Honey's installer architecture. Rack keeps explicit review, backups, drift detection, provenance and context separation as product requirements.

## Next

Complete the remaining Iteration 32 installed-app/Linux acceptance work in parallel, then continue Iteration 33/34 with:

- richer Starter practice for Writing and Research where evidence supports it;
- host discovery presented earlier in the creation/Set-up flow;
- reviewed host installation/restore plans for Claude Code, Codex and OpenCode;
- transient TOPO context delivery that never becomes standing project practice;
- a Rack-owned local \`repository-checks\` executor with explicit confirmation;
- cross-host conformance fixtures before promoting Hermes Agent or OpenClaw beyond Preview.
