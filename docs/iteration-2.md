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
- package tests and a byte-for-byte golden Writing fixture.

## Guided desktop thread

```text
choose Writing and communications
→ answer a short local guide
→ review the proposed instructions
→ choose a parent folder
→ atomically create the Rack
→ select or edit a Set-up
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
- conflict-safe source editing for instructions and Set-ups;
- Set-up selection and contribution preview;
- copy and Markdown export actions.

The visual treatment remains provisional until the Good Ship product-family audit. Guided type-specific maintenance editors remain for a later slice; the advanced source editor keeps the canonical files usable now.
