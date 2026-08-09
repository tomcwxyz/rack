import { slugSchema } from "@rack/schemas";
import { z } from "zod";

export const modelAliasSchema = slugSchema;
export const modelConnectionSchema = z.enum([
  "managed",
  "byok",
  "openai-compatible",
]);
export const modelCapabilitySchema = z.enum(["generate", "judge", "draft"]);

const priceSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const modelRegistryEntrySchema = z
  .object({
    alias: modelAliasSchema,
    providerId: slugSchema,
    modelId: z.string().min(1).max(200),
    connection: modelConnectionSchema,
    endpointId: slugSchema.optional(),
    capabilities: z.array(modelCapabilitySchema).min(1),
    pricing: z
      .object({
        inputMicrousdPerMillionTokens: priceSchema,
        outputMicrousdPerMillionTokens: priceSchema,
      })
      .strict(),
    limits: z
      .object({
        maxOutputTokens: z.number().int().positive().max(1_000_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.connection === "openai-compatible" && !entry.endpointId) {
      context.addIssue({
        code: "custom",
        path: ["endpointId"],
        message: "OpenAI-compatible models require an endpointId.",
      });
    }
  });

export const modelRegistrySchema = z
  .object({
    schemaVersion: z.literal("0.1"),
    models: z.array(modelRegistryEntrySchema).min(1),
  })
  .strict()
  .superRefine((registry, context) => {
    const seen = new Set<string>();
    registry.models.forEach((model, index) => {
      if (seen.has(model.alias)) {
        context.addIssue({
          code: "custom",
          path: ["models", index, "alias"],
          message: `Duplicate model alias: ${model.alias}`,
        });
      }
      seen.add(model.alias);
    });
  });

export type ModelRegistryEntry = z.infer<typeof modelRegistryEntrySchema>;
export type ModelRegistry = z.infer<typeof modelRegistrySchema>;
export type ModelCapability = z.infer<typeof modelCapabilitySchema>;

export const parseModelRegistry = (
  input: unknown,
  options: { minimumManagedProviders?: number } = {},
): ModelRegistry => {
  const registry = modelRegistrySchema.parse(input);
  const minimumManagedProviders = options.minimumManagedProviders ?? 0;
  const managedProviders = new Set(
    registry.models
      .filter((model) => model.connection === "managed")
      .map((model) => model.providerId),
  );
  if (managedProviders.size < minimumManagedProviders) {
    throw new Error(
      `Model registry requires at least ${minimumManagedProviders} distinct managed providers; found ${managedProviders.size}.`,
    );
  }
  return registry;
};

export const parseModelRegistryJson = (
  value: string,
  options: { minimumManagedProviders?: number } = {},
): ModelRegistry => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Model registry must be valid JSON.");
  }
  return parseModelRegistry(parsed, options);
};

export const resolveModelAlias = (
  registry: ModelRegistry,
  alias: string,
  capability?: ModelCapability,
): ModelRegistryEntry => {
  const parsedAlias = modelAliasSchema.parse(alias);
  const model = registry.models.find((entry) => entry.alias === parsedAlias);
  if (!model) throw new Error(`Unknown model alias: ${parsedAlias}`);
  if (capability && !model.capabilities.includes(capability)) {
    throw new Error(`Model alias ${parsedAlias} does not support ${capability}.`);
  }
  return model;
};

export const sameResolvedModel = (
  left: ModelRegistryEntry,
  right: ModelRegistryEntry,
): boolean => left.providerId === right.providerId && left.modelId === right.modelId;
