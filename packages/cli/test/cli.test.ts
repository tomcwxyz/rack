import { execFile } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const cliEntry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const tsxEntry = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const fixture = fileURLToPath(
  new URL("../../../test-fixtures/coding-basic/", import.meta.url),
);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

const copyFixture = async (): Promise<string> => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "rack-cli-"));
  temporaryRoots.push(temporaryRoot);
  const projectRoot = path.join(temporaryRoot, "coding-basic");
  await cp(fixture, projectRoot, { recursive: true });
  return projectRoot;
};

const runRack = async (args: string[]) =>
  execute(process.execPath, [tsxEntry, cliEntry, ...args], {
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    maxBuffer: 2 * 1024 * 1024,
  });

describe("supported host CLI builds", () => {
  for (const target of ["claude-code", "opencode", "codex"] as const) {
    it(
      `installs and checks a ${target} package`,
      async () => {
        const projectRoot = await copyFixture();
        const build = await runRack([
          "build",
          projectRoot,
          "--profile",
          "coding",
          "--target",
          target,
          "--install",
          "--json",
        ]);
        const built = JSON.parse(build.stdout) as {
          built: boolean;
          target: string;
          installed: { directory: string } | null;
          artifacts: Array<{ path: string }>;
        };

        expect(built.built).toBe(true);
        expect(built.target).toBe(target);
        expect(built.installed?.directory).toContain(
          path.join(".rack", "generated", target, "coding"),
        );
        expect(built.artifacts.length).toBeGreaterThan(0);

        const check = await runRack([
          "check",
          projectRoot,
          "--profile",
          "coding",
          "--target",
          target,
          "--json",
        ]);
        expect(JSON.parse(check.stdout)).toMatchObject({
          profile: "coding",
          target,
          status: "current",
          sourceChanged: false,
          rendererChanged: false,
          outputModified: false,
        });
      },
      15_000,
    );
  }
});
