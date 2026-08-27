# Iteration 24 — copy and accessibility guardrails

## Outcome

Turn RACK's plain-language and accessibility expectations into automated product guardrails rather than relying only on review.

Iteration 24 adds:

- a reusable interface copy-rules package;
- an automated audit of ordinary desktop surfaces;
- British English checks;
- a boundary between ordinary and advanced technical language;
- hype and management-dashboard language checks;
- long-sentence warnings;
- stronger visible focus;
- reduced-motion support;
- contrast regression tests against the actual desktop palette.

## Plain language is contextual

RACK should not pretend technical terms are inherently bad.

The rule is:

> Ordinary use should not require technical vocabulary. Advanced/source views may use it where it is useful.

The copy checker therefore supports two contexts.

### Ordinary

Ordinary surfaces flag terms such as:

- YAML;
- JSON;
- Git;
- frontmatter;
- dependency graph;
- schema version;
- semantic version;
- token budget;
- tokenisation.

The expectation is either:

- replace the term with plain language;
- explain it;
- or move the detail behind an advanced/source interaction.

### Advanced

Advanced surfaces may use those terms.

They still receive the general checks for:

- British English;
- hype;
- dashboard/KPI framing;
- excessively long sentences.

## British English

The interface defaults to British English.

The first rules cover common drift such as:

- organization → organisation;
- organizational → organisational;
- customize → customise;
- color → colour;
- center → centre;
- prioritize → prioritise.

This is deliberately a small explicit list rather than an unreliable automatic "American English" detector.

## No-bullshit language

The checker warns on product-copy language such as:

- seamless;
- supercharge;
- revolutionary;
- AI-powered;
- unlock potential.

RACK should describe what it does rather than imply magic.

The checker also warns on management-dashboard language such as:

- dashboard;
- KPI;
- compliance score;
- completion rate.

These terms are not prohibited concepts. The warning asks whether they are actually the best framing for the work.

A surface can explicitly allow a term when it is genuinely needed.

## Desktop copy audit

The copy-rules tests inspect the TSX source of the main desktop surfaces.

Ordinary surfaces include:

- route choice;
- proposition controls;
- Writing;
- Research;
- Coding;
- workspace navigation;
- Your Rack;
- Shared practice.

Technical maintenance surfaces such as Set-ups, Preview and Checks are audited in advanced mode.

The audit extracts user-facing:

- JSX text;
- labels;
- titles;
- placeholders;
- descriptions;
- summaries;
- status/error strings where practical.

This is intentionally not a full natural-language parser. It is a regression guard which catches common drift while still relying on human judgement for good writing.

## Sentence length

Ordinary copy receives a warning when a sentence exceeds the configured word limit.

The reusable package defaults to 32 words.

The initial desktop regression audit allows up to 40 words so adoption does not encourage arbitrary copy churn. The threshold can tighten as copy is revised.

RACK does not use a pseudo-precise reading-age score as a proxy for clarity.

## Focus

RACK already had a global `:focus-visible` treatment.

Iteration 24 strengthens it to a two-part indicator:

- a light inner outline;
- a darker accent outer ring.

This is intentional because a single pale ring had good contrast on dark buttons but insufficient non-text contrast on light surfaces.

The regression test verifies both sides of the two-colour treatment against the palette.

## Contrast

The desktop test calculates WCAG contrast ratios from the CSS variables themselves.

It protects key combinations including:

- primary text on the application ground;
- muted text on paper;
- accent text on paper;
- moss text on paper;
- error text on error background;
- success text on success background.

Text combinations are held to at least 4.5:1.

The focus treatment is held to at least 3:1 through its two contrasting parts.

This means later palette changes can fail CI rather than silently weakening accessibility.

## Reduced motion

RACK now honours `prefers-reduced-motion: reduce`.

When enabled:

- transitions are effectively removed;
- animations are reduced to a single near-zero-duration cycle;
- smooth scrolling is disabled.

The rule applies to current and future motion without requiring each component author to remember an accessibility branch.

## What this does not prove

Passing these tests does not mean "RACK is WCAG compliant".

Automated checks cannot prove:

- complete keyboard flows;
- correct screen-reader order and announcements;
- useful alternative text;
- zoom/reflow behaviour;
- cognitive accessibility;
- error recovery quality;
- platform-specific Tauri accessibility behaviour.

The product should continue to use manual accessibility testing and pilot feedback.

## Deliberately deferred

- browser/desktop automated keyboard-flow tests;
- dedicated screen-reader regression fixtures;
- zoom and reflow review;
- forced-colours/high-contrast-mode refinements;
- copy auditing for every service/admin surface;
- localisation beyond British English;
- a user-facing accessibility settings panel.

## Acceptance

1. copy rules build as a standalone workspace package;
2. ordinary technical jargon is flagged while advanced usage is allowed;
3. common US spellings are flagged;
4. hype/dashboard language is flagged;
5. main desktop surfaces are audited from source;
6. primary palette text pairs remain at least 4.5:1;
7. focus treatment has a >=3:1 path on both light and dark controls;
8. reduced-motion preference is respected;
9. existing visible focus remains keyboard-specific through `:focus-visible`;
10. no test claims automated accessibility compliance.
