import { z } from "zod";

const semanticVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "Expected a semantic version.",
);

export const sha256DigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const buildManifestSchema = z
  .object({
    schema_version: z.literal("0.1"),
    compiler: z
      .object({
        name: z.literal("rack"),
        version: semanticVersionSchema,
      })
      .strict(),
    adapter: z
      .object({
        id: z.literal("prompt"),
        version: semanticVersionSchema,
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
    artifact: z
      .object({
        path: z.literal("system-prompt.md"),
        media_type: z.literal("text/markdown"),
        digest: sha256DigestSchema,
        bytes: z.number().int().nonnegative(),
        estimated_tokens: z.number().int().nonnegative(),
        token_estimator: z.literal("utf8-bytes-divided-by-4"),
      })
      .strict(),
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
