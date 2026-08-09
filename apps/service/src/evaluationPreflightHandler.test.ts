import { describe, expect, it, vi } from "vitest";
import { parseModelRegistry } from "@rack/registry";
import { createEvaluationPreflightHandler } from "./evaluationPreflightHandler.js";

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
      pricing: { inputMicrousdPerMillionTokens: 1_000_000, outputMicrousdPerMillionTokens: 2_000_000 },
      limits: { maxOutputTokens: 4096 },
    },
    {
      alias: "judge",
      providerId: "provider-two",
      modelId: "model-b",
      connection: "managed",
      capabilities: ["judge"],
      pricing: { inputMicrousdPerMillionTokens: 1_000_000, outputMicrousdPerMillionTokens: 2_000_000 },
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
const body = {
  schemaVersion: "0.1",
  mode: "reliable",
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt",
  generatorAlias: "generator",
  judgeAlias: "judge",
  caseCount: 1,
  judgeCallsPerOutput: 1,
  candidateInputTokensPerCase: 1000,
  baselineInputTokensPerCase: 400,
  generatorOutputTokensPerCall: 500,
  judgePromptTokensPerCase: 200,
  judgeOutputTokensPerCall: 100,
};

describe("evaluation preflight handler", () => {
  it("rejects raw content fields at the public boundary", async () => {
    const handler = createEvaluationPreflightHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      limitStoreFor: () => ({
        getPreflightLimits: async () => ({
          workspaceId: "00000000-0000-4000-8000-000000000001",
          perRunCapMicrousd: 20_000_000,
          workspaceRemainingMicrousd: 100_000_000,
          activePaidRuns: 0,
          concurrencyLimit: 2,
          maxProviderAttemptsPerCall: 3,
        }),
      }),
    });
    const response = await handler(
      new Request("https://rack.test/api/evaluate/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, instructions: "private" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns cost and call metadata without creating a run", async () => {
    const getPreflightLimits = vi.fn(async () => ({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      perRunCapMicrousd: 20_000_000,
      workspaceRemainingMicrousd: 100_000_000,
      activePaidRuns: 0,
      concurrencyLimit: 2,
      maxProviderAttemptsPerCall: 3,
    }));
    const handler = createEvaluationPreflightHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      limitStoreFor: () => ({ getPreflightLimits }),
    });
    const response = await handler(
      new Request("https://rack.test/api/evaluate/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.calls.total).toBe(20);
    expect(result.requiresExplicitConfirmation).toBe(true);
    expect(result).not.toHaveProperty("runId");
    expect(getPreflightLimits).toHaveBeenCalledOnce();
  });

  it("blocks through workspace metadata without starting provider work", async () => {
    const handler = createEvaluationPreflightHandler({
      environment,
      verifyAuth: async () => ({ sub: "user-1" }),
      registry: () => registry,
      limitDefaults: () => defaults,
      limitStoreFor: () => ({
        getPreflightLimits: async () => ({
          workspaceId: "00000000-0000-4000-8000-000000000001",
          perRunCapMicrousd: 20_000_000,
          workspaceRemainingMicrousd: 1,
          activePaidRuns: 2,
          concurrencyLimit: 2,
          maxProviderAttemptsPerCall: 3,
        }),
      }),
    });
    const response = await handler(
      new Request("https://rack.test/api/evaluate/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const result = await response.json();
    expect(result.eligibleForConfirmation).toBe(false);
    expect(result.blockers.map((item: { code: string }) => item.code)).toEqual(
      expect.arrayContaining(["workspace-budget", "concurrency"]),
    );
  });
});
