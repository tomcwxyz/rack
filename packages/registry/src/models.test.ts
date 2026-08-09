import { describe, expect, it } from "vitest";
import {
  parseModelRegistry,
  resolveModelAlias,
  sameResolvedModel,
} from "./models.js";

const registry = {
  schemaVersion: "0.1" as const,
  models: [
    {
      alias: "generator",
      providerId: "provider-one",
      modelId: "model-a",
      connection: "managed" as const,
      capabilities: ["generate" as const],
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
      connection: "managed" as const,
      capabilities: ["judge" as const],
      pricing: {
        inputMicrousdPerMillionTokens: 3_000_000,
        outputMicrousdPerMillionTokens: 12_000_000,
      },
      limits: { maxOutputTokens: 2048 },
    },
    {
      alias: "local",
      providerId: "local-runtime",
      modelId: "local-model",
      connection: "openai-compatible" as const,
      endpointId: "local-openai",
      capabilities: ["generate" as const],
      pricing: {
        inputMicrousdPerMillionTokens: 0,
        outputMicrousdPerMillionTokens: 0,
      },
      limits: { maxOutputTokens: 8192 },
    },
  ],
};

describe("model registry", () => {
  it("keeps stable aliases separate from provider/model mappings", () => {
    const parsed = parseModelRegistry(registry, { minimumManagedProviders: 2 });
    expect(resolveModelAlias(parsed, "generator", "generate").modelId).toBe("model-a");
    expect(resolveModelAlias(parsed, "local").endpointId).toBe("local-openai");
  });

  it("can enforce managed-provider diversity", () => {
    expect(() =>
      parseModelRegistry(
        { ...registry, models: registry.models.filter((model) => model.providerId !== "provider-two") },
        { minimumManagedProviders: 2 },
      ),
    ).toThrow("at least 2 distinct managed providers");
  });

  it("detects whether a judge resolves to the same provider/model", () => {
    const parsed = parseModelRegistry(registry);
    const generator = resolveModelAlias(parsed, "generator");
    expect(sameResolvedModel(generator, generator)).toBe(true);
    expect(sameResolvedModel(generator, resolveModelAlias(parsed, "judge"))).toBe(false);
  });
});
