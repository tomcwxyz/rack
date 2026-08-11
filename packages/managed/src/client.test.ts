import { describe, expect, it, vi } from "vitest";
import { createManagedServiceClient } from "./client.js";

const request = {
  schemaVersion: "0.1" as const,
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt" as const,
  instructions: "Write clearly.",
};

const preflightRequest = {
  schemaVersion: "0.1" as const,
  mode: "quick" as const,
  rackFingerprint: request.rackFingerprint,
  profileId: "writing",
  target: "prompt" as const,
  generatorAlias: "generator",
  caseCount: 1,
  judgeCallsPerOutput: 0,
  candidateInputTokensPerCase: 1000,
  generatorOutputTokensPerCall: 500,
  judgePromptTokensPerCase: 0,
  judgeOutputTokensPerCall: 0,
};

const preflightResponse = {
  schemaVersion: "0.1",
  mode: "quick",
  indicative: true,
  requiresExplicitConfirmation: true,
  eligibleForConfirmation: true,
  generatorAlias: "generator",
  judgeAlias: "generator",
  generator: { alias: "generator", providerId: "provider-one", modelId: "model-a" },
  judge: { alias: "generator", providerId: "provider-one", modelId: "model-a" },
  judgeIndependent: null,
  repetitions: 1,
  baselineEnabled: false,
  comparePreviousAcceptedRun: false,
  regressionGate: false,
  calls: { candidateGenerator: 1, baselineGenerator: 0, judge: 0, total: 1 },
  tokens: {
    generatorInput: 1000,
    generatorOutput: 500,
    judgeInput: 0,
    judgeOutput: 0,
    total: 1500,
  },
  costMicrousd: {
    generator: 1000,
    judge: 0,
    estimated: 1000,
    maximumRetry: 3000,
  },
  limits: {
    perRunCapMicrousd: 10000,
    workspaceRemainingMicrousd: 100000,
    activePaidRuns: 0,
    concurrencyLimit: 2,
    maxProviderAttemptsPerCall: 3,
  },
  warnings: [],
  blockers: [],
};

describe("managed client", () => {
  it("does not make a request without an access token", async () => {
    const fetch = vi.fn();
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test",
      getAccessToken: async () => null,
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await expect(client.quickCheck(request)).rejects.toThrow("Sign in");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts and polls a reliable check without changing the local request contract", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            runId: "00000000-0000-4000-8000-000000000001",
            workflowRunId: "wrun_test",
            status: "queued",
            transientContentExpiresAt: "2026-08-10T05:00:00.000Z",
          },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          runId: "00000000-0000-4000-8000-000000000001",
          status: "running",
          summary: null,
        }),
      );
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test/",
      getAccessToken: async () => "token",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    const started = await client.startReliableCheck(request);
    const status = await client.getReliableCheckStatus(started.runId);

    expect(started.workflowRunId).toBe("wrun_test");
    expect(status.status).toBe("running");
  });

  it("requests evaluation preflight without sending Rack content", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(preflightResponse),
    );
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test",
      getAccessToken: async () => "token",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const preflight = await client.evaluationPreflight(preflightRequest);
    const sent = String(fetch.mock.calls[0]?.[1]?.body ?? "");
    expect(preflight.eligibleForConfirmation).toBe(true);
    expect(preflight.generator).toEqual(preflightResponse.generator);
    expect(sent).not.toContain(request.instructions);
  });

  it("sends content only through explicit confirmed execution", async () => {
    const response = {
      schemaVersion: "0.1",
      runId: "00000000-0000-4000-8000-000000000010",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      status: "completed",
      replayed: false,
      generator: preflightResponse.generator,
      judge: null,
      behaviouralVerdict: null,
      behaviouralScore: null,
      judgement: null,
      output: "A clear update.",
      transientContentAvailable: true,
      transientContentExpiresAt: "2026-08-12T05:00:00.000Z",
      providerCall: {
        status: "completed",
        responseId: "resp_123",
        inputTokens: 20,
        outputTokens: 10,
        costMicrousd: 40,
        costBasis: "provider-usage",
      },
      judgeCall: null,
    };
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(response),
    );
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test",
      getAccessToken: async () => "token",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const result = await client.confirmEvaluation({
      schemaVersion: "0.1",
      preflight: preflightRequest,
      acceptedGenerator: preflightResponse.generator,
      acceptedMaximumRetryCostMicrousd: preflightResponse.costMicrousd.maximumRetry,
      idempotencyKey: "00000000-0000-4000-8000-000000000099",
      instructions: request.instructions,
      casePrompt: "Write an update.",
    });
    expect(result.status).toBe("completed");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/evaluate/confirm");
    expect(String(init?.body)).toContain(request.instructions);
  });

  it("supports explicit rubric content and accepted judge identity only at confirmation", async () => {
    const rubricPreflight = {
      ...preflightRequest,
      judgeCallsPerOutput: 1,
      judgePromptTokensPerCase: 1000,
      judgeOutputTokensPerCall: 100,
    };
    const response = {
      schemaVersion: "0.1",
      runId: "00000000-0000-4000-8000-000000000011",
      workspaceId: "00000000-0000-4000-8000-000000000001",
      status: "completed",
      replayed: false,
      generator: preflightResponse.generator,
      judge: preflightResponse.generator,
      behaviouralVerdict: true,
      behaviouralScore: 90,
      judgement: {
        verdict: "pass",
        score: 90,
        reason: "Clear and grounded.",
        evidence: ["Uses only supplied facts."],
      },
      output: "A clear update.",
      transientContentAvailable: true,
      transientContentExpiresAt: "2026-08-12T05:00:00.000Z",
      providerCall: {
        status: "completed",
        responseId: "resp_candidate",
        inputTokens: 20,
        outputTokens: 10,
        costMicrousd: 40,
        costBasis: "provider-usage",
      },
      judgeCall: {
        status: "completed",
        responseId: "resp_judge",
        inputTokens: 30,
        outputTokens: 5,
        costMicrousd: 40,
        costBasis: "provider-usage",
      },
    };
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(response),
    );
    const client = createManagedServiceClient({
      baseUrl: "https://managed.rack.test",
      getAccessToken: async () => "token",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const result = await client.confirmEvaluation({
      schemaVersion: "0.1",
      preflight: rubricPreflight,
      acceptedGenerator: preflightResponse.generator,
      acceptedJudge: preflightResponse.generator,
      acceptedMaximumRetryCostMicrousd: 7500,
      idempotencyKey: "00000000-0000-4000-8000-000000000098",
      instructions: request.instructions,
      casePrompt: "Write an update.",
      rubric: "Pass when the update is clear and grounded.",
    });
    expect(result.behaviouralVerdict).toBe(true);
    expect(result.behaviouralScore).toBe(90);
    expect(String(fetch.mock.calls[0]?.[1]?.body ?? "")).toContain("Pass when the update");
  });
});
