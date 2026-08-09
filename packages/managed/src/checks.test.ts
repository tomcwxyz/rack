import { describe, expect, it } from "vitest";
import { durableEvaluationSummarySchema } from "./contracts.js";
import { runQuickCheck, transientExpiry } from "./checks.js";

const baseRequest = {
  schemaVersion: "0.1" as const,
  rackFingerprint: `sha256:${"a".repeat(64)}`,
  profileId: "writing",
  target: "prompt" as const,
  instructions: "Write clearly and keep claims tied to evidence.",
};

describe("managed quick checks", () => {
  it("returns a content-free durable summary", () => {
    const summary = runQuickCheck(baseRequest, new Date("2026-08-09T05:00:00.000Z"));
    expect(summary.passed).toBe(true);
    expect(summary.score).toBe(100);
    expect(JSON.stringify(summary)).not.toContain(baseRequest.instructions);
    expect(() =>
      durableEvaluationSummarySchema.parse({
        ...summary,
        instructions: baseRequest.instructions,
      }),
    ).toThrow();
  });

  it("reports budgets, placeholders and likely credentials without storing excerpts", () => {
    const summary = runQuickCheck({
      ...baseRequest,
      instructions: `TODO ${"x".repeat(200)} sk-${"a".repeat(24)}`,
      budget: { recommendedTokens: 10, maximumTokens: 20 },
    });
    expect(summary.passed).toBe(false);
    expect(summary.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["budget-maximum", "placeholder-content", "possible-secret"]),
    );
    expect(summary.findings.every((finding) => !("snippet" in finding))).toBe(true);
  });

  it("caps transient retention at 24 hours", () => {
    const now = new Date("2026-08-09T05:00:00.000Z");
    expect(transientExpiry(now, 72).toISOString()).toBe("2026-08-10T05:00:00.000Z");
    expect(transientExpiry(now, 1).toISOString()).toBe("2026-08-09T06:00:00.000Z");
  });
});
