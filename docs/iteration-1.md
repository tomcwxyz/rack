# Iteration 1 — Format to screen

This branch establishes the first executable thread through Rack:

```text
local Rack folder
→ safe desktop file read
→ shared TypeScript parser and schemas
→ diagnostics
→ grouped instruction cards
```

## Included

- pnpm/Turborepo packages;
- Zod schemas for the manifest, profiles and all seven module types;
- shared pure project parser;
- Node project loader and `rack validate`;
- Tauri desktop shell and local folder selection;
- Rust limited to safe file-system IO;
- a provisional warm Rack workspace;
- a Writing fixture project;
- Windows and macOS CI smoke checks.

## Deliberately deferred

- dependency closure and profile resolution;
- editing and writing project files;
- guided-route questions;
- compilation and destination previews;
- Neon and managed services;
- evaluation execution.

Visual tokens are provisional until the Good Ship product-family audit is complete.
