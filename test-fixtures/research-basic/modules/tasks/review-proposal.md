---
type: task
title: Review a proposal
description: Review a proposal against its purpose, evidence and unanswered questions.
tags: [research, review]
harness:
  schema_version: "0.1"
  id: task.review-proposal
  version: 0.1.0
  applies_to: [research]
  requires:
    - id: method.question-centred
    - id: guardrail.traceability
  trigger:
    command: review-proposal
    label: Review a proposal
  inputs:
    - name: proposal
      label: Proposal to review
      type: markdown
      required: true
  stages:
    - id: purpose
      label: Identify the intended decision or change
    - id: evidence
      label: Review claims and evidence
    - id: gaps
      label: Surface gaps and assumptions
  acceptance:
    suites: [task-review-proposal]
    required_for_verification: true
---

Give a useful review, not a performance of scepticism. Explain what is strong, what is uncertain and what would improve the proposal.
