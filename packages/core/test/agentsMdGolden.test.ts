import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildAgentsMd,
  parseProjectSnapshot,
  type ProjectSourceFile,
} from "../src/index.js";

const fixtureRoot = fileURLToPath(
  new URL("../../../test-fixtures/coding-basic/", import.meta.url),
);

const readFixture = async (path: string): Promise<ProjectSourceFile> => ({
  path,
  content: await readFile(`${fixtureRoot}${path}`, "utf8"),
});

describe("AGENTS.md golden fixture", () => {
  it("matches the accepted Coding fixture output byte for byte", async () => {
    const project = parseProjectSnapshot({
      root: fixtureRoot,
      manifest: await readFixture("rack.yaml"),
      modules: await Promise.all([
        readFixture("modules/index.md"),
        readFixture("modules/context/repository.md"),
        readFixture("modules/craft/code.md"),
        readFixture("modules/guardrails/safety.md"),
        readFixture("modules/tasks/implement-feature.md"),
      ]),
      profiles: [await readFixture("profiles/coding.yaml")],
    });
    const expected = await readFile(
      `${fixtureRoot}expected/agents-md/AGENTS.md`,
      "utf8",
    );

    const result = buildAgentsMd(project, "coding");
    expect(result.diagnostics).toEqual([]);
    expect(result.artifacts[0]?.content).toBe(expected);
  });
});
