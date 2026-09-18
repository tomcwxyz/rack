# RACK in the Organisational OS runtime experiment

Date: 2026-09-18  
Status: architectural record / experiment

The canonical cross-project decision is recorded in `tomcwxyz/Organisational-OS` RFC 0002: **AI runtime interoperability and the Orbital experiment**.

## Role

RACK is the practice node.

Its question is:

> How should this system work?

RACK packages working practices, constraints, methods and repeatable instructions. It does not own project queues, durable personal memory or the execution runtime.

## Relationship to the Orbital fork

`tomcwxyz/Orbital` is being used as a reference runtime/proving ground. The initial experiment should let Orbital resolve applicable RACK practices for a project task without making RACK dependent on Orbital.

Conceptually:

~~~text
RACK practices
      │
      ▼
practice resolution
      │
      ▼
Orbital project/runtime
      │
      ├── planning
      ├── worker briefing
      ├── completion criteria
      └── checks
~~~

Where practical, runtime lineage should retain stable practice identifiers and versions rather than flattening practice into unattributed prompt text.

## Boundary with TOPO

TOPO answers **what is known and may be disclosed for a purpose**. RACK answers **how work should be done**.

A runtime may combine both:

~~~text
TOPO Context Packet ───┐
                       ├──► Orbital assembled working context
RACK practice ─────────┘
~~~

TOPO context may help select or explain a RACK practice, but it cannot establish or mutate practice automatically.

## Boundary with CRUX

CRUX may observe whether a runtime applied a named/versioned RACK practice and what happened afterwards.

That gives us an empirical learning loop:

~~~text
RACK practice
      │
      ▼
runtime execution
      │
      ▼
CRUX evidence/outcome
      │
      ▼
reviewed proposal to improve RACK
~~~

CRUX evidence must not silently rewrite canonical RACK practice. Practice changes remain explicit and reviewable.

## Boundary with Ship Check

Ship Check can independently inspect whether an implementation exhibits evidence associated with a practice, for example secure-build or production-readiness expectations.

Ship Check findings may be correlated in CRUX with:

- the RACK practice/version;
- the runtime task/run;
- the artefact/build/release;
- other evaluations or approvals.

RACK should not depend on Ship Check to remain usable, and Ship Check should not become the canonical practice store.

## Organisational OS semantics

RACK participates primarily through:

- **Object** — Practice and related versioned artefacts;
- **Context** — purpose-bound resolution of applicable practice;
- **Event** — `practice.updated`, `practice.deprecated` and evidence-bearing runtime events consumed for learning;
- **Action** — explicit authorised practice-management capabilities where appropriate, never implied by context access.

## First experiment

1. Select a real task in the Orbital fork.
2. Resolve one or more relevant RACK practices.
3. Propagate practice IDs/versions into the runtime and worker briefing.
4. Emit runtime evidence sufficient for CRUX to tell whether the practice was actually applied.
5. Compare intended practice with observed execution and Ship Check evidence.
6. Record any proposed practice change for human review rather than automatic mutation.

## Invariants

1. RACK is practice, not a task manager.
2. RACK is not durable personal/organisational memory.
3. A practice remains identifiable and inspectable after being passed into a runtime.
4. Runtime outcomes can inform practice but cannot automatically redefine it.
5. RACK remains useful without TOPO, Orbital, CRUX or Ship Check.
6. Orbital is one proving runtime; integrations should remain runtime-agnostic at the contract boundary.
