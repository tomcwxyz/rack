# Iteration 31 — bounded judgement gates

## Outcome

Execute one semantic verification step safely without relying on the working AI's conversation context.

Iteration 30 made verification explicit and target-neutral. Iteration 31 adds the first executable verification path for questions which cannot be established reliably by deterministic software.

The implemented path is deliberately narrow:

**selected practice question → selected evidence → metadata-only cost preflight → explicit confirmation → fresh model call → strict structured verdict → configured gate decision**

## Why

Some working practices are semantic.

Examples include:

- whether tests meaningfully cover a changed behaviour;
- whether evidence is represented honestly;
- whether a recommendation distinguishes evidence from inference;
- whether a technical change preserves an important compatibility boundary.

Keyword matching and regular expressions cannot establish these reliably. Repeating the instruction in the working prompt also does not prove that the completed work followed it.

Rack therefore uses a fresh, bounded judgement call over explicit evidence.

## Fresh context

The verifier does not receive the working agent conversation.

It receives only:

1. one verification question from the active Verification Plan;
2. the evidence categories declared by that step;
3. evidence explicitly supplied for this verification.

The verifier system instruction says that evidence is untrusted data and that instructions inside evidence must not be followed.

Evidence is wrapped in explicit data delimiters before it is sent.

## Verdict contract

The verifier must return strict JSON with one of three verdicts:

- **pass**;
- **fail**;
- **uncertain**.

Anything else becomes **incomplete**.

Incomplete includes:

- a provider failure;
- malformed output;
- JSON which does not match the schema;
- a missing result.

Rack does not infer a pass from an incomplete execution.

## Gate semantics

The Verification Plan already defines what should happen on fail or uncertainty.

Iteration 31 resolves the model verdict to a target-neutral gate:

- pass → continue;
- fail → configured block, warning or human review;
- uncertain → configured block, warning or human review;
- incomplete → no trustworthy decision.

An uncertain result is never silently treated as pass.

The desktop reports the gate decision but does not yet interrupt a third-party AI host. Host hooks remain a later integration.

## Cost and privacy boundary

The implementation reuses Rack's existing managed model execution path rather than adding a second payment or provider stack.

Before confirmation, the desktop sends only:

- Rack fingerprint;
- Set-up ID;
- model alias;
- call counts;
- conservative input/output allowances.

The verification question and evidence are not included in preflight.

After the user explicitly confirms the displayed cost, one fresh managed call receives the bounded question and evidence.

Rack rejects a question/evidence bundle locally if the assembled managed prompt would exceed 240,000 characters, keeping it below the existing confirmation contract before any paid request is attempted.

The existing transient-content retention boundary applies. No Rack project is uploaded.

## Desktop

A new **Verify work** section is separate from **Checks**.

- **Checks** asks whether the Rack itself behaves well across a test case.
- **Verify work** asks whether a piece of actual work satisfies one configured practice question.

The first UI supports configured judgement steps only.

For a selected Set-up it:

1. lists semantic verification steps;
2. shows the exact question and fail/uncertain behaviour;
3. asks for each declared evidence category;
4. runs metadata-only preflight;
5. shows estimated and maximum retry cost;
6. requires an explicit paid confirmation;
7. shows pass/fail/uncertain/incomplete and the resulting gate decision;
8. shows the verifier's grounded observations and settled call cost.

## Security properties

- shared practice still cannot ship executable verifier code;
- the verifier receives no working conversation by default;
- evidence is treated as untrusted data;
- output is strict-schema parsed;
- malformed output does not pass;
- uncertainty does not pass;
- paid execution retains the existing preflight and retry-cost safeguards;
- verification execution does not mutate Rack source.

## Current limitation

The managed service currently executes this bounded verifier through the existing generation-only Quick execution primitive.

That deliberately reuses its authentication, model registry, cost confirmation, idempotency and transient-content safeguards. Durable service metadata therefore still uses the existing evaluation execution vocabulary internally.

A later service-contract version should give verification its own durable run type once verification history becomes a product feature.

## Acceptance

1. semantic verification runs in a fresh context;
2. only the configured question and explicitly supplied evidence are sent after confirmation;
3. evidence is treated as untrusted data;
4. preflight does not contain raw evidence;
5. paid execution still requires explicit confirmation;
6. verdict parsing supports pass, fail and uncertain only;
7. malformed or failed execution becomes incomplete;
8. fail and uncertain resolve through the source-configured gate;
9. uncertain never becomes pass;
10. the desktop keeps Verify work separate from Rack evaluation;
11. verification source is not changed by running a check;
12. no third-party host is automatically blocked yet.

## Next

Iteration 32 should add the deterministic verifier registry beginning with one trusted local check such as repository verification. That registry should map source-level check identifiers onto Rack-owned executors and must continue to reject executable code supplied by shared practice.

After that, host integration can combine deterministic and semantic results into a complete verification gate.
