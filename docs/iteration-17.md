# Iteration 17 — Shared practice files

## Outcome

Make shared organisational practice usable without Git or Managed Rack by introducing one plain-text `.rack.yaml` transport which materialises into the generic practice-source/resolution model from Iteration 16.

## Product intent

An organisation should be able to publish practice through infrastructure it already has.

A normal receiving user should not need:

- Git;
- a terminal;
- a Rack account;
- a central Rack control plane.

The initial transport is therefore a shared file.

## This iteration

### File contract

Add a strict shared-practice envelope containing:

- format/schema version;
- publisher document ID;
- semantic document version;
- title/description;
- publisher attribution;
- optional licence;
- inline Rack instructions.

### Materialisation

Add a pure core materialiser which:

- parses YAML;
- validates the envelope;
- validates every embedded Rack module;
- creates receiver-owned `PracticeSource` metadata;
- preserves document version and file path;
- creates deterministic synthetic module paths;
- returns resolver-ready candidates.

### Safety

Publication is atomic.

Any error blocks the complete source, including:

- malformed YAML;
- bad envelope;
- invalid instruction;
- duplicate IDs;
- a published `local-only` instruction;
- a binding instruction without a rationale.

### Authority boundary

The publisher controls instruction authority.

The receiver controls source identity, precedence and relationship.

Those fields are intentionally absent from the shared file.

### Incoming version comparison

Compare the currently accepted and incoming materialised modules by ID.

Ordinary additions, removals and content changes are reported separately from **tightening** changes. The first tightening classifier calls out:

- a newly added binding instruction;
- a new required instruction;
- an adaptable instruction becoming binding;
- increased instruction criticality;
- a binding review date being removed;
- a binding review date being pushed further out.

This is local comparison metadata for the future update-review UI. It does not accept or apply an update automatically.

### Resolved project integration

Combine the local Rack modules with external practice candidates before compilation.

The local Rack is always treated as the nearest source for adaptable conflicts. Applicable binding instructions from shared-file/Git sources are added to the **resolved copy** of each Set-up even if the local profile never explicitly included them.

If a local Set-up excludes an applicable binding shared instruction, the resolved copy removes that exclusion, includes the binding instruction and emits a warning. The user's YAML remains untouched.

New adaptable shared instructions are **not** automatically injected in this iteration. Their activation/acceptance belongs in the later desktop shared-practice UX rather than being silently imposed.

### File host boundary

The Node host can read an explicitly attached shared-practice path, canonicalise it and materialise it through the same core parser. Desktop/Tauri attachment remains a later host integration.

## Deferred

- filesystem watching;
- accepted-version state;
- desktop attach/remove/update UI;
- CLI export/publish command;
- Git transport;
- Managed Practice transport.

## Acceptance tests

1. valid shared YAML materialises into ordinary Rack modules;
2. source path/version/provenance are retained;
3. receiver precedence is not read from publisher YAML;
4. binding and adaptable instructions retain canonical v0.2 authority;
5. one bad instruction blocks the whole publication;
6. duplicate IDs block atomically;
7. local-only content cannot be published;
8. binding shared content requires a rationale;
9. resulting candidates can be handed directly to the Iteration 16 resolver;
10. ordinary incoming changes are distinguished from tightening changes;
11. applicable shared bindings enter the resolved Set-up without changing local YAML;
12. a local exclusion cannot suppress a binding shared instruction in the resolved build;
13. new adaptable shared instructions are not silently auto-injected;
14. existing v0.1 local projects continue unchanged.
