# Iteration 27 — desktop shared-practice publisher

## Outcome

Make shared-file publishing usable without the command line.

Iteration 25 established the safe publication contract in core and CLI. Iteration 27 reuses that exact contract in the desktop.

The desktop does not invent a second publication format or weaker validation path.

## Two distinct jobs

The Shared practice area now supports two separate actions:

1. **Publish practice from this Rack**;
2. **Receive shared practice from another source**.

They appear in the same area because both concern shared practice, but their data boundaries are deliberately different.

## Local source only

Desktop publishing always receives the canonical local `project`.

It does not receive the effective project after shared-practice resolution.

This means publishing cannot accidentally re-publish:

- an organisation's binding instruction which the user merely received;
- an adaptable shared default;
- another source's experiment;
- other external practice which happens to be active in the current Set-up.

If a user wants to publish an adapted version, that adaptation must exist in their local Rack source first.

## Explicit selection

Nothing is selected automatically.

The publisher chooses individual local instructions.

Each row shows:

- title;
- instruction ID;
- binding/adaptable authority;
- criticality.

`local-only` instructions are visible but disabled with an explanation that they stay local.

Rack does not offer a one-click "publish this Set-up" action.

## Publication details

The desktop asks for the same metadata as the core publisher:

- file ID;
- semantic version;
- title;
- description;
- publisher name;
- optional organisation;
- optional licence.

Values are initially derived from the local Rack manifest where sensible.

## Review before save

Before choosing a file location, the user reviews:

- publication title/version;
- instruction count;
- exact selected instructions;
- authority of each selected instruction;
- the complete generated shared-practice file.

The generated content has already round-tripped through receiver materialisation.

## Safe file writing

The desktop uses a dedicated Tauri write command.

It:

- enforces the existing 5 MB shared-practice limit;
- writes via a temporary file;
- refuses symlink and non-file replacement;
- refuses existing files by default;
- only replaces an existing ordinary file when the user explicitly enables replacement;
- backs up the old file and restores it if final replacement fails.

This makes repeated publication to a synced organisation file practical without silently overwriting an existing publication.

## Distribution

After saving, Rack tells the publisher to share the file through the place the organisation already uses.

Rack still does not host or distribute the file itself in this iteration.

That keeps OneDrive, Google Drive, Dropbox, Nextcloud and shared network folders as first-class ordinary transports.

## Copy/accessibility guardrail

The new publisher surface is included in the ordinary desktop copy audit.

It therefore inherits Iteration 24's plain-language, British English and no-hype checks.

## Deliberately deferred

- multiple simultaneous received practice sources;
- publication history;
- automatic version recommendations;
- signing;
- managed hosting;
- Git-backed publishing;
- organisation/member administration.

## Acceptance

1. ordinary desktop users can publish without a terminal;
2. publication uses local canonical source, not resolved external practice;
3. module selection is explicit;
4. local-only modules cannot be selected;
5. the core publisher remains the validation/serialisation authority;
6. exact generated content is reviewable before save;
7. existing output is not replaced by default;
8. replacement requires an explicit desktop choice;
9. symlink/non-file replacement is refused;
10. the receiver file format remains unchanged.
