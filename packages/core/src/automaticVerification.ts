import type { VerificationEvidence } from "@rack/schemas";
import type {
  VerificationGateDecision,
  VerificationPlanStep,
} from "./verificationPlan.js";

export type AutomaticVerificationEvidence = {
  kind: VerificationEvidence;
  content: string;
};

export type AutomaticVerificationFinding = {
  code: string;
  title: string;
};

export type AutomaticVerificationResult = {
  verifierId: string;
  status: "pass" | "fail" | "incomplete";
  reason: string;
  findings: AutomaticVerificationFinding[];
  checkedEvidence: VerificationEvidence[];
};

export type AutomaticVerifierDefinition = {
  id: string;
  label: string;
  description: string;
  supportedEvidence: VerificationEvidence[];
};

type AutomaticVerifier = AutomaticVerifierDefinition & {
  run: (
    evidence: AutomaticVerificationEvidence[],
  ) => Omit<AutomaticVerificationResult, "verifierId" | "checkedEvidence">;
};

type FindingPattern = {
  code: string;
  title: string;
  pattern: RegExp;
};

const secretPatterns: FindingPattern[] = [
  {
    code: "private-key",
    title: "Private key material is present",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
  },
  {
    code: "openai-key",
    title: "An OpenAI-style secret key is present",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    code: "anthropic-key",
    title: "An Anthropic-style secret key is present",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    code: "aws-access-key",
    title: "An AWS access key identifier is present",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    code: "github-token",
    title: "A GitHub access token is present",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  },
  {
    code: "slack-token",
    title: "A Slack token is present",
    pattern: /\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]{20,}\b/,
  },
];

const placeholderPatterns: FindingPattern[] = [
  {
    code: "todo-marker",
    title: "A TODO or FIXME marker remains",
    pattern: /\b(?:TODO|FIXME)\b/,
  },
  {
    code: "tbd-marker",
    title: "A TBD marker remains",
    pattern: /\bTBD\b/,
  },
  {
    code: "lorem-ipsum",
    title: "Lorem ipsum placeholder text remains",
    pattern: /\blorem ipsum\b/i,
  },
];

const scanPatterns = (
  evidence: AutomaticVerificationEvidence[],
  patterns: FindingPattern[],
): AutomaticVerificationFinding[] => {
  const findings: AutomaticVerificationFinding[] = [];
  for (const definition of patterns) {
    if (
      evidence.some((item) => {
        definition.pattern.lastIndex = 0;
        return definition.pattern.test(item.content);
      })
    ) {
      findings.push({
        code: definition.code,
        title: definition.title,
      });
    }
  }
  return findings;
};

const textEvidence: VerificationEvidence[] = [
  "output",
  "diff",
  "test-results",
  "build-results",
  "task-input",
  "source",
];

const noObviousSecrets: AutomaticVerifier = {
  id: "no-obvious-secrets",
  label: "No obvious secrets",
  description:
    "Checks supplied text for a small set of high-confidence private-key and access-token patterns.",
  supportedEvidence: textEvidence,
  run(evidence) {
    const findings = scanPatterns(evidence, secretPatterns);
    return findings.length > 0
      ? {
          status: "fail",
          reason:
            "Rack found credential-shaped material in the supplied evidence. It reports only the finding type, not the suspected secret.",
          findings,
        }
      : {
          status: "pass",
          reason:
            "Rack did not find any of its high-confidence private-key or access-token patterns in the supplied evidence.",
          findings: [],
        };
  },
};

const noPlaceholderContent: AutomaticVerifier = {
  id: "no-placeholder-content",
  label: "No obvious placeholder content",
  description:
    "Checks supplied text for a small set of unfinished-work markers such as TODO, FIXME, TBD and lorem ipsum.",
  supportedEvidence: textEvidence,
  run(evidence) {
    const findings = scanPatterns(evidence, placeholderPatterns);
    return findings.length > 0
      ? {
          status: "fail",
          reason:
            "Rack found one or more obvious unfinished-work markers in the supplied evidence.",
          findings,
        }
      : {
          status: "pass",
          reason:
            "Rack did not find any of its configured unfinished-work markers in the supplied evidence.",
          findings: [],
        };
  },
};

const registry = new Map<string, AutomaticVerifier>([
  [noObviousSecrets.id, noObviousSecrets],
  [noPlaceholderContent.id, noPlaceholderContent],
]);

export const listAutomaticVerifiers = (): AutomaticVerifierDefinition[] =>
  [...registry.values()].map(
    ({ id, label, description, supportedEvidence }) => ({
      id,
      label,
      description,
      supportedEvidence: [...supportedEvidence],
    }),
  );

export const getAutomaticVerifier = (
  id: string,
): AutomaticVerifierDefinition | null => {
  const verifier = registry.get(id);
  if (!verifier) return null;
  return {
    id: verifier.id,
    label: verifier.label,
    description: verifier.description,
    supportedEvidence: [...verifier.supportedEvidence],
  };
};

export const executeAutomaticVerification = (
  step: VerificationPlanStep,
  evidence: AutomaticVerificationEvidence[],
): AutomaticVerificationResult => {
  if (step.kind !== "automatic" || !step.check) {
    return {
      verifierId: step.check ?? "unknown",
      status: "incomplete",
      reason:
        "This Verification Plan step is not a configured automatic check.",
      findings: [],
      checkedEvidence: [],
    };
  }

  const verifier = registry.get(step.check);
  if (!verifier) {
    return {
      verifierId: step.check,
      status: "incomplete",
      reason: `Rack does not have a trusted local executor registered for ${step.check}.`,
      findings: [],
      checkedEvidence: [],
    };
  }

  const byKind = new Map<VerificationEvidence, AutomaticVerificationEvidence>();
  for (const item of evidence) {
    if (!byKind.has(item.kind) && item.content.trim()) {
      byKind.set(item.kind, { ...item, content: item.content.trim() });
    }
  }

  const missing = step.evidence.filter((kind) => !byKind.has(kind));
  if (missing.length > 0) {
    return {
      verifierId: verifier.id,
      status: "incomplete",
      reason: `This check still needs: ${missing.join(", ")}.`,
      findings: [],
      checkedEvidence: [],
    };
  }

  const unsupported = step.evidence.filter(
    (kind) => !verifier.supportedEvidence.includes(kind),
  );
  if (unsupported.length > 0) {
    return {
      verifierId: verifier.id,
      status: "incomplete",
      reason: `${verifier.label} cannot inspect: ${unsupported.join(", ")}.`,
      findings: [],
      checkedEvidence: [],
    };
  }

  const selected = step.evidence.map((kind) => byKind.get(kind)!);
  const result = verifier.run(selected);
  return {
    verifierId: verifier.id,
    ...result,
    checkedEvidence: selected.map((item) => item.kind),
  };
};

export const resolveAutomaticVerificationGate = (
  step: VerificationPlanStep,
  result: AutomaticVerificationResult,
): VerificationGateDecision => {
  if (step.kind !== "automatic") {
    throw new Error("Only automatic verification steps produce an automatic gate.");
  }
  if (result.status === "incomplete") return "incomplete";
  if (result.status === "pass") return "continue";
  return step.onFail ?? "block";
};
