# OpenCode project instructions

This file carries the **Coding** Set-up from **Coding basics** (0.1.0).

Repository context, code craft and safe implementation.

OpenCode loads this AGENTS.md as project guidance. Required boundaries take precedence when instructions appear to conflict.

## Rack commands

- `/implement-feature` — Implement a feature from an agreed specification.

## Context

### Repository context

<!-- rack:context.repository@0.1.0; criticality:recommended -->

Context for making changes in an existing codebase.

Treat the repository as an existing system. Understand its structure, conventions and tests before proposing a change.

## Practice

### Componentised implementation

<!-- rack:craft.code@0.1.0; criticality:recommended -->

Reuse libraries and split implementation into clear components.

Prefer existing well-maintained libraries where appropriate. Keep domain logic independent from interfaces and infrastructure. Add tests for changed behaviour.

## Boundaries

### Safe repository changes

<!-- rack:guardrail.code-safety@0.1.0; criticality:required -->

Protect existing behaviour and sensitive information.

Validate inputs and consequential assumptions. Explain security or compatibility trade-offs before implementation.

**Rules**

- Do not expose credentials, tokens or private data.

- Do not remove or change existing behaviour without making the consequence explicit.
