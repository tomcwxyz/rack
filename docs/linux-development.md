# Linux desktop development and support

## Status

Linux desktop support is **currently experimental**, but it is now a Phase 3 priority and a **supported-pilot target** rather than a later nice-to-have.

Rack has already been tested successfully using the Debian Linux development environment on ChromeOS (Crostini), including launching the native Tauri application, creating a Rack project and saving it locally.

The Phase 3 goal is to make Linux a normal pilot platform alongside Windows and macOS. Until the acceptance criteria below are met, the application should continue to describe Linux support as experimental.

## Phase 3 support target

Iteration 32 is establishing the first supported Linux pilot baseline. Native Linux CI plus `.deb`/AppImage bundle construction are now part of the first implementation slice; installed-app paired testing remains before the support label changes.

Required before changing the support label:

- an automated Linux desktop build on the release path;
- a reproducible installable x86_64 package suitable for common Debian/Ubuntu systems;
- a deliberate decision on the first direct-distribution formats, with `.deb` and AppImage as the baseline candidates;
- native smoke coverage for launch, create/open, edit/save, Starter use, build/export/install and restart persistence;
- TOPO local discovery, permission and context exchange tested on Linux;
- release checksums/provenance and installation documentation;
- no Linux-only weakening of Rack's local file, privacy or permission boundaries.

FIELD STATION's Debian/Flatpak packaging experiments are useful implementation evidence and should be reviewed before building a second solution from scratch. They are reference material, not a reason to import FIELD STATION's product or schema changes.

Arm64 and Flatpak are desirable follow-ons. They should be pulled into the supported baseline when CI/release reliability is good enough rather than being allowed to block the first useful Linux pilot package.

## Requirements

Use the normal repository requirements from the root README: Node.js 22.12 or newer, pnpm 10.15 and Rust.

For Debian-based Linux environments, install the Tauri desktop dependencies:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Then install the repository dependencies:

```bash
pnpm install
```

## Run Rack

From the repository root:

```bash
pnpm dev:desktop
```

This starts the native Tauri application. The Tauri development hook first builds the desktop workspace packages needed by Vite, including `@rack/core` and `@rack/managed`.

## Linux icon note

During the first Crostini test, the provisional generated PNG caused Tao/GTK to panic while creating the window with:

```text
data.len() must fit the width, height, and row_stride
```

The provisional PNG source has been replaced with a valid RGBA PNG. Asset generation now refreshes the generated `icon.png` on each run so existing checkouts do not retain the broken file.

The icon is still provisional and should be replaced as part of the final Rack identity work.

## Smoke test

For Linux changes, check at least:

- Rack launches and relaunches;
- create and reopen a Rack;
- native folder selection works;
- edit and save instructions;
- Starter library opens;
- destination builds can be generated;
- generated files can be exported or installed;
- local project state survives restart;
- TOPO discovery distinguishes waiting, permission-needed and connected states;
- reviewed TOPO context can be used without becoming canonical Rack source.

ChromeOS/Crostini remains useful for functional testing but should not be treated as the supported Linux performance or packaging benchmark.

## Pilot installation

The supported-pilot release target provides two direct Linux artefacts.

### Verify the download

Download the release artefact you intend to use and `SHA256SUMS.txt` into the same folder.

Then run:

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Do not install or run an artefact whose checksum does not match the published manifest.

### Debian / Ubuntu package

For Debian 12, Ubuntu 22.04 or a compatible Debian-based system:

```bash
sudo apt install ./<rack-package>.deb
```

Using `apt install` rather than `dpkg -i` lets the package manager resolve runtime dependencies normally.

To remove the package:

```bash
sudo apt remove rack
```

RACK project folders and TOPO data are separate from the application package and are not removed by uninstalling the application.

### AppImage

The AppImage is the portable direct-download option:

```bash
chmod +x ./<rack-package>.AppImage
./<rack-package>.AppImage
```

It does not need a system-wide install. Remove the downloaded AppImage when you no longer want it.

Desktop-menu integration varies by distribution and is not required for the pilot.

## Linux compatibility notes

The first supported-pilot build baseline is Ubuntu 22.04 / Debian 12 because it is old enough to avoid needlessly raising the glibc floor while still providing WebKitGTK 4.1 for Tauri v2.

Linux GUI applications do not reliably inherit the interactive shell `PATH`. Future local AI-host detection must therefore use platform-aware discovery rather than assuming that a command visible in `.bashrc` or `.zshrc` is visible to the desktop application.

Flatpak and arm64 remain immediate follow-on targets. They should not create a second RACK product or source model; only packaging and platform integration should differ.
