import { describe, expect, it } from "vitest";
import {
  resolveVerificationCompletionGate,
  type VerificationStepResult,
} from "./completionGate.js";
import type { VerificationPlan, VerificationPlanStep } from "./verificationPlan.js";

const step = (
  overrides: Partial<VerificationPlanStep> = {},
): VerificationPlanStep => ({
  id: "module:step",
  sourceStepId: "step",
  moduleId: "module",
  moduleTitle: "Module",
  modulePath: "modules/module.md",
  criticality: "required",
  kind: "automatic",
  label: "Check",
  evidence: [],
  onFail: "block",
  onUncertain: null,
  check: "repository-checks",
  requirement: "Checks pass",
  question: null,
  prompt: null,
  requiredForCompletion: true,
  ...overrides,
});

const plan = (steps: VerificationPlanStep[]): VerificationPlan => ({
  profileId: "coding",
  profileTitle: "Coding",
  steps,
  taskSuites: [],
  unconfigured: [],
  diagnostics: [],
  blocked: false,
  counts: {
    automatic: steps.filter((item) => item.kind === "automatic").length,
    judgement: steps.filter((item) => item.kind === "judgement").length,
    human: steps.filter((item) => item.kind === "human").length,
    taskSuites: 0,
    unconfigured: 0,
  },
});

describe("target-neutral verification completion gate", () => {
  it("does not pass when a required automatic result is missing", () => {
    expect(resolveVerificationCompletionGate(plan([step()]), []).status).toBe(
      "incomplete",
    );
  });

  it("fails when any blocking step fails", () => {
    const results: VerificationStepResult[] = [
      { stepId: "module:step", outcome: "fail" },
    ];
    expect(resolveVerificationCompletionGate(plan([step()]), results).status).toBe(
      "fail",
    );
  });

  it("requires review when a required human step has not been completed", () => {
    const human = step({
      id: "module:human",
      kind: "human",
      check: null,
      requirement: null,
      prompt: "Review the security consequence.",
      onFail: null,
      requiredForCompletion: true,
    });
    expect(resolveVerificationCompletionGate(plan([human]), []).status).toBe(
      "review-required",
    );
  });

  it("preserves uncertainty when judgement uncertainty is warning-only", () => {
    const judgement = step({
      id: "module:judge",
      kind: "judgement",
      check: null,
      requirement: null,
      question: "Is the change appropriately scoped?",
      onFail: "block",
      onUncertain: "warn",
      requiredForCompletion: true,
    });
    const gate = resolveVerificationCompletionGate(plan([judgement]), [
      { stepId: judgement.id, outcome: "uncertain" },
    ]);
    expect(gate.status).toBe("uncertain");
    expect(gate.warnings).toHaveLength(1);
  });

  it("allows a configured warning-only failure without turning it into a blocker", () => {
    const warning = step({
      id: "module:warning",
      onFail: "warn",
      requiredForCompletion: false,
    });
    const gate = resolveVerificationCompletionGate(plan([warning]), [
      { stepId: warning.id, outcome: "fail" },
    ]);
    expect(gate.status).toBe("pass");
    expect(gate.warnings).toHaveLength(1);
  });

  it("uses fail before review, uncertainty and incomplete", () => {
    const automatic = step({ id: "automatic" });
    const human = step({
      id: "human",
      kind: "human",
      check: null,
      requirement: null,
      prompt: "Review",
      onFail: null,
      requiredForCompletion: true,
    });
    const judgement = step({
      id: "judge",
      kind: "judgement",
      check: null,
      requirement: null,
      question: "Question",
      onFail: "block",
      onUncertain: "warn",
    });
    const gate = resolveVerificationCompletionGate(
      plan([automatic, human, judgement]),
      [
        { stepId: automatic.id, outcome: "fail" },
        { stepId: judgement.id, outcome: "uncertain" },
      ],
    );
    expect(gate.status).toBe("fail");
  });
});
