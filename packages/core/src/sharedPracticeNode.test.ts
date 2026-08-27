import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSharedPracticeFile } from "./node.js";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(
    created.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("shared practice Node host", () => {
  it("reads an attached shared practice file from its canonical path", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rack-shared-"));
    created.push(directory);
    const filePath = path.join(directory, "organisation.rack.yaml");
    await fs.writeFile(
      filePath,
      `format: rack.shared-practice
schema_version: "0.1"
id: organisation
version: 0.1.0
title: Organisation practice
published_by:
  name: Example Organisation
instructions:
  - type: context
    title: Shared context
    harness:
      schema_version: "0.2"
      id: context.shared
      version: 0.2.0
    body: Shared context.
`,
      "utf8",
    );

    const result = await readSharedPracticeFile(filePath, {
      sourceId: "organisation-practice",
      relationship: "organisation",
      precedence: 10,
    });

    expect(result.blocked).toBe(false);
    expect(result.source?.path).toBe(await fs.realpath(filePath));
    expect(result.modules[0]?.harness.id).toBe("context.shared");
  });
});
