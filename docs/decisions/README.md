# Architecture Decision Records

Rack uses ADRs for decisions that change canonical project semantics, dependency or conflict resolution, import trust, evaluation claims, privacy defaults, destination status or generated destination output.

## Accepted v0.1 decisions

1. Local-first Tauri desktop application
2. Canonical local project with an OKF-compatible `modules/` directory
3. Set-ups separate intended use from destinations
4. Shared compiler and renderer architecture
5. Supported prompt, `AGENTS.md`, Claude Code, OpenCode and Codex destinations
6. Preview Hermes Agent and OpenClaw destinations
7. Neon Postgres and Neon Auth for the managed service
8. Provider-neutral model runners with stable purpose aliases
9. Durable reliable evaluation through Vercel Workflow
10. Local projects and transient managed content
11. Curated signed Starter library and pinned imports
12. Guided creation followed by structured maintenance
13. Good Ship product-family visual direction
14. Open application and commercial managed service
15. Privacy-preserving telemetry
16. Signed, user-controlled desktop updates
17. Six-week structured private pilot
18. Semantic changes require ADRs and versioning
19. Instruction, verification and evaluation remain separate; shared verification declarations cannot ship executable code
20. Host discovery, installation and runtime delivery remain separate from deterministic destination rendering

Individual ADR files record the decisions which have moved from product specification into implementation. Accepted decisions must not be silently reversed in implementation tickets.
