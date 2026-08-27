# Iteration 23 — practice experiments

## Outcome

Add an explicit way to say that an instruction is being tried in order to learn something, without adding a second expiry mechanism or allowing time to silently change builds.

An experiment is ordinary Rack practice with three extra constraints:

1. it is **adaptable**, never binding;
2. it has a **learning question**;
3. it has a **review date**.

The instruction remains active when the review date arrives. The date means "learn from this and decide what happens next", not "turn this off".

## Source shape

Experiments use module schema 0.2.

Example:

```yaml
harness:
  schema_version: "0.2"
  id: method.decision-notes
  version: 0.2.0
  criticality: recommended
  authority:
    mode: adaptable
    propagation: shared
    review_after: 2026-11-01
  experiment:
    question: Do short decision notes reduce repeated discussion?
```

The instruction body still contains the practice itself.

`experiment.question` describes what the organisation or practitioner hopes to learn by trying it.

## Schema rules

Rack rejects an experiment when:

- it uses module schema 0.1;
- it has no `authority.review_after`;
- its authority mode is `binding`;
- its learning question is empty.

Rack does not require an experiment to be optional or recommended. `criticality` still describes how important the instruction is while it is present in a Set-up.

This preserves the separation established in Iteration 16:

- **criticality** — importance to output behaviour;
- **authority** — whether nearer practice may adapt the instruction;
- **experiment** — whether the practice is deliberately provisional and what is being learned.

## Why experiments cannot be binding

"Binding experiment" mixes two incompatible claims:

- this practice must not be adapted downstream;
- this practice is provisional and is being tested.

If an organisation needs a non-negotiable boundary while testing how it is implemented, the binding boundary and the experimental implementation should be separate instructions.

## Review semantics

Experiments reuse Iteration 22's review model.

Core review reports now carry:

- the experiment learning question;
- experiments due for review;
- experiments coming up for review.

There is no `until` field and no automatic lapse.

When the date arrives:

- the experiment remains in the Set-up;
- Preview, Export and Checks are unchanged;
- the desktop surfaces the learning question;
- the user/publisher decides whether to keep, change or remove the practice.

For shared practice, that decision should normally produce a new publication which then goes through the Iteration 21 accept/decline lifecycle.

## Desktop

### Your Rack

The Rack summary includes the number of experiments.

Experiment instruction cards show:

- **experiment**;
- review status/date;
- the learning question.

When an experiment reaches its review date, Rack shows a dedicated:

> ready to learn from

notice rather than treating it only as an overdue instruction.

### Shared practice

Accepted shared practice shows:

- experiment count;
- experiment status on instruction cards;
- learning questions;
- a separate experiment-review notice.

The accepted experiment remains active until revised shared practice is published and the receiver chooses whether to accept the revision.

## No experiment telemetry

Rack does not record:

- whether somebody "completed" an experiment;
- experiment participation;
- acknowledgement;
- team-level experiment compliance;
- outcome scores.

The learning question is practice metadata, not an employee monitoring mechanism.

If evidence about an experiment is collected, that belongs in the user's existing research/knowledge tools or a later explicit evidence workflow—not hidden product analytics.

## Relationship to evaluation

Rack's Quick/Reliable evaluation asks whether AI behaviour follows the current Set-up.

An experiment asks whether that practice is useful in the real work.

Those are related but different questions.

A future workflow may make it easier to compare evaluation results around an experiment, but Iteration 23 does not conflate behavioural conformance with organisational learning.

## Deliberately deferred

- guided create/edit controls for marking an instruction as experimental;
- experiment notes/results inside Rack;
- linking an experiment to formal evaluation suites;
- experiment history;
- automatic reminders outside the desktop;
- automatic expiry/lapse.

## Acceptance tests

1. a reviewed adaptable experiment is valid;
2. an experiment requires module schema 0.2;
3. an experiment requires a real review date;
4. a binding experiment is rejected;
5. empty learning questions are rejected;
6. review signals carry the learning question;
7. experiment due/upcoming counts remain distinct from ordinary review counts;
8. reaching the review date does not mutate the module or its authority;
9. experiment state is visible in local and shared-practice desktop views;
10. builds remain determined by source/accepted practice, not the system date.
