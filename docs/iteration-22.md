# Iteration 22 — reviewable practice

## Outcome

Make `review_after` useful without turning Rack into a compliance dashboard or making time silently change working practice.

A review date is a prompt to reconsider an instruction. It is **not**:

- an expiry date;
- an automatic removal;
- an automatic downgrade from binding to adaptable;
- a failed check;
- evidence that somebody has or has not complied.

## Date contract

`authority.review_after` remains module schema 0.2 metadata.

Rack now validates that it is a real calendar date in `YYYY-MM-DD` form, rather than only checking the text shape.

For example:

```yaml
harness:
  schema_version: "0.2"
  id: guardrail.public-evidence
  version: 0.2.0
  criticality: required
  authority:
    mode: binding
    propagation: shared
    rationale: Public claims need a clear evidence boundary.
    review_after: 2027-02-01
```

## Core review assessment

`@rack/core` exposes a pure review assessment.

The caller supplies:

- the modules to assess;
- an explicit `asOf` calendar date;
- an optional upcoming window, defaulting to 30 days.

Review state is:

- **due** — review date is today or earlier;
- **upcoming** — review date is within the upcoming window;
- **scheduled** — review date is later.

The core function does not read the system clock itself. This keeps tests and other hosts deterministic.

It does not mutate modules or feed back into practice resolution.

## Desktop date

The desktop supplies its current **local calendar date** to the core assessment.

It deliberately formats local year/month/day rather than converting the time to UTC first, so a user close to midnight does not see review state based on the wrong calendar day.

## Local Rack

Your Rack shows a non-blocking review notice when one or more local instructions have reached their review date.

Individual instruction cards show:

- Review due;
- Review soon;
- or the scheduled review date.

The instruction remains in exactly the same Set-ups and builds.

## Shared practice

The accepted shared-practice view shows:

- number of reviews currently due;
- review status on each dated instruction;
- a clear warning when accepted shared instructions have reached their review date.

The warning explicitly says that accepted practice remains active with the same authority.

This matters especially for binding organisational practice: a review date should make a long-lived boundary visible for reconsideration without allowing a calendar tick to weaken the boundary silently.

## Updates

Iteration 17 already treats these incoming changes as tightening:

- removing an existing binding review date;
- pushing an existing binding review date further into the future.

Iteration 22 keeps that behaviour.

A publisher can respond to a review by publishing a new shared-practice version. The receiver then uses the Iteration 21 lifecycle to review and explicitly accept or decline that update.

## No central review dashboard

Rack does not create:

- overdue counts across people;
- completion tracking;
- acknowledgement timestamps;
- manager reporting;
- compliance scoring.

Review is surfaced where the practice is used.

Managed Practice can later help publish revised practice, but the existence of a review date should not turn into employee/activity telemetry.

## Experiments are separate

This iteration does **not** introduce experiment expiry.

Time-limited experiments need a separate semantic decision because an `until` date may legitimately affect whether an instruction is active. That is materially different from `review_after`, whose only job is to prompt reconsideration.

Rack should not copy the Field Station fork's automatic lapse/downgrade behaviour into binding authority.

## Acceptance tests

1. impossible dates such as `2027-02-29` are rejected;
2. valid leap dates are accepted;
3. a review is due on its review date;
4. past reviews remain due;
5. upcoming and later reviews are distinguished;
6. instructions without dates are ignored;
7. assessment order is deterministic;
8. assessment requires an explicit valid `asOf` date;
9. review assessment does not mutate the instruction or its authority;
10. desktop surfaces due review state without changing Preview, Export or Checks.
