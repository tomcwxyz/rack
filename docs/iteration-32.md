# Iteration 32 — paired context and cross-platform pilot hardening

## Outcome

Make the proven TOPO → RACK local-context path reliable enough to become an ordinary paired-product workflow, while promoting Linux from experimental development support to a supported-pilot target.

This iteration deliberately comes before the previously planned deterministic verifier registry. Verification remains on the roadmap, but the TOPO/RACK pairing exposed a more fundamental product dependency: the applications need to behave reliably together across the platforms we intend people to use.

## First implementation slice

### Linux desktop CI and packages

RACK now treats Linux as a native desktop build rather than only the operating system used for TypeScript tests.

The CI path adds:

- Ubuntu 22.04 desktop dependencies;
- Rust/Tauri native checking;
- document-import and TOPO-local Rust tests;
- real `.deb` and AppImage bundle construction when desktop paths change.

The manual pilot release matrix now includes Linux x64 and uploads `.deb` and AppImage artefacts into the same draft pre-release as Windows and macOS.

Windows signing and macOS signing/notarisation remain unchanged. Linux does not weaken those fail-closed requirements.

### TOPO discovery state

RACK previously treated every discovery-file error as if TOPO simply was not running.

That collapsed materially different situations:

- TOPO is absent;
- a discovery file exists but has unsafe permissions;
- a discovery file is malformed or unsupported;
- TOPO was discovered but the local endpoint is temporarily unreachable.

Iteration 32 separates invalid discovery into a **connection issue** state while preserving:

- waiting for TOPO;
- permission needed;
- update needed;
- reconnecting;
- connected.

The ordinary UI uses shared plain-language state/copy helpers so the creation and build surfaces do not drift.

### Participant installation guidance

Linux documentation now covers checksum verification, `.deb` installation/removal, portable AppImage execution and the first compatibility baseline. It also records the desktop-`PATH` constraint that later host detection must handle explicitly.

### Release provenance

After all platform jobs complete, the release workflow downloads the draft artefacts, creates a deterministic `SHA256SUMS.txt` manifest and uploads it back to the same draft release. An empty artefact set fails closed rather than publishing an empty manifest.

### Tests

The first slice adds coverage that:

- missing discovery is distinct from invalid discovery;
- capability classification distinguishes permission-off, unsupported and connected states;
- TOPO state copy remains consistent;
- the pilot release workflow cannot silently drop Linux packaging.

## Platform target

Linux remains labelled experimental until the full iteration acceptance criteria are met.

The intended supported-pilot baseline is:

- Linux x86_64;
- Debian/Ubuntu-compatible direct distribution;
- `.deb` and AppImage;
- paired TOPO/RACK local-context workflow tested end to end.

FIELD STATION's Debian/Flatpak work remains useful implementation evidence. Flatpak and arm64 are follow-on targets once the first release path is reliable.

## Remaining work in Iteration 32

- exercise native Linux installation rather than build-only CI;
- run a paired TOPO/RACK Linux acceptance journey against the installed applications;
- test reconnection when TOPO restarts or rotates its discovery token;
- test stale/expired Context Packets in the desktop journey;
- add richer release provenance beyond the SHA-256 artefact manifest;
- decide whether Flatpak joins the first supported pilot or the immediate follow-on.

## Acceptance

1. Linux desktop code is checked and packaged on desktop-related CI changes.
2. The pilot release produces Windows, macOS and Linux artefacts from one explicit manual release.
3. Linux packaging failures block the relevant release job.
4. Missing TOPO and invalid TOPO discovery are distinguishable.
5. Sharing-off, unsupported, unreachable and connected states remain distinguishable.
6. Ordinary connection copy is shared across desktop surfaces.
7. TOPO context still requires explicit local sharing and explicit use.
8. No TOPO context becomes canonical RACK source merely because the applications are paired.
9. Installed Linux RACK can discover and use an installed/running TOPO through the same local boundary.
10. Release/install documentation is sufficient for a pilot participant who does not have a development environment.
