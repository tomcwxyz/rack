import { describe, expect, it } from "vitest";
import type { EvaluationPreflightLimits, EvaluationPreflightRequest } from "@rack/managed";
import { parseModelRegistry } from "@rack/registry";
import { buildEvaluationPreflight } from "./preflight.js";

const registry = parseModelRegistry({
  schemaVersion: "0.1",
  models: [
    {
      alias: "generator",
      providerId: "provider-one",
      modelId: "model-a",
      connection: "managed",
      capabilities: ["generate", "judge"],
      pricing: {
        inputMicrousdPerMillionTokens: 2_000_000,
        outputMicrousdPerMillionTokens: 8_000_000,
      },
      limits: { maxOutputTokens: 4096 },
    },
    {
      alias: "judge",
      providerId: "provider-two",
      modelId: "model-b",
      connection: "managed",
      capabilities: ["judge"],
      pricing: {
        inputMicrousdPerMillionTokens: 3_000_000,
        outputMicrousdPerMillionTokens: 12_000_000,
      },
      limits: { maxOutputTokens: 2048 },
    },
  ],
});

const limits: EvaluationPreflightLimits = {
  perRunCapMicrousd: 20_000_000,
  workspaceRemainingMicrousd: 100_000_000,
  activePaidRuns: 0,
  concurrencyLimit: 2,
  maxProviderAttemptsPerCall: 3,
};

const quick: EvaluationPreflightRequest = {
  schemaVersion: "0.1",
  mode: "quick",
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt",
  generatorAlias: "generator",
  caseCount: 2,
  judgeCallsPerOutput: 1,
  candidateInputTokensPerCase: 1000,
  generatorOutputTokensPerCall: 500,
  judgePromptTokensPerCase: 200,
  judgeOutputTokensPerCall: 100,
};

const reliable: EvaluationPreflightRequest = {
  ...quick,
  mode: "reliable",
  judgeAlias: "judge",
  baselineInputTokensPerCase: 400,
};

describe("evaluation preflight", () => {
  it("keeps Quick indicative with one repetition and no baseline/regression gate", () => {
    const result = buildEvaluationPreflight(quick, registry, limits);
    expect(result.indicative).toBe(true);
    expect(result.repetitions).toBe(1);
    expect(result.baselineEnabled).toBe(false);
    expect(result.regressionGate).toBe(false);
    expect(result.calls).toEqual({
      candidateGenerator: 2,
      baselineGenerator: 0,
      judge: 2,
      total: 4,
    });
    expect(result.generator).toEqual({
      alias: "generator",
      providerId: "provider-one",
      modelId: "model-a",
    });
    expect(result.judge).toEqual(result.generator);
    expect(result.judgeAlias).toBe("generator");
    expect(result.judgeIndependent).toBeNull();
  });

  it("plans five Reliable repetitions, baseline and an independent judge", () => {
    const result = buildEvaluationPreflight(reliable, registry, limits);
    expect(result.indicative).toBe(false);
    expect(result.repetitions).toBe(5);
    expect(result.baselineEnabled).toBe(true);
    expect(result.comparePreviousAcceptedRun).toBe(true);
    expect(result.regressionGate).toBe(true);
    expect(result.calls).toEqual({
      candidateGenerator: 10,
      baselineGenerator: 10,
      judge: 20,
      total: 40,
    });
    expect(result.judge).toEqual({
      alias: "judge",
      providerId: "provider-two",
      modelId: "model-b",
    });
    expect(result.judgeIndependent).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.costMicrousd.maximumRetry).toBe(
      result.costMicrousd.estimated * limits.maxProviderAttemptsPerCall,
    );
  });

  it("warns when Reliable judging resolves to the generator model", () => {
    const result = buildEvaluationPreflight(
      { ...reliable, judgeAlias: "generator" },
      registry,
      limits,
    );
    expect(result.judgeIndependent).toBe(false);
    expect(result.warnings[0]?.code).toBe("judge-not-independent");
  });

  it("blocks each hard limit independently", () => {
    const perRun = buildEvaluationPreflight(reliable, registry, {
      ...limits,
      perRunCapMicrousd: 1,
    });
    const workspace = buildEvaluationPreflight(reliable, registry, {
      ...limits,
      workspaceRemainingMicrousd: 1,
    });
    const concurrency = buildEvaluationPreflight(reliable, registry, {
      ...limits,
      activePaidRuns: 2,
    });
    expect(perRun.blockers.map((item) => item.code)).toContain("per-run-cap");
    expect(workspace.blockers.map((item) => item.code)).toContain("workspace-budget");
    expect(concurrency.blockers.map((item) => item.code)).toContain("concurrency");
  });

  it("never starts or reserves a paid run — it returns metadata only", () => {
    const result = buildEvaluationPreflight(reliable, registry, limits);
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result).not.toHaveProperty("runId");
    expect(result).not.toHaveProperty("reservationId");
  });
});
