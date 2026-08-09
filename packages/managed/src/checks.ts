import {
  durableEvaluationSummarySchema,
  MAX_TRANSIENT_RETENTION_HOURS,
  type DurableEvaluationSummary,
  type QuickCheckFinding,
  type QuickCheckRequest,
} from "./contracts.js";

const placeholderPattern = /\b(?:TODO|TBD|FIXME)\b|\[(?:insert|add|replace)[^\]]{0,80}\]/i;
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export const estimateTokens = (value: string): number =>
  value.length === 0 ? 0 : Math.ceil(value.length / 4);

export const containsPossibleSecret = (value: string): boolean =>
  secretPatterns.some((pattern) => pattern.test(value));

export const transientExpiry = (
  now: Date,
  retentionHours = MAX_TRANSIENT_RETENTION_HOURS,
): Date => {
  if (!Number.isFinite(retentionHours) || retentionHours <= 0) {
    throw new Error("Transient retention must be a positive number of hours.");
  }
  const boundedHours = Math.min(retentionHours, MAX_TRANSIENT_RETENTION_HOURS);
  return new Date(now.getTime() + boundedHours * 60 * 60 * 1000);
};

export const runQuickCheck = (
  request: QuickCheckRequest,
  now = new Date(),
): DurableEvaluationSummary => {
  const findings: QuickCheckFinding[] = [];
  const estimatedInstructionTokens = estimateTokens(request.instructions);

  if (request.budget) {
    if (estimatedInstructionTokens > request.budget.maximumTokens) {
      findings.push({
        code: "budget-maximum",
        severity: "error",
        title: "Instructions exceed the maximum token budget",
      });
    } else if (estimatedInstructionTokens > request.budget.recommendedTokens) {
      findings.push({
        code: "budget-recommended",
        severity: "warning",
        title: "Instructions exceed the recommended token budget",
      });
    }
  }

  if (placeholderPattern.test(request.instructions)) {
    findings.push({
      code: "placeholder-content",
      severity: "warning",
      title: "Instructions appear to contain unfinished placeholder content",
    });
  }

  if (containsPossibleSecret(request.instructions)) {
    findings.push({
      code: "possible-secret",
      severity: "error",
      title: "Instructions may contain a credential or private key",
    });
  }

  if (request.sampleOutput && containsPossibleSecret(request.sampleOutput)) {
    findings.push({
      code: "sample-possible-secret",
      severity: "error",
      title: "Sample output may contain a credential or private key",
    });
  }

  const counts = findings.reduce(
    (current, finding) => {
      if (finding.severity === "error") current.errors += 1;
      else if (finding.severity === "warning") current.warnings += 1;
      else current.information += 1;
      return current;
    },
    { errors: 0, warnings: 0, information: 0 },
  );
  const score = Math.max(0, 100 - counts.errors * 30 - counts.warnings * 10);

  return durableEvaluationSummarySchema.parse({
    schemaVersion: "0.1",
    rackFingerprint: request.rackFingerprint,
    profileId: request.profileId,
    target: request.target,
    passed: counts.errors === 0,
    score,
    estimatedInstructionTokens,
    counts,
    findings,
    checkedAt: now.toISOString(),
  });
};
