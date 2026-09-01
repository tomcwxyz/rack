# RACK roadmap

**Status:** active  
**Updated:** 1 September 2026

This is the active product and implementation roadmap. Earlier iteration notes and the initial backlog remain useful implementation history, but they no longer describe the current priority order.

## Direction

RACK's job is to make AI working practice portable, inspectable and testable.

TOPO's job is to provide durable, purpose-bound memory and context.

Those remain separate:

```text
TOPO
memory · context · evidence
        │
        │ explicit purpose-bound disclosure
        ▼
RACK
practice · boundaries · verification
        │
        ▼
AI host / agent
        │
        ▼
work
```

Context can influence a piece of work without becoming canonical RACK practice. Shared practice can influence an effective Set-up without being copied into local practice. Generated host files remain replaceable outputs rather than canonical source.

## Progress so far

### Phase 1 — portable working practice · complete

**Iterations 1–15**

Established:

- local-first Tauri desktop and CLI;
- canonical Markdown/YAML practice;
- guided Writing, Research and Coding routes;
- deterministic compilation and drift detection;
- prompt, `AGENTS.md`, Claude Code, OpenCode and Codex destinations;
- Starter library;
- guided maintenance;
- optional managed Quick and Reliable evaluation;
- privacy-safe managed-service boundaries.

### Phase 2 — shared, governed and verifiable practice · complete enough to pilot

**Iterations 16–31**

Established:

- practice sources and provenance;
- criticality separated from authority;
- binding and adaptable shared practice;
- local-only propagation;
- deterministic shared-practice resolution;
- plain shared-file publishing and accepted-snapshot update review;
- review dates without automatic expiry;
- explicit experiments with learning questions;
- proposition-first creation;
- copy and accessibility guardrails;
- desktop publishing and receiving;
- signed Windows/macOS pilot distribution;
- Verification Plans;
- the first fresh-context bounded semantic verification gate.

FIELD STATION was an important design experiment during this phase. RACK adopted its useful generic principles rather than its complete VSM-specific architecture.

### Phase 3 — put practice into context · active

The TOPO → RACK connection has now been proved. The goal is to make that useful in ordinary work and across real AI hosts.

Phase 3 now has five first-class product tracks which should move together rather than becoming isolated features:

1. **Useful Starter practice** — deepen the Writing, Research and especially Coding packs so a new Rack begins with strong, inspectable working practice rather than generic prompt advice.
2. **Host discovery and hand-off** — detect likely local AI tools safely, model their real capabilities, and show a reviewed installation/hand-off plan instead of treating every host as a text-file destination.
3. **Verification** — complete the path from declared practice through trusted deterministic checks, fresh bounded judgement and explicit human review to a defensible completion decision.
4. **Purpose-bound context** — let TOPO provide transient context without copying memory into canonical Rack practice or persistent host instructions.
5. **Evaluation and governance boundaries** — evaluate practice rather than people, preserve personal context as personal context, and prevent implicit movement of context or behavioural exhaust across inside/between/beneath/around relationships.

The relationship model is non-hierarchical: **inside** (personal/local), **between** (teams, projects and collaborations), **beneath** (infrastructure and verification machinery), and **around** (networks, standards and wider ecosystems). These are overlapping relationship lenses, not ranks or automatic inheritance boundaries.

The intended host model is:

```text
Rack practice + reviewed TOPO context
                │
                ▼
        host integration plan
        ├─ standing practice
        ├─ on-demand practice
        ├─ transient task context
        └─ completion verification
                │
                ▼
             AI tool
```

#### Iteration 32 — paired context and cross-platform pilot hardening · in progress

Outcome: TOPO and RACK behave like reliable companion applications, including on Linux.

Scope:

- harden local TOPO discovery, authentication, reconnection and failure recovery;
- make expiry, staleness and provenance understandable without exposing protocol jargon;
- test creation and build flows with TOPO absent, waiting, permission-needed, connected and changed;
- ensure no silent context retrieval or disclosure;
- keep reviewed context distinct from canonical practice;
- make Linux a first-class pilot engineering target;
- add Linux release packaging and native smoke coverage;
- verify the TOPO/RACK local pairing on Linux, not only the standalone desktop;
- review FIELD STATION's Debian/Flatpak release work before choosing new packaging machinery.

Linux support remains labelled experimental until this iteration's release and smoke criteria are met. The intended outcome is **supported Linux pilot**, beginning with a reliable x86_64 Debian/Ubuntu-compatible distribution path; arm64 and Flatpak should follow as release reliability permits.

#### Iteration 33 — context-aware Set-ups and richer Starter practice

Outcome: RACK asks for less configuration and gives people stronger starting practice before asking them to design everything themselves.

Scope:

- let a Set-up express purpose-bound transient context needs without turning them into modules;
- ask TOPO for suitable context first when the person has enabled local sharing;
- reuse document import and existing Rack source before asking the person to re-enter information;
- present TOPO material as reviewable propositions, never silent truth;
- ask the person only for unresolved gaps;
- preserve explicit accept/change/reject decisions for working practice;
- expand Starter packs based on real working patterns rather than generic role labels;
- deepen Coding practice around the smallest useful change, dependency discipline, simplification, agent hand-off and meaningful verification;
- let Starter practice declare structured automatic, judgement and human verification while preserving the no-executable-shared-code boundary;
- improve empty states, first-run guidance and the transition from creation to real work.

UX rule:

> use what the system can legitimately know; ask the person for what only they can know or decide.

#### Iteration 34 — host discovery, installation plans and agent delivery · in progress

Outcome: RACK understands which AI tools are actually available, how each one accepts practice, and what a reviewed hand-off will change before anything is installed.

Scope:

- maintain one host compatibility map instead of scattered destination assumptions;
- safely detect supported and research hosts locally without uploading paths or host state;
- begin with Claude Code, Codex and OpenCode, then test Hermes Agent, OpenClaw, Copilot CLI, Gemini CLI, Cursor and other useful coding hosts;
- distinguish rendering from host detection, installation planning and installation execution;
- require an explicit work-project target rather than assuming the Rack source folder is the code repository;
- show the exact files/native surfaces a hand-off would change and require explicit review;
- preserve backups, drift inspection and removal/restore paths for Rack-managed host output;
- refuse to overwrite pre-existing host files Rack does not already own;
- define context delivery for Claude Code, Codex and OpenCode;
- distinguish standing practice, on-demand practice, transient task context and completion verification;
- prevent transient TOPO material being accidentally installed as canonical project instructions;
- promote Hermes Agent and OpenClaw from simple Preview-destination thinking into agent-runtime integration experiments;
- test RACK as governed practice plus TOPO as durable context alongside an agent's own short-term/native memory;
- use external portability projects such as Honey for Devs as compatibility research, not as a runtime dependency or a reason to adopt silent installers.

#### Iteration 35 — deterministic verifier registry and local execution · in progress

Outcome: trusted factual checks can execute without Starter or shared practice shipping executable code.

Scope:

- complete the RACK-owned verifier registry boundary begun in Phase 3;
- begin with the `repository-checks` identifier for tests, type checks and builds;
- map source-level verifier IDs only to Rack-owned local executors;
- run checks against the explicitly selected work project, not the Rack source by assumption;
- inspect the repository and show the exact planned checks before execution;
- fingerprint the reviewed plan and refuse execution if it changes before confirmation;
- require an explicit local confirmation before running repository code in the first pilot implementation;
- capture bounded evidence/results rather than complete process history;
- distinguish registered, available, unavailable, failed and incomplete verification;
- fail closed when a named verifier is unavailable or incomplete;
- keep deterministic and semantic verification distinct;
- never accept a shell command, script body or plug-in supplied by Starter/shared practice as a verifier.

#### Iteration 36 — complete verification gates, governance boundaries and cross-host conformance

Outcome: automatic checks, bounded AI judgement and explicit human review combine into one target-neutral completion decision, and RACK can show whether the same practice survives translation across hosts.

Scope:

- combine Verification Plan results;
- keep the unit of organisational evaluation as practice/version + scenario/task + host/adapter rather than an individual;
- keep live verification task-local by default and produce artefact attestations rather than individual performance histories where assurance must travel;
- prohibit automatic reporting of personal adaptations, TOPO context, prompts, conversations or individual verification histories;
- add explicit context-flow checks so task context cannot silently become Rack source, standing host practice, shared practice, evaluation evidence or organisational analytics;
- preserve pass/fail/uncertain/incomplete semantics;
- make model/provider independence explicit where independent judgement is claimed;
- add host hooks only where they can respect RACK's gate semantics;
- never infer a pass from missing or malformed evidence;
- keep the working AI conversation separate from fresh verification context;
- add a small cross-host conformance suite using the same Rack, task and repository across supported coding hosts;
- test whether required boundaries, task procedures, transient context and verification survive each host translation;
- report known degradation explicitly rather than treating file generation as proof of host support.

#### Iteration 37 — paired private pilot

Outcome: test the proposition in real work rather than feature demonstrations.

Pilot groups should include:

- RACK-only use;
- paired RACK + TOPO use;
- Writing, Research and Coding work;
- at least one agent-runtime workflow;
- Windows, macOS and supported-pilot Linux.

The central learning question is not whether participants understand RACK internals. It is whether they experience:

> the AI has the context I chose to share and works in the way I intended.

Observe:

- repeated context entry avoided;
- useful versus distracting memory;
- practice people accept, adapt or remove;
- destination hand-off friction;
- verification usefulness;
- Linux-specific installation/runtime friction;
- where people expect RACK, TOPO or the host to own a capability.

## Phase 4 — derive the wider Organisational OS

Broader Organisational OS work remains paused through Phase 3.

Resume it from evidence generated by RACK, TOPO and agent/runtime integrations rather than by expanding the protocol spec in advance.

Questions to revisit then include:

- whether RACK needs to advertise an OOS Practice primitive at all;
- what cross-tool activity or evidence objects are genuinely necessary;
- whether feedback such as "this practice does not work here" belongs in RACK, TOPO, a signal system, or the protocol between them;
- which FIELD STATION VSM concepts solve real coordination problems that the simpler source/context model cannot.

## UX direction

FIELD STATION's strongest contribution now is UX research rather than a schema to merge.

RACK should adopt these principles:

1. **Lead with the person's job, not RACK's architecture.** Prefer verbs and outcomes over schema concepts in ordinary views.
2. **Ask only for genuine gaps.** Check TOPO, imported material and existing source before asking somebody to repeat context.
3. **Propose, then let the person decide.** Practice suggestions require explicit accept/change/reject decisions.
4. **Keep review boundaries visible.** TOPO context, shared practice and generated host output must each say where they came from and what accepting them will do.
5. **Make hand-off concrete.** Detect likely supported tools locally where safe, prioritise them, and explain exactly what will be written, registered, supplied transiently or checked afterwards.
6. **Hide machinery without hiding consequences.** YAML, provenance digests and adapter capabilities belong behind ordinary product language, but changes, authority and data movement remain inspectable.
7. **Design cross-platform from the start.** Windows, macOS and Linux should use the same mental model even when packaging or host integration differs.

The canonical object remains a Rack for now. FIELD STATION's **handbook** language should be tested as interface copy rather than adopted as a format or architectural rename.

See [`ux-direction.md`](ux-direction.md) for the detailed interaction principles.

## FIELD STATION pause

FIELD STATION should now be treated as a design-research reference rather than a parallel production roadmap.

Useful work while paused:

- serious bug fixes;
- documentation of experiments and learning;
- preservation of VSM, ratchet, signal and distribution fixtures;
- isolated UX prototypes;
- notes that make later comparison easier.

Pause:

- new canonical schema semantics;
- additional VSM primitives in the core format;
- independent shared-practice architecture;
- major destination/compiler divergence.

Review FIELD STATION again after host-aware context delivery has been implemented, and make the larger convergence decision after the paired pilot.

## Cross-cutting constraints

- Local authoring/builds remain account-free.
- Managed evaluation/verification remains optional.
- Canonical Rack source stays local.
- TOPO context is purpose-bound and explicitly reviewed.
- No individual-compliance or employee-monitoring control plane.
- Semantic format changes require ADR/version review.
- Destination changes require adapter-version review and golden output.
- Linux support must not weaken file, permission, privacy or update boundaries.
