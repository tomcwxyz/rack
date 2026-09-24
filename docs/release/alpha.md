# Desktop alpha releases

RACK desktop alphas are signed cross-platform builds for hands-on testing before the paired private pilot.

## Current alpha

```text
0.2.0-alpha.1
```

This is deliberately a higher version line than the earlier `0.1.0-pilot.1` test build, so semantic versioning and Windows installer versions both move forwards.

## What this alpha is testing

The key test is the complete product loop:

1. start from the work somebody wants to do;
2. choose an opinionated Starter Pack without needing to understand RACK internals;
3. create and inspect the resulting local practice;
4. select a real work-project folder;
5. detect and hand practice to a supported AI host;
6. understand what is native, RACK-provided, human, degraded or unavailable on that host;
7. do real work;
8. return to due practice and record **Keep / Change / Remove**;
9. confirm that review history remains local and canonical practice only changes explicitly.

TOPO context, RACK verification and optional Ship Check evidence should be tested where useful, but they are not prerequisites for completing the basic loop.

## Release workflow

Run the **Desktop alpha release** GitHub Actions workflow from `main`.

The workflow fails closed unless the requested version matches the desktop source, uses `x.y.z-alpha.N`, the confirmation input is `RELEASE`, signing/notarisation configuration is present, and repository checks pass on the exact release commit.

It builds a draft GitHub pre-release for:

- Windows x64 — NSIS and MSI;
- macOS Apple Silicon — app bundle and DMG;
- macOS Intel — app bundle and DMG;
- Linux x64 — `.deb` and AppImage.

It then verifies Windows Authenticode signatures, macOS code signatures and notarisation staples, Linux packages, and publishes `SHA256SUMS.txt`.

## GitHub signing configuration

The release workflow expects the following repository configuration.

### Windows

Secrets:

- `WINDOWS_CERTIFICATE` — base64-encoded PFX certificate;
- `WINDOWS_CERTIFICATE_PASSWORD` — password used to export/import that PFX.

Repository variable:

- `WINDOWS_TIMESTAMP_URL` — timestamp server recommended by the certificate issuer.

The runner imports the certificate into the current-user certificate store, derives its thumbprint and writes a temporary Tauri configuration override. No thumbprint is committed to the repository.

The temporary override sets SHA-256 signing, the configured timestamp URL and a WiX-compatible numeric installer version derived from the alpha version. For example, `0.2.0-alpha.1` becomes `0.2.0.1`.

### macOS

Secrets:

- `APPLE_CERTIFICATE` — base64-encoded Developer ID Application `.p12`;
- `APPLE_CERTIFICATE_PASSWORD` — export password for the `.p12`;
- `APPLE_API_KEY` — App Store Connect API key ID;
- `APPLE_API_ISSUER` — App Store Connect issuer ID;
- `APPLE_API_KEY_BASE64` — base64-encoded `.p8` private key.

The runner creates an ephemeral keychain, imports the certificate as PKCS#12 and derives the Developer ID Application identity. It writes the App Store Connect private key only into the runner's temporary directory for notarisation. No Apple certificate or API-key file is committed to the repository.

## Preparing certificate values

### Windows PFX

Create or export the signing PFX according to the certificate provider's instructions, then base64-encode the binary before storing it in `WINDOWS_CERTIFICATE`.

On PowerShell:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("certificate.pfx")
) | Set-Clipboard
```

Store the PFX password separately in `WINDOWS_CERTIFICATE_PASSWORD`.

### macOS Developer ID certificate

Export the Developer ID Application certificate and private key from Keychain Access as a password-protected `.p12`, then encode it:

```bash
openssl base64 -A -in DeveloperIDApplication.p12
```

Store that output as `APPLE_CERTIFICATE`, and the export password as `APPLE_CERTIFICATE_PASSWORD`.

### App Store Connect API key

Download the `.p8` private key when creating the App Store Connect API key, then encode it:

```bash
openssl base64 -A -in AuthKey_ABC123DEFG.p8
```

Store:

- the base64 output as `APPLE_API_KEY_BASE64`;
- `ABC123DEFG` as `APPLE_API_KEY`;
- the associated issuer ID as `APPLE_API_ISSUER`.

## Version bumping

Use:

```bash
pnpm desktop:version 0.2.0-alpha.2
```

The helper supports both `alpha.N` and later `pilot.N` channels and updates the desktop package, Tauri config, Rust package and Cargo lock together.

## Acceptance gate

Automated release checks must be green on Windows, both macOS architectures and Linux before the draft is considered usable.

Hands-on testing should then cover:

- signed install and clean launch on Windows x64;
- Gatekeeper-clean DMG install on macOS Apple Silicon and Intel;
- `.deb` and AppImage launch on Linux x64;
- Writing, Research and Coding first-use routes;
- **Use this**, **Change a few things** and **Show me why**;
- Rack creation, restart and reopen;
- separate work-project selection;
- host discovery and capability-aware hand-off with Claude Code, Codex or OpenCode where installed;
- install, drift inspection and remove/restore of RACK-managed host output;
- one RACK-owned Coding verification plan;
- **Keep**, **Change** and **Remove** practice reviews;
- confirmation that Remove stays visible until an explicit source/Set-up change;
- confirmation that `.rack/practice-reviews.json` remains ignored by Git;
- local use without an account or managed model connection;
- TOPO absent → permission-needed → connected → changed states where TOPO is available.

Do not publish the draft if signing/notarisation fails, an installer cannot launch cleanly, or the end-to-end loop has a blocking data-loss or practice-boundary defect.

Automatic updater manifests and updater signatures remain disabled for this alpha.
