# Iteration 2 — Writing vertical slice

Issue: #3

The first implementation step is the deterministic local compiler thread:

```text
parsed Rack project
→ Set-up resolution
→ dependency closure
→ blocking diagnostics
→ compiled profile
→ generic prompt
→ CLI output
```

This slice deliberately reuses `@rack/core` so the desktop and CLI can call the same behaviour without adding a new dependency graph. The compiler API can move into the planned `@rack/compiler` package when destination adapters are introduced, without changing its public data contracts.

## Included in the first compiler slice

- deterministic dependency closure;
- missing, excluded, cyclic and exact-version diagnostics;
- domain compatibility checks for explicitly included instructions;
- target-neutral compiled profile;
- deterministic generic Markdown prompt;
- `rack build --profile <id> --target prompt`;
- package tests for dependency closure, exclusion and reproducibility.

## Next within Iteration 2

- expose Set-ups and prompt preview in the desktop UI;
- add local project-writing commands;
- build the no-model Writing route;
- review proposed instructions before writing;
- add copy and export actions;
- add golden prompt fixtures.
