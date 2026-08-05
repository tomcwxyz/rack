import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildTarget,
  parseProjectSnapshot,
  type DestinationId,
  type ProjectSourceFile,
} from "../src/index.js";

const fixtureRoot = fileURLToPath(
  new URL("../../../test-fixtures/coding-basic/", import.meta.url),
);

const readFixture = async (path: string): Promise<ProjectSourceFile> => ({
  path,
  content: await readFile(`${fixtureRoot}${path}`, "utf8"),
});

const openCodingFixture = async () =>
  parseProjectSnapshot({
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

const cases: Array<{
  target: DestinationId;
  files: string[];
}> = [
  {
    target: "claude-code",
    files: [
      "CLAUDE.md",
      ".claude/skills/implement-feature/SKILL.md",
    ],
  },
  {
    target: "opencode",
    files: [
      "AGENTS.md",
      ".opencode/commands/implement-feature.md",
    ],
  },
  { target: "codex", files: ["AGENTS.md"] },
];

describe("supported host golden fixtures", () => {
  for (const testCase of cases) {
    it(`matches the accepted ${testCase.target} package byte for byte`, async () => {
      const project = await openCodingFixture();
      const result = buildTarget(project, "coding", testCase.target);

      expect(result.diagnostics).toEqual([]);
      expect(result.artifacts.map((artifact) => artifact.path)).toEqual(
        testCase.files,
      );

      for (const artifact of result.artifacts) {
        const expected = await readFile(
          `${fixtureRoot}expected/${testCase.target}/${artifact.path}`,
          "utf8",
        );
        expect(artifact.content, artifact.path).toBe(expected);
      }
    });
  }
});
