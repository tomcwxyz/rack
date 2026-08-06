# Iteration 7 — Research and Coding creation routes

Issue: #14

Iteration 7 completes Rack's three planned guided starting routes while keeping Writing and communications as the most polished pilot experience.

## Creation journey

```text
welcome
→ choose Writing, Research or Coding
→ answer route-specific questions
→ review the proposed source
→ choose a parent folder
→ atomically create the Rack
→ maintain and build through the existing workspace
```

Every route:

- works without an account, model or network request;
- creates ordinary local Markdown and YAML;
- shows all proposed instructions before writing files;
- reuses the existing staged Tauri project-creation command;
- creates one useful Set-up and local evaluation configuration;
- can be maintained through the guided editors added in Iteration 6.

## Writing and communications

The existing route remains the most polished pilot route. It captures:

- organisation context;
- audience context;
- voice and language guidance;
- terms to avoid;
- evidence boundaries;
- one repeatable writing task.

The visible flow now uses the shared guided-creation component, but its source-builder semantics remain unchanged.

## Research and knowledge work

The Research route captures:

- organisation and decision context;
- a research question or uncertainty;
- evidence, source and access expectations;
- a repeatable research method;
- evidence and uncertainty boundaries;
- one investigation task with framing, gathering, assessment, synthesis and gap stages.

Its initial Set-up builds for the generic prompt and portable `AGENTS.md` destinations.

## Coding and technical work

The Coding route captures:

- repository and project context;
- technology and compatibility constraints;
- implementation practice;
- sensitive-data, compatibility and honest-verification boundaries;
- one implementation task with inspect, plan, implement and verify stages.

Its initial Set-up builds for the generic prompt, `AGENTS.md`, Claude Code, OpenCode and Codex. The route does not connect to repositories, select models, grant permissions or activate tools.

## Verification

The desktop package's proposal-builder tests run through the existing Turbo `test` dependency of `pnpm check`.

Tests verify that:

- the same answers produce identical source files;
- all three proposals parse without source diagnostics;
- Writing compiles for the generic prompt;
- Research compiles for the generic prompt and `AGENTS.md`;
- Coding compiles for every currently Supported coding destination.

## CI discipline

The entire Iteration 7 slice is prepared as one coherent branch batch before opening a pull request. This gives the review branch one Linux quality run and, because desktop paths change, one Windows smoke run. macOS remains a post-merge or deliberate manual verification under the repository's reduced Actions-usage policy.
