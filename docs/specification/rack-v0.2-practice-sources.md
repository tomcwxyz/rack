# Rack v0.2 — personal, shared and managed practice

**Status:** implementation direction  
**Date:** 27 August 2026  
**Steward:** The Good Ship

## Summary

Rack remains one product and one source/compiler architecture.

There are two ways to use a Rack:

- **personal/local practice** — how an individual wants AI to work with them;
- **shared practice** — working practices published by a team or organisation, including adaptable defaults and explicit binding boundaries.

These are not separate products or separate compilers. They are different combinations of practice sources resolved into one ordinary Rack project before the existing compiler runs.

**Managed Rack is orthogonal to both.** It is an optional service layer which can provide managed evaluation, and later managed publishing/distribution/versioning of shared practice. Local use must continue to work without an account or managed service.

## Product shape

```text
                         RACK
                          |
                portable practice format
                          |
             +------------+------------+
             |                         |
          PERSONAL                   SHARED
             |                         |
        Your practice             Team / org practice
        Your Set-ups              Defaults + boundaries
        Your adaptations          Published versions
             |                         |
             +------------+------------+
                          |
                       RESOLVE
                          |
                        BUILD
                          |
       +------------------+------------------+
       |                  |                  |
     Claude             Codex              etc.
                          |
                          v
                        TEST
                          |
               Quick / Reliable eval


                     OPTIONAL CLOUD
                          |
              +-----------+------------+
              |                        |
       Managed Practice         Managed Evaluation
       publishing              model execution
       sync/distribution       reliable checks
       starter registry        budgets/results
       workspaces
```

## One core, multiple practice sources

Rack should treat Starter content, local practice and shared organisational material as sources of the same underlying instruction model.

```text
  Starter       Shared file       Git       Local Rack
     |               |             |            |
     +---------------+------+------+------------+
                            |
                    source materialisation
                            |
                            v
                       RESOLUTION
                 authority + provenance
                   conflict + privacy
                            |
                            v
                    resolved Rack project
                            |
                            v
                     existing compiler
```

The compiler remains destination-focused. It should not know whether an instruction came from a Starter, a shared file, Git or the user's local Rack.

## Personal and organisational Rack are product modes, not forks

The local/open-source proposition remains intact:

- no account required;
- canonical Markdown/YAML stored locally;
- Starter content available locally;
- Set-ups remain the user's intended-use profiles;
- builds and destination adapters remain local;
- managed checks remain optional.

When shared practice is present, Rack gains additional capabilities:

- provenance: where a practice came from;
- authority: whether a nearer source may adapt it;
- deterministic conflict resolution;
- explicit explanations when a binding shared rule overrides a local adaptation;
- local-only personal practice that never propagates into shared sources.

This can be positioned commercially as **Rack for Organisations**, but it should use the same schemas, resolver, compiler, desktop and CLI.

## Managed Rack

"Managed" must not mean "organisational".

Two optional managed capabilities should remain separable.

### Managed evaluation

The existing service direction:

- model registry and aliases;
- Quick checks;
- Reliable checks;
- explicit cost preflight and confirmation;
- budgets and accounting;
- transient managed content.

### Managed practice

A later service capability:

- personal and organisation workspaces;
- Starter/community practice registry;
- publishing shared practice;
- version history;
- distribution/sync;
- publisher permissions;
- review dates and update classification.

A user or organisation may use either managed capability without the other.

An organisation must also be able to distribute shared practice without Managed Rack, for example through a shared file in OneDrive, Google Drive, Dropbox, Nextcloud or another synchronised folder.

## Starter content

The current Starter library becomes the first form of a broader reusable-practice model.

Useful categories are:

1. **Rack Starter** — generic curated practice maintained with Rack;
2. **method/community packs** — attributed reusable methods or domain practice;
3. **organisation practice** — practice published by a team or organisation.

All can materialise as practice sources. Authority and provenance, rather than a separate compiler path, determine how they behave.

## Shared practice transport

The core abstraction should be a `PracticeSource`, not Git.

Initial source kinds:

- `local`;
- `starter`;
- `shared-file`;
- `git`.

Shared files should be the normal organisational path because they work with existing sync infrastructure and do not require Git literacy.

Git remains valuable for technical publishers, CLI workflows and version-pinned sources.

Managed Rack can later become another transport/materialisation path without changing resolution semantics.

## Authority is separate from criticality

Rack v0.1 uses:

```yaml
criticality: required | recommended | optional
```

This remains.

It answers:

> How important is this instruction to the resulting behaviour?

Shared practice introduces a different question:

> May a nearer source adapt this instruction?

The v0.2 source model therefore adds a separate authority dimension:

```yaml
authority:
  mode: adaptable | binding
  propagation: shared | local-only
  rationale: optional explanatory text
  review_after: optional date
```

Examples:

```yaml
criticality: required
authority:
  mode: adaptable
  propagation: local-only
```

means "this is essential to my own working practice, but it is mine".

```yaml
criticality: recommended
authority:
  mode: adaptable
  propagation: shared
```

means "this is a shared convention which can be adapted nearer the work".

```yaml
criticality: required
authority:
  mode: binding
  propagation: shared
  rationale: Public-facing research must distinguish evidence from inference.
```

means "this boundary applies downstream and cannot be silently overridden".

"Personal" is therefore not a strength/criticality value. Local-only behaviour is represented through propagation and source provenance.

## Provenance belongs to resolution

An instruction should not claim to be "organisational" or "team" practice in isolation.

Those are properties of the source it came from.

A materialised source should carry metadata similar to:

```ts
type PracticeSource = {
  id: string;
  label: string;
  kind: "local" | "shared-file" | "git" | "starter";
  relationship?: "organisation" | "team" | "project" | "other";
  precedence: number;
};
```

The resolver produces a winning instruction plus provenance and an explanation of what happened. Resolution metadata remains local and must not be emitted into model prompts by default.

## Resolution rules

The first generic rules are:

1. local-only instructions from an upstream/shared source do not propagate;
2. if one or more applicable binding candidates exist for an instruction ID, the furthest-upstream binding candidate wins;
3. otherwise, the nearest candidate wins;
4. resolution is deterministic;
5. ties or invalid source precedence produce explicit diagnostics rather than silent arbitrary behaviour;
6. local source files are not rewritten simply because a binding shared rule wins;
7. the user can inspect why a local adaptation did or did not apply.

A later slice must also ensure binding instructions enter every applicable Set-up even when the local profile did not explicitly include their IDs.

## Privacy boundary

Managed shared practice must not become an individual-compliance dashboard.

Managed Rack may know what an organisation publishes, its versions, rationales, review dates and who can publish.

It should not need to know which adaptable defaults an individual changed, which non-binding Starter modules they use, or their local-only instructions.

Local adaptation remains local unless the user explicitly publishes it.

## Field Station

The Field Station fork has demonstrated useful generic capabilities: authority, layered resolution, provenance, conflict explanations, local-adaptation privacy, update review and a proposition-based first-run experience.

Those generic capabilities should converge into Rack core.

Field Station-specific VSM language and experiments can remain an opinionated downstream package or shell. The long-term goal is to avoid two independent schemas, compilers and evaluators.

## Proposed implementation sequence

- **Iteration 15** — finish the existing model-backed Reliable evaluation branch.
- **Iteration 16** — v0.2 practice-source and authority foundation.
- **Iteration 17** — shared practice files and source materialisation.
- **Iteration 18** — resolved shared-practice desktop UX.
- **Iteration 19** — proposition-based first run, backed by canonical source.
- **Iteration 20** — plain-language/copy and accessibility system.
- **Iteration 21** — review dates, lapse and experiments.
- **Iteration 22** — optional Git-backed practice source transport.

This sequence may move as implementation evidence changes, but the separation between source materialisation, resolution and compilation is the architectural constraint.
