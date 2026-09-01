import { describe, expect, it } from "vitest";
import {
  getTrustedVerifier,
  resolveAutomaticVerifiers,
  type VerificationPlan,
} from "../src/index.js";

describe("trusted verifier registry", () => {
  it("registers repository checks without allowing shared executable code", () => {
    const verifier = getTrustedVerifier("repository-checks");
    expect(verifier).toEqual(
      expect.objectContaining({
        implementation: "available",
        execution: "local",
        sharedExecutableCodeAllowed: false,
      }),
    );
    expect(verifier?.evidence).toEqual(["test-results", "build-results"]);
  });

  it("fails closed at the registry boundary for unknown automatic checks", () => {
    const plan: VerificationPlan = {
      profileId: "coding",
      profileTitle: "Coding",
      steps: [
        {
          id: "guardrail.verify:known",
          sourceStepId: "known",
          moduleId: "guardrail.verify",
          moduleTitle: "Verify",
          modulePath: "modules/verify.md",
          criticality: "required",
          kind: "automatic",
          label: "Known",
          evidence: ["test-results"],
          onFail: "block",
          onUncertain: null,
          check: "repository-checks",
          requirement: "Checks pass.",
          question: null,
          prompt: null,
          requiredForCompletion: true,
        },
        {
          id: "guardrail.verify:unknown",
          sourceStepId: "unknown",
          moduleId: "guardrail.verify",
          moduleTitle: "Verify",
          modulePath: "modules/verify.md",
          criticality: "required",
          kind: "automatic",
          label: "Unknown",
          evidence: [],
          onFail: "block",
          onUncertain: null,
          check: "arbitrary-script",
          requirement: "Something happens.",
          question: null,
          prompt: null,
          requiredForCompletion: true,
        },
      ],
      taskSuites: [],
      unconfigured: [],
      diagnostics: [],
      blocked: false,
      counts: {
        automatic: 2,
        judgement: 0,
        human: 0,
        taskSuites: 0,
        unconfigured: 0,
      },
    };

    expect(resolveAutomaticVerifiers(plan)).toEqual([
      expect.objectContaining({ check: "repository-checks", status: "available" }),
      expect.objectContaining({
        check: "arbitrary-script",
        status: "unregistered",
        verifier: null,
      }),
    ]);
  });
});
