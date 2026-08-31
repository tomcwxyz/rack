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
});
