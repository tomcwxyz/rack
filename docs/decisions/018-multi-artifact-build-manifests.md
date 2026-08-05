# ADR-018 — Destination-neutral, multi-artifact build manifests

**Status:** Accepted  
**Date:** 5 August 2026

## Context

Iteration 3 introduced a prompt-specific `build.json` containing one fixed `system-prompt.md` artifact. Rack's accepted destination model includes portable single-file targets and richer host packages containing several files. Extending the prompt-only shape independently for each adapter would duplicate installation and drift logic and make provenance inconsistent.

Generated builds are replaceable output rather than canonical Rack source. The manifest format can therefore be revised during pre-release development without migrating project source files.

## Decision

Use one destination-neutral build-manifest schema for every adapter.

The v0.2 generated manifest records:

- destination ID, adapter version and support status;
- compiler version;
- project, Set-up and semantic source digest;
- one or more artifact paths, media types, digests, byte sizes and token estimates;
- package-level token estimate;
- capability degradations;
- included instruction IDs and versions.

Managed output is stored under:

```text
.rack/generated/<destination>/<set-up>/
```

The same installation, backup and drift model applies to single-file and multi-file destinations. Prompt compatibility remains available through wrapper functions while UI and CLI move to the destination-neutral API.

## Consequences

- Prompt and `AGENTS.md` builds can coexist.
- Rich adapters can add files without inventing another manifest shape.
- Existing pre-release v0.1 generated prompt manifests are treated as unverifiable and should be rebuilt; canonical Rack source is unaffected.
- Every adapter version change and artifact change remains visible through golden fixtures and build inspection.
- Adding a destination does not permit Rack to activate tools or services.
