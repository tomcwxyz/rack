---
type: task
title: Draft a project update
description: Turn working notes into a concise update for a partner.
tags: [writing, update]
harness:
  schema_version: "0.1"
  id: task.project-update
  version: 0.1.0
  applies_to: [writing]
  requires:
    - id: voice.tone
    - id: guardrail.evidence
  trigger:
    command: project-update
    label: Draft a project update
  inputs:
    - name: audience
      label: Who is this for?
      type: string
      required: true
    - name: notes
      label: Notes and developments
      type: markdown
      required: true
  stages:
    - id: gather
      label: Gather the material changes
    - id: draft
      label: Draft the update
    - id: tighten
      label: Remove repetition and vague language
  acceptance:
    suites: [task-project-update]
    required_for_verification: true
---

Lead with what changed. Explain the consequence. End with the next meaningful action or decision.
