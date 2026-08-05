import { mkdtemp, cp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { DestinationId } from "../src/index.js";
import {
  inspectPromptBuild,
  inspectTargetBuild,
  preparePromptBuild,
  prepareTargetBuild,
} from "../src/build.js";
import {
  installPromptBuild,
  installTargetBuild,
  openProject,
  readInstalledPromptBuild,
  readInstalledTargetBuild,
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

describe("installed destination builds", () => {
  it("installs a prompt atomically and reports later output edits", async () => {
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

  it("keeps all supported destinations separate and current", async () => {
    const projectRoot = await copyFixture();
    const project = await openProject(projectRoot);
    const targets: DestinationId[] = [
      "prompt",
      "agents-md",
      "claude-code",
      "opencode",
      "codex",
    ];
    const directories = new Set<string>();

    for (const target of targets) {
      const prepared = await prepareTargetBuild(project, "writing", target);
      const installed = await installTargetBuild(projectRoot, prepared);
      directories.add(installed.directory);
      const inspection = await inspectTargetBuild(
        project,
        "writing",
        target,
        await readInstalledTargetBuild(projectRoot, target, "writing"),
      );
      expect(inspection.status, target).toBe("current");
    }

    expect(directories.size).toBe(targets.length);
    expect(
      await readFile(
        path.join(
          projectRoot,
          ".rack/generated/claude-code/writing/.claude/skills/project-update/SKILL.md",
        ),
        "utf8",
      ),
    ).toContain("disable-model-invocation: true");
    expect(
      await readFile(
        path.join(
          projectRoot,
          ".rack/generated/opencode/writing/.opencode/commands/project-update.md",
        ),
        "utf8",
      ),
    ).toContain("$ARGUMENTS");
  });
});
