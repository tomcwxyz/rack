import { describe, expect, it } from "vitest";
import {
  reliableEvaluationConfirmRequestSchema,
  reliableEvaluationStatusResponseSchema,
} from "./reliableEvaluation.js";

const baseRequest = {
  schemaVersion: "0.1" as const,
  preflight: {
    schemaVersion: "0.1" as const,
    mode: "reliable" as const,
    rackFingerprint: `sha256:${"a".repeat(64)}`,
    profileId: "writing",
    target: "prompt" as const,
    generatorAlias: "generator",
    judgeAlias: "judge",
    caseCount: 1,
    judgeCallsPerOutput: 1,
    candidateInputTokensPerCase: 2_000,
    baselineInputTokensPerCase: 1_000,
    generatorOutputTokensPerCall: 1_000,
    judgePromptTokensPerCase: 2_500,
    judgeOutputTokensPerCall: 400,
  },
  acceptedGenerator: {
    alias: "generator",
    providerId: "provider-one",
    modelId: "model-a",
  },
  acceptedJudge: {
    alias: "judge",
    providerId: "provider-two",
    modelId: "model-b",
  },
  acceptedMaximumRetryCostMicrousd: 20_000,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  instructions: "Write clearly.",
  casePrompt: "Write an update.",
  rubric: "Pass when the update is clear and grounded.",
};

describe("Reliable evaluation contracts", () => {
  it("accepts the deliberately narrow v0.1 Reliable confirmation shape", () => {
    expect(reliableEvaluationConfirmRequestSchema.parse(baseRequest)).toEqual(baseRequest);
  });

  it("rejects multiple cases and missing rubric judgements", () => {
    expect(
      reliableEvaluationConfirmRequestSchema.safeParse({
        ...baseRequest,
        preflight: { ...baseRequest.preflight, caseCount: 2, judgeCallsPerOutput: 0 },
      }).success,
    ).toBe(false);
  });

  it("keeps aggregate Reliable results content-free", () => {
    const parsed = reliableEvaluationStatusResponseSchema.parse({
      schemaVersion: "0.1",
      runId: "00000000-0000-4000-8000-000000000002",
      status: "completed",
      summary: {
        schemaVersion: "0.1",
        generator: baseRequest.acceptedGenerator,
        judge: baseRequest.acceptedJudge,
        judgeIndependent: true,
        behaviouralVerdict: true,
        candidateScore: 92,
        baselineScore: 74,
        candidatePassRate: 100,
        baselinePassRate: 60,
        previousAcceptedScore: 90,
        regressionDelta: 2,
        regressionPassed: true,
        candidateJudgements: 5,
        baselineJudgements: 5,
        settledCostMicrousd: 12_000,
        checkedAt: "2026-08-11T18:00:00.000Z",
      },
      transientContentAvailable: true,
      transientContentExpiresAt: "2026-08-12T18:00:00.000Z",
    });
    expect(parsed.summary).not.toHaveProperty("output");
    expect(parsed.summary).not.toHaveProperty("rubric");
    expect(parsed.summary).not.toHaveProperty("reason");
  });
});
