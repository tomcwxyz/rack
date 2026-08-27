# ADR-021 — One Rack core with personal and shared practice sources

**Status:** Accepted  
**Date:** 27 August 2026

## Context

Rack v0.1 is local-first: a user creates local Markdown/YAML practice, selects a Set-up, compiles it into supported destinations and can optionally use managed evaluation.

The Field Station fork tested the architecture against a wider organisational problem: practice may come from more than one place. Some shared conventions should be adaptable, some boundaries may be binding, and personal adaptations should not become a surveillance feed.

The fork also demonstrated that these concerns can be resolved before the existing compiler. However, it replaced Rack's existing `criticality` semantics with `mandatory/default/personal`, conflating importance with authority.

Rack also has an existing managed-service direction. Organisational use must not force local projects into a cloud control plane or make "managed" synonymous with "organisation".

## Decision

Rack will remain one core product and one compiler architecture.

### Personal and shared practice

Personal/local and organisational/shared Rack are modes of using the same system, not separate schemas or compilers.

Practice may be materialised from multiple source kinds, initially:

- local;
- Starter;
- shared file;
- Git.

A source-resolution stage runs before compilation and produces an ordinary resolved Rack project for the existing compiler, destination adapters and evaluation paths.

### Authority

Rack retains v0.1 `criticality: required | recommended | optional`.

A separate authority model is introduced for shared-practice resolution:

- `adaptable` — a nearer source may replace/adapt the instruction;
- `binding` — a nearer source may not replace the instruction;
- `shared` propagation — the instruction may propagate from a shared source;
- `local-only` propagation — the instruction never propagates out of its local source.

Binding instructions should carry a human-readable rationale when published as shared practice.

Source provenance is separate from instruction authority. Organisation/team/project labels describe a source relationship, not the intrinsic type of an instruction.

### Managed Rack

Managed Rack remains optional and orthogonal.

The managed platform may provide two independently usable capability groups:

1. managed evaluation — model execution, Quick/Reliable checks, budgets and results;
2. managed practice — workspaces, publishing, version history and distribution of shared practice.

Organisations must also be able to distribute shared practice outside Managed Rack using ordinary shared files or other transports.

### Privacy

Shared-practice management must not require reporting individual local adaptations upstream.

The central service may know what shared practice was published and by whom. Personal/local-only instructions and adaptations of non-binding defaults remain local unless explicitly published.

### Field Station

Field Station may remain an experimental downstream distribution while the generic capabilities converge.

Long term, Field Station-specific VSM concepts should depend on shared Rack schemas/core rather than maintaining an independent compiler and evaluation stack.

## Consequences

- the compiler remains simpler and destination-focused;
- Starter, shared-file, Git and managed sources can converge on one source abstraction;
- existing v0.1 `criticality` meaning is preserved;
- organisational features can be sold/positioned separately without creating a second technical product;
- Managed Rack can serve individual and organisational users without becoming mandatory for either;
- shared practice can be distributed through existing sovereign infrastructure;
- resolution and provenance become first-class testable behaviour;
- the v0.2 source-format changes require migration and compatibility tests before becoming the default writer format.
