# Iteration 30 — verification plans

## Outcome

Turn Rack's existing enforcement and task acceptance metadata into an explicit, inspectable plan for checking real work.

Iteration 30 does **not** add host hooks or execute checks. It establishes the source contract, compiler boundary, diagnostics and desktop explanation needed before execution is safe.

## Why

Important working practice currently risks falling into one of two weak patterns:

1. repeat an instruction in the model context and hope it is remembered;
2. translate a semantic expectation into brittle deterministic code.

Rack should distinguish what software can establish from what still requires judgement.

The target flow is:

**practice → instruction → evidence → verification → gate**

with deterministic software around any probabilistic judgement.

## Structured verification

Module schema 0.2 can now contain harness.verification.

Three step kinds are supported.

### Automatic

A named trusted verifier plus a factual requirement:

~~~yaml
verification:
  - id: repository-checks
    kind: automatic
    label: Repository checks pass
    check: repository-checks
    requirement: Run the repository's trusted tests, type checks and build checks successfully.
    evidence: [test-results, build-results]
    on_fail: block
~~~

The check value is an identifier, not executable code.

### Judgement

An explicit semantic question over a bounded evidence bundle:

~~~yaml
verification:
  - id: meaningful-tests
    kind: judgement
    label: Tests cover the change
    question: Do the tests meaningfully exercise the behaviour introduced by this change?
    evidence: [diff, test-results]
    on_fail: block
    on_uncertain: human_review
~~~

### Human

An explicit review point:

~~~yaml
verification:
  - id: consequential-change
    kind: human
    label: Consequential changes are approved
    prompt: Review any compatibility or security consequence before completion.
    evidence: [diff]
    required_for_completion: true
~~~

## Enforcement relationship

Structured verification does not replace enforcement.

The two layers now have distinct roles:

- instruction — carry practice into the AI host;
- output_check — declare automatic verification;
- rubric_eval — declare semantic judgement;
- human_review — declare a human decision point;
- adversarial_eval — exercise practice through evaluation;
- host_policy — use a host-enforced rule where supported.

A structured automatic step requires output_check; a judgement step requires rubric_eval; a human step requires human_review.

## Verification Plan

The core package now exposes buildVerificationPlan(project, profileId).

It resolves the same effective Set-up used by builds, including shared-practice resolution upstream, then returns:

- configured automatic checks;
- configured AI judgements;
- configured human reviews;
- task acceptance suite references;
- declared verification modes which still lack a concrete step;
- ordinary Rack diagnostics;
- summary counts.

The plan is target-neutral. Claude Code, Codex and other hosts do not each invent verification semantics.

## Legacy declarations

Existing Rack source often contains:

~~~yaml
enforcement: [instruction, output_check]
~~~

without saying what output_check actually means.

Rack keeps that source valid. The Verification Plan adds warning RACK-VERIFY-001 so the gap is visible without breaking builds.

## Guided starting practice

The guided routes now demonstrate the distinction.

Writing and Research evidence boundaries use semantic judgement rather than pretending evidence quality is a deterministic string check.

Coding safety combines:

- a named automatic repository check;
- a semantic safe-change/veracity judgement;
- the existing task acceptance-suite reference.

This is planning metadata only in Iteration 30.

## Desktop

Instruction cards now explain:

- **How this is applied** — for example AI guidance or a host rule;
- **How this is checked** — automatic check, AI judgement or human review, including declared-but-unconfigured checks.

Set-up cards summarise the compiled Verification Plan and acceptance-suite references.

## Security boundary

Shared practice remains data.

A shared publication can name repository-checks; it cannot include a shell command, script or plug-in which Rack silently executes.

Later execution must map identifiers to a locally trusted verifier registry.

## Acceptance

1. schema 0.2 supports automatic, judgement and human verification;
2. schema 0.1 cannot silently gain structured verification semantics;
3. each structured step requires the matching enforcement declaration;
4. a Set-up compiles one target-neutral Verification Plan;
5. task acceptance suites are carried into that plan;
6. legacy enforcement remains valid and produces a visible warning;
7. verification metadata does not alter generated destination instructions;
8. guided Writing/Research use semantic judgement for semantic evidence questions;
9. guided Coding demonstrates deterministic + semantic verification together;
10. desktop explains how practice is applied and checked;
11. no shared/Starter content gains executable code;
12. no automatic or model-backed verification is executed in this iteration.

## Next

Iteration 31 should execute one bounded judgement gate by reusing Rack's existing model registry, preflight/cost controls, model runner and transient-content privacy boundary. It must return pass/fail/uncertain/incomplete and must not depend on the working agent's conversation context.
