# Linux desktop development

Linux desktop support is experimental.

Rack has been tested successfully using the Debian Linux development environment on ChromeOS (Crostini), including launching the native Tauri application, creating a Rack project and saving it locally.

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
- local project state survives restart.

ChromeOS/Crostini is useful for Linux functional testing but should not be treated as a native Linux performance benchmark.
