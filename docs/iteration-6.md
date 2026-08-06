# Iteration 6 — Guided maintenance and task design

## Aim

Make the first Writing Rack maintainable without requiring ordinary users to edit YAML or Markdown, while keeping the local source canonical and fully inspectable.

## Implemented on the active branch

- loss-aware Markdown/YAML patching based on the YAML document AST;
- preservation of unknown frontmatter fields, IDs, versions, scalar comments and line-ending style where supported;
- exact source-change review before any guided save;
- reuse of the existing expected-content check so external changes are never overwritten silently;
- guided context maintenance for organisation, audience, domain, project and reference instructions;
- guided voice maintenance for prose guidance, explicit rules and avoided terms;
- guided boundary maintenance for rule statements and refusal guidance;
- guided repeatable-task design for task purpose, command, inputs and ordered stages;
- guided Set-up maintenance for work domains, root instruction selection, explicit exclusions and destination token budgets;
- advanced source editing retained as an explicit fallback;
- representative project round-trip coverage that patches all guided source types, reparses the Rack and builds the resulting Set-up;
- editor Escape handling, initial focus movement and focus return to the opening control;
- unit coverage for context, voice, boundary, task, Set-up, preservation, refusal behaviour and stable line diffs.

## Safety rules

Guided editing changes only the fields owned by the relevant form. It does not rename module or Set-up IDs or paths, alter versions, change acceptance suites, modify Set-up overrides or remove unknown advanced settings. A file that cannot be interpreted safely is refused and can only be opened in the advanced editor.

Every save is a two-step action:

1. Rack prepares and displays the exact source diff.
2. Rack writes only when the file still matches the content originally opened.

After a successful write, the project snapshot is parsed again, diagnostics are refreshed and all destination previews and drift calculations use the new canonical source.

## Remaining before Iteration 6 completes

- final copy and spacing review on smaller desktop windows;
- final `pnpm check` and Windows desktop smoke run on the complete branch;
- macOS smoke verification on the next scheduled cross-platform run;
- update issue #11, mark PR #12 ready and merge after review.
