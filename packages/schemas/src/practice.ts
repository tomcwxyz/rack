import { z } from "zod";

export const practiceAuthorityModeSchema = z.enum([
  "adaptable",
  "binding",
]);

export const practicePropagationSchema = z.enum([
  "shared",
  "local-only",
]);

export const practiceAuthoritySchema = z.object({
  mode: practiceAuthorityModeSchema.default("adaptable"),
  propagation: practicePropagationSchema.default("shared"),
  rationale: z.string().trim().min(1).optional(),
  review_after: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date such as 2026-11-01.")
    .optional(),
}).strict();

export const practiceSourceKindSchema = z.enum([
  "local",
  "starter",
  "shared-file",
  "git",
]);

export const practiceSourceRelationshipSchema = z.enum([
  "organisation",
  "team",
  "project",
  "other",
]);

export const practiceSourceSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  kind: practiceSourceKindSchema,
  relationship: practiceSourceRelationshipSchema.optional(),
  precedence: z.number().int().nonnegative(),
  ref: z.string().trim().min(1).optional(),
  commit: z.string()
    .regex(/^[0-9a-f]{7,64}$/i, "Expected a Git commit SHA.")
    .optional(),
}).strict();

export type PracticeAuthority = z.infer<typeof practiceAuthoritySchema>;
export type PracticeAuthorityMode = z.infer<typeof practiceAuthorityModeSchema>;
export type PracticePropagation = z.infer<typeof practicePropagationSchema>;
export type PracticeSource = z.infer<typeof practiceSourceSchema>;
export type PracticeSourceKind = z.infer<typeof practiceSourceKindSchema>;
export type PracticeSourceRelationship = z.infer<typeof practiceSourceRelationshipSchema>;
