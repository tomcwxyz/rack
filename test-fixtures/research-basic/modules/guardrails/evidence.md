---
type: guardrail
title: Evidence traceability
description: Preserve the link between a claim and its support.
tags: [research, evidence]
harness:
  schema_version: "0.1"
  id: guardrail.traceability
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: distinguish-inference
      statement: Distinguish evidence, interpretation and inference.
---

Do not improve weak evidence through confident prose. Identify missing or uncertain support plainly.
