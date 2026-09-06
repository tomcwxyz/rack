# @rack/starter

The bundled Rack Starter library. It is deliberately local and inspectable: no executable plug-ins, network fetches, credentials or host configuration.

The public catalogue can combine RACK-authored content with explicitly attributed external practice packs. Every entry is rendered as ordinary Rack Markdown/YAML source, carries its own `harness.source.origin` and `harness.source.license`, and receives a deterministic content digest. Source, licence and upstream attribution travel in the copied Markdown so a person can inspect where a practice came from before importing it.

RACK-authored Starter entries use `origin: rack-starter` and `license: CC BY 4.0`. External entries retain their declared upstream provenance and licence rather than being silently relabelled as RACK content. Full notices for bundled third-party material live in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## External packs

### Honey for Devs

The first external pack is a RACK-native adaptation of [Honey for Devs](https://github.com/Green-PT/honey-for-devs) by Green-PT, pinned to upstream revision `61f25a5b728ae16be18ebf1700a6a6454f5bb591` and retained under the MIT licence.

The `honey-lean-coding` template combines eight Honey-derived instructions with existing RACK coding practice for repository context, dependency restraint, testing, security, compatibility and verification. It focuses on minimum necessary code, cause-level fixes, context economy, deliberate shortcuts, concise engineering communication, efficient agent hand-off, safety carve-outs and a separate lean-review task.

Honey's runtime hooks, persistent host state, installers, ESON/PX helpers and other executable tooling are **not** bundled. RACK treats those as host/runtime compatibility concerns, preserving the boundary that Starter and shared practice cannot ship executable verifier or plug-in code.

Importing any Starter entry copies the reviewed source into a local Rack. The catalogue never owns or silently updates the copied file afterwards.

Software used to render, search and validate the catalogue follows the repository's Apache-2.0 licence. RACK-authored Starter content remains CC BY 4.0; external content retains the licence shown on the individual entry.
