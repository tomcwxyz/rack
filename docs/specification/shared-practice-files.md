# Shared practice files

**Status:** Iteration 17 implementation contract  
**Date:** 27 August 2026

## Purpose

A shared practice file is the simplest organisational transport for Rack practice.

It is one inspectable YAML file which can be distributed through infrastructure an organisation already uses: OneDrive, Google Drive, Dropbox, Nextcloud, a shared network folder, email or chat.

Rack does not need to run a control plane in order for shared practice to work.

The file is a transport. After parsing, its instructions become ordinary Rack modules and enter the same source-resolution stage as local, Starter and later Git/managed sources.

## File extension

Use:

```text
.rack.yaml
```

The extension is a convention rather than a security boundary. Rack still validates the file format before applying it.

## Envelope

Version 0.1:

```yaml
format: rack.shared-practice
schema_version: "0.1"

id: good-ship
version: 0.1.0
title: The Good Ship practice
description: Shared working practice for AI-supported work.

published_by:
  name: The Good Ship

license: CC-BY-4.0

instructions:
  - type: guardrail
    title: Evidence boundaries
    harness:
      schema_version: "0.2"
      id: guardrail.evidence
      version: 0.2.0
      criticality: required
      authority:
        mode: binding
        propagation: shared
        rationale: Public-facing work must distinguish evidence from inference.
      rules:
        - id: evidence
          statement: Distinguish evidence from inference.
    body: |
      Make the source of important claims clear.

  - type: voice
    title: Plain language
    harness:
      schema_version: "0.2"
      id: voice.plain
      version: 0.2.0
      criticality: recommended
      authority:
        mode: adaptable
        propagation: shared
    body: |
      Prefer direct, concrete language.
```

Each item under `instructions` is a normal Rack module frontmatter object plus a plain-text `body`.

This keeps the shared file close to Rack's canonical module semantics rather than inventing a second instruction language.

## What the publisher controls

The file publisher controls:

- document ID;
- document version;
- title/description;
- publisher attribution;
- licence;
- instruction content;
- instruction criticality;
- instruction authority;
- binding rationale.

A binding shared instruction must explain why it is binding.

A `local-only` instruction cannot be published in a shared file. That is contradictory by definition and blocks the file.

## What the receiver controls

The shared file does **not** contain:

- local source ID;
- source precedence;
- source relationship such as organisation/team/project;
- trust/acceptance state;
- local adaptations.

Those belong to the receiving Rack.

For example, the same published file could be attached by one user as:

```text
source id: good-ship-org
relationship: organisation
precedence: 10
```

and by another test project at a different precedence.

This prevents a publisher from making itself more authoritative simply by editing its own transport file.

## Materialisation

The host reads the file and supplies receiver-owned source metadata.

Conceptually:

```ts
materializeSharedPractice(fileContents, {
  sourceId: "good-ship-org",
  relationship: "organisation",
  precedence: 10,
  filePath: "/shared/good-ship.rack.yaml",
})
```

returns:

- parsed document metadata;
- a `PracticeSource` of kind `shared-file`;
- ordinary `RackModule[]`;
- resolver-ready `PracticeCandidate[]`;
- diagnostics;
- a blocked/unblocked result.

The modules receive deterministic synthetic source paths for internal provenance. The original file path remains on the source metadata.

The Node host also exposes a file reader for an explicitly attached path. It resolves the canonical filesystem path, verifies it is a regular file and then uses the same materialiser. Desktop/Tauri attachment will call into an equivalent host boundary later rather than teaching the compiler about filesystems.

## Resolved Set-ups

Shared-file materialisation produces candidates, not a second compiler path.

Core combines those candidates with the local Rack through the Iteration 16 resolver. The local Rack is assigned the nearest precedence automatically, so adaptable conflicts still favour local practice.

Binding shared instructions need stronger behaviour: when a winning binding instruction applies to a Set-up's domains, Rack adds its ID to the **resolved copy** of that Set-up before the existing compiler runs.

If the local Set-up explicitly excludes that binding ID, the resolved copy removes the exclusion and emits a warning explaining what happened. The local source file remains unchanged.

New adaptable shared instructions are not auto-injected in this iteration. They remain available in the resolved module set but require later activation/acceptance UX before entering a Set-up automatically.

This fixes the important failure mode where an organisation publishes a new binding instruction with a new module ID but an existing user's local Set-up has never heard of that ID.

## Atomic safety

Shared publication is atomic.

If any instruction is invalid, the whole shared file is blocked. Rack must not apply the valid subset and silently ignore the rest.

Iteration 17 blocks for at least:

- unreadable YAML;
- invalid envelope;
- invalid module schema;
- duplicate instruction IDs;
- published `local-only` instructions;
- binding instructions without a rationale;
- invalid receiver-owned source metadata.

This is deliberately stricter than importing a collection of unrelated local files because the shared file represents one published version of organisational practice.

## Versioning

The shared document has its own semantic `version`.

This is distinct from:

- the shared-file envelope `schema_version`;
- each individual module's `harness.version`;
- Rack application releases.

The document version is retained in `PracticeSource.version` so later update review can compare the currently accepted source with an incoming publication.

## Incoming version comparison

Core can compare the currently accepted materialised modules with an incoming version before any update is applied.

Every changed instruction is reported as added, removed or changed. A separate **tightening** flag is raised when the incoming publication:

- adds a binding instruction;
- adds a required instruction;
- changes an adaptable instruction to binding;
- increases criticality;
- removes the review date from an existing binding instruction;
- pushes a binding review date further into the future.

The classifier is deliberately descriptive. It does not decide whether the user should accept the update.

## Desktop acceptance and updates

Iteration 21 turns the source comparison into an explicit local lifecycle.

When a user attaches a valid shared-practice file, Rack stores three pieces of local app state:

- the canonical source path;
- the exact **accepted content snapshot**;
- optional exact content for the most recently declined update.

This state is stored in Rack's application data, not in the Rack project files and not in a managed service.

On opening the Rack, the desktop:

1. restores the accepted snapshot immediately;
2. reads the remembered source path when available;
3. compares current source content with the accepted snapshot;
4. keeps Preview, Export and Checks on the accepted snapshot;
5. presents changed source content as an incoming update;
6. shows instruction changes and flags tightening changes;
7. requires explicit acceptance before the effective Rack changes.

If the source path is unavailable, Rack continues using the last accepted snapshot and shows the read failure.

If an incoming file is invalid, it cannot be accepted and the last accepted snapshot remains effective.

Declining an update remembers the exact incoming content. That exact content is not repeatedly offered. If the source changes again, the newer content is reviewed separately. The user can also explicitly reconsider a declined update.

Rack does not silently rewrite local source or silently adopt a changed shared file.

Filesystem watching remains deferred; Iteration 21 checks on Rack open and on an explicit **Check source** action.

## Managed Rack

Managed Practice can later publish/distribute the same logical document.

That should be another materialisation transport, not a different authority model.

The goal remains:

```text
shared file / Git / Managed Practice
             ↓
       PracticeSource
             ↓
          resolver
             ↓
      ordinary Rack project
```

## Privacy

The shared file says what the publisher is sharing.

It does not report back:

- who adapted an adaptable instruction;
- which optional practice a user kept;
- which local-only instructions they have;
- how often they opened the file;
- whether they complied with a default.

Rack can therefore support managed organisational practice without turning individual working practice into an activity dashboard.
