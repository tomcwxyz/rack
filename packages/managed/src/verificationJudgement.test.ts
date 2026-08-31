import { describe, expect, it } from "vitest";
import {
  buildVerificationJudgementPreflight,
  buildVerificationJudgementPrompt,
  parseVerificationJudgement,
  VERIFICATION_JUDGE_SYSTEM,
} from "./verificationJudgement.js";

const fingerprint = `sha256:${"a".repeat(64)}`;

describe("bounded verification judgement", () => {
  it("builds a prompt from only the question and supplied evidence", () => {
    const prompt = buildVerificationJudgementPrompt({
      question: "Do the tests meaningfully exercise the changed behaviour?",
      evidence: [
        { kind: "diff", content: "Added validation and a new error branch." },
        { kind: "test-results", content: "12 tests passed." },
      ],
    });

    expect(prompt).toContain(
      "Do the tests meaningfully exercise the changed behaviour?",
    );
    expect(prompt).toContain("## Change diff");
    expect(prompt).toContain("Added validation and a new error branch.");
    expect(prompt).toContain("## Test results");
    expect(prompt).toContain("12 tests passed.");
    expect(prompt).not.toContain("conversation");
  });

  it("uses the existing one-call paid preflight without sending raw evidence", () => {
    const result = buildVerificationJudgementPreflight({
      rackFingerprint: fingerprint,
      profileId: "coding",
      modelAlias: "standard",
      question: "Is the change safe?",
      evidence: [{ kind: "diff", content: "A small source change." }],
    });

    expect(result.system).toBe(VERIFICATION_JUDGE_SYSTEM);
    expect(result.prompt).toContain("A small source change.");
    expect(result.request).toMatchObject({
      schemaVersion: "0.1",
      mode: "quick",
      rackFingerprint: fingerprint,
      profileId: "coding",
      target: "prompt",
      generatorAlias: "standard",
      caseCount: 1,
      judgeCallsPerOutput: 0,
      judgePromptTokensPerCase: 0,
      judgeOutputTokensPerCall: 0,
    });
    expect(result.request.baselineInputTokensPerCase).toBeUndefined();
    expect(result.request.candidateInputTokensPerCase).toBeGreaterThan(0);
    expect(JSON.stringify(result.request)).not.toContain("A small source change.");
    expect(JSON.stringify(result.request)).not.toContain("Is the change safe?");
  });

  it.each([
    ["pass", "The supplied tests cover the changed branch."],
    ["fail", "The diff adds behaviour which the tests do not exercise."],
    ["uncertain", "The supplied evidence does not include the relevant tests."],
  ] as const)("parses a structured %s judgement", (verdict, reason) => {
    expect(
      parseVerificationJudgement(
        JSON.stringify({
          verdict,
          reason,
          evidence: ["Grounded observation"],
        }),
      ),
    ).toEqual({
      verdict,
      reason,
      evidence: ["Grounded observation"],
    });
  });

  it("accepts one JSON code fence and rejects prose or invalid verdicts", () => {
    expect(
      parseVerificationJudgement(
        "~~~json\n{\"verdict\":\"uncertain\",\"reason\":\"Evidence is incomplete.\",\"evidence\":[]}\n~~~"
          .replaceAll("~~~", "```"),
      ),
    ).toEqual({
      verdict: "uncertain",
      reason: "Evidence is incomplete.",
      evidence: [],
    });

    expect(parseVerificationJudgement("I think it passes.")).toBeNull();
    expect(
      parseVerificationJudgement(
        '{"verdict":"maybe","reason":"Unsure","evidence":[]}',
      ),
    ).toBeNull();
  });
});
