import { mkdtemp, cp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { inspectPromptBuild, preparePromptBuild } from "../src/build.js";
import {
  installPromptBuild,
  openProject,
  readInstalledPromptBuild,
} from "../src/node.js";

const fixture = fileURLToPath(
  new URL("../../../test-fixtures/writing-basic/", import.meta.url),
);
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const copyFixture = async (): Promise<string> => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "rack-build-"));
  temporaryRoots.push(temporaryRoot);
  const projectRoot = path.join(temporaryRoot, "writing-basic");
  await cp(fixture, projectRoot, { recursive: true });
  return projectRoot;
};

describe("installed prompt builds", () => {
  it("installs atomically and reports later output edits", async () => {
    const projectRoot = await copyFixture();
    const project = await openProject(projectRoot);
    const prepared = await preparePromptBuild(project, "writing");

    const installed = await installPromptBuild(projectRoot, prepared);
    expect(installed.backupDirectory).toBeNull();

    const firstInspection = await inspectPromptBuild(
      project,
      "writing",
      await readInstalledPromptBuild(projectRoot, "writing"),
    );
    expect(firstInspection.status).toBe("current");

    const outputPath = path.join(installed.directory, "system-prompt.md");
    const output = await readFile(outputPath, "utf8");
    await writeFile(outputPath, `${output}\nManual edit`, "utf8");

    const changedInspection = await inspectPromptBuild(
      project,
      "writing",
      await readInstalledPromptBuild(projectRoot, "writing"),
    );
    expect(changedInspection.status).toBe("modified");

    const secondInstall = await installPromptBuild(projectRoot, prepared);
    expect(secondInstall.backupDirectory).not.toBeNull();
  });
});
