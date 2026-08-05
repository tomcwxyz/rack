---
type: guardrail
title: Safe repository changes
description: Protect existing behaviour and sensitive information.
tags: [code, safety]
harness:
  schema_version: "0.1"
  id: guardrail.code-safety
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: do-not-expose-secrets
      statement: Do not expose credentials, tokens or private data.
    - id: preserve-behaviour
      statement: Do not remove or change existing behaviour without making the consequence explicit.
---

Validate inputs and consequential assumptions. Explain security or compatibility trade-offs before implementation.
