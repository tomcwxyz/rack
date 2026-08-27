# Iteration 19 — proposition-based first run

## Outcome

Change the first-run experience from **write a configuration form** to **give Rack the information only you know, then react to proposed working practice**.

The first implementation is the Writing and communications route. Research and Coding keep their existing guided forms until the interaction is validated.

## Why

The existing route asks a new user to author organisation context, audience, voice rules, evidence practice and task behaviour all at once.

That makes Rack feel like a configuration editor before it has demonstrated its value.

The new sequence separates three kinds of input:

- **GAP** — information Rack cannot know, so the user supplies it;
- **DEFAULT** — low-variance practice Rack can sensibly suggest;
- **DECIDE** — practice where the user should explicitly accept, change or reject the suggestion.

## Writing route journey

### 1. Your context

Ask six short prompts:

1. Rack name;
2. optional author/team;
3. organisation/project context;
4. normal audience;
5. first repeatable writing task;
6. what a good result should achieve.

Voice and evidence policy are no longer blank-form questions.

### 2. Suggested practice

Show practice as propositions.

For each proposition the user must choose:

- **That’s right** — keep the proposed instruction;
- **Not quite** — edit it;
- **Not me** — do not create/include that instruction.

The first slice proposes:

- voice and language;
- evidence honesty.

No choice is preselected.

### 3. Review

Show the resulting Rack in plain language, including what will not be created.

The generated file list remains inspectable before choosing a folder.

## Structural requirement

Choices must change the actual Rack.

This is not UI state layered over an unchanged template.

For Writing:

- dropping Voice removes `voice.tone`, removes it from the Set-up and removes the task dependency;
- changing Voice changes the generated voice instruction and compiled prompt;
- dropping Evidence removes `guardrail.evidence`, removes it from the Set-up and removes the task dependency;
- changing Evidence replaces the suggested evidence boundary with the user's wording;
- context and task modules still come from the user's GAP answers.

The builder keeps the old all-default behaviour when called without proposition choices so existing callers/tests remain compatible.

## Product boundary

A local user is allowed to reject even a `criticality: required` suggested module during creation.

That does not weaken the organisational authority model:

- `criticality` describes the importance of an instruction **once present in the Set-up**;
- `authority.mode: binding` from a shared source determines whether a nearer source may adapt/remove it.

Local Starter suggestions are not organisational binding rules.

## Validation

Iteration 19 must prove:

`questions → choices → files → parse → compile`

Tests assert that:

- dropped modules are absent from both files and profile includes;
- downstream task dependencies are repaired;
- changed proposition text reaches the compiled prompt;
- default builder behaviour remains deterministic and compatible.

## Next

Once the Writing interaction is sound:

- port the same proposition model to Research;
- port it to Coding;
- use the same decision vocabulary when introducing adaptable shared defaults;
- consider Starter templates as pre-composed proposition sets rather than separate creation machinery.
