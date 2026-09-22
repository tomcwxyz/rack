# RACK alpha UI and brand review

**Status:** release-gate review  
**Date:** 22 September 2026

## What already feels like RACK

The current interface already has the right family resemblance: warm paper rather than glossy SaaS chrome, editorial serif headings, restrained purple and moss accents, plain British English, local-first reassurance and progressive disclosure of technical machinery.

The alpha should refine that direction rather than introduce a new visual identity.

## Review findings

### 1. The hierarchy is stronger than the brand signature

The app is readable, but several surfaces resolve to the same pattern: rounded card, pale background, light shadow and pill labels. That makes important choices, supporting information and technical state feel too similar.

For the alpha:

- use a quieter default surface with less shadow;
- reserve stronger elevation/accent treatments for a genuine next action or selected state;
- use a small RACK rail/rung motif with the wordmark as a recognisable signature;
- let typography, spacing and a visible edge/spine do more of the hierarchy work.

### 2. First use still contains some configuration language

The first-run structure is now right, but some copy still describes what Rack is doing internally rather than what the person gets.

For the alpha:

- keep **Teach AI how you work** as the proposition;
- describe Starter Packs as **starting points** or **ways to work** before calling them packs;
- make the default choice obvious without hiding alternatives;
- use **Why this works** and **Change a few things** before provenance/source language;
- keep exact source, licence, Set-ups and adapter detail available underneath.

### 3. Coding has more product character than Writing and Research

Coding starting points currently represent distinct working philosophies. Writing and Research are useful but shallower compositions.

For the alpha:

- deepen the existing Writing and Research packs rather than adding more packs;
- make Clear everyday writing include drafting/review discipline and useful structure;
- make Client communication explicitly separate observation, recommendation and next step;
- make Evidence review start from the question and carry uncertainty/evidence boundaries throughout;
- make Decision research include comparable evidence, triangulation and traceable synthesis.

### 4. The work loop should be visible everywhere

The product has converged on a strong loop:

**Start well → use it in real work → check what matters → keep/change/remove what you learned.**

The UI should reinforce that loop rather than make Work, Improve and Check feel like independent feature areas.

### 5. Purple currently does too many jobs

Purple should mean **choice, action or selected practice**, not simply “important”. Moss should remain the calmer signal for provenance, connected/healthy state and grounded information. Neutral paper/ink should carry most ordinary structure.

## Alpha visual rules

- Warm paper and ink remain the base.
- Georgia/system typography remains for now; no bundled font dependency is introduced for the alpha.
- One restrained RACK motif accompanies the lowercase wordmark.
- Default cards become flatter and more editorial.
- Selected/recommended/action surfaces may use a purple edge or wash.
- Success/context surfaces use moss.
- Destructive/error surfaces stay warm red.
- No gradients purely for decoration; gradients are kept only where they communicate focus/state.
- No new icon library is introduced.
- Exact technical detail remains progressively disclosed.

## Alpha acceptance checks

Before release:

1. A new user can identify the primary next action on welcome, work-type choice, starting-point choice and Work.
2. The recommended starting point is visible without making alternatives look disabled.
3. Writing, Research and Coding each feel like coherent practices rather than collections of modules.
4. A person can reach source/provenance detail, but does not need it to make the first decision.
5. Work → hand-off → check → improve reads as one loop.
6. The app still works at the configured 860×620 minimum window.
7. Focus states and contrast remain visible without relying on colour alone.
8. The release keeps local-first/privacy boundaries explicit where data or files move.
