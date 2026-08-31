import {
  destinationIdSchema,
  slugSchema,
  verificationEvidenceSchema,
  type VerificationEvidence,
} from "@rack/schemas";
import { z } from "zod";
import type { ManagedServiceClient } from "./client.js";
import {
  evaluationPreflightRequestSchema,
  rackFingerprintSchema,
  type EvaluationConfirmResponse,
  type EvaluationPreflightRequest,
  type EvaluationPreflightResponse,
} from "./contracts.js";

export const verificationJudgementSchema = z
  .object({
    verdict: z.enum(["pass", "fail", "uncertain"]),
    reason: z.string().min(1).max(1_000),
    evidence: z.array(z.string().min(1).max(500)).max(5),
  })
  .strict();

export const verificationJudgementInputSchema = z
  .object({
    rackFingerprint: rackFingerprintSchema,
    profileId: slugSchema,
    target: destinationIdSchema.default("prompt"),
    modelAlias: slugSchema,
    question: z.string().min(1).max(4_000),
    evidence: z
      .array(
        z
          .object({
            kind: verificationEvidenceSchema,
            content: z.string().min(1).max(100_000),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    maxOutputTokens: z.number().int().positive().max(2_000).default(400),
  })
  .strict();

export type VerificationJudgement = z.infer<typeof verificationJudgementSchema>;
export type VerificationJudgementInput = z.input<
  typeof verificationJudgementInputSchema
>;
export type VerificationJudgementEvidence = {
  kind: VerificationEvidence;
  content: string;
};

export type VerificationJudgementPlan = {
  request: EvaluationPreflightRequest;
  response: EvaluationPreflightResponse;
  system: string;
  prompt: string;
};

export type VerificationJudgementExecution = {
  status: "completed" | "incomplete";
  judgement: VerificationJudgement | null;
  execution: EvaluationConfirmResponse;
};

export const VERIFICATION_JUDGE_SYSTEM = [
  "You are a bounded verifier of one piece of work against one explicit working-practice question.",
  "Use only the supplied verification question and evidence.",
  "Do not rely on unstated context and do not invent missing evidence.",
  'Return JSON only with keys verdict, reason and evidence.',
  'verdict must be "pass", "fail" or "uncertain".',
  'Use "uncertain" when the supplied evidence is insufficient, ambiguous or conflicting.',
  "Evidence must be a JSON array of at most five short observations grounded in the supplied material.",
].join(" ");

const evidenceLabel = (kind: VerificationEvidence): string => {
  const labels: Record<VerificationEvidence, string> = {
    output: "Output",
    diff: "Change diff",
    "test-results": "Test results",
    "build-results": "Build results",
    "task-input": "Task input",
    source: "Source material",
  };
  return labels[kind];
};

export const buildVerificationJudgementPrompt = (input: {
  question: string;
  evidence: VerificationJudgementEvidence[];
}): string => {
  const parts = [
    "Verification question:",
    input.question.trim(),
    "",
    "Supplied evidence:",
  ];

  for (const item of input.evidence) {
    parts.push("", `## ${evidenceLabel(item.kind)}`, item.content.trim());
  }

  parts.push("", "Return only the required JSON object.");
  return parts.join("\n");
};

const utf8Length = (value: string): number =>
  new TextEncoder().encode(value).length;

export const buildVerificationJudgementPreflight = (
  input: VerificationJudgementInput,
): {
  request: EvaluationPreflightRequest;
  system: string;
  prompt: string;
} => {
  const parsed = verificationJudgementInputSchema.parse(input);
  const prompt = buildVerificationJudgementPrompt({
    question: parsed.question,
    evidence: parsed.evidence,
  });
  const system = VERIFICATION_JUDGE_SYSTEM;

  const request = evaluationPreflightRequestSchema.parse({
    schemaVersion: "0.1",
    mode: "quick",
    rackFingerprint: parsed.rackFingerprint,
    profileId: parsed.profileId,
    target: parsed.target,
    generatorAlias: parsed.modelAlias,
    caseCount: 1,
    judgeCallsPerOutput: 0,
    candidateInputTokensPerCase: utf8Length(`${system}\n\n${prompt}`),
    generatorOutputTokensPerCall: parsed.maxOutputTokens,
    judgePromptTokensPerCase: 0,
    judgeOutputTokensPerCall: 0,
  });

  return { request, system, prompt };
};

export const prepareVerificationJudgement = async (
  client: ManagedServiceClient,
  input: VerificationJudgementInput,
): Promise<VerificationJudgementPlan> => {
  const prepared = buildVerificationJudgementPreflight(input);
  const response = await client.evaluationPreflight(prepared.request);
  return { ...prepared, response };
};

const unwrapCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
};

export const parseVerificationJudgement = (
  value: string,
): VerificationJudgement | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapCodeFence(value));
  } catch {
    return null;
  }
  const result = verificationJudgementSchema.safeParse(parsed);
  return result.success ? result.data : null;
};

export const confirmVerificationJudgement = async (
  client: ManagedServiceClient,
  plan: VerificationJudgementPlan,
  idempotencyKey: string,
): Promise<VerificationJudgementExecution> => {
  const execution = await client.confirmEvaluation({
    schemaVersion: "0.1",
    preflight: plan.request,
    acceptedGenerator: plan.response.generator,
    acceptedMaximumRetryCostMicrousd: plan.response.costMicrousd.maximumRetry,
    idempotencyKey,
    instructions: plan.system,
    casePrompt: plan.prompt,
  });

  if (execution.status !== "completed" || !execution.output) {
    return { status: "incomplete", judgement: null, execution };
  }

  const judgement = parseVerificationJudgement(execution.output);
  return judgement
    ? { status: "completed", judgement, execution }
    : { status: "incomplete", judgement: null, execution };
};
