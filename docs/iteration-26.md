# Iteration 26 — adaptable shared defaults

## Outcome

Complete the authority distinction in ordinary Set-up behaviour.

Shared practice now behaves differently according to its authority:

- **binding** practice applies and cannot be removed by a nearer Set-up;
- **adaptable** practice applies by default but can be changed or left out locally.

This makes adaptable organisational practice a real default rather than merely an available module.

## Resolver

For every resolved Set-up, Rack finds external adaptable shared instructions which apply to that Set-up's domains.

If an instruction is not explicitly included or excluded locally, its winning resolved instruction is added to the **resolved copy** of the Set-up.

The local Set-up YAML is unchanged.

A new information diagnostic, `RACK-PRACTICE-103`, explains when shared adaptable defaults are being added.

## Local opt-out

The existing Set-up `exclude` list is the local opt-out mechanism.

If a local Set-up excludes an adaptable shared instruction:

- it is not injected;
- no shared source is modified;
- no special private adaptation record is required;
- the local exclusion remains inspectable in ordinary Rack source.

This is deliberately different from binding practice, where a local exclusion is overridden in the resolved copy and produces `RACK-PRACTICE-102`.

## Same-ID adaptations

If a shared source provides adaptable `voice.plain` and the local Rack contains its own `voice.plain`:

- local remains the winning instruction because it is nearer;
- the shared default still activates that instruction in an applicable Set-up unless locally excluded.

The default therefore says "this practice belongs in the Set-up", while normal source precedence decides which adaptable version wins.

## Desktop Set-up editor

The Set-up editor now works from the effective resolved project, while still reading and writing the local Set-up file.

Shared modules are therefore visible in the same instruction list as local modules.

### Binding shared practice

Displayed as:

> Required by shared practice

The selection control is disabled. The user cannot create a misleading local opt-out through the ordinary editor.

### Adaptable shared practice

An untouched adaptable instruction is displayed as:

> Included by shared practice

The user can choose:

- **Include locally** — persist an explicit local inclusion;
- **Leave out** — persist a local exclusion;
- **Included by shared practice** — remove an explicit local decision and return to the default.

Source changes still use the existing guided editor review/diff before save.

## Set-up summaries

The main Set-ups area now uses the effective project.

Counts and Preview therefore agree about instructions added by accepted shared practice.

Editing still writes only the local Set-up source.

## Metadata

`PracticeProfileChange` now reports both:

- all applicable binding/adaptable shared IDs;
- the subset newly added by resolution.

This gives hosts enough information to explain effective state without trying to infer provenance from module criticality or IDs.

## Privacy

A local exclusion is local Rack source.

The shared publisher does not learn:

- who left out an adaptable default;
- who changed it;
- which local version won;
- whether a person accepted the suggested practice.

There is still no feedback/control plane hidden inside practice resolution.

## Acceptance

1. new applicable adaptable shared practice is active by default;
2. local exclusion prevents adaptable default activation;
3. binding shared practice still overrides exclusion;
4. local same-ID adaptation remains the winning content;
5. shared default can activate that local adaptation;
6. domain applicability is respected;
7. effective Set-up counts match Preview behaviour;
8. the guided editor identifies binding shared practice as required;
9. the guided editor can persist a local opt-out for adaptable practice;
10. returning to the default removes the explicit local decision.
