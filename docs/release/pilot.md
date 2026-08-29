# Signed pilot desktop releases

Rack pilot desktop releases are built through the manual **Pilot desktop release** GitHub Actions workflow.

The workflow is deliberately fail-closed:

- it only runs successfully from `main`;
- the typed version must match `apps/desktop/src-tauri/tauri.conf.json`;
- the confirmation input must be exactly `RELEASE`;
- Windows signing configuration must be present;
- macOS Developer ID signing and notarisation configuration must be present;
- GitHub creates a **draft pre-release**, never an automatically published release.

The workflow currently builds:

- Windows x64 — NSIS and MSI;
- macOS Apple Silicon — app bundle and DMG;
- macOS Intel — app bundle and DMG.

Linux remains outside the supported private-pilot release gate.

## Current pilot version

```text
0.1.0-pilot.1
```

The desktop package, Tauri configuration, Rust crate and Cargo lock must all carry the same version. `apps/desktop/src/releaseVersion.test.ts` enforces this.

## GitHub signing configuration

The workflow expects the following repository configuration.

### Windows

Secrets:

- `WINDOWS_CERTIFICATE` — base64-encoded PFX certificate;
- `WINDOWS_CERTIFICATE_PASSWORD` — password used to export/import that PFX.

Repository variable:

- `WINDOWS_TIMESTAMP_URL` — timestamp server recommended by the certificate issuer.

The runner imports the certificate into the current-user certificate store, derives its thumbprint and writes a temporary Tauri configuration override. No thumbprint is committed to the repository.

The temporary override sets:

- the imported certificate thumbprint;
- SHA-256 signing;
- the configured timestamp URL.

The workflow refuses to build a pilot release if the certificate or timestamp configuration is absent.

### macOS

Secrets:

- `APPLE_CERTIFICATE` — base64-encoded Developer ID Application `.p12`;
- `APPLE_CERTIFICATE_PASSWORD` — export password for the `.p12`;
- `APPLE_API_KEY` — App Store Connect API key ID;
- `APPLE_API_ISSUER` — App Store Connect issuer ID;
- `APPLE_API_KEY_BASE64` — base64-encoded `.p8` private key.

The runner creates an ephemeral keychain, imports the certificate explicitly as PKCS#12 and derives the `Developer ID Application` identity.

It separately writes the App Store Connect private key into the runner's temporary directory and gives Tauri its path for notarisation.

No Apple certificate or API key file is committed to the repository.

## Preparing certificate values

### Windows PFX

Create/export the signing PFX according to the certificate provider's instructions, then base64-encode the binary before storing it in `WINDOWS_CERTIFICATE`.

On PowerShell:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("certificate.pfx")
) | Set-Clipboard
```

Store the PFX password separately in `WINDOWS_CERTIFICATE_PASSWORD`.

### macOS Developer ID certificate

Export the Developer ID Application certificate and private key from Keychain Access as a password-protected `.p12`.

Then:

```bash
openssl base64 -A -in DeveloperIDApplication.p12
```

Store that output as `APPLE_CERTIFICATE`, and the export password as `APPLE_CERTIFICATE_PASSWORD`.

### App Store Connect API key

Download the `.p8` private key when creating the App Store Connect API key.

Then:

```bash
openssl base64 -A -in AuthKey_ABC123DEFG.p8
```

Store:

- the base64 output as `APPLE_API_KEY_BASE64`;
- `ABC123DEFG` as `APPLE_API_KEY`;
- the associated issuer ID as `APPLE_API_ISSUER`.

## Running a pilot release

1. Merge the intended release code to `main`.
2. Confirm CI on `main` is green.
3. In GitHub Actions, open **Pilot desktop release**.
4. Choose **Run workflow** from `main`.
5. Enter the exact current desktop version, for example `0.1.0-pilot.1`.
6. Enter `RELEASE` in the confirmation field.
7. Run the workflow.
8. Review all three platform jobs.
9. Inspect the resulting draft GitHub release and its assets.
10. Test the installers on clean Windows and macOS machines before publishing the draft to pilot participants.

Do not publish a draft whose signing or notarisation job failed.

## Version bumping

For the next pilot build, use the version helper:

```bash
pnpm desktop:version 0.1.0-pilot.2
```

It updates the desktop package, Tauri configuration, Rust package and Cargo lock together.

Pilot versions must use the `x.y.z-pilot.N` form, for example:

```text
0.1.0-pilot.2
0.1.0-pilot.3
```

The release-version test must pass before merging.

## Not included yet

This workflow does not enable the Tauri updater.

Pilot participants receive explicit installer releases. Automatic updater signing, update manifests and in-app update UX should be added as a separate change after the direct-release path is proven.
