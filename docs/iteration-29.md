# Iteration 29 — signed pilot distribution

## Outcome

Create the first supported distribution path for Rack's private desktop pilot.

The release path is intentionally narrower than the normal Tauri multi-platform example:

- Windows x64;
- macOS Apple Silicon;
- macOS Intel;
- no Linux pilot support;
- no automatic updater yet.

## Version

The first pilot version is:

```text
0.1.0-pilot.1
```

It is aligned across:

- desktop package metadata;
- Tauri app configuration;
- Rust package metadata;
- Cargo lock.

A desktop regression test fails if those versions diverge or return to `0.0.0`.

## Trigger

`.github/workflows/pilot-release.yml` is **workflow_dispatch only**.

A release run must:

1. be dispatched from `main`;
2. provide the exact app version;
3. type `RELEASE` explicitly.

This prevents tags/releases being created merely because a branch was pushed.

## Release state

Tauri Action creates:

- tag: `rack-v__VERSION__`;
- release name: `Rack __VERSION__ · pilot`;
- draft release;
- pre-release marker.

The workflow does not publish the draft.

A person must inspect the platform jobs and assets before making it visible to pilot participants.

## Windows signing

The workflow imports a base64 PFX from GitHub Secrets into the current-user certificate store.

It derives the certificate thumbprint during the run and creates a temporary Tauri config override containing:

- thumbprint;
- SHA-256 digest;
- repository-configured timestamp URL.

The thumbprint and certificate are not committed.

## macOS signing and notarisation

The workflow imports a Developer ID Application certificate into an ephemeral runner keychain.

It derives the signing identity rather than storing an identity string in source.

The App Store Connect API private key is decoded into the runner temporary directory and supplied to Tauri for notarisation.

Both Intel and Apple Silicon direct-download builds are signed and notarised.

## Fail-closed boundary

Before any native release runner starts, preflight checks that every required signing/notarisation value is non-empty.

Missing configuration fails the release instead of falling back to:

- unsigned Windows installers;
- ad-hoc macOS signing;
- unnotarised DMGs.

That boundary is deliberate for a supported private pilot.

## Action version

The release workflow pins the current Tauri action release tag:

```text
tauri-apps/tauri-action@action-v1.0.0
```

It does not use a floating action branch.

## Deliberately deferred

- Linux release packaging;
- automatic updater;
- updater signing key;
- public stable-release workflow;
- stores;
- unattended release-on-tag;
- automatic publication of draft releases.

## Acceptance

1. app version is no longer `0.0.0`;
2. desktop release versions stay aligned;
3. release can only be dispatched manually from `main`;
4. requested version must match source;
5. explicit release confirmation is required;
6. missing platform credentials stop the workflow before builds;
7. Windows signing is configured from imported PFX material;
8. macOS uses Developer ID signing plus notarisation;
9. both macOS architectures are produced;
10. release remains draft + pre-release;
11. Linux is not presented as supported pilot output;
12. updater remains outside this iteration.
