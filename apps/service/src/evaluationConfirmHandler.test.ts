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
      alias: "judge",
      providerId: "provider-two",
      modelId: "model-b",
      connection: "managed",
      capabilities: ["judge"],
      pricing: {
        inputMicrousdPerMillionTokens: 1_000_000,
        outputMicrousdPerMillionTokens: 2_000_000,
      },
      limits: { maxOutputTokens: 2048 },
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

const preflight = {
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

const confirmation = {
  schemaVersion: "0.1" as const,
  preflight,
  acceptedGenerator: {
    alias: "generator",
    providerId: "provider-one",
    modelId: "model-a",
  },
  acceptedMaximumRetryCostMicrousd: 3600,
  idempotencyKey: "00000000-0000-4000-8000-000000000099",
  instructions: "Write clearly and use the supplied facts.",
  casePrompt: "Write a short project update.",
};

const runningRecord = (): StoredQuickEvaluation => ({
  runId: "00000000-0000-4000-8000-000000000010",
  workspaceId: "00000000-0000-4000-8000-000000000001",
  status: "running",
  generator: confirmation.acceptedGenerator,
  behaviouralVerdict: null,
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
});

const fakeExecutionStore = (options: {
  replayed?: boolean;
  initial?: StoredQuickEvaluation;
  order?: string[];
} = {}) => {
  let stored = options.initial ?? runningRecord();
  const store: ModelExecutionStore = {
    reserveQuickEvaluation: vi.fn(async () => {
      options.order?.push("reserve");
      return {
        runId: stored.runId,
        workspaceId: stored.workspaceId,
        replayed: options.replayed ?? false,
      };
    }),
    getQuickEvaluation: vi.fn(async () => stored),
    settleQuickEvaluation: vi.fn(async (input) => {
      options.order?.push("settle");
      stored = {
        ...stored,
        status: input.providerCallStatus === "completed" ? "completed" : "incomplete",
        output: input.output,
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
  };
  return store;
};

const requestFor = (body: unknown) =>
  new Request("https://rack.test/api/evaluate/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("evaluation confirmation handler", () => {
  it("fails closed when the resolved model identity changed after preflight", async () => {
    const runner: ModelRunner = { generate: vi.fn() };
    const store = fakeExecutionStore();
    const handler = createEvaluationConfirmHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      modelRunner: () => runner,
      limitStoreFor: () => limitStore(),
      executionStoreFor: () => store,
    });
    const response = await handler(
      requestFor({
        ...confirmation,
        acceptedGenerator: { ...confirmation.acceptedGenerator, modelId: "old-model" },
      }),
    );
    expect(response.status).toBe(409);
    expect(store.reserveQuickEvaluation).not.toHaveBeenCalled();
    expect(runner.generate).not.toHaveBeenCalled();
  });

  it("reserves and claims the call before invoking the provider runner", async () => {
    const order: string[] = [];
    const store = fakeExecutionStore({ order });
    const runner: ModelRunner = {
      generate: vi.fn(async () => {
        order.push("provider");
        return {
          text: "A clear update.",
          responseId: "resp_123",
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        };
      }),
    };
    const handler = createEvaluationConfirmHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      modelRunner: () => runner,
      limitStoreFor: () => limitStore(),
      executionStoreFor: () => store,
      now: () => new Date("2026-08-11T05:00:00.000Z"),
    });
    const response = await handler(requestFor(confirmation));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(order).toEqual(["reserve", "provider", "settle"]);
    expect(result.status).toBe("completed");
    expect(result.behaviouralVerdict).toBeNull();
    expect(result.output).toBe("A clear update.");
    expect(result.providerCall).toMatchObject({
      status: "completed",
      responseId: "resp_123",
      inputTokens: 20,
      outputTokens: 10,
      costMicrousd: 40,
      costBasis: "provider-usage",
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
    const handler = createEvaluationConfirmHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      modelRunner: () => runner,
      limitStoreFor: () => limitStore(),
      executionStoreFor: () => store,
    });
    const response = await handler(requestFor(confirmation));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.replayed).toBe(true);
    expect(result.output).toBe("Existing output");
    expect(runner.generate).not.toHaveBeenCalled();
  });

  it("never automatically repeats an already-claimed paid provider call", async () => {
    const store = fakeExecutionStore({ replayed: true });
    const runner: ModelRunner = { generate: vi.fn() };
    const handler = createEvaluationConfirmHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      modelRunner: () => runner,
      limitStoreFor: () => limitStore(),
      executionStoreFor: () => store,
    });
    const response = await handler(requestFor(confirmation));
    const result = await response.json();
    expect(response.status).toBe(409);
    expect(result.error.message).toContain("will not repeat");
    expect(runner.generate).not.toHaveBeenCalled();
  });

  it("records provider failure as incomplete rather than a behavioural failure", async () => {
    const store = fakeExecutionStore();
    const runner: ModelRunner = {
      generate: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    const handler = createEvaluationConfirmHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      modelRunner: () => runner,
      limitStoreFor: () => limitStore(),
      executionStoreFor: () => store,
    });
    const response = await handler(requestFor(confirmation));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.status).toBe("incomplete");
    expect(result.behaviouralVerdict).toBeNull();
    expect(result.providerCall).toMatchObject({
      status: "failed",
      costMicrousd: 1200,
      costBasis: "failed-conservative",
    });
  });
});
