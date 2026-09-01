import type { VerificationEvidence } from "@rack/schemas";
import type { VerificationPlan } from "./verificationPlan.js";

export type TrustedVerifierDefinition = {
  id: string;
  label: string;
  description: string;
  evidence: VerificationEvidence[];
  execution: "local";
  implementation: "planned" | "available";
  sharedExecutableCodeAllowed: false;
};

const verifierDefinitions: readonly TrustedVerifierDefinition[] = [
  {
    id: "repository-checks",
    label: "Repository checks",
    description:
      "Run a Rack-owned repository verification path for trusted tests, type checks and builds without executing code supplied by Starter or shared practice.",
    evidence: ["test-results", "build-results"],
    execution: "local",
    implementation: "available",
    sharedExecutableCodeAllowed: false,
  },
] as const;

export const listTrustedVerifiers = (): TrustedVerifierDefinition[] =>
  verifierDefinitions.map((item) => ({ ...item, evidence: [...item.evidence] }));

export const getTrustedVerifier = (
  id: string,
): TrustedVerifierDefinition | null => {
  const definition = verifierDefinitions.find((item) => item.id === id);
  return definition ? { ...definition, evidence: [...definition.evidence] } : null;
};

export type AutomaticVerifierResolution = {
  stepId: string;
  check: string;
  status: "available" | "planned" | "unregistered";
  verifier: TrustedVerifierDefinition | null;
};

export const resolveAutomaticVerifiers = (
  plan: VerificationPlan,
): AutomaticVerifierResolution[] =>
  plan.steps
    .filter((step) => step.kind === "automatic" && step.check)
    .map((step) => {
      const verifier = getTrustedVerifier(step.check!);
      return {
        stepId: step.id,
        check: step.check!,
        status: verifier?.implementation ?? "unregistered",
        verifier,
      };
    });
