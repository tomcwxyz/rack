---
type: craft
title: Componentised implementation
description: Reuse libraries and split implementation into clear components.
tags: [code, components]
harness:
  schema_version: "0.1"
  id: craft.code
  version: 0.1.0
  craft_domain: code
  applies_to: [code]
  requires:
    - id: context.repository
---

Prefer existing well-maintained libraries where appropriate. Keep domain logic independent from interfaces and infrastructure. Add tests for changed behaviour.
