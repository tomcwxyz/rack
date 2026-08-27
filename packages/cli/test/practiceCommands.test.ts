import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { writePublicationFile } from "../src/practiceCommands.js";

const directories: string[] = [];

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rack-publish-"));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("shared-practice publication output", () => {
  it("writes a new publication", async () => {
    const directory = await temporaryDirectory();
    const destination = path.join(directory, "org.rack.yaml");

    await expect(
      writePublicationFile(destination, "version: one\n"),
    ).resolves.toBe(destination);
    await expect(readFile(destination, "utf8")).resolves.toBe(
      "version: one\n",
    );
  });

  it("does not replace an existing file without --force", async () => {
    const directory = await temporaryDirectory();
    const destination = path.join(directory, "org.rack.yaml");
    await writeFile(destination, "old\n", "utf8");

    await expect(
      writePublicationFile(destination, "new\n"),
    ).rejects.toThrow("already exists");
    await expect(readFile(destination, "utf8")).resolves.toBe("old\n");
  });

  it("replaces an existing ordinary file when force is explicit", async () => {
    const directory = await temporaryDirectory();
    const destination = path.join(directory, "org.rack.yaml");
    await writeFile(destination, "old\n", "utf8");

    await writePublicationFile(destination, "new\n", true);
    await expect(readFile(destination, "utf8")).resolves.toBe("new\n");
  });

  it("refuses to replace a symlink even with force", async () => {
    const directory = await temporaryDirectory();
    const target = path.join(directory, "target.yaml");
    const destination = path.join(directory, "org.rack.yaml");
    await writeFile(target, "private\n", "utf8");
    await symlink(target, destination);

    await expect(
      writePublicationFile(destination, "new\n", true),
    ).rejects.toThrow("ordinary shared-practice file");
    await expect(readFile(target, "utf8")).resolves.toBe("private\n");
  });
});
