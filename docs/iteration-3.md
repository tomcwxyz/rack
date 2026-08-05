# Iteration 3 — Safe builds and drift detection

Issue: #5  
Pull request: #6

Iteration 3 turns an in-memory prompt preview into a managed local build that Rack can inspect later.

## Build thread

```text
resolved Set-up
→ deterministic prompt
→ token estimate and budget checks
→ canonical source digest
→ build manifest
→ staged local installation
→ inspect source and output drift
```

Included:

- canonical semantic input representation;
- SHA-256 source and output digests with line-ending normalisation;
- deterministic prompt token estimate;
- recommended and maximum Set-up budgets;
- no silent truncation;
- `build.json` provenance manifest;
- managed output under `.rack/generated/prompt/<set-up>/`;
- retained backups of replaced generated builds;
- build states for missing, current, stale, externally modified, stale-and-modified and invalid output;
- CLI `rack build --install` and `rack check`;
- desktop build-state display and Build action;
- Node integration tests and cross-platform desktop smoke builds.

## Managed output layout

```text
.rack/
  generated/
    prompt/
      writing/
        system-prompt.md
        build.json
  backups/
    prompt/
      writing/
        <timestamp>/
```

The canonical Rack source remains outside `.rack/`. Generated files are replaceable outputs and are never treated as source instructions.

## Safety behaviour

- builds are staged before replacing the current generated folder;
- an existing generated folder is retained as a backup;
- symlinked or non-directory destinations are rejected;
- invalid or incomplete build plans cannot be installed;
- source changes and manual generated-file edits are reported separately;
- CI cancels superseded runs for the same pull request to reduce duplicate failure notifications.

Additional destinations reuse this build-state contract in later iterations.
