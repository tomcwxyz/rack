# ADR 023 — host integration is separate from destination rendering

**Status:** accepted  
**Date:** 1 September 2026

## Context

Rack already compiles one Set-up into destination-specific generated artefacts such as \`CLAUDE.md\`, \`AGENTS.md\` and host task/skill files.

That is necessary but not sufficient to claim useful integration with an AI tool.

Real hosts differ in:

- how they are detected;
- which project/global locations they read;
- whether they support commands, skills or extensions;
- whether instructions are standing or invoked on demand;
- how transient task context can be supplied;
- whether completion hooks or policies exist;
- how files/configuration can be safely installed and removed.

Treating all of that as part of a renderer would make adapters responsible for local-machine inspection and writes, and would encourage Rack to flatten transient TOPO context into persistent generated files.

Compatibility research such as Honey for Devs also shows that host conventions change independently and that several tools have native plugin, extension, skill or rule surfaces rather than one universal instruction file.

## Decision

Rack separates four concerns:

1. **destination rendering** — compile canonical Rack practice into deterministic generated artefacts;
2. **host discovery** — read-only inspection of likely local AI tools;
3. **host installation planning/execution** — explain and, only after review, apply the generated artefacts through the correct host surface;
4. **runtime delivery** — supply transient context and verification state without turning them into canonical or standing practice.

A host integration records support separately for:

- standing practice;
- on-demand practice;
- transient task context;
- completion verification.

Rendering support does not by itself mean host integration is complete.

Host discovery must remain read-only and privacy-minimising. The first implementation returns logical evidence labels rather than full home-directory paths and does not install, authenticate, launch or configure a host.

Installation plans must:

- require an explicit work-project target; the Rack source folder is not assumed to be the target repository;
- require review before host changes;
- preserve canonical Rack source;
- keep transient context out of installed standing practice;
- distinguish Rack-managed files from native extension/skill mechanisms;
- keep ownership state/backups with local Rack metadata while writing host files only into the selected work project;
- refuse to overwrite pre-existing host files Rack does not already own;
- provide backup, drift and restore semantics before an integration becomes Supported.

## Verification relationship

Host integration may eventually enforce a Rack Verification Plan, but hosts do not define Rack's verification semantics.

Automatic checks map through the Rack-owned verifier registry. Bounded judgements run in fresh verification context. Human review remains explicit.

A host hook may consume the resulting gate only when it can preserve pass/fail/uncertain/incomplete semantics.

## Consequences

- Target adapters remain deterministic and testable without machine-local state.
- Rack can detect tools before asking somebody to choose a destination.
- Hermes Agent, OpenClaw, Copilot, Gemini and editor integrations can use their native surfaces without forcing them into the Claude/Codex file model.
- TOPO context can be delivered per task without being written into standing project instructions.
- Host compatibility can be benchmarked independently from prompt generation.
- More code is required than a universal \`AGENTS.md\` installer, but the resulting boundaries are safer and more honest.

## Rejected alternatives

### Put detection/install behaviour in each TargetAdapter

Rejected because rendering would become machine-dependent and harder to test deterministically.

### Copy one universal instruction file everywhere

Rejected because host capabilities and loading conventions differ, and it hides meaningful degradation.

### Let shared practice provide installation scripts

Rejected because received practice must remain data. It cannot gain local code-execution authority merely because a host supports plug-ins.

### Persist TOPO context into host instruction files

Rejected because purpose-bound transient context is not canonical Rack practice and may have different expiry/provenance requirements.
