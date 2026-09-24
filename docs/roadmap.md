# RACK roadmap

**Status:** active  
**Updated:** 21 September 2026

This is the active product and implementation roadmap. Earlier iteration notes and the initial backlog remain useful implementation history, but they no longer describe the current priority order.

## Direction

RACK's job is to make AI working practice portable, inspectable and testable.

TOPO's job is to provide durable, purpose-bound memory and context.

Ship Check's job is to provide independent, evidence-led assurance about what the work actually produced.

Those remain separate and independently useful:

```text
optional TOPO context
purpose · constraints · evidence
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
        │
        ▼
optional Ship Check
repository evidence · assurance · repair guidance
        │
        └──────── bounded verification evidence ────────► RACK
```

Context can influence a piece of work without becoming canonical RACK practice. Shared practice can influence an effective Set-up without being copied into local practice. Generated host files remain replaceable outputs rather than canonical source. Ship Check evidence may inform RACK verification without Ship Check becoming a RACK runtime dependency.

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

The TOPO → RACK connection has now been proved. The goal is to make that useful in ordinary work and across real AI hosts, while adding an independent evidence loop through Ship Check where that is useful.

Phase 3 now has six first-class product tracks which should move together rather than becoming isolated features:

1. **Lovely first use and useful Starter practice** — make RACK useful before somebody understands RACK: start from the work they want to do, offer a strong opinionated way to begin, and let their own working practice emerge through use.
2. **Host discovery and hand-off** — detect likely local AI tools safely, model their real capabilities, and show a reviewed installation/hand-off plan instead of treating every host as a text-file destination.
3. **Verification** — complete the path from declared practice through trusted deterministic checks, fresh bounded judgement and explicit human review to a defensible completion decision.
4. **Purpose-bound context** — let TOPO provide transient context without copying memory into canonical Rack practice or persistent host instructions.
5. **Practice evidence loop** — let independent tools such as Ship Check return evidence against stable practice principle identifiers without making those tools mandatory or granting them authority over canonical practice.
6. **Evaluation and governance boundaries** — evaluate practice rather than people, preserve personal context as personal context, and prevent implicit movement of context or behavioural exhaust across inside/between/beneath/around relationships.

The relationship model is non-hierarchical: **inside** (personal/local), **between** (teams, projects and collaborations), **beneath** (infrastructure and verification machinery), and **around** (networks, standards and wider ecosystems). These are overlapping relationship lenses, not ranks or automatic inheritance boundaries.

### Immediate product priority — start with a good way of working

The architecture is now ahead of the ordinary product experience. The next implementation priority is therefore not another protocol or integration layer. It is to make RACK feel obvious and useful to somebody who cannot yet describe their own AI working practice.

The first-use test is:

> Someone who has never thought about an “AI working practice” can tell RACK roughly what they are trying to do and, within a few minutes, start with a genuinely good way of working which they can inspect, adapt and improve later.

This means:

- lead with jobs and outcomes — writing something, researching something, making a decision, building or reviewing something — rather than RACK objects;
- present opinionated **Starter Packs** before individual modules;
- describe a pack by the behaviour and benefit it gives the person, with its ingredients available underneath;
- treat the existing module catalogue as composable practice infrastructure rather than the primary first-run experience;
- let people adopt a good default quickly, then learn their own preferences from real use;
- keep external packs attributed and inert: imported practice may declare capability needs, but executable hooks, commands and installers remain RACK-owned adapter/runtime concerns;
- use genuine harness projects as practice and compatibility research, following the Honey model, without turning RACK into another harness-specific runtime;
- make host capability differences legible in human terms: what becomes standing guidance, what can be mechanically enforced, what remains a RACK check and what still needs human review.

The immediate implementation order is: **first-run language → Starter Packs v2 → harness-pack programme → capability-aware application → practice refinement from use**. TOPO, verification and Ship Check work continue where they make this loop better, rather than as separate concepts a new user must understand first.

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
                │
                ▼
              work
                │
                ├─ RACK-owned verification
                └─ optional external evidence, e.g. Ship Check
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

#### Iteration 33 — lovely first use and Starter Packs v2 · active

Outcome: somebody can start with a good way of working before they know how to describe their own practice.

Scope:

- lead creation with the work the person is trying to do, not RACK architecture or role labels;
- make ordinary language warm, concrete and consequence-led across welcome, creation, Work and Starter surfaces;
- promote opinionated Starter Packs as the main starting point, with individual modules as inspectable ingredients underneath;
- give every Starter Pack a clear promise and “best for” description so choosing one does not require understanding its module composition;
- make Writing, Research and Coding each offer several genuinely different starting practices rather than only one route default;
- preserve the existing review-before-write boundary: a pack is a proposed way of working, not an invisible configuration change;
- let people move from “use this” → “change a few things” → “show me why” without forcing source-level concepts into the golden path;
- reuse document import, existing Rack source and reviewed TOPO context before asking the person to repeat information;
- ask the person only for unresolved gaps or decisions only they can make;
- begin a **harness-pack programme**: review useful external harnesses and agent-practice projects, extract portable working practice and capability requirements, retain provenance and licensing, and keep their executable runtime machinery out of Starter content;
- use Honey as the first reference implementation for that programme;
- maintain the source audit and candidate RACK-native packs in [harness-pack-programme.md](harness-pack-programme.md);
- deepen Coding practice around smallest useful change, dependency discipline, simplification, agent hand-off and meaningful verification;
- expand Research and Writing packs to the same level of coherence and usefulness;
- let Starter practice declare structured automatic, judgement and human verification while preserving the no-executable-shared-code boundary;
- improve the transition from choosing a starting point to doing real work with a detected AI tool.

UX rule:

> Start with a good way of working. Let the person discover and shape their own practice through use.

The underlying rule still applies:

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
- use external portability projects such as Honey for Devs as compatibility research and attributed practice sources, not as runtime dependencies or reasons to adopt silent installers;
- map Starter Pack capability needs onto the host compatibility model so RACK can explain which parts become guidance, hooks/checks or human review on each supported host;
- treat capability application as a consequence model, not just a compatibility matrix: resolve each need as native, RACK-provided, human, degraded or unavailable and make any loss/change of form explicit before installation;
- derive those needs from the current compiled Set-up and verification plan so the explanation stays true after a person edits or extends their Rack rather than depending on stale Starter Pack metadata.

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

#### Iteration 35.5 — first RACK ↔ Ship Check practice-evidence test · ready to test

Outcome: prove one end-to-end loop in which RACK can name a working-practice principle and Ship Check can independently return evidence against the same identifier.

Scope:

- establish a small neutral `practice.*` vocabulary rather than coupling Ship Check to RACK module IDs;
- map every Honey Starter entry to at least one stable principle identifier;
- also map RACK's existing dependency, security and change-verification practice to the same vocabulary;
- begin with `practice.preserve-safety`, `practice.dependency-restraint`, `practice.minimum-useful-change`, `practice.reuse-before-new-code`, `practice.fix-causes`, `practice.context-economy`, `practice.concise-handoff`, `practice.meaningful-verification` and `practice.cost-discipline`;
- accept bounded Ship Check `practiceEvidence` inside its existing provider result rather than inventing a second verification channel;
- do not interpret absence of Ship Check findings as proof that a broad practice principle passed;
- keep RACK, Ship Check and TOPO independently installable and useful;
- run the first contract test using Honey's `practice.preserve-safety` mapping and a deterministic Ship Check safety finding;
- then run a manual cross-repository test using the Honey coding set-up against a deliberately risky fixture and one real repository;
- use that evidence to decide whether principle identifiers should later become canonical module frontmatter rather than Starter catalogue metadata only.

First-test success means the same principle ID survives **practice selection → work/check boundary → Ship Check evidence → RACK verification result**, with no source-code or TOPO requirement added to the contract.

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

#### Iteration 36.5 — explicit practice refinement from use · in progress

Outcome: real use can improve a Rack without passive telemetry or automatic rewriting of canonical practice.

Scope:

- turn due review dates and experiment learning questions into an explicit **what happened? → Keep / Change / Remove** review flow;
- store bounded review history as local RACK metadata under `.rack/`, separate from canonical practice and excluded from Git by default;
- record the exact practice ID and review-date snapshot so completing one review does not permanently suppress later review dates;
- keep review notes deliberately small and user-authored rather than capturing prompts, conversations, full outputs or passive usage histories;
- make **Change** hand deliberately into the existing practice editor rather than letting observations rewrite source automatically;
- treat **Remove** as a visible decision until a separate explicit source/Set-up change actually stops the practice applying;
- keep previous review decisions inspectable on the practice itself, especially when a remove decision is recorded but the instruction remains active;
- use this loop in the private pilot to learn which practices people keep, adapt or remove without turning individual behaviour into organisational analytics.

#### Iteration 37 — paired private pilot

Outcome: test the proposition in real work rather than feature demonstrations.

Pilot groups should include:

- RACK-only use;
- paired RACK + TOPO use;
- paired RACK + Ship Check use for Coding work;
- optional RACK + TOPO + Ship Check use where purpose-bound context genuinely helps;
- Writing, Research and Coding work;
- at least one agent-runtime workflow;
- Windows, macOS and supported-pilot Linux.

The central learning question is not whether participants understand RACK internals. It is whether they experience:

> the AI has the context I chose to share, works in the way I intended, and gives me useful evidence when that practice does or does not hold up.

Observe:

- repeated context entry avoided;
- useful versus distracting memory;
- practice people accept, adapt or remove;
- destination hand-off friction;
- verification usefulness;
- whether external evidence improves repair decisions without becoming noisy scoring;
- Linux-specific installation/runtime friction;
- where people expect RACK, TOPO, Ship Check or the host to own a capability.

## Phase 4 — derive the wider Organisational OS

Broader Organisational OS work remains paused through Phase 3.

Resume it from evidence generated by RACK, TOPO, Ship Check and agent/runtime integrations rather than by expanding the protocol spec in advance.

Questions to revisit then include:

- whether RACK needs to advertise an OOS Practice primitive at all;
- what cross-tool activity or evidence objects are genuinely necessary;
- whether feedback such as "this practice does not work here" belongs in RACK, TOPO, Ship Check, a signal system, or the protocol between them;
- which FIELD STATION VSM concepts solve real coordination problems that the simpler source/context/evidence model cannot.

## UX direction

FIELD STATION's strongest contribution now is UX research rather than a schema to merge.

RACK should adopt these principles:

1. **Lead with the person's job, not RACK's architecture.** Prefer verbs and outcomes over schema concepts in ordinary views.
2. **Ask only for genuine gaps.** Check TOPO, imported material and existing source before asking somebody to repeat context.
3. **Propose, then let the person decide.** Practice suggestions require explicit accept/change/reject decisions.
4. **Keep review boundaries visible.** TOPO context, shared practice, generated host output and external verification evidence must each say where they came from and what accepting them will do.
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
- Ship Check remains optional, evidence-led and independent; its absence does not make RACK unusable.
- No individual-compliance or employee-monitoring control plane.
- Semantic format changes require ADR/version review.
- Destination changes require adapter-version review and golden output.
- Linux support must not weaken file, permission, privacy or update boundaries.
