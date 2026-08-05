import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  InstalledPromptBuild,
  PreparedPromptBuild,
} from "./build.js";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
  type ProjectSourceFile,
  type RackProject,
} from "./index.js";

const collect = async (
  root: string,
  directory: string,
  extension: string,
): Promise<ProjectSourceFile[]> => {
  const absolute = path.join(root, directory);

  try {
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    const files: ProjectSourceFile[] = [];

    for (const entry of entries) {
      const relative = path.posix.join(directory, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await collect(root, relative, extension)));
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push({
          path: relative,
          content: await fs.readFile(path.join(root, relative), "utf8"),
        });
      }
    }

    return files.sort((a, b) => a.path.localeCompare(b.path));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

export const readProjectSnapshot = async (
  projectPath: string,
): Promise<ProjectSnapshot> => {
  const root = await fs.realpath(projectPath);

  return {
    root,
    manifest: {
      path: "rack.yaml",
      content: await fs.readFile(path.join(root, "rack.yaml"), "utf8"),
    },
    modules: await collect(root, "modules", ".md"),
    profiles: await collect(root, "profiles", ".yaml"),
  };
};

export const openProject = async (
  projectPath: string,
): Promise<RackProject> =>
  parseProjectSnapshot(await readProjectSnapshot(projectPath));

const assertProfileId = (profileId: string): void => {
  if (!/^[a-z][a-z0-9-]*$/.test(profileId)) {
    throw new Error(`Unsafe Set-up ID: ${profileId}`);
  }
};

const readOptionalFile = async (filePath: string): Promise<string | null> => {
  try {
    const metadata = await fs.lstat(filePath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) return null;
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const promptBuildDirectory = (
  projectRoot: string,
  profileId: string,
): string => {
  assertProfileId(profileId);
  return path.join(projectRoot, ".rack", "generated", "prompt", profileId);
};

export const readInstalledPromptBuild = async (
  projectPath: string,
  profileId: string,
): Promise<InstalledPromptBuild> => {
  const root = await fs.realpath(projectPath);
  const directory = promptBuildDirectory(root, profileId);

  return {
    artifactContent: await readOptionalFile(
      path.join(directory, "system-prompt.md"),
    ),
    manifestContent: await readOptionalFile(path.join(directory, "build.json")),
  };
};

export type PromptBuildInstallResult = {
  directory: string;
  backupDirectory: string | null;
};

export const installPromptBuild = async (
  projectPath: string,
  build: PreparedPromptBuild,
): Promise<PromptBuildInstallResult> => {
  if (
    !build.manifest ||
    !build.manifestContent ||
    !build.outputDirectory ||
    build.outputFiles.length === 0
  ) {
    throw new Error("This prompt build is blocked and cannot be installed.");
  }

  const root = await fs.realpath(projectPath);
  const expectedDirectory = path.join(
    ".rack",
    "generated",
    "prompt",
    build.manifest.profile.id,
  );
  if (path.normalize(build.outputDirectory) !== path.normalize(expectedDirectory)) {
    throw new Error("The generated output directory does not match the Set-up.");
  }

  const finalDirectory = promptBuildDirectory(root, build.manifest.profile.id);
  const generatedRoot = path.dirname(finalDirectory);
  const stagingDirectory = path.join(
    generatedRoot,
    `.${build.manifest.profile.id}.tmp-${process.pid}`,
  );
  const backupDirectory = path.join(
    root,
    ".rack",
    "backups",
    "prompt",
    build.manifest.profile.id,
    `${Date.now()}-${process.pid}`,
  );

  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.rm(stagingDirectory, { recursive: true, force: true });
  await fs.mkdir(stagingDirectory);

  try {
    for (const file of build.outputFiles) {
      if (!/^[a-z0-9][a-z0-9.-]*$/.test(file.path)) {
        throw new Error(`Unsafe generated filename: ${file.path}`);
      }
      await fs.writeFile(path.join(stagingDirectory, file.path), file.content, "utf8");
    }

    let retainedBackup: string | null = null;
    try {
      const existing = await fs.lstat(finalDirectory);
      if (existing.isSymbolicLink() || !existing.isDirectory()) {
        throw new Error(
          "The generated destination is not an ordinary folder. Rack will not replace it.",
        );
      }
      await fs.mkdir(path.dirname(backupDirectory), { recursive: true });
      await fs.rename(finalDirectory, backupDirectory);
      retainedBackup = backupDirectory;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    try {
      await fs.rename(stagingDirectory, finalDirectory);
    } catch (error) {
      if (retainedBackup) {
        await fs.rename(retainedBackup, finalDirectory).catch(() => undefined);
      }
      throw error;
    }

    return { directory: finalDirectory, backupDirectory: retainedBackup };
  } catch (error) {
    await fs.rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
};
