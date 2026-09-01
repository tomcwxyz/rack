# ADR 024 — Govern practice, not people; context crosses boundaries only explicitly

**Status:** accepted  
**Date:** 1 September 2026

## Context

Rack is moving from personal working practice into shared practice, host integration, verification and organisational use.

That creates two related risks:

1. evaluation of AI practice can drift into evaluation of the individual using AI; and
2. purpose-bound personal context can drift into shared practice, persistent host instructions, evaluation records or organisational reporting.

A simple organisational hierarchy is also the wrong mental model. Real work happens through overlapping teams, projects, partnerships, professional communities and infrastructure. Practice often moves across these relationships rather than down an org chart.

The existing Rack source model already distinguishes local and shared practice, authority from criticality, and transient TOPO context from canonical Rack source. This decision makes the privacy and governance implications explicit.

## Decision

Rack adopts the principle:

> **Govern practice, not people.**

### Relationship topology

Rack uses four relationship lenses when explaining where practice, context and infrastructure sit:

- **inside** — personal context, local choices, private adaptations and reflection;
- **between** — practice agreed across peers, teams, projects, collaborations and partnerships;
- **beneath** — infrastructure, models, data boundaries, protocols and verification machinery;
- **around** — networks, communities, sector standards, regulators, suppliers and public/shared practice.

These are not ranks, security levels or concentric ownership domains. They can overlap. Organisation, team, project and network labels describe relationships and applicability, not authority derived from position in a hierarchy.

No implicit inheritance is introduced by this topology.

### Context movement

A Context Packet is a purpose-bound disclosure, not reusable organisational data.

A received context snapshot must retain enough provenance to answer:

- where it came from;
- the purpose for which it was disclosed;
- its scope/handling constraints;
- when it expires;
- what objects were included.

Context may be used for the stated task after review. It must not silently:

- become canonical Rack source;
- become standing host practice;
- become shared practice;
- become evaluation evidence for another purpose;
- become organisational analytics or telemetry.

Crossing any of those boundaries requires a new explicit disclosure appropriate to the new purpose.

Personal TOPO context is treated as **inside** by default. Organisational membership does not grant access to it.

### Evaluation and verification

Rack keeps the distinction from ADR 022:

- **verification** asks whether a real piece of work satisfies active practice;
- **evaluation** tests whether a version of Rack practice behaves usefully and reliably across representative cases.

The unit of organisational evaluation is therefore a **practice/version + scenario/task + host/adapter**, not a person.

Organisational evaluation should primarily use fixtures, scenarios and practice test benches. Live verification remains task-local by default.

A task may produce an explicit artefact attestation where assurance needs to travel with the work. That is not an individual performance history.

### No behavioural exhaust

Receiving shared practice creates no automatic observation right for its publisher.

Rack must not create an automatic reporting channel for:

- personal/local adaptations;
- prompts or conversations;
- personal TOPO context;
- individual verification histories;
- individual AI productivity or compliance scores;
- identifiable rankings of AI use;
- which practice a person ignored or changed locally.

Learning may travel across or around the system through deliberate, reviewable contributions such as a practice feedback note, benchmark result or artefact attestation.

### Product boundary

Individual surveillance features are not an enterprise configuration option. They are outside Rack's product contract.

If regulated work requires an audit trail, Rack should attest the relevant work, practice version and verification result rather than construct a behavioural dossier about the worker.

## Initial implementation

For Phase 3:

1. preserve Context Packet scope when Rack parses TOPO context;
2. classify TOPO context conservatively as **inside** unless an explicit relationship boundary is supplied;
3. expose a Rack-owned context-flow decision which only permits the current snapshot to enter the reviewed transient task;
4. refuse reuse of the same snapshot for canonical source, standing host practice, shared practice, evaluation or organisational analytics;
5. replace ordinary UI language that calls TOPO context “organisational context” with “purpose-bound context”;
6. include scope/boundary in context build digests so handling changes make a build stale;
7. keep managed-run initiator identity only for the transient request window and scrub it from durable run metadata after 24 hours.

A later protocol revision may make boundary metadata explicit on the wire. This ADR does not silently redefine the draft OOS Context Packet schema.

## Consequences

- organisational use does not imply hierarchical control;
- context provenance becomes an information-flow constraint, not only explanatory metadata;
- practice can be shared across overlapping relationships without creating a surveillance channel;
- evaluation can improve shared practice without employee scoring;
- some future analytics become deliberately impossible unless they can be designed without violating this boundary;
- host and evaluation integrations must request fresh purpose-bound context rather than reusing a task snapshot.
