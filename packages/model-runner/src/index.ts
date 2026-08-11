import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ModelRegistryEntry } from "@rack/registry";
import { generateText, type LanguageModel } from "ai";

export type ModelRunnerUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type ModelRunnerRequest = {
  model: ModelRegistryEntry;
  instructions: string;
  prompt: string;
  maxOutputTokens: number;
  apiKey?: string;
};

export type ModelRunnerResult = {
  text: string;
  responseId: string | null;
  usage: ModelRunnerUsage | null;
};

export type ModelRunner = {
  generate: (request: ModelRunnerRequest) => Promise<ModelRunnerResult>;
};

export type DirectProviderConfiguration = {
  kind: "openai" | "anthropic";
  apiKey?: string;
};

export type OpenAICompatibleEndpointConfiguration = {
  baseURL: string;
  apiKey?: string;
  headers?: Record<string, string>;
};

export type VercelAiSdkModelRunnerConfiguration = {
  providers: Record<string, DirectProviderConfiguration>;
  endpoints?: Record<string, OpenAICompatibleEndpointConfiguration>;
};

const requireNonEmpty = (value: string | undefined, label: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
};

const resolveModel = (
  request: ModelRunnerRequest,
  configuration: VercelAiSdkModelRunnerConfiguration,
): LanguageModel => {
  if (request.model.connection === "openai-compatible") {
    const endpointId = requireNonEmpty(request.model.endpointId, "OpenAI-compatible endpointId");
    const endpoint = configuration.endpoints?.[endpointId];
    if (!endpoint) throw new Error(`No OpenAI-compatible endpoint is configured for ${endpointId}.`);
    const provider = createOpenAICompatible({
      name: request.model.providerId,
      baseURL: requireNonEmpty(endpoint.baseURL, `Endpoint ${endpointId} baseURL`),
      apiKey: request.apiKey?.trim() || endpoint.apiKey?.trim(),
      headers: endpoint.headers,
    });
    return provider(request.model.modelId);
  }

  const providerConfig = configuration.providers[request.model.providerId];
  if (!providerConfig) {
    throw new Error(`No direct provider is configured for ${request.model.providerId}.`);
  }
  const apiKey = requireNonEmpty(
    request.apiKey?.trim() || providerConfig.apiKey?.trim(),
    `API key for ${request.model.providerId}`,
  );
  if (providerConfig.kind === "openai") {
    return createOpenAI({ apiKey })(request.model.modelId);
  }
  return createAnthropic({ apiKey })(request.model.modelId);
};

export const createVercelAiSdkModelRunner = (
  configuration: VercelAiSdkModelRunnerConfiguration,
): ModelRunner => ({
  async generate(request) {
    const result = await generateText({
      model: resolveModel(request, configuration),
      system: request.instructions,
      prompt: request.prompt,
      maxOutputTokens: request.maxOutputTokens,
      maxRetries: 0,
    });
    const usage = result.totalUsage;
    return {
      text: result.text,
      responseId: result.response.id || null,
      usage: usage
        ? {
            inputTokens: usage.inputTokens ?? null,
            outputTokens: usage.outputTokens ?? null,
            totalTokens: usage.totalTokens ?? null,
          }
        : null,
    };
  },
});
