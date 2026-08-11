import { describe, expect, it, vi } from "vitest";
import type {
  EvaluationLimitStore,
  ModelExecutionStore,
  StoredQuickEvaluation,
} from "@rack/database";
import type { ModelRunner } from "@rack/model-runner";
import { parseModelRegistry } from "@rack/registry";
import { createEvaluationConfirmHandler } from "./evaluationConfirmHandler.js";

const environment = {
  databaseUrl: "postgresql://example",
  workflowDatabaseUrl: "postgresql://workflow",
  retentionDatabaseUrl: "postgresql://retention",
  neonAuthJwksUrl: "https://example.test/jwks.json",
  cronSecret: "test-secret-that-is-long-enough",
};

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
        inputMicrousdPerMillionTokens: 1_000_000,
        outputMicrousdPerMillionTokens: 2_000_000,
      },
      limits: { maxOutputTokens: 4096 },
    },
    {
      alias: "other",
      providerId: "provider-two",
      modelId: "model-b",
      connection: "managed",
      capabilities: ["generate", "judge"],
      pricing: {
        inputMicrousdPerMillionTokens: 1_000_000,
        outputMicrousdPerMillionTokens: 2_000_000,
      },
      limits: { maxOutputTokens: 4096 },
    },
  ],
});

const defaults = {
  hardBudgetMicrousd: 100_000_000,
  perRunCapMicrousd: 20_000_000,
  concurrencyLimit: 2,
  maxProviderAttemptsPerCall: 3,
};

const limitStore = (): EvaluationLimitStore => ({
  getPreflightLimits: async () => ({
    workspaceId: "00000000-0000-4000-8000-000000000001",
    perRunCapMicrousd: 20_000_000,
    workspaceRemainingMicrousd: 100_000_000,
    activePaidRuns: 0,
    concurrencyLimit: 2,
    maxProviderAttemptsPerCall: 3,
  }),
});

const generationPreflight = {
  schemaVersion: "0.1" as const,
  mode: "quick" as const,
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt" as const,
  generatorAlias: "generator",
  caseCount: 1,
  judgeCallsPerOutput: 0,
  candidateInputTokensPerCase: 1000,
  generatorOutputTokensPerCall: 100,
  judgePromptTokensPerCase: 0,
  judgeOutputTokensPerCall: 0,
};

const rubricPreflight = {
  ...generationPreflight,
  judgeCallsPerOutput: 1,
  judgePromptTokensPerCase: 1000,
  judgeOutputTokensPerCall: 100,
};

const acceptedGenerator = {
  alias: "generator",
  providerId: "provider-one",
  modelId: "model-a",
};

const generationConfirmation = {
  schemaVersion: "0.1" as const,
  preflight: generationPreflight,
  acceptedGenerator,
  acceptedMaximumRetryCostMicrousd: 3600,
  idempotencyKey: "00000000-0000-4000-8000-000000000099",
  instructions: "Write clearly and use the supplied facts.",
  casePrompt: "Write a short project update.",
};

const rubricConfirmation = {
  ...generationConfirmation,
  preflight: rubricPreflight,
  acceptedJudge: acceptedGenerator,
  acceptedMaximumRetryCostMicrousd: 7500,
  rubric: "Pass only when the response is clear and does not invent facts.",
};

const runningRecord = (): StoredQuickEvaluation => ({
  runId: "00000000-0000-4000-8000-000000000010",
  workspaceId: "00000000-0000-4000-8000-000000000001",
  status: "running",
  generator: acceptedGenerator,
  judge: null,
  behaviouralVerdict: null,
  behaviouralScore: null,
  judgement: null,
  output: null,
  transientContentAvailable: true,
  transientContentExpiresAt: "2026-08-12T05:00:00.000Z",
  providerCall: {
    status: "claimed",
    responseId: null,
    inputTokens: null,
    outputTokens: null,
    costMicrousd: 0,
    costBasis: null,
  },
  judgeCall: null,
});

const fakeExecutionStore = (options: {
  replayed?: boolean;
  initial?: StoredQuickEvaluation;
  order?: string[];
} = {}) => {
  let stored = options.initial ?? runningRecord();
  const reserve = vi.fn(async () => {
    options.order?.push("reserve");
    return {
      runId: stored.runId,
      workspaceId: stored.workspaceId,
      replayed: options.replayed ?? false,
    };
  });
  const store: ModelExecutionStore = {
    reserveQuickEvaluation: reserve,
    reserveQuickRubricEvaluation: reserve,
    getQuickEvaluation: vi.fn(async () => stored),
    settleQuickEvaluation: vi.fn(async (input) => {
      options.order?.push("candidate-settle");
      stored = {
        ...stored,
        status: input.providerCallStatus === "completed" ? "completed" : "incomplete",
        output: input.output,
        behaviouralVerdict: null,
        behaviouralScore: null,
        judgement: null,
        providerCall: {
          status: input.providerCallStatus,
          responseId: input.responseId,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costMicrousd: input.costMicrousd,
          costBasis: input.costBasis,
        },
      };
    }),
    recordQuickCandidateForJudge: vi.fn(async (input) => {
      options.order?.push("candidate-record");
      stored = {
        ...stored,
        output: input.output,
        providerCall: {
          status: "completed",
          responseId: input.responseId,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costMicrousd: input.costMicrousd,
          costBasis: input.costBasis,
        },
      };
    }),
    claimQuickJudge: vi.fn(async (_runId, judge) => {
      options.order?.push("judge-claim");
      stored = {
        ...stored,
        judge,
        judgeCall: {
          status: "claimed",
          responseId: null,
          inputTokens: null,
          outputTokens: null,
          costMicrousd: 0,
          costBasis: null,
        },
      };
      return true;
    }),
    settleQuickJudgement: vi.fn(async (input) => {
      options.order?.push("judge-settle");
      stored = {
        ...stored,
        status: input.executionStatus,
        behaviouralVerdict: input.behaviouralVerdict,
        behaviouralScore: input.judgement?.score ?? null,
        judgement: input.judgement,
        judgeCall: {
          status: input.providerCallStatus,
          responseId: input.responseId,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costMicrousd: input.costMicrousd,
          costBasis: input.costBasis,
        },
      };
    }),
  };
  return store;
};

const requestFor = (body: unknown) =>
  new Request("https://rack.test/api/evaluate/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const handlerFor = (store: ModelExecutionStore, runner: ModelRunner) =>
  createEvaluationConfirmHandler({
    environment,
    verifyAuth: async () => ({ sub: "user-1" }),
    registry: () => registry,
    limitDefaults: () => defaults,
    modelRunner: () => runner,
    limitStoreFor: () => limitStore(),
    executionStoreFor: () => store,
    now: () => new Date("2026-08-11T05:00:00.000Z"),
  });

describe("evaluation confirmation handler", () => {
  it("fails closed when the resolved model identity changed after preflight", async () => {
    const runner: ModelRunner = { generate: vi.fn() };
    const store = fakeExecutionStore();
    const response = await handlerFor(store, runner)(
      requestFor({
        ...generationConfirmation,
        acceptedGenerator: { ...acceptedGenerator, modelId: "old-model" },
      }),
    );
    expect(response.status).toBe(409);
    expect(store.reserveQuickEvaluation).not.toHaveBeenCalled();
    expect(runner.generate).not.toHaveBeenCalled();
  });

  it("preserves generation-only Quick execution as an execution primitive", async () => {
    const order: string[] = [];
    const store = fakeExecutionStore({ order });
    const runner: ModelRunner = {
      generate: vi.fn(async () => {
        order.push("candidate-provider");
        return {
          text: "A clear update.",
          responseId: "resp_candidate",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        };
      }),
    };
    const response = await handlerFor(store, runner)(requestFor(generationConfirmation));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(order).toEqual(["reserve", "candidate-provider", "candidate-settle"]);
    expect(result.status).toBe("completed");
    expect(result.behaviouralVerdict).toBeNull();
    expect(result.judgeCall).toBeNull();
  });

  it("runs candidate then rubric judge and returns a structured indicative pass", async () => {
    const order: string[] = [];
    const store = fakeExecutionStore({ order });
    const runner: ModelRunner = {
      generate: vi
        .fn()
        .mockImplementationOnce(async () => {
          order.push("candidate-provider");
          return {
            text: "The project remains on track using the supplied milestones.",
            responseId: "resp_candidate",
            usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          };
        })
        .mockImplementationOnce(async () => {
          order.push("judge-provider");
          return {
            text: JSON.stringify({
              verdict: "pass",
              score: 92,
              reason: "Clear and grounded in the supplied task.",
              evidence: ["States the project status without adding unsupported facts."],
            }),
            responseId: "resp_judge",
            usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
          };
        }),
    };
    const response = await handlerFor(store, runner)(requestFor(rubricConfirmation));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(order).toEqual([
      "reserve",
      "candidate-provider",
      "candidate-record",
      "judge-claim",
      "judge-provider",
      "judge-settle",
    ]);
    expect(result.status).toBe("completed");
    expect(result.behaviouralVerdict).toBe(true);
    expect(result.behaviouralScore).toBe(92);
    expect(result.judgement).toMatchObject({ verdict: "pass", score: 92 });
    expect(result.providerCall.status).toBe("completed");
    expect(result.judgeCall).toMatchObject({ status: "completed", responseId: "resp_judge" });
  });

  it("represents a rubric failure as a completed behavioural failure, not infrastructure failure", async () => {
    const store = fakeExecutionStore();
    const runner: ModelRunner = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          text: "An update with an invented number.",
          responseId: "resp_candidate",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            verdict: "fail",
            score: 35,
            reason: "It invents a fact that was not supplied.",
            evidence: ["Introduces an unsupported number."],
          }),
          responseId: "resp_judge",
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
        }),
    };
    const result = await (await handlerFor(store, runner)(requestFor(rubricConfirmation))).json();
    expect(result.status).toBe("completed");
    expect(result.behaviouralVerdict).toBe(false);
    expect(result.behaviouralScore).toBe(35);
  });

  it("treats an unparsable judge response as incomplete with no behavioural verdict", async () => {
    const store = fakeExecutionStore();
    const runner: ModelRunner = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          text: "Candidate",
          responseId: "resp_candidate",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        })
        .mockResolvedValueOnce({
          text: "I think this is probably fine.",
          responseId: "resp_judge",
          usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 },
        }),
    };
    const result = await (await handlerFor(store, runner)(requestFor(rubricConfirmation))).json();
    expect(result.status).toBe("incomplete");
    expect(result.behaviouralVerdict).toBeNull();
    expect(result.judgement).toBeNull();
    expect(result.judgeCall.status).toBe("completed");
  });

  it("treats judge-provider failure as incomplete rather than behavioural failure", async () => {
    const store = fakeExecutionStore();
    const runner: ModelRunner = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          text: "Candidate",
          responseId: "resp_candidate",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        })
        .mockRejectedValueOnce(new Error("judge provider unavailable")),
    };
    const result = await (await handlerFor(store, runner)(requestFor(rubricConfirmation))).json();
    expect(result.status).toBe("incomplete");
    expect(result.behaviouralVerdict).toBeNull();
    expect(result.judgeCall).toMatchObject({
      status: "failed",
      costBasis: "failed-conservative",
    });
  });

  it("returns a settled idempotent replay without making another provider call", async () => {
    const completed: StoredQuickEvaluation = {
      ...runningRecord(),
      status: "completed",
      output: "Existing output",
      providerCall: {
        status: "completed",
        responseId: "resp_existing",
        inputTokens: 20,
        outputTokens: 10,
        costMicrousd: 40,
        costBasis: "provider-usage",
      },
    };
    const store = fakeExecutionStore({ replayed: true, initial: completed });
    const runner: ModelRunner = { generate: vi.fn() };
    const response = await handlerFor(store, runner)(requestFor(generationConfirmation));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.replayed).toBe(true);
    expect(result.output).toBe("Existing output");
    expect(runner.generate).not.toHaveBeenCalled();
  });

  it("never automatically repeats an in-progress or ambiguously claimed paid run", async () => {
    const store = fakeExecutionStore({ replayed: true });
    const runner: ModelRunner = { generate: vi.fn() };
    const response = await handlerFor(store, runner)(requestFor(generationConfirmation));
    const result = await response.json();
    expect(response.status).toBe(409);
    expect(result.error.message).toContain("will not repeat");
    expect(runner.generate).not.toHaveBeenCalled();
  });
});
