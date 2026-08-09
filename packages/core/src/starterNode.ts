import { promises as fs } from "node:fs";
import path from "node:path";
import type { StarterImportPlan } from "./starterImports.js";

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const assertNewModulePath = (value: string): string => {
  const normalised = value.replace(/\\/g, "/");
  if (
    !/^modules\/starter\/[a-z0-9-]+\.md$/.test(normalised) ||
    path.isAbsolute(value)
  ) {
    throw new Error(`Unsafe Starter import path: ${value}`);
  }
  return normalised;
};

const assertProfilePath = (value: string): string => {
  const normalised = value.replace(/\\/g, "/");
  if (!/^profiles\/[a-z0-9/-]+\.yaml$/.test(normalised) || path.isAbsolute(value)) {
    throw new Error(`Unsafe Starter Set-up path: ${value}`);
  }
  return normalised;
};

export const applyStarterImport = async (
  projectPath: string,
  plan: StarterImportPlan,
): Promise<void> => {
  if (plan.blocked) {
    throw new Error(
      plan.blockedReasons[0] ?? "This Starter import is blocked and cannot be applied.",
    );
  }
  if (plan.files.length === 0 && !plan.profileChange) return;

  const root = await fs.realpath(projectPath);
  const rootMetadata = await fs.lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Starter imports require an ordinary Rack project folder.");
  }

  const stagingRoot = path.join(
    root,
    ".rack",
    `starter-import-${process.pid}-${Date.now()}`,
  );
  const createdFiles: string[] = [];
  let profileBackup: string | null = null;
  let profileDestination: string | null = null;

  await fs.mkdir(stagingRoot, { recursive: true });

  try {
    for (const file of plan.files) {
      const relative = assertNewModulePath(file.path);
      const destination = path.join(root, relative);
      try {
        await fs.lstat(destination);
        throw new Error(`${relative} now exists. Review the Rack again before importing.`);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }

      const staged = path.join(stagingRoot, relative);
      await fs.mkdir(path.dirname(staged), { recursive: true });
      await fs.writeFile(staged, file.content, "utf8");
    }

    let stagedProfile: string | null = null;
    if (plan.profileChange) {
      const relative = assertProfilePath(plan.profileChange.path);
      profileDestination = path.join(root, relative);
      const metadata = await fs.lstat(profileDestination);
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error("Rack will only update an ordinary Set-up file during import.");
      }
      const current = await fs.readFile(profileDestination, "utf8");
      if (current !== plan.profileChange.before) {
        throw new Error(
          "The selected Set-up changed after the import was reviewed. Review the newer source and try again.",
        );
      }
      stagedProfile = path.join(stagingRoot, relative);
      await fs.mkdir(path.dirname(stagedProfile), { recursive: true });
      await fs.writeFile(stagedProfile, plan.profileChange.after, "utf8");
      profileBackup = `${stagedProfile}.before`;
      await fs.copyFile(profileDestination, profileBackup);
    }

    for (const file of plan.files) {
      const relative = assertNewModulePath(file.path);
      const staged = path.join(stagingRoot, relative);
      const destination = path.join(root, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(staged, destination);
      createdFiles.push(destination);
    }

    if (plan.profileChange && profileDestination) {
      const stagedProfile = path.join(
        stagingRoot,
        assertProfilePath(plan.profileChange.path),
      );
      await fs.rm(profileDestination);
      try {
        await fs.rename(stagedProfile, profileDestination);
      } catch (error) {
        if (profileBackup) await fs.copyFile(profileBackup, profileDestination);
        throw error;
      }
    }
  } catch (error) {
    for (const created of createdFiles.reverse()) {
      await fs.rm(created, { force: true }).catch(() => undefined);
    }
    if (profileBackup && profileDestination) {
      await fs.copyFile(profileBackup, profileDestination).catch(() => undefined);
    }
    throw error;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
};
