import type {
  VerificationGateDecision,
  VerificationPlan,
  VerificationPlanStep,
  VerificationJudgementVerdict,
} from "./verificationPlan.js";

export type VerificationStepOutcome =
  | "pass"
  | "fail"
  | "uncertain"
  | "incomplete";

export type VerificationStepResult = {
  stepId: string;
  outcome: VerificationStepOutcome;
};

export type VerificationCompletionStatus =
  | "pass"
  | "fail"
  | "review-required"
  | "uncertain"
  | "incomplete";

export type VerificationCompletionStep = {
  stepId: string;
  label: string;
  kind: VerificationPlanStep["kind"];
  requiredForCompletion: boolean;
  outcome: VerificationStepOutcome | "missing";
  decision: VerificationCompletionStatus | "not-required";
};

export type VerificationCompletionGate = {
  status: VerificationCompletionStatus;
  steps: VerificationCompletionStep[];
  warnings: string[];
};

const decisionFromFailureAction = (
  decision: Exclude<VerificationGateDecision, "continue" | "incomplete">,
): VerificationCompletionStatus => {
  if (decision === "block") return "fail";
  if (decision === "human_review") return "review-required";
  return "pass";
};

const resolveStepDecision = (
  step: VerificationPlanStep,
  outcome: VerificationStepOutcome | "missing",
): { decision: VerificationCompletionStep["decision"]; warning?: string } => {
  if (outcome === "missing") {
    if (!step.requiredForCompletion) return { decision: "not-required" };
    if (step.kind === "human") return { decision: "review-required" };
    return { decision: "incomplete" };
  }

  if (outcome === "pass") return { decision: "pass" };

  if (step.kind === "human") {
    if (outcome === "fail") return { decision: "fail" };
    return step.requiredForCompletion
      ? { decision: "review-required" }
      : { decision: "not-required" };
  }

  if (outcome === "incomplete") {
    return step.requiredForCompletion
      ? { decision: "incomplete" }
      : { decision: "not-required" };
  }

  if (outcome === "uncertain") {
    if (step.kind !== "judgement" || !step.onUncertain) {
      return step.requiredForCompletion
        ? { decision: "uncertain" }
        : { decision: "not-required" };
    }
    const mapped = decisionFromFailureAction(step.onUncertain);
    if (mapped === "pass") {
      return {
        decision: "uncertain",
        warning: `${step.label} is uncertain but configured as a warning.`,
      };
    }
    return { decision: mapped };
  }

  if (!step.onFail) {
    return step.requiredForCompletion
      ? { decision: "fail" }
      : { decision: "not-required" };
  }

  const mapped = decisionFromFailureAction(step.onFail);
  if (mapped === "pass") {
    return {
      decision: "pass",
      warning: `${step.label} failed but is configured as a warning.`,
    };
  }
  return { decision: mapped };
};

const statusPriority: VerificationCompletionStatus[] = [
  "fail",
  "review-required",
  "uncertain",
  "incomplete",
  "pass",
];

export const resolveVerificationCompletionGate = (
  plan: VerificationPlan,
  results: readonly VerificationStepResult[],
): VerificationCompletionGate => {
  if (plan.blocked) {
    return {
      status: "incomplete",
      steps: [],
      warnings: ["The Verification Plan is blocked by Rack diagnostics."],
    };
  }

  const byStep = new Map(results.map((result) => [result.stepId, result]));
  const warnings: string[] = [];
  const steps = plan.steps.map((step): VerificationCompletionStep => {
    const outcome = byStep.get(step.id)?.outcome ?? "missing";
    const resolved = resolveStepDecision(step, outcome);
    if (resolved.warning) warnings.push(resolved.warning);
    return {
      stepId: step.id,
      label: step.label,
      kind: step.kind,
      requiredForCompletion: step.requiredForCompletion,
      outcome,
      decision: resolved.decision,
    };
  });

  const activeDecisions = steps
    .map((step) => step.decision)
    .filter(
      (decision): decision is VerificationCompletionStatus =>
        decision !== "not-required",
    );

  const status =
    statusPriority.find((candidate) => activeDecisions.includes(candidate)) ??
    "pass";

  return { status, steps, warnings };
};
