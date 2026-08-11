import { describe, expect, it } from "vitest";
import { buildQuickPreflightRequest, formatMicrousd, settledCostMicrousd } from "./managedChecks.js";

describe("desktop managed-check helpers", () => {
  it("builds one-case rubric-backed Quick preflight using conservative UTF-8 allowances", () => {
    const request = buildQuickPreflightRequest({
      rackFingerprint: `sha256:${"a".repeat(64)}`,
      profileId: "writing",
      generatorAlias: "generator",
      instructions: "Write clearly.",
      casePrompt: "Write an update.",
      rubric: "Pass when it is clear and grounded.",
    });
    expect(request).toMatchObject({
      mode: "quick",
      target: "prompt",
      caseCount: 1,
      judgeCallsPerOutput: 1,
      generatorAlias: "generator",
    });
    expect(request.candidateInputTokensPerCase).toBeGreaterThan("Write clearly.".length);
    expect(request.judgePromptTokensPerCase).toBeGreaterThanOrEqual(2048);
  });

  it("formats micro-USD for explicit paid confirmation", () => {
    expect(formatMicrousd(3_000)).toContain("0.003");
    expect(formatMicrousd(2_500_000)).toContain("2.50");
  });

  it("adds candidate and judge settled costs", () => {
    expect(
      settledCostMicrousd({
        schemaVersion: "0.1",
        runId: "00000000-0000-4000-8000-000000000001",
        workspaceId: "00000000-0000-4000-8000-000000000002",
        status: "completed",
        replayed: false,
        generator: { alias: "generator", providerId: "provider-one", modelId: "model-a" },
        judge: { alias: "generator", providerId: "provider-one", modelId: "model-a" },
        behaviouralVerdict: true,
        behaviouralScore: 90,
        judgement: {
          verdict: "pass",
          score: 90,
          reason: "Clear.",
          evidence: ["Grounded."],
        },
        output: "Update",
        transientContentAvailable: true,
        transientContentExpiresAt: "2026-08-12T05:00:00.000Z",
        providerCall: {
          status: "completed",
          responseId: "candidate",
          inputTokens: 20,
          outputTokens: 10,
          costMicrousd: 40,
          costBasis: "provider-usage",
        },
        judgeCall: {
          status: "completed",
          responseId: "judge",
          inputTokens: 30,
          outputTokens: 5,
          costMicrousd: 35,
          costBasis: "provider-usage",
        },
      }),
    ).toBe(75);
  });
});
