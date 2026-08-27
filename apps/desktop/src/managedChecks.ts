import {
  RELIABLE_BASELINE_INSTRUCTIONS,
  type EvaluationConfirmResponse,
  type EvaluationPreflightRequest,
} from "@rack/managed";

const encoder = new TextEncoder();

export const conservativeUtf8Allowance = (...parts: string[]): number =>
  encoder.encode(parts.join("\n\n")).byteLength;

const judgePromptAllowance = (rubric: string, casePrompt: string): number =>
  Math.max(2_048, conservativeUtf8Allowance(rubric, casePrompt) + 1_200);

export const buildQuickPreflightRequest = (input: {
  rackFingerprint: string;
  profileId: string;
  generatorAlias: string;
  instructions: string;
  casePrompt: string;
  rubric: string;
}): EvaluationPreflightRequest => ({
  schemaVersion: "0.1",
  mode: "quick",
  rackFingerprint: input.rackFingerprint,
  profileId: input.profileId,
  target: "prompt",
  generatorAlias: input.generatorAlias,
  caseCount: 1,
  judgeCallsPerOutput: 1,
  candidateInputTokensPerCase: conservativeUtf8Allowance(
    input.instructions,
    input.casePrompt,
  ),
  generatorOutputTokensPerCall: 1_000,
  judgePromptTokensPerCase: judgePromptAllowance(input.rubric, input.casePrompt),
  judgeOutputTokensPerCall: 400,
});

export const buildReliablePreflightRequest = (input: {
  rackFingerprint: string;
  profileId: string;
  generatorAlias: string;
  judgeAlias: string;
  instructions: string;
  casePrompt: string;
  rubric: string;
}): EvaluationPreflightRequest => ({
  schemaVersion: "0.1",
  mode: "reliable",
  rackFingerprint: input.rackFingerprint,
  profileId: input.profileId,
  target: "prompt",
  generatorAlias: input.generatorAlias,
  judgeAlias: input.judgeAlias,
  caseCount: 1,
  judgeCallsPerOutput: 1,
  candidateInputTokensPerCase: conservativeUtf8Allowance(
    input.instructions,
    input.casePrompt,
  ),
  baselineInputTokensPerCase: conservativeUtf8Allowance(
    RELIABLE_BASELINE_INSTRUCTIONS,
    input.casePrompt,
  ),
  generatorOutputTokensPerCall: 1_000,
  judgePromptTokensPerCase: judgePromptAllowance(input.rubric, input.casePrompt),
  judgeOutputTokensPerCall: 400,
});

export const formatMicrousd = (value: number): string => {
  const dollars = value / 1_000_000;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars < 0.01 ? 4 : 2,
    maximumFractionDigits: dollars < 0.01 ? 4 : 2,
  }).format(dollars);
};

export const settledCostMicrousd = (result: EvaluationConfirmResponse): number =>
  result.providerCall.costMicrousd + (result.judgeCall?.costMicrousd ?? 0);
