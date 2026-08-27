# Iteration 25 — shared-practice publisher

## Outcome

Complete the first shared-file lifecycle from both sides.

Before this iteration RACK could:

- parse shared practice;
- resolve it with local practice;
- attach it in the desktop;
- remember an accepted snapshot;
- detect updates;
- show tightening changes;
- accept or decline incoming versions.

But a publisher still had to assemble the YAML envelope manually.

Iteration 25 adds a safe core publication function plus CLI workflows for exporting and inspecting shared practice.

## Design principle

> Distribution should not be easier than consent about what is being distributed.

RACK therefore requires explicit instruction selection.

It does not offer "publish this Set-up" as the default publisher operation.

A Set-up can include:

- user-specific context;
- local-only practice;
- imported material;
- instructions which happen to be useful locally but are not organisational policy/defaults.

Selecting modules explicitly makes the publication boundary visible.

## Core publisher

`createSharedPracticePublication(project, input)` takes:

- document ID;
- semantic version;
- title and optional description;
- publisher name and optional organisation;
- optional licence;
- explicit module IDs.

It returns:

- parsed shared-practice document;
- YAML content;
- selected source modules;
- diagnostics;
- blocked/unblocked state.

The selected modules are emitted in deterministic ID order.

## Validation

Core blocks publication when:

- no modules are selected;
- a module ID is repeated;
- a module cannot be found;
- an ID resolves to more than one source module;
- a selected module is `local-only`;
- document metadata is invalid.

After serialisation, core feeds the generated YAML through `materializeSharedPractice`.

That catches the same atomic publication failures the receiver would see, including invalid module semantics or a binding instruction without the required shared rationale.

Publisher and receiver therefore share one acceptance contract.

## Normalised output

The first publisher serialises the parsed Rack module representation.

That means defaults which were implicit in the source module may be explicit in the shared YAML.

This is intentional for the first version:

- semantics are preserved;
- output is deterministic;
- output is inspectable;
- publisher/receiver round-trip is simple.

A later formatting pass can make the publication terser without changing the file format.

## CLI: inspect

```bash
rack practice inspect practice.rack.yaml
rack practice inspect practice.rack.yaml --json
```

Human-readable inspection reports:

- title and version;
- publisher;
- instruction count;
- binding/adaptable counts;
- experiment count;
- review-date count;
- diagnostics.

JSON inspection additionally reports each module's:

- ID;
- title;
- type;
- criticality;
- authority;
- review date;
- experiment learning question.

Invalid shared practice returns a non-zero status.

## CLI: export

Example:

```bash
rack practice export . \
  --id example-org \
  --version 1.0.0 \
  --title "Example organisation practice" \
  --publisher "Practice team" \
  --organisation "Example Organisation" \
  --license CC-BY-4.0 \
  --module guardrail.evidence \
  --module method.decision-notes
```

With no `--output`, stdout contains the generated YAML.

This makes review, diffing and shell redirection possible before RACK writes a file.

### File output

```bash
rack practice export . ... --output example-org.rack.yaml
```

RACK:

- creates the parent folder when necessary;
- writes via a temporary file;
- refuses to overwrite an existing output by default.

To replace an existing publication:

```bash
rack practice export . ... \
  --output example-org.rack.yaml \
  --force
```

Even with `--force`, RACK only replaces an ordinary file.

It refuses symlinks and non-file destinations.

When replacing an ordinary file, it temporarily moves the old output aside and restores it if the final rename fails.

## Machine-readable workflows

Both inspect and export support `--json`.

When export writes no file, JSON can include the generated content.

When export writes a file, JSON returns the output path and publication summary rather than duplicating the entire YAML.

## Experiments and review dates

The publisher does not special-case experiments.

They are ordinary schema 0.2 modules, so their:

- adaptable authority;
- review date;
- learning question;

travel through the same publication and round-trip validation.

Binding rationale and review metadata are likewise preserved.

## What the publisher does not control

The shared publication still cannot choose receiver-owned:

- source precedence;
- organisation/team/project relationship;
- acceptance;
- local adaptations;
- local-only practice.

Those remain receiver concerns from Iterations 16–21.

## Privacy

No publication action reports back which people later:

- attach the file;
- accept an update;
- adapt an adaptable instruction;
- keep or remove optional practice.

The CLI creates an artefact. It does not create a reporting channel.

## Deliberately deferred

- desktop publisher UI;
- publish-from-Set-up convenience with an explicit privacy review;
- signing publications;
- managed publication hosting;
- Git-backed publication transport;
- publication history/changelog generation;
- automatic semantic-version recommendations.

## Acceptance

1. publisher requires explicit module selection;
2. missing, repeated and local-only modules block;
3. output ordering is deterministic;
4. generated YAML round-trips through receiver materialisation;
5. binding rationale is preserved;
6. experiment learning questions/review dates are preserved;
7. inspect reports valid and invalid files;
8. stdout remains the default export destination;
9. file overwrite requires explicit `--force`;
10. symlink/non-file overwrite is refused.
