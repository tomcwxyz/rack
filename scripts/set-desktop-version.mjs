import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const nextVersion = process.argv[2];
const desktopPrereleaseVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(alpha|pilot)\.(0|[1-9]\d*)$/;

if (!nextVersion || !desktopPrereleaseVersion.test(nextVersion)) {
  console.error(
    "Usage: pnpm desktop:version <semver-prerelease-version>, for example 0.2.0-alpha.1 or 0.2.0-pilot.1",
  );
  process.exit(1);
}

const root = process.cwd();

const replaceOnce = (path, pattern, replacement) => {
  const absolute = resolve(root, path);
  const current = readFileSync(absolute, "utf8");
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...current.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) {
    throw new Error(`Expected exactly one version match in ${path}; found ${count}.`);
  }
  writeFileSync(absolute, current.replace(pattern, replacement));
};

replaceOnce(
  "apps/desktop/package.json",
  /"version": "[^"]+"/,
  `"version": "${nextVersion}"`,
);

replaceOnce(
  "apps/desktop/src-tauri/tauri.conf.json",
  /"version": "[^"]+"/,
  `"version": "${nextVersion}"`,
);

replaceOnce(
  "apps/desktop/src-tauri/Cargo.toml",
  /^version = "[^"]+"$/m,
  `version = "${nextVersion}"`,
);

replaceOnce(
  "apps/desktop/src-tauri/Cargo.lock",
  /(\[\[package\]\]\nname = "rack"\nversion = ")[^"]+(")/,
  `$1${nextVersion}$2`,
);

console.log(`Rack desktop version set to ${nextVersion}.`);
console.log("Run pnpm --filter @rack/desktop test before committing.");
