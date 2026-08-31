import { z } from "zod";
import {
  adapterCapabilityIdSchema,
  destinationIdSchema,
} from "./index.js";

const semanticVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "Expected a semantic version.",
);

const relativeArtifactPathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".."),
    "Expected a safe relative artifact path.",
  );

export const sha256DigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

const artifactSchema = z
  .object({
    path: relativeArtifactPathSchema,
    media_type: z.enum(["text/markdown", "text/plain", "application/json"]),
    digest: sha256DigestSchema,
    bytes: z.number().int().nonnegative(),
    estimated_tokens: z.number().int().nonnegative(),
  })
  .strict();

export const buildManifestSchema = z
  .object({
    schema_version: z.literal("0.2"),
    compiler: z
      .object({
        name: z.literal("rack"),
        version: semanticVersionSchema,
      })
      .strict(),
    adapter: z
      .object({
        id: destinationIdSchema,
        version: semanticVersionSchema,
        status: z.enum(["supported", "preview", "community", "deprecated"]),
      })
      .strict(),
    project: z
      .object({
        name: z.string().min(1),
        version: semanticVersionSchema,
      })
      .strict(),
    profile: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1),
      })
      .strict(),
    source: z
      .object({
        digest: sha256DigestSchema,
        module_ids: z.array(z.string()).default([]),
      })
      .strict(),
    context: z
      .object({
        source: z.string().min(1),
        packet_id: z.string().min(1),
        digest: sha256DigestSchema,
        subject: z.string().min(1),
        purpose: z.string().min(1),
        generated_at: z.string().datetime({ offset: true }),
        expires_at: z.string().datetime({ offset: true }).nullable(),
        permissions: z.array(z.string()).default([]),
        object_ids: z.array(z.string()).default([]),
      })
      .strict()
      .optional(),
    artifacts: z
      .array(artifactSchema)
      .min(1)
      .refine(
        (artifacts) =>
          new Set(artifacts.map((artifact) => artifact.path)).size === artifacts.length,
        "Artifact paths must be unique.",
      ),
    package: z
      .object({
        estimated_tokens: z.number().int().nonnegative(),
        token_estimator: z.literal("utf8-bytes-divided-by-4"),
      })
      .strict(),
    degradations: z
      .array(
        z
          .object({
            capability: adapterCapabilityIdSchema,
            title: z.string().min(1),
            module_ids: z.array(z.string()).default([]),
          })
          .strict(),
      )
      .default([]),
    modules: z
      .array(
        z
          .object({
            id: z.string().min(1),
            version: semanticVersionSchema,
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export type BuildManifest = z.infer<typeof buildManifestSchema>;
