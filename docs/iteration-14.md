# Iteration 14 — Desktop managed Quick checks

## Outcome

Rack now exposes the managed Quick evaluation path inside the desktop application without making accounts or the managed service a requirement for local Rack use.

A pilot user can:

1. open and maintain a Rack locally as before;
2. choose **Checks** from the Rack workspace;
3. sign in only when they want to use managed checks;
4. choose the local Set-up to test;
5. enter one concrete test case and a plain-language rubric;
6. ask Rack for a metadata-only cost preflight;
7. see estimated cost, maximum retry exposure, call count and hard blockers before paid work;
8. explicitly confirm a Quick check with the maximum exposure in the button label;
9. see Pass, Fail or Incomplete with transient score/reason/evidence and the candidate response;
10. see actual settled provider cost and the transient-content expiry time.

## Local-first boundary

The desktop auth provider wraps the application, but it does not gate opening, authoring, importing, compiling, previewing or exporting a Rack.

If managed configuration is absent, the Checks section simply explains that managed checks are unavailable in that build. The rest of Rack is unchanged.

Managed configuration uses Vite build variables only:

- `VITE_RACK_SERVICE_URL`;
- `VITE_NEON_AUTH_URL`;
- `VITE_RACK_QUICK_MODEL_ALIAS`.

These values are public desktop configuration and must not contain secrets. Provider API keys remain server-side deployment variables.

## Sign-in

The desktop uses the current Neon Auth browser client with Neon Auth UI. The first native slice enables email OTP only.

Google and Microsoft remain accepted product requirements, but their native desktop callback/deep-link behaviour is deliberately deferred rather than reusing a browser redirect without an explicit Tauri callback design.

The managed client obtains the current Neon JWT through an access-token callback. Sign-in state therefore remains outside `@rack/core`, and local project parsing/building does not acquire an auth dependency.

## What Quick evaluates

The desktop currently evaluates the **generic prompt** rendering of the selected Set-up.

This is deliberate. Quick is testing the assembled working practices independently of a particular host package. Multi-file destination packages such as Claude Code or OpenCode may add host-specific structure that should not be flattened silently into a model prompt.

`prepareTargetBuild(project, profileId, "prompt")` provides:

- the exact compiled prompt instructions;
- the canonical source digest used as `rackFingerprint`;
- normal build diagnostics and token-budget blocking.

If the selected Set-up cannot build cleanly as a generic prompt, Rack does not start managed preflight.

## Preflight and explicit confirmation

The desktop builds the Quick metadata request locally and sends no instruction, case or rubric content during preflight.

The first UI uses conservative UTF-8 allowances for the current service safety checks:

- candidate allowance covers the compiled instructions plus case prompt;
- judge-prompt allowance covers the rubric/task plus a fixed margin for Rack-owned judge instructions;
- candidate output allowance is 1,000 tokens;
- judge output allowance is 400 tokens.

Preflight displays both the estimated one-attempt cost and the maximum retry exposure. A hard budget/concurrency/model blocker disables paid confirmation.

The confirmation button includes the maximum retry exposure in its label. Confirmation sends:

- the original preflight request;
- accepted resolved generator and judge identities;
- accepted maximum retry exposure;
- a fresh UUID idempotency key;
- compiled instructions;
- case prompt;
- rubric.

The service still rechecks model mapping, price and hard workspace limits transactionally before provider work starts.

## Results

The desktop preserves the service semantics:

- **Pass** — completed provider work and a valid rubric pass;
- **Fail** — completed provider work and a valid rubric fail;
- **Incomplete** — no trustworthy behavioural verdict because provider/judge/accounting execution did not complete safely.

Quick remains visibly labelled **indicative** because it is one case, one repetition and same-model judging.

Transient result detail can include:

- score;
- judge reason;
- judge evidence;
- candidate response.

The UI also shows settled candidate + judge cost and the payload expiry timestamp.

## Reliable mode

The Checks screen shows Reliable as a visible but disabled next mode. It describes the accepted target behaviour — repeated candidate/baseline runs, independent judging and regression gating — without implying the model-backed Reliable execution slice is already available.

The existing Vercel Workflow infrastructure remains the foundation for that next implementation step.

## Validation

Desktop tests cover the pure managed-check planning helpers:

- conservative allowance construction;
- fixed one-case rubric-backed Quick request shape;
- micro-USD display;
- settled candidate + judge cost aggregation.

The implementation also reuses the existing `prepareTargetBuild` path rather than introducing a second compiler in the UI.

Because this iteration adds desktop dependencies, pull-request CI should run the normal Linux gate plus the Windows desktop smoke check. The repository policy will run macOS smoke after the desktop-related change reaches `main` or through a deliberate manual full-suite run.
