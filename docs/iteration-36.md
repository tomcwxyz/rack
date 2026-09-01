# Iteration 36 — target-neutral completion gate and host conformance

## Outcome

Iteration 36 turns Rack verification from separate mechanisms into one conservative answer to a practical question:

> Has the work satisfied the completion requirements in this Set-up?

The answer is target-neutral. Hosts may help execute work or surface the result, but they do not define Rack's verification semantics.

## Completion states

The first gate exposes five states:

- **pass** — every required configured step has sufficient passing evidence;
- **fail** — at least one active step blocks completion;
- **review-required** — a person must make or confirm a consequential decision;
- **uncertain** — available evidence did not justify pass or fail;
- **incomplete** — required evidence is missing, malformed, unavailable, or verification is not concretely configured.

The priority is conservative. A blocking failure wins over every other state. A required human review cannot be bypassed by passing automatic checks.

An empty Verification Plan is **incomplete**, not pass.

If a module declares verification through enforcement metadata but does not provide the corresponding structured verification step, an otherwise passing gate remains incomplete.

## Three verification planes

### Automatic

Trusted Rack-owned verifiers establish deterministic facts.

The first executable verifier is `repository-checks`.

Starter and shared practice can request that verifier by ID. They cannot supply the executable command.

### Judgement

A fresh bounded model call answers an explicit semantic question from selected evidence.

The working AI conversation is not reused as verification context.

Pass/fail/uncertain remain distinct.

### Human

A person explicitly records whether the review requirement is satisfied or whether the work needs changes.

Required human review appears in the same completion gate rather than as an informational note beside it.

## Coding Loop Alpha

The first end-to-end coding loop is:

```text
current Rack practice
        |
        v
reviewed host installation
        |
        v
optional reviewed TOPO context
        |
        v
transient host task
        |
        v
work / proposed work
        |
        v
automatic + judgement + human verification
        |
        v
target-neutral completion gate
```

Purpose-bound context remains separate from standing practice throughout the loop.

## First host conformance fixture

The first common fixture covers Claude Code, Codex and OpenCode.

It checks capability truthfulness rather than output similarity.

For every host, Rack asks:

1. can standing practice be delivered without changing canonical Rack source?
2. can transient task context be delivered without being written into standing practice?
3. is the transient channel genuinely implemented or only planned?
4. does Rack report unsupported capability as degradation rather than pretending file generation is integration?

Current first-slice result:

| Host | Standing practice | Transient context | First runtime mode |
| --- | --- | --- | --- |
| Claude Code | supported | supported | read-only / plan |
| Codex | supported | supported | read-only / ephemeral |
| OpenCode | supported | planned | not yet enabled |

## Persistence boundary

The gate is currently task-local UI state.

Rack deliberately does **not** yet create a historical per-person verification record.

Before durable attestations are added, they need a useful work/artefact binding so that the stored object can say what was verified without becoming behavioural exhaust.

A future local attestation should store only bounded result metadata, such as:

- Rack/practice fingerprint;
- Set-up;
- work/artefact fingerprint;
- gate result;
- verifier kinds/results;
- timestamp.

It should not store:

- user identity as the evaluation subject;
- prompts or conversations;
- TOPO context;
- full verification evidence/logs;
- a longitudinal productivity/compliance score.

## Remaining work

- bind a completion result to a meaningful work/artefact fingerprint before persisting attestations;
- connect host completion hooks only where pass/fail/review/uncertain/incomplete semantics can survive;
- exercise the same real repository/task across Claude Code and Codex, not only static capability fixtures;
- establish a safe OpenCode transient-context route or keep the degradation visible;
- decide whether edit-capable host runtime should be introduced after the read-only pilot;
- improve process-tree termination for timed-out local host/verifier processes;
- extend the CLI with the same inspection and verification semantics where useful.
