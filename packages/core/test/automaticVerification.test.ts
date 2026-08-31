import { describe, expect, it } from "vitest";
import {
  executeAutomaticVerification,
  getAutomaticVerifier,
  listAutomaticVerifiers,
  resolveAutomaticVerificationGate,
  type VerificationPlanStep,
} from "../src/index.js";

const automaticStep = (
  check: string,
  evidence: VerificationPlanStep["evidence"] = ["diff"],
  onFail: VerificationPlanStep["onFail"] = "block",
): VerificationPlanStep => ({
  id: `guardrail.safe:${check}`,
  sourceStepId: check,
  moduleId: "guardrail.safe",
  moduleTitle: "Safe changes",
  modulePath: "modules/guardrails/safe.md",
  criticality: "required",
  kind: "automatic",
  label: "Run automatic check",
  evidence,
  onFail,
  onUncertain: null,
  check,
  requirement: "Run the trusted Rack-owned check.",
  question: null,
  prompt: null,
  requiredForCompletion: onFail !== "warn",
});

describe("automatic verification registry", () => {
  it("exposes only Rack-owned verifier definitions", () => {
    expect(listAutomaticVerifiers().map((item) => item.id)).toEqual([
      "no-obvious-secrets",
      "no-placeholder-content",
    ]);
    expect(getAutomaticVerifier("repository-checks")).toBeNull();
    expect(getAutomaticVerifier("no-obvious-secrets")).toEqual(
      expect.objectContaining({
        label: "No obvious secrets",
        supportedEvidence: expect.arrayContaining(["diff", "output"]),
      }),
    );
  });

  it("passes high-confidence secret scanning when no configured pattern is present", () => {
    const step = automaticStep("no-obvious-secrets");
    const result = executeAutomaticVerification(step, [
      {
        kind: "diff",
        content:
          "+ const token = process.env.OPENAI_API_KEY;\n+ return client(token);",
      },
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        verifierId: "no-obvious-secrets",
        status: "pass",
        findings: [],
        checkedEvidence: ["diff"],
      }),
    );
    expect(resolveAutomaticVerificationGate(step, result)).toBe("continue");
  });

  it("blocks credential-shaped material without echoing the suspected secret", () => {
    const step = automaticStep("no-obvious-secrets");
    const secret = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const result = executeAutomaticVerification(step, [
      { kind: "diff", content: `+ const token = "${secret}";` },
    ]);

    expect(result.status).toBe("fail");
    expect(result.findings).toContainEqual({
      code: "github-token",
      title: "A GitHub access token is present",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(resolveAutomaticVerificationGate(step, result)).toBe("block");
  });

  it("keeps missing evidence and unknown verifier IDs incomplete", () => {
    const missingStep = automaticStep("no-obvious-secrets", [
      "diff",
      "test-results",
    ]);
    const missing = executeAutomaticVerification(missingStep, [
      { kind: "diff", content: "No secret material." },
    ]);
    expect(missing.status).toBe("incomplete");
    expect(missing.reason).toContain("test-results");
    expect(resolveAutomaticVerificationGate(missingStep, missing)).toBe(
      "incomplete",
    );

    const unknown = executeAutomaticVerification(
      automaticStep("shared-script-from-somewhere"),
      [{ kind: "diff", content: "Anything" }],
    );
    expect(unknown.status).toBe("incomplete");
    expect(unknown.reason).toContain("trusted local executor");
  });

  it("detects obvious unfinished-work markers through a separate built-in", () => {
    const step = automaticStep("no-placeholder-content", ["output"], "warn");
    const result = executeAutomaticVerification(step, [
      { kind: "output", content: "Final answer. TODO: replace this paragraph." },
    ]);

    expect(result.status).toBe("fail");
    expect(result.findings).toContainEqual({
      code: "todo-marker",
      title: "A TODO or FIXME marker remains",
    });
    expect(resolveAutomaticVerificationGate(step, result)).toBe("warn");
  });
});
