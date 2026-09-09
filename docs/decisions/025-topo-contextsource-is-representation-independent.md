# ADR 025 — TOPO context is consumed through a representation-independent ContextSource

- **Status:** Accepted
- **Date:** 2026-09-09

## Context

RACK and TOPO have proved a useful local pairing: a running TOPO desktop can disclose purpose-bound context which a person reviews before RACK uses it.

TOPO is now moving from a claim-first memory model to a prose-first **Memory Page** model so durable context remains meaningfully portable across AI systems and ordinary file-based tools.

That change should not require RACK to understand or migrate TOPO's internal memory representation.

RACK's responsibility is to assemble governed working practice. TOPO's responsibility is to decide which personal/project context is appropriate to disclose for a stated purpose.

## Decision

RACK consumes TOPO through a stable **ContextSource** boundary and purpose-bound **Context Packets**.

```text
TOPO memory
    │
    ▼
TOPO resolver
    │
    ▼
Context Packet
    │
    ▼
RACK ContextSource ─────┐
                       │
RACK PracticeSources ───┼──► effective Set-up / host delivery
                       │
other task context ─────┘
```

RACK must not depend on:

- TOPO Claim schemas;
- TOPO Memory Page schemas;
- TOPO SQLite layout;
- TOPO embedding/index implementation;
- TOPO's internal migration/versioning machinery.

RACK may depend on the stable Context Packet contract and capability discovery exposed by the TOPO local bridge.

## Context handling

TOPO context remains:

- purpose-bound;
- explicitly disclosed by the person;
- transient by default;
- separate from canonical RACK modules and shared practice;
- accompanied by provenance/revision metadata sufficient for review/audit;
- unsuitable for automatic organisational analytics or individual evaluation.

RACK can request fresh context when the purpose/task changes.

A static host build may snapshot explicitly reviewed context only where the destination requires it, and must record provenance/revision while keeping that snapshot distinct from canonical practice.

Transient TOPO context must not silently become:

- a RACK module;
- standing project instructions;
- shared organisational practice;
- evaluation evidence;
- an individual performance/compliance record.

## Practice promotion

TOPO may identify repeated reviewed context that appears suitable for practice, but RACK must treat this only as a **proposal**.

The person still accepts, changes or rejects any resulting RACK practice.

The invariant is:

> TOPO may suggest what should become practice. TOPO cannot establish practice.

## Portability consequence

RACK is deliberately one consumer of TOPO, not the owner of TOPO memory.

The same underlying TOPO memory should remain usable by another AI, local agent, notes tool or future context system without being converted into RACK source first.

This is beneficial to RACK as well: practice remains portable on its own, context remains portable on its own, and the two are composed only for the work where both are useful.

## Consequences

- TOPO can change from Claims to Memory Pages without a RACK data migration;
- RACK's paired-context UX can remain stable while TOPO retrieval improves;
- TOPO's semantic retrieval/index choices remain private implementation details;
- RACK tests should use Context Packet fixtures rather than TOPO database fixtures;
- cross-tool conformance should verify context meaning/provenance rather than internal TOPO field shapes;
- RACK remains fully useful without TOPO;
- TOPO remains useful without RACK.
