# Iteration 12 — Confirmed model execution and atomic budget reservation

## Outcome

Rack can start one explicitly confirmed paid Quick model call without weakening the local-first product boundary or treating provider/infrastructure success as an evaluation verdict.

This recovery iteration replaces the accidentally merged Iteration 12 bootstrap-only change. Paid work now has an explicit API contract, exact model/cost confirmation, an atomic Postgres reservation boundary, a pre-call provider ledger and conservative settlement.

The first execution slice is intentionally narrow: one Quick case, candidate generation only, no baseline and no rubric judge. A successful model response has `behaviouralVerdict: null`; model-backed judging is the next slice.

## Preflight-to-confirmation binding

Evaluation preflight still accepts metadata and token estimates only. Its response now records both the stable model alias and the resolved deployment identity:

- alias;
- provider ID;
- provider model ID.

`POST /api/evaluate/confirm` repeats the current preflight using current registry mappings, prices and workspace limits. Confirmation fails closed if either:

- the accepted resolved generator `(alias, providerId, modelId)` no longer matches; or
- the accepted maximum retry exposure no longer matches.

A provider/model remap or price change behind a stable Rack alias therefore requires a fresh preflight and explicit confirmation.

The confirmation contract is strict. Iteration 12 accepts exactly one Quick case and zero judge calls. Unknown fields and Reliable execution are rejected.

## Provider-neutral ModelRunner

`@rack/model-runner` adds a small provider-neutral execution interface over Vercel AI SDK.

The default service runner supports:

- direct OpenAI provider adapters;
- direct Anthropic provider adapters;
- OpenAI-compatible endpoints;
- per-request API-key override for future BYOK/direct use.

The managed service maps deployment-owned provider IDs through `RACK_MODEL_RUNNER_JSON`; provider secrets are referenced by environment-variable name rather than embedded in the JSON.

The provider request is made with `maxRetries: 0`. Rack therefore owns retry, idempotency and cost policy rather than allowing the SDK to repeat a paid call invisibly.

The managed confirmation endpoint executes only registry entries with `connection: managed`. BYOK and OpenAI-compatible/local shapes remain available at the shared runner layer for a later direct execution path.

## Conservative content allowance

Raw instructions and the case prompt appear only at the explicit confirmation boundary.

Before reservation, Rack computes a conservative UTF-8 byte allowance for the combined system instructions and case prompt. If that exceeds the candidate-input allowance accepted in preflight, confirmation is rejected and the user must run preflight again with a larger allowance.

This check is intentionally conservative: it protects the cost reservation from a confirmation payload that is materially larger than the metadata-only estimate.

## Atomic reservation

Migration `0004_model_execution` adds:

- `rack_model_evaluation_runs` — durable run/model/cost/idempotency state;
- `rack_provider_calls` — durable provider-call claim, response ID, usage and cost accounting;
- `rack_reserve_quick_evaluation(...)`;
- `rack_settle_quick_evaluation(...)`.

Reservation is performed by a SECURITY INVOKER function under the existing authenticated RLS boundary. It locks the workspace evaluation-limit row before checking or mutating paid state.

Inside that locked transaction Rack:

1. checks for an existing workspace/idempotency key;
2. rechecks the hard per-run cap;
3. rechecks remaining workspace budget;
4. recounts active paid model-evaluation runs against the concurrency limit;
5. reserves the full accepted maximum retry exposure;
6. creates the durable `model-evaluation` run;
7. creates the content-bearing transient payload with its fixed expiry;
8. inserts the `candidate-0` provider-call ledger row as `claimed`.

No provider network call can start before all eight steps have committed.

## Idempotency and crash ambiguity

The provider-call ledger exists before the network request.

If the same workspace/idempotency key is submitted again after settlement, Rack returns the existing result and does not call the provider again.

If the existing provider-call row is still `claimed`, Rack returns a conflict and refuses to repeat the provider call automatically. This covers the ambiguous crash window where a process may have sent a paid request to the provider but failed before recording the response.

This deliberately favours cost safety over automatic recovery. A later operational slice can add explicit reconciliation rather than guessing whether a paid call happened.

## Settlement

After a successful provider call, Rack uses reported input/output usage when both are available and calculates cost from the current resolved model pricing using integer micro-USD arithmetic.

If usage is unavailable, Rack settles the planned one-attempt generator cost. If the provider call throws, Rack also settles the planned one-attempt cost conservatively, marks the provider call failed and records the evaluation as `incomplete`.

If reported usage would exceed the accepted maximum retry reservation, Rack fails closed, consumes the reserved maximum conservatively and records an incomplete result rather than allowing accounting to exceed the confirmed cap.

Settlement locks the evaluation and workspace limit rows, releases the reservation, increments workspace spent cost and completes the provider-call ledger. It is idempotent once the evaluation is no longer `running`.

## Behavioural semantics

Iteration 12 is an execution primitive, not yet a behavioural evaluator.

- provider success → execution status `completed`, `behaviouralVerdict: null`;
- provider/infrastructure failure → execution status `incomplete`, `behaviouralVerdict: null`;
- no incomplete run is represented as a pass or fail.

Quick rubric judgement and Reliable candidate/baseline/judge fan-out remain subsequent slices.

## Privacy boundary

Instructions, case prompt and generated output are stored only in `rack_managed_payloads` and retain the existing maximum 24-hour expiry.

Durable `rack_model_evaluation_runs` and `rack_provider_calls` rows contain only:

- run/workspace/idempotency identifiers;
- resolved model identity;
- status;
- accepted/reserved/settled cost metadata;
- provider response ID;
- token usage;
- cost basis;
- timestamps.

They do not contain instruction, prompt or output text.

After transient payload deletion, an idempotent replay can still return the durable execution/accounting state but returns no output and reports transient content unavailable.

## Validation boundary

Tests use injected fake `ModelRunner` and store implementations only. They verify:

- exact resolved-model confirmation;
- reservation occurs before the provider runner is called;
- settled idempotent replay never repeats a provider call;
- an already-claimed call is not repeated automatically;
- provider failure produces `incomplete`, never a behavioural failure;
- the managed client sends content only at explicit confirmation, not preflight.

CI must not contain provider secrets or make paid provider calls.
