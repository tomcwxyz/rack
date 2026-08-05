import { promises as fs } from "node:fs";
import path from "node:path";
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
