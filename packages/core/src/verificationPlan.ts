import type {
  EnforcementMode,
  RackModule,
  VerificationEvidence,
  VerificationFailureAction,
} from "@rack/schemas";
import { resolveProfile } from "./compiler.js";
import type { Diagnostic, RackProject } from "./index.js";

export type VerificationPlanStepKind = "automatic" | "judgement" | "human";

export type VerificationPlanStep = {
  id: string;
  sourceStepId: string;
  moduleId: string;
  moduleTitle: string;
  modulePath: string;
  criticality: RackModule["harness"]["criticality"];
  kind: VerificationPlanStepKind;
  label: string;
  evidence: VerificationEvidence[];
  onFail: VerificationFailureAction | null;
  onUncertain: VerificationFailureAction | null;
  check: string | null;
  requirement: string | null;
  question: string | null;
  prompt: string | null;
  requiredForCompletion: boolean;
};

export type VerificationTaskSuite = {
  moduleId: string;
  moduleTitle: string;
  suiteId: string;
  requiredForVerification: boolean;
};

export type UnconfiguredVerification = {
  moduleId: string;
  moduleTitle: string;
  mode: Extract<EnforcementMode, "output_check" | "rubric_eval" | "human_review">;
};

export type VerificationPlan = {
  profileId: string;
  profileTitle: string | null;
  steps: VerificationPlanStep[];
  taskSuites: VerificationTaskSuite[];
  unconfigured: UnconfiguredVerification[];
  diagnostics: Diagnostic[];
  blocked: boolean;
  counts: {
    automatic: number;
    judgement: number;
    human: number;
    taskSuites: number;
    unconfigured: number;
  };
};

const verificationModes: Array<{
  mode: UnconfiguredVerification["mode"];
  kind: VerificationPlanStepKind;
  label: string;
}> = [
  { mode: "output_check", kind: "automatic", label: "automatic check" },
  { mode: "rubric_eval", kind: "judgement", label: "AI judgement" },
  { mode: "human_review", kind: "human", label: "human review" },
];

const planStep = (
  module: RackModule,
  step: NonNullable<RackModule["harness"]["verification"]>[number],
): VerificationPlanStep => {
  const common = {
    id: `${module.harness.id}:${step.id}`,
    sourceStepId: step.id,
    moduleId: module.harness.id,
    moduleTitle: module.title,
    modulePath: module.path,
    criticality: module.harness.criticality,
    kind: step.kind,
    label: step.label,
    evidence: [...step.evidence],
  };

  if (step.kind === "automatic") {
    return {
      ...common,
      onFail: step.on_fail,
      onUncertain: null,
      check: step.check,
      requirement: step.requirement,
      question: null,
      prompt: null,
      requiredForCompletion: step.on_fail !== "warn",
    };
  }

  if (step.kind === "judgement") {
    return {
      ...common,
      onFail: step.on_fail,
      onUncertain: step.on_uncertain,
      check: null,
      requirement: null,
      question: step.question,
      prompt: null,
      requiredForCompletion:
        step.on_fail !== "warn" || step.on_uncertain !== "warn",
    };
  }

  return {
    ...common,
    onFail: null,
    onUncertain: null,
    check: null,
    requirement: null,
    question: null,
    prompt: step.prompt,
    requiredForCompletion: step.required_for_completion,
  };
};

export const buildVerificationPlan = (
  project: RackProject,
  profileId: string,
): VerificationPlan => {
  const resolution = resolveProfile(project, profileId);
  const diagnostics = [...resolution.diagnostics];

  if (!resolution.compiled) {
    return {
      profileId,
      profileTitle:
        project.profiles.find((profile) => profile.id === profileId)?.title ?? null,
      steps: [],
      taskSuites: [],
      unconfigured: [],
      diagnostics,
      blocked: true,
      counts: {
        automatic: 0,
        judgement: 0,
        human: 0,
        taskSuites: 0,
        unconfigured: 0,
      },
    };
  }

  const steps = resolution.compiled.modules.flatMap((module) =>
    (module.harness.verification ?? []).map((step) => planStep(module, step)),
  );

  const unconfigured: UnconfiguredVerification[] = [];

  for (const module of resolution.compiled.modules) {
    for (const expected of verificationModes) {
      if (!module.harness.enforcement.includes(expected.mode)) continue;
      if ((module.harness.verification ?? []).some((step) => step.kind === expected.kind)) {
        continue;
      }

      unconfigured.push({
        moduleId: module.harness.id,
        moduleTitle: module.title,
        mode: expected.mode,
      });
      diagnostics.push({
        code: "RACK-VERIFY-001",
        severity: "warning",
        title: "Verification is declared but not configured",
        message: `${module.title} requests an ${expected.label}, but does not yet define how Rack should perform it. The instruction still applies; Rack cannot include this declaration as a concrete verification step until it is configured.`,
        filePaths: [module.path],
        moduleIds: [module.harness.id],
      });
    }
  }

  const taskSuites = resolution.compiled.modules
    .filter(
      (
        module,
      ): module is Extract<RackModule, { type: "task" }> =>
        module.type === "task" && module.harness.acceptance !== undefined,
    )
    .flatMap((module) =>
      (module.harness.acceptance?.suites ?? []).map((suiteId) => ({
        moduleId: module.harness.id,
        moduleTitle: module.title,
        suiteId,
        requiredForVerification:
          module.harness.acceptance?.required_for_verification ?? true,
      })),
    );

  return {
    profileId,
    profileTitle: resolution.compiled.profile.title,
    steps,
    taskSuites,
    unconfigured,
    diagnostics,
    blocked: diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    counts: {
      automatic: steps.filter((step) => step.kind === "automatic").length,
      judgement: steps.filter((step) => step.kind === "judgement").length,
      human: steps.filter((step) => step.kind === "human").length,
      taskSuites: taskSuites.length,
      unconfigured: unconfigured.length,
    },
  };
};

export const verificationApplicationLabels = (
  module: RackModule,
): string[] => {
  const labels: Partial<Record<EnforcementMode, string>> = {
    instruction: "AI guidance",
    output_check: "automatic check",
    rubric_eval: "AI judgement",
    adversarial_eval: "stress test",
    host_policy: "host rule",
    human_review: "human review",
  };

  return module.harness.enforcement
    .map((mode) => labels[mode])
    .filter((label): label is string => Boolean(label));
};
