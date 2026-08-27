import { describe, expect, it } from "vitest";
import type {
  ReliableEvaluationWorkflowStore,
  ReliableProviderCall,
  ReliableProviderSettlementInput,
} from "@rack/database";
import type {
  ReliableEvaluationConfirmRequest,
  ReliableEvaluationStatusResponse,
  ResolvedModelIdentity,
} from "@rack/managed";
import type { ModelRunner } from "@rack/model-runner";
import type { ModelRegistry } from "@rack/registry";
import { executeReliableModelEvaluation } from "./reliableModelEvaluation.js";

const confirmation: ReliableEvaluationConfirmRequest = {
  schemaVersion: "0.1",
  preflight: {
    schemaVersion: "0.1",
    mode: "reliable",
    rackFingerprint: `sha256:${"a".repeat(64)}`,
    profileId: "writing",
    target: "prompt",
    generatorAlias: "generator",
    judgeAlias: "judge",
    caseCount: 1,
    judgeCallsPerOutput: 1,
    candidateInputTokensPerCase: 1_000,
    baselineInputTokensPerCase: 1_000,
    generatorOutputTokensPerCall: 200,
    judgePromptTokensPerCase: 1_000,
    judgeOutputTokensPerCall: 100,
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
  acceptedMaximumRetryCostMicrousd: 100_000,
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  instructions: "Use the Rack instructions.",
  casePrompt: "Write the update.",
  rubric: "Pass when the response follows the working practices.",
};

const registry: ModelRegistry = {
  schemaVersion: "0.1",
  models: [
    {
      alias: "generator",
      providerId: "provider-one",
      modelId: "model-a",
      connection: "managed",
      capabilities: ["generate"],
      pricing: {
        inputMicrousdPerMillionTokens: 1_000_000,
        outputMicrousdPerMillionTokens: 1_000_000,
      },
      limits: { maxOutputTokens: 2_000 },
    },
    {
      alias: "judge",
      providerId: "provider-two",
      modelId: "model-b",
      connection: "managed",
      capabilities: ["judge"],
      pricing: {
        inputMicrousdPerMillionTokens: 1_000_000,
        outputMicrousdPerMillionTokens: 1_000_000,
      },
      limits: { maxOutputTokens: 2_000 },
    },
  ],
};

const pendingStatus = (): ReliableEvaluationStatusResponse => ({
  schemaVersion: "0.1",
  runId: "00000000-0000-4000-8000-000000000002",
  status: "queued",
  summary: null,
  transientContentAvailable: true,
  transientContentExpiresAt: "2026-08-12T18:00:00.000Z",
});

class FakeStore implements ReliableEvaluationWorkflowStore {
  calls = new Map<string, ReliableProviderCall>();
  completion:
    | {
        candidateScore: number;
        baselineScore: number;
        candidatePassRate: number;
        baselinePassRate: number;
      }
    | null = null;
  incompleteCalled = false;
  status = pendingStatus();

  async getStatus() {
    return this.status;
  }

  async loadConfirmation() {
    return confirmation;
  }

  async markRunning() {
    this.status = { ...this.status, status: "running" };
  }

  async getCall(callKey: string) {
    return this.calls.get(callKey) ?? null;
  }

  async claimCall(callKey: string, model: ResolvedModelIdentity) {
    if (this.calls.has(callKey)) return false;
    this.calls.set(callKey, {
      callKey,
      status: "claimed",
      responseId: null,
      inputTokens: null,
      outputTokens: null,
      costMicrousd: 0,
      costBasis: null,
      output: null,
      judgement: null,
    });
    expect(model.alias === "generator" || model.alias === "judge").toBe(true);
    return true;
  }

  async settleCall(input: ReliableProviderSettlementInput) {
    this.calls.set(input.callKey, {
      callKey: input.callKey,
      status: input.status,
      responseId: input.responseId,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costMicrousd: input.costMicrousd,
      costBasis: input.costBasis,
      output: input.output,
      judgement: input.judgement,
    });
  }

  async complete(input: {
    candidateScore: number;
    baselineScore: number;
    candidatePassRate: number;
    baselinePassRate: number;
  }) {
    this.completion = input;
    this.status = {
      ...this.status,
      status: "completed",
      summary: {
        schemaVersion: "0.1",
        generator: confirmation.acceptedGenerator,
        judge: confirmation.acceptedJudge,
        judgeIndependent: true,
        behaviouralVerdict: true,
        candidateScore: input.candidateScore,
        baselineScore: input.baselineScore,
        candidatePassRate: input.candidatePassRate,
        baselinePassRate: input.baselinePassRate,
        previousAcceptedScore: null,
        regressionDelta: null,
        regressionPassed: null,
        candidateJudgements: 5,
        baselineJudgements: 5,
        settledCostMicrousd: 1_000,
        checkedAt: "2026-08-11T18:00:00.000Z",
      },
    };
    return this.status;
  }

  async incomplete() {
    this.incompleteCalled = true;
    this.status = { ...this.status, status: "incomplete", summary: null };
    return this.status;
  }
}

describe("model-backed Reliable execution", () => {
  it("runs five candidates, five baselines and ten strict judgements", async () => {
    const store = new FakeStore();
    let generation = 0;
    let judgement = 0;
    const runner: ModelRunner = {
      async generate(request) {
        if (request.model.alias === "judge") {
          judgement += 1;
          const candidate = request.prompt.includes("candidate-");
          return {
            text: JSON.stringify({
              verdict: "pass",
              score: candidate ? 92 : 70,
              reason: candidate ? "Rack behaviour present." : "Baseline acceptable.",
              evidence: [candidate ? "candidate" : "baseline"],
            }),
            responseId: `judge-${judgement}`,
            usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          };
        }
        generation += 1;
        const candidate = request.instructions === confirmation.instructions;
        return {
          text: `${candidate ? "candidate" : "baseline"}-${generation}`,
          responseId: `generation-${generation}`,
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        };
      },
    };

    const result = await executeReliableModelEvaluation({ store, registry, runner });

    expect(result.status).toBe("completed");
    expect(generation).toBe(10);
    expect(judgement).toBe(10);
    expect(store.calls.size).toBe(20);
    expect(store.completion).toEqual({
      candidateScore: 92,
      baselineScore: 70,
      candidatePassRate: 100,
      baselinePassRate: 100,
    });
  });

  it("marks the run Incomplete when a judge response is not valid structured JSON", async () => {
    const store = new FakeStore();
    const runner: ModelRunner = {
      async generate(request) {
        return {
          text: request.model.alias === "judge" ? "Looks good to me" : "candidate-output",
          responseId: "response",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        };
      },
    };

    const result = await executeReliableModelEvaluation({ store, registry, runner });

    expect(result.status).toBe("incomplete");
    expect(store.incompleteCalled).toBe(true);
    expect(store.completion).toBeNull();
  });
});
