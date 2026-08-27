# Iteration 21 — shared-practice lifecycle

## Outcome

Turn shared-practice attachment from a session-only preview into a stable, explicit local lifecycle.

A Rack can remember one accepted shared-practice source across desktop restarts, continue using the last accepted content when the source changes or becomes unavailable, and review incoming updates before they affect Preview, Export or Checks.

## Core rule

**The accepted snapshot is the effective shared practice. The current file on disk is only a candidate update.**

This prevents an organisation, sync client or accidental edit from changing a user's effective Rack merely by replacing a file in OneDrive, Google Drive, Dropbox, Nextcloud or another shared folder.

## Local state

The desktop stores a small versioned record in the Rack application's data directory.

Version 0.1 contains:

- source path;
- exact accepted shared-practice content;
- optional exact content of the most recently declined update.

The state is keyed by the canonical Rack project path.

It is not written into:

- `rack.yaml`;
- Set-up YAML;
- module source;
- generated destinations;
- the managed service.

The accepted content is stored because the source may change or temporarily disappear. Rack must still be able to reproduce the practice the user explicitly accepted.

## Open behaviour

When a Rack opens:

1. load its local shared-practice state;
2. materialise the accepted snapshot;
3. use that snapshot for shared-practice resolution;
4. read the remembered source path;
5. compare the source with accepted content;
6. if unchanged, do nothing;
7. if changed, present the source as an incoming update.

The external source never becomes effective merely because it was read successfully.

## Incoming updates

A valid incoming file is compared with the accepted materialised modules using the Iteration 17 classifier.

The desktop shows:

- accepted version → incoming version;
- added, removed and changed instruction IDs;
- whether the update tightens practice;
- reasons for tightening.

Current tightening reasons include:

- new binding instruction;
- adaptable → binding;
- new required instruction;
- increased criticality;
- binding review removed;
- binding review pushed later.

Metadata-only publication changes can also be accepted even when materialised instructions are unchanged.

## Invalid incoming content

If the remembered source changes to invalid shared-practice content:

- the incoming content is shown as invalid;
- it cannot be accepted;
- the last accepted snapshot remains effective;
- the user can keep the current accepted version and ignore that exact invalid content.

## Accept

Accepting an incoming update:

- replaces the stored accepted content with the incoming content;
- clears declined-content memory;
- immediately re-resolves Preview, Export and Checks from the new accepted snapshot.

Local Rack source remains unchanged.

## Keep current

Keeping the current accepted practice:

- leaves the accepted snapshot unchanged;
- stores the exact incoming content as declined;
- suppresses that exact content on future opens/checks.

If the source changes again, the new content is reviewed independently.

A user can explicitly choose **Review this update again** to clear decline memory.

## Source unavailable

If the source path cannot be read:

- the accepted snapshot remains effective;
- the desktop shows that the source is unavailable;
- no practice is silently removed.

This makes the shared file a distribution mechanism rather than a runtime dependency.

## Persistence implementation

Tauri owns the local state file.

The implementation:

- resolves Rack's app-data directory through the Tauri path API;
- stores one JSON map keyed by canonical project path;
- rejects a symlink/non-file state path;
- applies the existing 5 MB per-content limit;
- writes via a temporary file and backup/replace sequence.

The frontend receives only the state record through dedicated commands.

## Desktop interaction

The Shared practice area now supports:

- restored accepted attachment;
- **Check source**;
- **Replace**;
- **Detach**;
- incoming change review;
- tightening warnings;
- **Use this update**;
- **Keep current**;
- **Review this update again**;
- source-unavailable fallback.

## Privacy

Shared-practice lifecycle state is local application data.

Rack does not report:

- whether the user accepted or declined an update;
- which adaptable instructions they use;
- local adaptations;
- how often the source is checked.

Managed Practice can later distribute the same logical source/update payload, but acceptance state remains a user/workspace concern unless a future product decision explicitly changes that boundary.

## Deliberately deferred

- filesystem watching;
- multiple simultaneous shared-practice sources;
- organisation/team relationship selection in desktop UI;
- user-defined source precedence;
- update history and rollback beyond the current accepted snapshot;
- Managed Practice publishing/distribution;
- Git-backed desktop transport.

## Acceptance tests

1. accepted content remains effective when the source changes;
2. valid changed content becomes incoming rather than effective;
3. tightening is classified before acceptance;
4. exact declined content is suppressed;
5. newer content after a decline is offered;
6. declined content can be reconsidered;
7. accepting replaces the accepted snapshot;
8. source read failure retains accepted practice;
9. invalid incoming content cannot replace accepted practice;
10. Preview, Export and Quick/Reliable Checks continue to resolve from the accepted snapshot.
