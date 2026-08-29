import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const nextVersion = process.argv[2];
const pilotVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-pilot\.(0|[1-9]\d*)$/;

if (!nextVersion || !pilotVersion.test(nextVersion)) {
  console.error(
    "Usage: pnpm desktop:version <semver-pilot-version>, for example 0.1.0-pilot.2",
  );
  process.exit(1);
}

const root = process.cwd();

const replaceOnce = (path, pattern, replacement) => {
  const absolute = resolve(root, path);
  const current = readFileSync(absolute, "utf8");
  const matches = current.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected exactly one version match in ${path}.`);
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
