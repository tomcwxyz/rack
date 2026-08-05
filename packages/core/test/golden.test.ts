import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  parseProjectSnapshot,
  type ProjectSourceFile,
} from "../src/index.js";

const fixtureRoot = fileURLToPath(
  new URL("../../../test-fixtures/writing-basic/", import.meta.url),
);

const readFixture = async (path: string): Promise<ProjectSourceFile> => ({
  path,
  content: await readFile(`${fixtureRoot}${path}`, "utf8"),
});

describe("golden prompt fixture", () => {
  it("matches the accepted Writing fixture output byte for byte", async () => {
    const project = parseProjectSnapshot({
      root: fixtureRoot,
      manifest: await readFixture("rack.yaml"),
      modules: await Promise.all([
        readFixture("modules/index.md"),
        readFixture("modules/context/organisation.md"),
        readFixture("modules/voice/tone.md"),
        readFixture("modules/guardrails/evidence.md"),
        readFixture("modules/tasks/project-update.md"),
      ]),
      profiles: [await readFixture("profiles/writing.yaml")],
    });
    const expected = await readFile(
      `${fixtureRoot}expected/prompt/system-prompt.md`,
      "utf8",
    );

    const result = buildPrompt(project, "writing");
    expect(result.diagnostics).toEqual([]);
    expect(result.artifact?.content).toBe(expected);
  });
});
