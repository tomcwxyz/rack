# ADR-022 — Separate instruction, verification and evaluation

## Status

Accepted for Iteration 30.

## Context

Rack already carries working practice into AI hosts and can evaluate a Set-up through Quick and Reliable checks. Those are different jobs.

A working practice such as "add appropriate tests and explain security implications" contains several kinds of expectation:

- guidance that the working model should receive;
- facts that deterministic software can establish;
- semantic questions that need bounded model judgement;
- decisions which should remain with a person.

Treating all four as prompt text makes important practice depend on the model remembering it. Treating all four as deterministic code produces brittle keyword and regular-expression checks which cannot establish meaning.

## Decision

Rack keeps three planes separate.

### Instruction

Instruction tells the working AI what practice to follow.

It is compiled into the selected destination through the existing adapter system.

### Verification

Verification asks whether the real work satisfies active practice.

A module may define structured verification steps:

- **automatic** — a named, locally trusted verifier establishes a deterministic fact;
- **judgement** — a bounded model invocation answers an explicit semantic question from a limited evidence bundle;
- **human** — a person must review an explicit question or consequence.

Iteration 30 compiles these declarations into a target-neutral Verification Plan. It does not execute them yet.

### Evaluation

Evaluation tests whether the Rack itself produces useful, reliable behaviour across representative cases.

Quick and Reliable evaluation remain separate from live verification. Reliable evaluation can later be used to test whether a judgement rule is itself dependable.

## Source boundary

Structured verification is additive module schema 0.2 metadata.

Shared practice may declare:

- the verification kind;
- a trusted verifier identifier;
- a semantic question;
- the evidence categories required;
- fail/uncertain behaviour.

Shared or Starter practice may **not** ship arbitrary executable verifier code.

A receiver or host maps a named automatic check onto code it already trusts. This keeps shared-practice files and Starter content inspectable data rather than an executable plug-in channel.

## Uncertainty

Semantic verification must preserve uncertainty.

A future judgement executor must distinguish:

- pass;
- fail;
- uncertain;
- incomplete execution.

Uncertain is not silently converted to pass. Source can choose to block, warn or require human review.

## Backwards compatibility

Existing enforcement declarations remain valid.

When a module requests output_check, rubric_eval or human_review without a corresponding structured verification step, the Verification Plan reports a warning rather than changing existing build behaviour.

Existing source and destination output therefore remain usable while verification becomes progressively more explicit.

## Consequences

This gives Rack a path from exhortation to a real harness without pretending semantic work is deterministic.

It also means:

- destination adapters remain responsible for guidance, not verification execution;
- verification can run with fresh, bounded context rather than relying on the working conversation;
- shared organisational practice can require a kind of verification without installing code on receivers;
- model-backed verification can reuse the existing managed model registry, privacy boundary and paid-work safeguards later;
- verification rules can themselves be evaluated through the existing Reliable evaluation machinery.

## Deferred

- execution of automatic checks;
- managed judgement calls;
- host event hooks;
- automatic repair/retry loops;
- verifier registry and host capability negotiation;
- historical verification records;
- team compliance reporting.
