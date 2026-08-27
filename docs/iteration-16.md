# Iteration 16 — Practice sources and authority foundation

## Outcome

Introduce the first additive foundation for composing personal and shared practice without changing existing Rack v0.1 build behaviour.

Iteration 16 does **not** yet make shared organisational practice active in the desktop application. It creates and tests the generic source/authority/resolution primitives that later iterations can wire into shared files, desktop review and Set-up propagation.

## Why now

The Field Station fork demonstrates that Rack's local instruction model can support organisational coordination if practice is resolved before the existing compiler.

The useful generic ideas are:

- practice may come from several sources;
- source provenance must remain visible;
- shared defaults can be adapted locally;
- binding boundaries cannot be silently overridden;
- local-only practice must not leak out of its source;
- conflict resolution must be deterministic.

The fork also exposes an important semantic problem: `required/recommended/optional` is not the same dimension as `binding/adaptable/local-only`. Rack keeps these concepts separate.

## First implementation slice

This branch adds:

- reusable schemas/types for practice authority and practice-source metadata;
- a pure practice-candidate resolver in `@rack/core`;
- deterministic precedence rules;
- upstream local-only filtering;
- binding-over-adaptable resolution;
- provenance and resolution explanation data;
- diagnostics for ambiguous same-precedence sources;
- focused tests for the initial rules.

This slice is deliberately additive. Existing project parsing, v0.1 files, Set-ups, compiler output and managed checks do not change.

## Resolution contract

For candidates with the same instruction ID:

1. discard `local-only` candidates that came from non-local sources;
2. if binding candidates remain, choose the lowest-precedence (furthest upstream) binding candidate;
3. otherwise choose the highest-precedence (nearest) candidate;
4. report superseded sources and whether a nearer adaptation was blocked;
5. fail ambiguous same-precedence candidates explicitly;
6. return results ordered deterministically by instruction ID.

The resolver does not mutate source files.

## Deferred from this slice

- writing authority into canonical module frontmatter;
- a source format version bump/default writer migration;
- shared-practice file parsing;
- Git fetching/caching;
- automatic injection of applicable binding instructions into Set-ups;
- desktop source/update review;
- proposition-based first-run UX;
- review/lapse dates and experiments;
- managed practice publishing/distribution.

Those follow once the generic resolution contract is stable.

## Relationship to Iteration 15

Iteration 15 remains the existing draft Reliable model-evaluation branch.

Iteration 16 is based on `main` rather than being stacked on the draft branch so the two areas can be reviewed independently. The practice-source work should be rebased/merged normally after Iteration 15 lands if required.
