# Iteration 11 — Model registry and paid evaluation preflight

## Outcome

Rack can now explain the shape and maximum cost of a managed model evaluation before any paid provider call is possible. Stable model aliases resolve through deployment-owned configuration, workspace limits are read under RLS, and the public preflight contract accepts metadata/token estimates rather than Rack source or generated content.

This is deliberately a planning and guardrail slice. It does **not** add a provider runner, confirmation endpoint, reservation, billing event or model call.

## Provider-neutral model registry

`@rack/registry` owns the model registry contract. A registry entry separates the stable Rack alias from deployment details:

- `alias` — the public stable identifier used by Rack;
- `providerId` — a deployment-owned provider identity;
- `modelId` — the provider model mapping;
- `connection` — `managed`, `byok` or `openai-compatible`;
- optional `endpointId` for OpenAI-compatible/local endpoints;
- capabilities — `generate`, `judge`, `draft`;
- input/output prices in micro-USD per million tokens;
- output-token limit.

Production service parsing requires at least two distinct `managed` provider IDs. This enforces provider diversity without hard-coding provider brands into Rack source. BYOK and local/OpenAI-compatible entries can coexist and do not require AI Gateway.

Prices are deployment configuration, not application constants. Changing a provider model or price behind a stable alias therefore does not require a Rack project-format change.

## Evaluation plan defaults

`@rack/eval` turns a strict preflight request into a deterministic plan.

### Quick

Quick evaluation is explicitly **indicative**:

- one repetition;
- candidate only, no baseline;
- no comparison with the previous accepted run;
- no regression gate;
- configured rubric judge calls use the one selected generator model.

### Reliable

Reliable evaluation uses the accepted durable defaults:

- five repetitions;
- candidate plus baseline for every case/repetition;
- at least one recorded rubric-judge call per output;
- comparison with the previous accepted run enabled;
- regression gate enabled;
- an explicitly selected judge alias.

For `N` cases and one judge call per output, the default Reliable call plan is:

- candidate generator calls: `N × 5`;
- baseline generator calls: `N × 5`;
- judge calls: `N × 10`;
- total provider calls: `N × 20`.

Configured adversarial cases are represented in the case count; they do not create a hidden multiplier in the calculator.

## Judge independence

For Reliable mode the resolved provider/model identity of generator and judge is compared. If they resolve to the same provider/model, the preflight records `judgeIndependent: false` and emits a warning. It does not pretend same-model judging is independent.

Quick mode records `judgeIndependent: null` because it deliberately uses one selected model.

## Token and cost estimate

Preflight accepts counts and token estimates only:

- case count;
- candidate input tokens per case;
- baseline input tokens per case for Reliable;
- generator output-token allowance;
- judge prompt tokens per case;
- judge output-token allowance;
- judge calls per output.

It computes candidate/baseline/judge call counts and total input/output token volume. Cost is calculated separately for generator and judge using registry pricing.

`estimated` is the one-attempt plan cost. `maximumRetry` multiplies that value by the workspace's configured maximum provider attempts per call. The latter is the value checked against hard budgets so the confirmation UI cannot hide retry exposure.

All cost arithmetic uses integer micro-USD and BigInt intermediates. Floating-point currency arithmetic is not used.

## Workspace limits

Migration `0003_evaluation_limits` adds an owner-scoped `rack_workspace_evaluation_limits` row containing:

- hard workspace budget;
- spent amount;
- reserved amount;
- hard per-run cap;
- paid-run concurrency limit;
- maximum provider attempts per call.

The service copies deployment defaults into the row on first use and does not overwrite an existing workspace's values when deployment defaults change.

Available workspace budget is `hard - spent - reserved`. Active paid runs are counted from `rack_managed_runs` with kind `model-evaluation` and status `queued`/`running`.

Preflight blocks independently when:

- maximum retry cost exceeds the per-run cap;
- maximum retry cost exceeds workspace remaining budget;
- active paid runs have reached the concurrency limit;
- requested generator/judge output exceeds the resolved model limit.

## Public endpoint

`POST /api/evaluate/preflight` requires the same Neon Auth boundary as other managed endpoints.

Its strict schema does not contain instruction, sample-output or arbitrary text-content fields. Unknown fields are rejected. It returns the call/token/cost plan, warnings, blockers, and `requiresExplicitConfirmation: true`.

The response deliberately has no run ID, reservation ID or provider-call handle. `eligibleForConfirmation` means only that current metadata/limits do not block a future confirmation step; there is no confirmation endpoint in Iteration 11.

## Next execution boundary

The next paid-execution slice must preserve these accepted constraints:

- Vercel AI SDK behind a Rack `ModelRunner` abstraction;
- model aliases remain provider-neutral and deployment-configurable;
- at least two managed providers;
- direct BYOK/local OpenAI-compatible endpoints remain possible;
- no mandatory AI Gateway;
- paid work starts only after explicit confirmation of a still-valid preflight;
- workspace/per-run/concurrency caps are rechecked transactionally before reservation;
- provider calls and billing/reservations are idempotent;
- failed provider calls can consume usage but are not behavioural failures;
- incomplete runs are never passes;
- Reliable judge identity and baseline/regression state remain part of the durable result.
