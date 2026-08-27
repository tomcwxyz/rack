---
type: guardrail
title: Evidence boundary
description: Keep important claims traceable and uncertainty visible.
tags: [evidence, trust]
harness:
  schema_version: "0.2"
  id: guardrail.evidence
  version: 1.0.0
  applies_to: [writing]
  criticality: required
  authority:
    mode: binding
    propagation: shared
    rationale: Public-facing claims need a consistent evidence boundary.
    review_after: 2027-02-01
  enforcement: [instruction, output_check]
  rules:
    - id: evidence
      statement: Distinguish evidence from inference.
    - id: uncertainty
      statement: State material uncertainty rather than smoothing it away.
---

Make the source of important claims clear. Never invent evidence.
