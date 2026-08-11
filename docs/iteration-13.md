# Iteration 13 — Rubric-backed Quick evaluation

## Outcome

Rack can now turn the safe paid-generation primitive from Iteration 12 into one real, explicitly indicative behavioural evaluation.

The first Quick evaluation remains deliberately narrow:

- one case;
- one candidate generation;
- zero or one rubric judge call;
- no baseline;
- no previous-run comparison;
- no regression gate;
- Quick judging uses the same selected model and is therefore not represented as independent.

Generation-only confirmation remains available as the underlying execution primitive. When one judge call is configured, confirmation requires a rubric and the accepted resolved judge identity and returns a structured pass/fail judgement.

## Rubric contract

A rubric-backed confirmation includes:

- the case prompt;
- the compiled candidate instructions;
- a plain-text rubric;
- the exact accepted generator identity;
- the exact accepted judge identity;
- the accepted maximum retry exposure from preflight.

Quick preflight still contains no raw content. The rubric appears only at explicit confirmation alongside the other transient managed content.

The current public contract supports at most one Quick judge call per output. More repetitions, multiple judges and Reliable fan-out remain later slices.

## Judge prompt and parsing

`quickRubric.ts` owns the deterministic Quick judge prompt rather than embedding it in the HTTP handler.

The judge is instructed to return one strict JSON object:

```json
{
  "verdict": "pass",
  "score": 90,
  "reason": "Short explanation",
  "evidence": ["Short grounded observation"]
}
```

The parser accepts either the raw JSON object or a single JSON code fence and validates it against the shared managed-service schema. It does not attempt to infer a verdict from prose when the structured result is invalid.

An invalid/unparseable judge response therefore produces an `incomplete` evaluation with no behavioural verdict, even though the provider call itself completed successfully.

## Cost boundary

Preflight already accounts for Quick rubric calls as:

- one candidate generator call;
- the configured judge calls, using the selected generator model;
- candidate input/output allowances;
- judge prompt allowance plus candidate-output allowance;
- judge output allowance;
- maximum retry exposure across the complete plan.

Confirmation adds a conservative content check for the fixed judge instructions plus rubric/task text before reservation. If this exceeds the accepted judge-prompt allowance, the user must run preflight again with a larger estimate.

The entire candidate + judge maximum retry exposure is reserved before candidate generation begins.

## Provider-call sequencing

Rubric evaluation uses the same cost-safe pre-call ledger rule for both network calls.

1. Reservation creates the run and claims `candidate-0` before candidate generation.
2. Candidate success is recorded durably with provider response/usage/cost metadata while the workspace reservation remains held.
3. Rack inserts `judge-0` as `claimed` before sending the rubric judge request.
4. Judge settlement releases the full run reservation and moves the actual/conservative candidate + judge cost into workspace spent cost.

If the candidate provider fails, the existing Iteration 12 settlement path ends the evaluation immediately as `incomplete` and no judge call is created.

If a process crashes while a provider call is `claimed`, replay still fails closed rather than automatically repeating that paid request.

## Behavioural semantics

Quick now distinguishes three outcomes:

### Completed pass

- candidate provider completed;
- judge provider completed;
- judge output parsed against the strict schema;
- `status: completed`;
- `behaviouralVerdict: true`;
- transient structured judgement contains score, reason and evidence.

### Completed fail

- the same execution requirements as a pass;
- `status: completed`;
- `behaviouralVerdict: false`.

A behavioural fail is therefore not a provider/infrastructure failure.

### Incomplete

Any of the following leaves `behaviouralVerdict: null`:

- candidate provider failure;
- judge provider failure;
- judge output that does not satisfy the strict judgement schema;
- paid-call/accounting state that cannot safely complete inside the accepted reservation.

An incomplete run is never represented as a pass or fail.

## Privacy and durable state

The candidate output, raw judge response, parsed score, reason and evidence remain in `rack_managed_payloads` under the existing maximum 24-hour expiry.

Durable state keeps:

- run/workspace/idempotency IDs;
- resolved candidate and judge provider-call identities;
- call statuses, provider response IDs, usage and cost metadata;
- the final nullable boolean behavioural verdict.

Free-text judge reason/evidence is not copied into durable provider/evaluation rows.

After transient deletion, Rack can still say whether a settled run passed or failed and account for its provider calls, but the detailed score/reason/evidence is no longer returned.

## Validation

Tests use fake `ModelRunner` and execution-store implementations only. Coverage includes:

- generation-only Iteration 12 compatibility;
- candidate reservation before provider execution;
- judge claim before judge provider execution;
- structured Quick pass;
- structured Quick behavioural fail;
- unparseable judge output → incomplete;
- judge-provider failure → incomplete;
- idempotent replay without another provider call;
- no automatic repeat of an in-progress/claimed paid run;
- deterministic rubric prompt and strict parser behaviour.

CI makes no paid provider calls and requires no provider secrets.
