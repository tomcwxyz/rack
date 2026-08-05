# AGENTS.md

This file carries the **Coding** Set-up from **Coding basics** (0.1.0).

Repository context, code craft and safe implementation.

Use these instructions as standing project guidance. Required boundaries take precedence when instructions appear to conflict.

## Destination notes

- **Commands become procedures.** AGENTS.md can describe a repeatable task and suggested invocation, but this portable file does not register executable commands.

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

## Repeatable tasks

### Implement a feature

<!-- rack:task.implement-feature@0.1.0; criticality:recommended -->

Implement a feature from an agreed specification.

Use the existing architecture where it is sound. Keep the change componentised and leave the repository in a buildable state.

**Task:** Implement a feature

**Suggested invocation:** /implement-feature — reference only; this file does not install a command.

**Inputs**

- Feature specification — required

**Approach**

1. Inspect the existing implementation

2. Identify components and tests

3. Make the smallest coherent change

4. Run checks and review the diff
