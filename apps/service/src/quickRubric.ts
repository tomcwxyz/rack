import {
  quickRubricJudgementSchema,
  type QuickRubricJudgement,
} from "@rack/managed";

export const QUICK_RUBRIC_JUDGE_SYSTEM = [
  "You are a strict evaluator of one AI response.",
  "Apply only the supplied rubric and task.",
  "Return JSON only with keys verdict, score, reason and evidence.",
  'verdict must be "pass" or "fail"; score must be an integer from 0 to 100.',
  "Evidence must be a JSON array of at most five short strings grounded in the candidate response.",
].join(" ");

const rubricPromptParts = (input: {
  rubric: string;
  casePrompt: string;
  candidateOutput: string;
}) => [
  "Rubric:",
  input.rubric,
  "",
  "Task:",
  input.casePrompt,
  "",
  "Candidate response:",
  input.candidateOutput,
  "",
  "Return only the required JSON object.",
];

export const buildQuickRubricPrompt = (input: {
  rubric: string;
  casePrompt: string;
  candidateOutput: string;
}): string => rubricPromptParts(input).join("\n");

export const conservativeQuickRubricPromptAllowance = (input: {
  rubric: string;
  casePrompt: string;
}): number =>
  new TextEncoder().encode(
    `${QUICK_RUBRIC_JUDGE_SYSTEM}\n\n${buildQuickRubricPrompt({
      ...input,
      candidateOutput: "",
    })}`,
  ).length;

const unwrapCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
};

export const parseQuickRubricJudgement = (
  value: string,
): QuickRubricJudgement | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapCodeFence(value));
  } catch {
    return null;
  }
  const result = quickRubricJudgementSchema.safeParse(parsed);
  return result.success ? result.data : null;
};
