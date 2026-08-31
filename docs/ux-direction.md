# RACK UX direction

**Status:** active design direction  
**Updated:** 31 August 2026

RACK should feel like a practical way to teach AI how to work with you, not like a configuration editor for an instruction compiler.

The underlying architecture remains inspectable. The ordinary interface should expose it only when understanding the machinery helps somebody make a real decision.

## The core journey

The preferred mental model is:

```text
What are you doing?
        ↓
What do we already know?
TOPO · existing Rack · imported material
        ↓
What is still missing?
        ↓
Suggested working practice
accept · change · leave out
        ↓
Set-up for this kind of work
        ↓
Send/use with an AI tool
        ↓
Do the work
        ↓
Verify / review / improve
```

## 1. Ask for less

The proposition-first work remains the right direction, but TOPO changes what counts as a genuine gap.

Before asking a person to type context, RACK should consider:

1. reviewed TOPO context, when local sharing is enabled;
2. existing local Rack context;
3. material the person has explicitly imported;
4. safe Starter defaults;
5. only then, a direct question.

TOPO is not automatically correct. Memory should be shown as reviewable material which can be selected, corrected or ignored.

The design target is:

> Do not make somebody retype something the system can safely surface for review.

## 2. Separate knowledge from decisions

RACK should not use TOPO to decide working practice on the person's behalf.

TOPO can help answer:

- who or what is this work about?
- what project history is relevant?
- what preferences or known constraints may matter?

RACK still needs the person to decide:

- is this how I want AI to work?
- is this boundary appropriate?
- should this practice be binding, adaptable or local?
- should this proposal be accepted, changed or left out?

That distinction should be obvious in the interaction.

## 3. Prefer verbs in ordinary navigation

FIELD STATION's strongest UI lesson is that actions are easier to understand than architecture labels.

Where practical, ordinary surfaces should prefer language close to:

- create or improve your working practice;
- organise it for a kind of work;
- use it with a tool;
- check the work;
- share practice;
- review changes.

Formal terms such as module, schema, adapter, provenance and verification plan remain available in advanced/source views.

The existing labels **Your Rack**, **Set-ups**, **Preview and export**, **Checks** and **Verify work** should be tested against this verb-led approach rather than renamed mechanically.

## 4. Keep RACK as the canonical concept for now

FIELD STATION's **handbook** framing is useful because it makes the artefact feel owned and readable.

It should be tested as copy, onboarding language or a metaphor, but it should not currently replace the Rack format or create a second product model.

A usability test should compare whether people better understand:

- "Create a Rack";
- "Create your AI working practice";
- "Create a handbook for this work".

The winning wording should be chosen from observed comprehension, not architectural preference.

## 5. Make TOPO ambient, not mysterious

TOPO connection state should stay visible but quiet.

The important ordinary states are:

- connected;
- permission needed;
- waiting for TOPO;
- unavailable/error.

When context is actually used, RACK should show:

- what it asked TOPO about;
- why;
- what came back;
- what the person selected;
- whether that selection is now stale.

Do not expose loopback endpoints, packet formats or protocol names unless the user opens advanced detail.

## 6. Make data movement explicit

Every boundary should have a plain answer to "what happens if I click this?"

Examples:

- **Add selected to this Rack** — selected memory becomes editable local Rack context; TOPO remains the original source.
- **Use TOPO context for this task** — context is transient for this build/run and does not become Rack source.
- **Accept shared practice** — the accepted external snapshot affects the effective Set-up but does not rewrite local practice.
- **Install for Codex** — generated destination files are written to the shown project path and remain replaceable output.
- **Verify work** — only the configured question and supplied evidence are sent after paid confirmation.

## 7. Improve hand-off to AI tools

The destination experience should become less adapter-centric.

Where safe and feasible, RACK should detect supported local tools and:

- put likely installed destinations first;
- explain the files/context each destination receives;
- show where persistent instructions will be installed;
- distinguish persistent practice from transient task context;
- give a single clear next action after build/install.

Agent runtimes need a different hand-off from coding hosts. RACK should not pretend a generated file is the only integration pattern.

## 8. Use progressive disclosure

Ordinary views should answer:

- what is this?
- why does it matter?
- what will happen?
- what choice do I have?

Advanced views can answer:

- which source won?
- what is the digest?
- what schema/version is this?
- what capability degraded?
- what exact source or generated package will be used?

The advanced information should remain complete. It simply should not be the first thing somebody must understand.

## 9. Treat Linux as a product platform

Linux work is not only a packaging task.

The UX must cover:

- native folder/file pickers;
- application discovery;
- TOPO discovery and permission flows;
- generated destination paths;
- installation guidance;
- desktop integration;
- clear behaviour when a host application is installed differently across distributions.

Cross-platform UI tests should verify the same concepts and choices even when platform-specific detail differs.

## 10. Test the whole working loop

Pilot sessions should use real work.

Useful observation points:

- what people think RACK is for before explanation;
- whether TOPO removes repeated data entry;
- whether users notice and understand what memory is being used;
- whether practice proposals feel helpful or generic;
- whether Set-ups make sense as a concept;
- whether destination hand-off is obvious;
- whether verification feels like useful assurance or another configuration step;
- where users expect history/learning from completed work to go.

UX findings that imply a semantic schema change should be treated separately from copy/navigation improvements and require the normal ADR/version review.
