# Iteration 20 — proposition-first Research and Coding

## Outcome

Complete the proposition-first creation model across all three guided routes.

Writing established the interaction in Iteration 19. Research and Coding now use the same sequence and the same structural decision semantics:

1. **Your context** — information Rack cannot reasonably know;
2. **Suggested practice** — proposed reusable working practice;
3. **Review** — the actual Rack that will be written.

The old long-form `GuidedCreationRoute` abstraction is removed because no route uses it after this iteration.

## Shared interaction

All routes use one `PracticeProposition` component.

Every proposition requires one explicit choice:

- **That’s right** — keep the proposed instruction;
- **Not quite** — edit the proposed instruction;
- **Not me** — do not create/include the instruction.

No choice is preselected.

The shared component also owns the three-step progress indicator and decision labels so the language does not drift between routes.

## Research

### User-specific context

The user supplies:

- Rack name;
- optional author/team;
- organisation/project/decision context;
- research question or uncertainty;
- available evidence, sources and practical limits;
- repeatable research task;
- what a good result should achieve.

### Suggested practice

Rack proposes:

- **Research method** — clarify, assess and synthesise before recommending;
- **Evidence boundary** — make uncertainty, gaps and inference visible.

### Structural behaviour

Dropping the method removes `method.research`, removes it from the Research Set-up and removes the task dependency.

Dropping the evidence boundary removes `guardrail.evidence`, removes it from the Set-up and removes the task dependency.

Changing either writes the user's version into the generated module and therefore into compiled Prompt/AGENTS.md output.

## Coding

### User-specific context

The user supplies:

- Rack name;
- optional author/team;
- repository/product/system context;
- stack and technical constraints;
- repeatable technical task;
- what a good result should achieve.

### Suggested practice

Rack proposes:

- **Implementation practice** — inspect first, then make the smallest coherent change;
- **Safety boundary** — protect secrets, compatibility and honest verification.

### Structural behaviour

Dropping implementation practice removes `craft.code`, removes it from the Coding Set-up and removes the task dependency.

Dropping the safety boundary removes `guardrail.code-safety`, removes it from the Set-up and removes the task dependency.

Changing either writes the user's version into the generated instruction. Tests verify the result across Prompt, AGENTS.md, Claude Code, OpenCode and Codex destinations.

## Compatibility

All proposal builders still default to the previous all-included behaviour when called without explicit proposition selections.

This means:

- existing programmatic callers remain valid;
- deterministic proposal tests remain useful;
- proposition state is an authoring decision rather than a new required project-file schema.

## Product semantics

The distinction introduced in Iteration 19 remains important:

- **criticality** says how important an instruction is once present in a Set-up;
- **local proposition choice** says whether a Starter suggestion belongs in the local Rack at all;
- **shared authority** says whether a nearer source may adapt or remove organisational practice.

A local user can therefore reject a suggested required guardrail without weakening the separate organisational binding model.

## What this establishes

After Iteration 20, first-run creation has one consistent mental model across Writing, Research and Coding:

> Tell Rack what is specific to your work. React to suggested practice. Inspect what will be created.

This same interaction vocabulary can later be reused when a shared source introduces a new adaptable default.

## Next

Return to the shared-practice lifecycle:

- remember attached source paths;
- detect incoming versions;
- compare accepted and incoming practice;
- show ordinary vs tightening changes;
- explicit accept/decline;
- keep declined versions from being repeatedly offered;
- keep all of that local by default.

Only after that should Rack add Managed Practice publishing/distribution as another transport over the same source/update model.
