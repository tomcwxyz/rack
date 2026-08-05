# Iteration 2 — Writing vertical slice

Issue: #3

Iteration 2 now has two coherent local threads.

## Compiler thread

```text
parsed Rack project
→ Set-up resolution
→ dependency closure
→ blocking diagnostics
→ compiled profile
→ generic prompt
→ CLI output
```

Included:

- deterministic dependency closure;
- missing, excluded, cyclic and exact-version diagnostics;
- domain compatibility checks for explicitly included instructions;
- target-neutral compiled profile;
- deterministic generic Markdown prompt;
- `rack build --profile <id> --target prompt`;
- package tests for dependency closure, exclusion and reproducibility.

## Guided desktop thread

```text
choose Writing and communications
→ answer a short local guide
→ review the proposed instructions
→ choose a parent folder
→ atomically create the Rack
→ select a Set-up
→ preview, copy or export the prompt
```

Included:

- no-model Writing route;
- organisation and audience context;
- voice guidance and avoided language;
- evidence boundary;
- one progressively structured task;
- review before canonical files are written;
- safe staged project creation in Rust;
- Set-up selection and contribution preview;
- copy and Markdown export actions.

The visual treatment remains provisional until the Good Ship product-family audit. Direct editing of existing source files and golden prompt fixtures remain before the Iteration 2 PR leaves draft.
