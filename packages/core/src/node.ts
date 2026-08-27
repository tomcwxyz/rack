import { promises as fs } from "node:fs";
import path from "node:path";
import {
  destinationIdSchema,
  type DestinationId,
} from "@rack/schemas";
import { buildManifestSchema } from "@rack/schemas/build";
import type {
  InstalledPromptBuild,
  InstalledTargetBuild,
  PreparedPromptBuild,
  PreparedTargetBuild,
} from "./build.js";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
  type ProjectSourceFile,
  type RackProject,
} from "./index.js";
import {
  materializeSharedPractice,
  type SharedPracticeMaterialization,
  type SharedPracticeSourceOptions,
} from "./sharedPractice.js";

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

export const readSharedPracticeFile = async (
  filePath: string,
  options: Omit<SharedPracticeSourceOptions, "filePath">,
): Promise<SharedPracticeMaterialization> => {
  const absolute = await fs.realpath(filePath);
  const metadata = await fs.stat(absolute);
  if (!metadata.isFile()) {
    throw new Error("Shared practice path must point to a regular file.");
  }
  return materializeSharedPractice(
    await fs.readFile(absolute, "utf8"),
    { ...options, filePath: absolute },
  );
};

const assertProfileId = (profileId: string): void => {
  if (!/^[a-z][a-z0-9-]*$/.test(profileId)) {
    throw new Error(`Unsafe Set-up ID: ${profileId}`);
  }
};

const assertTarget = (target: DestinationId): void => {
  destinationIdSchema.parse(target);
};

const safeRelativePath = (value: string): string => {
  if (
    !value ||
    path.isAbsolute(value) ||
    value.split(/[\\/]/).some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe generated path: ${value}`);
  }
  return value;
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

export const managedBuildDirectory = (
  projectRoot: string,
  target: DestinationId,
  profileId: string,
): string => {
  assertTarget(target);
  assertProfileId(profileId);
  return path.join(projectRoot, ".rack", "generated", target, profileId);
};

export const promptBuildDirectory = (
  projectRoot: string,
  profileId: string,
): string => managedBuildDirectory(projectRoot, "prompt", profileId);

export const readInstalledTargetBuild = async (
  projectPath: string,
  target: DestinationId,
  profileId: string,
): Promise<InstalledTargetBuild> => {
  const root = await fs.realpath(projectPath);
  const directory = managedBuildDirectory(root, target, profileId);
  const manifestContent = await readOptionalFile(path.join(directory, "build.json"));
  const artifactContents: Record<string, string | null> = {};

  if (manifestContent) {
    try {
      const parsed = buildManifestSchema.safeParse(JSON.parse(manifestContent));
      if (parsed.success) {
        for (const artifact of parsed.data.artifacts) {
          artifactContents[artifact.path] = await readOptionalFile(
            path.join(directory, safeRelativePath(artifact.path)),
          );
        }
      }
    } catch {
      // Inspection reports the invalid manifest using the original content.
    }
  }

  return { artifactContents, manifestContent };
};

export const readInstalledPromptBuild = async (
  projectPath: string,
  profileId: string,
): Promise<InstalledPromptBuild> => {
  const installed = await readInstalledTargetBuild(
    projectPath,
    "prompt",
    profileId,
  );
  return {
    artifactContent: installed.artifactContents["system-prompt.md"] ?? null,
    manifestContent: installed.manifestContent,
  };
};

export type TargetBuildInstallResult = {
  directory: string;
  backupDirectory: string | null;
};
export type PromptBuildInstallResult = TargetBuildInstallResult;

export const installTargetBuild = async (
  projectPath: string,
  build: PreparedTargetBuild,
): Promise<TargetBuildInstallResult> => {
  if (
    !build.manifest ||
    !build.manifestContent ||
    !build.outputDirectory ||
    build.outputFiles.length === 0
  ) {
    throw new Error("This build is blocked and cannot be installed.");
  }

  const root = await fs.realpath(projectPath);
  const expectedDirectory = path.join(
    ".rack",
    "generated",
    build.target,
    build.manifest.profile.id,
  );
  if (path.normalize(build.outputDirectory) !== path.normalize(expectedDirectory)) {
    throw new Error("The generated output directory does not match its destination and Set-up.");
  }

  const finalDirectory = managedBuildDirectory(
    root,
    build.target,
    build.manifest.profile.id,
  );
  const generatedRoot = path.dirname(finalDirectory);
  const stagingDirectory = path.join(
    generatedRoot,
    `.${build.manifest.profile.id}.tmp-${process.pid}`,
  );
  const backupDirectory = path.join(
    root,
    ".rack",
    "backups",
    build.target,
    build.manifest.profile.id,
    `${Date.now()}-${process.pid}`,
  );

  const expectedFiles = new Set([
    ...build.manifest.artifacts.map((artifact) => artifact.path),
    "build.json",
  ]);
  const actualFiles = new Set(build.outputFiles.map((file) => file.path));
  if (
    expectedFiles.size !== actualFiles.size ||
    [...expectedFiles].some((file) => !actualFiles.has(file))
  ) {
    throw new Error("The generated files do not match the build manifest.");
  }

  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.rm(stagingDirectory, { recursive: true, force: true });
  await fs.mkdir(stagingDirectory);

  try {
    for (const file of build.outputFiles) {
      const relative = safeRelativePath(file.path);
      const destination = path.join(stagingDirectory, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, file.content, "utf8");
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

export const installPromptBuild = async (
  projectPath: string,
  build: PreparedPromptBuild,
): Promise<PromptBuildInstallResult> => installTargetBuild(projectPath, build);
