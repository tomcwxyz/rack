# Iteration 18 — Desktop shared practice attachment

## Outcome

Make the Iteration 17 shared-practice model visible and usable in the Rack desktop application without changing the local-authoring contract.

A user can attach one `.rack.yaml` shared-practice file for the current desktop session, inspect what it contains and see it applied consistently to Preview, Export and Checks.

## Source boundary

The desktop deliberately holds two project views:

- **local project** — the files the user owns and edits;
- **resolved project** — the local project composed with the attached shared-practice candidates.

Local authoring continues to use the local project:

- Your Rack;
- Set-ups;
- guided/source editors;
- Starter imports;
- Library.

Behavioural/build surfaces use the resolved project:

- Preview;
- Export/install;
- managed Checks.

This prevents shared organisational instructions from being copied into or silently rewriting personal Rack source.

## Attachment

The first slice supports one attachment per open Rack session.

The user chooses a YAML file with the native file dialog. Tauri reads it through a dedicated read-only command which:

- rejects symlinks;
- requires an ordinary file;
- canonicalises the path;
- applies a conservative size limit;
- returns the text to the existing TypeScript shared-practice materialiser.

The attachment is not persisted yet. Opening another Rack resets it.

## Shared practice section

A new **Shared practice** workspace area shows:

- publisher and shared-document version;
- exact source path;
- whether the file is blocked;
- instruction count;
- binding/adaptable count;
- each instruction's ID, criticality and authority;
- binding rationale;
- resolution messages where shared binding practice changes a Set-up.

A blocked shared file remains visible for diagnosis but is not composed into the resolved project.

## Resolution

The desktop calls the same `resolvePracticeProject` used by core tests.

As a result:

- local adaptable practice remains nearest;
- applicable shared bindings enter resolved Set-ups;
- a local exclusion cannot suppress a binding rule in Preview/Export/Checks;
- local YAML remains untouched.

## Deliberately deferred

- remembering attachments across restarts;
- file watching;
- accepted/declined incoming version state;
- incoming update review UI;
- selecting organisation/team relationship or multiple source precedence;
- multiple simultaneous shared sources;
- activation UI for newly introduced adaptable defaults;
- Managed Practice sync;
- Git-backed desktop sources.

Those should build on this working local attachment path rather than introducing a second resolution flow.
