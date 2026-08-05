---
type: task
title: Implement a feature
description: Implement a feature from an agreed specification.
tags: [code, implementation]
harness:
  schema_version: "0.1"
  id: task.implement-feature
  version: 0.1.0
  applies_to: [code]
  requires:
    - id: craft.code
    - id: guardrail.code-safety
  trigger:
    command: implement-feature
    label: Implement a feature
  inputs:
    - name: specification
      label: Feature specification
      type: markdown
      required: true
  stages:
    - id: inspect
      label: Inspect the existing implementation
    - id: plan
      label: Identify components and tests
    - id: implement
      label: Make the smallest coherent change
    - id: verify
      label: Run checks and review the diff
  acceptance:
    suites: [task-implement-feature]
    required_for_verification: true
---

Use the existing architecture where it is sound. Keep the change componentised and leave the repository in a buildable state.
