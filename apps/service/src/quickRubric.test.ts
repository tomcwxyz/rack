import { describe, expect, it } from "vitest";
import {
  buildQuickRubricPrompt,
  conservativeQuickRubricPromptAllowance,
  parseQuickRubricJudgement,
} from "./quickRubric.js";

describe("quick rubric judgement", () => {
  it("builds a deterministic prompt with rubric, task and candidate output", () => {
    const prompt = buildQuickRubricPrompt({
      rubric: "Pass when every claim is grounded in supplied facts.",
      casePrompt: "Write a project update.",
      candidateOutput: "The project remains on track.",
    });
    expect(prompt).toContain("Rubric:\nPass when every claim");
    expect(prompt).toContain("Task:\nWrite a project update.");
    expect(prompt).toContain("Candidate response:\nThe project remains on track.");
  });

  it("parses only the strict judgement shape, including a JSON code fence", () => {
    expect(
      parseQuickRubricJudgement(
        '```json\n{"verdict":"pass","score":90,"reason":"Grounded.","evidence":["Uses only supplied status."]}\n```',
      ),
    ).toEqual({
      verdict: "pass",
      score: 90,
      reason: "Grounded.",
      evidence: ["Uses only supplied status."],
    });
    expect(parseQuickRubricJudgement('{"verdict":"maybe","score":90,"reason":"x","evidence":[]}')).toBeNull();
  });

  it("counts fixed judge instructions and rubric/task content in the conservative allowance", () => {
    const small = conservativeQuickRubricPromptAllowance({ rubric: "Be clear.", casePrompt: "Write." });
    const large = conservativeQuickRubricPromptAllowance({
      rubric: "Be clear and accurate. ".repeat(20),
      casePrompt: "Write a detailed update. ".repeat(20),
    });
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });
});
