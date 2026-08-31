import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Record<
    string,
    unknown
  >;

const desktopPackage = readJson("../package.json");
const tauriConfig = readJson("../src-tauri/tauri.conf.json");
const cargoToml = readFileSync(
  new URL("../src-tauri/Cargo.toml", import.meta.url),
  "utf8",
);
const cargoLock = readFileSync(
  new URL("../src-tauri/Cargo.lock", import.meta.url),
  "utf8",
);
const pilotReleaseWorkflow = readFileSync(
  new URL("../../../.github/workflows/pilot-release.yml", import.meta.url),
  "utf8",
);

const packageVersion = desktopPackage.version as string;
const tauriVersion = tauriConfig.version as string;
const cargoVersion =
  cargoToml.match(/^version = "([^"]+)"$/m)?.[1] ?? "";
const lockedRackVersion =
  cargoLock.match(
    /\[\[package\]\]\nname = "rack"\nversion = "([^"]+)"/,
  )?.[1] ?? "";

const semver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

describe("desktop release version", () => {
  it("uses one explicit semantic version across desktop release surfaces", () => {
    expect(packageVersion).toMatch(semver);
    expect(packageVersion).not.toBe("0.0.0");
    expect(tauriVersion).toBe(packageVersion);
    expect(cargoVersion).toBe(packageVersion);
    expect(lockedRackVersion).toBe(packageVersion);
  });

  it("keeps Linux in the supported pilot release matrix", () => {
    expect(pilotReleaseWorkflow).toContain("label: Linux x64");
    expect(pilotReleaseWorkflow).toContain('--bundles deb,appimage');
    expect(pilotReleaseWorkflow).toContain("libwebkit2gtk-4.1-dev");
    expect(pilotReleaseWorkflow).toContain("patchelf");
  });
});
