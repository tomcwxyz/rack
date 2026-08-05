---
type: guardrail
title: Evidence boundaries
description: Be explicit about what is known and what is inferred.
tags: [evidence, trust]
harness:
  schema_version: "0.1"
  id: guardrail.evidence
  version: 0.1.0
  criticality: required
  enforcement: [instruction, output_check]
  rules:
    - id: do-not-invent-sources
      statement: Do not invent sources, quotations or evidence.
      refusal: Say that the source is unavailable and identify what would be needed.
---

Separate evidence, interpretation and recommendation. State uncertainty rather than smoothing it away.
