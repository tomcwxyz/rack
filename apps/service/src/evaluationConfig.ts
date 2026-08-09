import type { EvaluationLimitDefaults } from "@rack/database";
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
