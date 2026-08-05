# Iteration 4 — Portable destinations foundation

Issue: #7  
Pull request: #8

Iteration 4 introduces Rack's destination-adapter boundary and proves it with two Supported portable outputs.

## Adapter thread

```text
resolved Set-up
→ target-neutral compiled profile
→ adapter capability check
→ shared flat-instruction renderer
→ destination-specific package
→ destination-neutral build manifest
```

Supported in this iteration:

- generic prompt;
- `AGENTS.md`.

The generic prompt remains the canonical semantic-evaluation form. `AGENTS.md` demonstrates how Rack can preserve standing guidance while making destination limitations explicit.

## Degradation behaviour

For `AGENTS.md`:

- repeatable tasks remain documented procedures;
- command names are reference labels and are not registered as executable commands;
- tool declarations become configuration expectations;
- Rack does not start, authenticate or grant access to tools;
- required boundaries remain ordinary standing instructions;
- destination changes appear in the preview and build manifest.

## Explicit required capabilities

A module may declare that its meaning depends on a real destination capability:

```yaml
harness:
  capabilities:
    required:
      - commands
```

Rack blocks a destination that cannot provide the capability. A Set-up can add an explicit waiver for a named module and destination. Waivers remain visible as warnings; they never silently change the source module.

Rack does not infer a hard capability requirement merely from a task command name, tool declaration or criticality level.

## Managed output

Build manifests are destination-neutral and support one or more artifacts:

```text
.rack/
  generated/
    prompt/
      writing/
        system-prompt.md
        build.json
    agents-md/
      writing/
        AGENTS.md
        build.json
```

Prompt and `AGENTS.md` outputs can coexist. Each destination has independent provenance, token estimates, backups and drift state.

## Interfaces

The CLI supports:

```text
rack build . --profile writing --target prompt
rack build . --profile writing --target agents-md --install
rack check . --profile writing --target agents-md
```

The desktop preview allows the user to choose a Set-up and destination, inspect degradation notices, copy or export the primary artifact, install a managed local build and see whether it is current.

ADRs 018 and 019 record the multi-artifact manifest and explicit required-capability decisions.
