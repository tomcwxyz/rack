import { z } from "zod";

export const practiceAuthorityModeSchema = z.enum([
  "adaptable",
  "binding",
]);

export const practicePropagationSchema = z.enum([
  "shared",
  "local-only",
]);

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const isCalendarDate = (value: string): boolean => {
  if (!calendarDatePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const practiceDateSchema = z.string()
  .regex(calendarDatePattern, "Expected an ISO date such as 2026-11-01.")
  .refine(isCalendarDate, "Expected a real calendar date.");

export const practiceExperimentSchema = z.object({
  question: z.string().trim().min(1),
}).strict();

export const practiceAuthoritySchema = z.object({
  mode: practiceAuthorityModeSchema.default("adaptable"),
  propagation: practicePropagationSchema.default("shared"),
  rationale: z.string().trim().min(1).optional(),
  review_after: practiceDateSchema.optional(),
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
  path: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional(),
  ref: z.string().trim().min(1).optional(),
  commit: z.string()
    .regex(/^[0-9a-f]{7,64}$/i, "Expected a Git commit SHA.")
    .optional(),
}).strict();

const sharedPracticeVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "Expected a semantic version such as 0.1.0.",
);

export const sharedPracticeFileSchema = z.object({
  format: z.literal("rack.shared-practice"),
  schema_version: z.literal("0.1"),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "Expected a lowercase shared-practice ID."),
  version: sharedPracticeVersionSchema,
  title: z.string().trim().min(1),
  description: z.string().default(""),
  published_by: z.object({
    name: z.string().trim().min(1),
    organisation: z.string().trim().min(1).optional(),
  }).strict(),
  license: z.string().trim().min(1).nullable().default(null),
  instructions: z.array(z.record(z.string(), z.unknown())).min(1),
}).strict();

export type PracticeAuthority = z.infer<typeof practiceAuthoritySchema>;
export type PracticeExperiment = z.infer<typeof practiceExperimentSchema>;
export type PracticeAuthorityMode = z.infer<typeof practiceAuthorityModeSchema>;
export type PracticePropagation = z.infer<typeof practicePropagationSchema>;
export type PracticeSource = z.infer<typeof practiceSourceSchema>;
export type PracticeSourceKind = z.infer<typeof practiceSourceKindSchema>;
export type PracticeSourceRelationship = z.infer<typeof practiceSourceRelationshipSchema>;

export type SharedPracticeFile = z.infer<typeof sharedPracticeFileSchema>;
