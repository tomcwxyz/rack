# Iteration 8 — Curated Starter library and safe imports

## Outcome

Rack now includes a bundled Starter library that can be browsed, inspected and copied into an ordinary local Rack. The first catalogue contains 35 reusable instructions and six starting templates across shared practice, Writing and communications, Research and knowledge work, and Coding and technical work.

## Package boundary

Starter content lives in `@rack/starter`, separate from the application and compiler. The package owns catalogue metadata, exact Markdown/YAML source, deterministic digests, attribution, filtering and templates. It does not own file-system writes or external catalogue access.

Import planning lives in `@rack/core/starter`. Applying a reviewed plan remains a separate Node or Tauri operation. This keeps content discovery separate from the ability to change a local Rack.

## Content and licensing

Starter entries carry ordinary Rack source metadata:

```yaml
source:
  origin: rack-starter
  license: CC BY 4.0
```

Where an entry adapts an attributed method or guidance source, Rack shows that attribution before import and copies it into Markdown frontmatter comments so it remains attached to the local source. The bundled content package carries its own CC BY 4.0 notice; application code remains Apache-2.0.

An imported instruction is copied into `modules/starter/` and then behaves like any other local Rack source. It is not kept as an opaque package reference and is never silently refreshed from the bundled catalogue.

## Catalogue

The 35 instructions cover shared context, voice, structure and evidence practice; Writing craft and client communication; Research framing, source assessment, synthesis and comparison; and Coding repository context, implementation, testing, compatibility and review.

The six templates are:

1. Clear everyday writing
2. Client communication
3. Evidence review
4. Decision research
5. Careful code change
6. Repository review

Templates are curated selections of catalogue IDs. They use the same review and import path as selecting individual instructions.

Every entry is built from structured metadata, validated with the existing Rack instruction schema and rendered to deterministic source. Each entry also has a deterministic `fnv1a64-u16:` digest for catalogue comparison and identity checks. It is not a cryptographic trust mechanism.

Tests verify the catalogue size and unique IDs, schema validation, template references, stable ordering and digests, and deterministic filtering.

## Import planning

CLI and desktop use the same `planStarterImport` function. Each selected entry is reported as one of four states:

- **ready** — the ID is absent and the target path is free;
- **identical** — the same ID already exists with identical normalised source;
- **changed** — the same known ID exists but its local source differs from the bundled version;
- **conflict** — the proposed target path is already occupied by different Rack content.

A changed ID or conflict blocks the whole import. Rack does not replace or merge local source in this iteration.

A user can optionally add the selected IDs to a Set-up. Rack prepares a loss-aware YAML patch and shows the exact Set-up diff before writing it. If that Set-up explicitly excludes a selected ID, the import is blocked instead of quietly reversing the local choice.

## Applying a reviewed plan

The CLI and desktop application both re-check the local Rack before applying a plan. New Starter files are limited to the expected `modules/starter/` location, an occupied destination stops the import, and a Set-up is only replaced when its current source still matches the version that was reviewed. Writes are staged so a failed final write can remove newly created Starter files and restore the prior Set-up.

Importing Starter content does not change generated destination packages or application configuration.

## CLI

Browse and inspect:

```bash
rack library list
rack library list --route research
rack library list --type guardrail --tag evidence
rack library list --templates
rack library show @rack-starter/method.source-assessment
rack library show evidence-review
```

Review without changing files:

```bash
rack library add @rack-starter/voice.plain-language --path ./my-rack
rack library add --template client-communication --path ./my-rack --profile writing
```

Apply after review:

```bash
rack library add @rack-starter/voice.plain-language --path ./my-rack --apply
rack library add --template client-communication --path ./my-rack --profile writing --apply
```

`--json` is available for list, show and add operations. The add command reports `applied: true` only after the write succeeds.

## Desktop

The Library workspace now provides search and route/type filters, the six templates, multi-select catalogue cards, exact source and attribution inspection, optional Set-up inclusion, an explicit change review, and a separate final import action.

The UI refreshes the project snapshot immediately before planning and receives a fresh snapshot after a successful import.

## Deliberately deferred

This iteration does not include remote or community catalogues, background catalogue updates, automatic replacement of edited local modules, three-way catalogue merging, or executable extensions. Those require separate provenance and update designs rather than being folded into the local content import path.
