# Iteration 28 — shared-practice pilot hardening

## Outcome

Stop adding organisational-practice semantics long enough to prove the complete journey.

Iteration 28 adds a realistic publisher/receiver fixture, an end-to-end core regression test and a matching human pilot walkthrough.

It does not add another transport, authority level or administration layer.

## Fixture

`test-fixtures/shared-practice-pilot/` contains two independent canonical Racks.

### Publisher

Contains:

- a binding required evidence boundary;
- an adaptable plain-language default;
- an adaptable decision-note experiment with a review date;
- a local-only internal context instruction.

### Receiver

Contains:

- local receiver context;
- a local same-ID adaptation of the shared plain-language instruction;
- a Writing Set-up which initially knows nothing about the shared publication.

## End-to-end regression

`packages/core/test/sharedPracticePilotJourney.test.ts` exercises the real sequence:

1. parse the publisher Rack;
2. publish three explicitly selected instructions;
3. verify local-only context was not published;
4. materialise the generated shared file with receiver-owned source metadata;
5. parse the receiver Rack;
6. resolve shared + local practice;
7. compile the effective Writing Set-up;
8. verify binding evidence is active;
9. verify the shared adaptable default activates the receiver's nearer local adaptation;
10. verify the experiment survives with its learning question/review date;
11. add a local exclusion for the adaptable default;
12. resolve and compile again;
13. verify the adaptable instruction is gone while binding/other shared practice remains.

This is intentionally broader than the unit tests around publisher, materialiser and resolver.

## Human walkthrough

`docs/pilot/shared-practice.md` uses the same fixture and covers:

- desktop publication;
- attach/accept;
- binding behaviour;
- adaptable defaults;
- local leave-out and return-to-default;
- incoming/tightening update review;
- review dates and experiments;
- Preview/Checks consistency;
- qualitative pilot questions.

## Why this comes before multiple sources

Core already accepts multiple `PracticeSource` candidates.

The desktop currently remembers one received shared source per Rack.

Adding multiple-source persistence, ordering and relationship UI is possible, but it introduces another set of concepts before the one-source model has been tested with ordinary users.

Iteration 28 therefore creates the evidence needed to decide whether multi-source support is genuinely the next constraint.

## Acceptance

1. fixture publisher and receiver parse cleanly;
2. publisher output round-trips through materialisation;
3. local-only publisher context is absent;
4. binding shared practice is active in the receiver;
5. adaptable shared practice enters as a default;
6. local same-ID adaptation wins content;
7. local exclusion removes only the adaptable default;
8. binding practice remains after opt-out;
9. experiment/review metadata survives;
10. human pilot steps match the automated fixture.
