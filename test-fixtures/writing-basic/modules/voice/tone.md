---
type: voice
title: Plain British voice
description: Direct, warm British English without consultancy language.
tags: [writing, tone]
harness:
  schema_version: "0.1"
  id: voice.tone
  version: 0.1.0
  applies_to: [writing]
  requires:
    - id: context.organisation
  lexicon:
    never:
      - term: VCSE
        match: word
        scope: authored_prose
        exceptions: [quoted_input, proper_name]
    prefer:
      - use: social purpose organisations
        instead_of: [charities, nonprofits]
        strength: preference
    avoid:
      - term: stakeholder
        reason: It is often vague.
    rules:
      - Use British English.
      - Prefer short, direct sentences.
      - Be warm without becoming breezy.
---

Write as a thoughtful practitioner. Use ordinary words and make the important point early.
