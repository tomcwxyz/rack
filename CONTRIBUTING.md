# Contributing to Rack

Rack is stewarded by The Good Ship and is currently in early implementation.

## Before contributing

- Read the accepted specification in `docs/specification/`.
- Read the Architecture Decision Records in `docs/decisions/`.
- Open an issue before substantial changes.
- Do not introduce cloud-only requirements for local authoring, compilation or static checks.
- Do not change canonical project semantics, import trust, evaluation claims, privacy defaults or destination output without an ADR and versioning plan.

## Development

Requirements:

- Node.js 22 or later
- pnpm 10
- Rust and the Tauri prerequisites when working on the desktop shell

```bash
pnpm install
pnpm check
```

Use focused branches and small pull requests. Add or update fixtures for schema and adapter changes.

## Commit and pull-request expectations

- Explain the user or engineering problem.
- Describe consequential trade-offs.
- Include tests for changed behaviour.
- Call out privacy, file-system, import or model-cost implications.
- Include a golden diff when destination output changes.

## Licences

Code contributions are accepted under Apache-2.0. Starter knowledge content is CC BY 4.0 unless otherwise declared. By contributing, you confirm that you have the right to submit the work under the applicable licence.
