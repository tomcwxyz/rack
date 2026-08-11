import type { EvaluationLimitDefaults } from "@rack/database";
import {
  createVercelAiSdkModelRunner,
  type ModelRunner,
  type VercelAiSdkModelRunnerConfiguration,
} from "@rack/model-runner";
import { parseModelRegistryJson, type ModelRegistry } from "@rack/registry";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing evaluation environment variable: ${name}`);
  return value;
};

const safeInteger = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
};

export const readEvaluationModelRegistry = (): ModelRegistry =>
  parseModelRegistryJson(required("RACK_MODEL_REGISTRY_JSON"), {
    minimumManagedProviders: 2,
  });

export const readEvaluationLimitDefaults = (): EvaluationLimitDefaults => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(required("RACK_EVALUATION_LIMITS_JSON"));
  } catch {
    throw new Error("RACK_EVALUATION_LIMITS_JSON must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("RACK_EVALUATION_LIMITS_JSON must be a JSON object.");
  }
  const value = parsed as Record<string, unknown>;
  const hardBudgetMicrousd = safeInteger(value.hardBudgetMicrousd, "Workspace hard budget");
  const perRunCapMicrousd = safeInteger(value.perRunCapMicrousd, "Per-run cap");
  const concurrencyLimit = safeInteger(value.concurrencyLimit, "Concurrency limit");
  const maxProviderAttemptsPerCall = safeInteger(
    value.maxProviderAttemptsPerCall,
    "Provider attempt limit",
  );
  if (concurrencyLimit < 1) throw new Error("Concurrency limit must be at least 1.");
  if (maxProviderAttemptsPerCall < 1 || maxProviderAttemptsPerCall > 5) {
    throw new Error("Provider attempt limit must be between 1 and 5.");
  }
  return {
    hardBudgetMicrousd,
    perRunCapMicrousd,
    concurrencyLimit,
    maxProviderAttemptsPerCall,
  };
};

type DeploymentProvider = {
  kind: "openai" | "anthropic";
  apiKeyEnv: string;
};

type DeploymentEndpoint = {
  baseURL: string;
  apiKeyEnv?: string;
};

type DeploymentRunnerConfiguration = {
  providers: Record<string, DeploymentProvider>;
  endpoints?: Record<string, DeploymentEndpoint>;
};

const nonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
};

const parseRunnerConfiguration = (input: unknown): DeploymentRunnerConfiguration => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("RACK_MODEL_RUNNER_JSON must be a JSON object.");
  }
  const value = input as Record<string, unknown>;
  if (!value.providers || typeof value.providers !== "object" || Array.isArray(value.providers)) {
    throw new Error("RACK_MODEL_RUNNER_JSON requires a providers object.");
  }
  const providers: Record<string, DeploymentProvider> = {};
  for (const [providerId, raw] of Object.entries(value.providers as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Provider ${providerId} configuration must be an object.`);
    }
    const provider = raw as Record<string, unknown>;
    if (provider.kind !== "openai" && provider.kind !== "anthropic") {
      throw new Error(`Provider ${providerId} kind must be openai or anthropic.`);
    }
    providers[providerId] = {
      kind: provider.kind,
      apiKeyEnv: nonEmptyString(provider.apiKeyEnv, `Provider ${providerId} apiKeyEnv`),
    };
  }

  const endpoints: Record<string, DeploymentEndpoint> = {};
  if (value.endpoints !== undefined) {
    if (!value.endpoints || typeof value.endpoints !== "object" || Array.isArray(value.endpoints)) {
      throw new Error("RACK_MODEL_RUNNER_JSON endpoints must be an object when provided.");
    }
    for (const [endpointId, raw] of Object.entries(value.endpoints as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`Endpoint ${endpointId} configuration must be an object.`);
      }
      const endpoint = raw as Record<string, unknown>;
      endpoints[endpointId] = {
        baseURL: nonEmptyString(endpoint.baseURL, `Endpoint ${endpointId} baseURL`),
        apiKeyEnv:
          endpoint.apiKeyEnv === undefined
            ? undefined
            : nonEmptyString(endpoint.apiKeyEnv, `Endpoint ${endpointId} apiKeyEnv`),
      };
    }
  }
  return { providers, endpoints };
};

const secretFromEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing model-provider secret environment variable: ${name}`);
  return value;
};

export const readEvaluationModelRunner = (): ModelRunner => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(required("RACK_MODEL_RUNNER_JSON"));
  } catch {
    throw new Error("RACK_MODEL_RUNNER_JSON must be valid JSON.");
  }
  const deployment = parseRunnerConfiguration(parsed);
  const configuration: VercelAiSdkModelRunnerConfiguration = {
    providers: Object.fromEntries(
      Object.entries(deployment.providers).map(([providerId, provider]) => [
        providerId,
        {
          kind: provider.kind,
          apiKey: secretFromEnvironment(provider.apiKeyEnv),
        },
      ]),
    ),
    endpoints: Object.fromEntries(
      Object.entries(deployment.endpoints ?? {}).map(([endpointId, endpoint]) => [
        endpointId,
        {
          baseURL: endpoint.baseURL,
          apiKey: endpoint.apiKeyEnv ? secretFromEnvironment(endpoint.apiKeyEnv) : undefined,
        },
      ]),
    ),
  };
  return createVercelAiSdkModelRunner(configuration);
};
