import { describe, expect, it } from "vitest";
import {
  buildVerificationPlan,
  parseProjectSnapshot,
  verificationApplicationLabels,
  resolveVerificationJudgementGate,
} from "../src/index.js";

const manifest = {
  path: "rack.yaml",
  content: `
schema_version: "0.1"
name: verification
version: 0.1.0
title: Verification
author: { name: Example Author }
default_profile: coding
profiles: [coding]
`,
};

const profile = {
  path: "profiles/coding.yaml",
  content: `
schema_version: "0.1"
id: coding
title: Coding
domains: [code]
include: [guardrail.change-safety, task.change]
`,
};

describe("verification plans", () => {
  it("compiles automatic, judgement and human checks without executing them", () => {
    const project = parseProjectSnapshot({
      root: "/verification",
      manifest,
      modules: [
        {
          path: "modules/guardrails/change-safety.md",
          content: `---
type: guardrail
title: Safe changes
harness:
  schema_version: "0.2"
  id: guardrail.change-safety
  version: 0.2.0
  applies_to: [code]
  criticality: required
  enforcement: [instruction, output_check, rubric_eval, human_review]
  verification:
    - id: repository-checks
      kind: automatic
      label: Repository checks pass
      check: repository-checks
      requirement: Run the repository's trusted verification command successfully.
      evidence: [test-results, build-results]
      on_fail: block
    - id: meaningful-tests
      kind: judgement
      label: Tests cover the change
      question: Do the tests meaningfully exercise the behaviour introduced by this change?
      evidence: [diff, test-results]
      on_fail: block
      on_uncertain: human_review
    - id: consequential-change
      kind: human
      label: Consequential changes are approved
      prompt: Review any compatibility or security consequence before completion.
      evidence: [diff]
      required_for_completion: true
  rules:
    - id: verify
      statement: Verify consequential changes before completion.
---
Use checks, bounded judgement and human review for different kinds of evidence.
`,
        },
        {
          path: "modules/tasks/change.md",
          content: `---
type: task
title: Make a change
harness:
  schema_version: "0.1"
  id: task.change
  version: 0.1.0
  applies_to: [code]
  trigger:
    command: change
    label: Make a change
  acceptance:
    suites: [change-regression]
    required_for_verification: true
---
Make the smallest coherent change.
`,
        },
      ],
      profiles: [profile],
    });

    expect(project.diagnostics).toEqual([]);

    const plan = buildVerificationPlan(project, "coding");

    expect(plan.blocked).toBe(false);
    expect(plan.counts).toEqual({
      automatic: 1,
      judgement: 1,
      human: 1,
      taskSuites: 1,
      unconfigured: 0,
    });
    expect(plan.steps).toEqual([
      expect.objectContaining({
        id: "guardrail.change-safety:repository-checks",
        kind: "automatic",
        check: "repository-checks",
        requiredForCompletion: true,
      }),
      expect.objectContaining({
        id: "guardrail.change-safety:meaningful-tests",
        kind: "judgement",
        question:
          "Do the tests meaningfully exercise the behaviour introduced by this change?",
        onUncertain: "human_review",
      }),
      expect.objectContaining({
        id: "guardrail.change-safety:consequential-change",
        kind: "human",
        requiredForCompletion: true,
      }),
    ]);
    expect(plan.taskSuites).toEqual([
      {
        moduleId: "task.change",
        moduleTitle: "Make a change",
        suiteId: "change-regression",
        requiredForVerification: true,
      },
    ]);
    expect(verificationApplicationLabels(project.modules[0]!)).toEqual([
      "AI guidance",
      "automatic check",
      "AI judgement",
      "human review",
    ]);
  });

  it("keeps legacy enforcement usable but makes missing verification visible", () => {
    const project = parseProjectSnapshot({
      root: "/legacy-verification",
      manifest,
      modules: [
        {
          path: "modules/guardrails/legacy.md",
          content: `---
type: guardrail
title: Legacy evidence boundary
harness:
  schema_version: "0.1"
  id: guardrail.change-safety
  version: 0.1.0
  applies_to: [code]
  enforcement: [instruction, output_check]
  rules:
    - id: evidence
      statement: Check the output before completion.
---
This existing Rack predates structured verification.
`,
        },
        {
          path: "modules/tasks/change.md",
          content: `---
type: task
title: Make a change
harness:
  schema_version: "0.1"
  id: task.change
  version: 0.1.0
  applies_to: [code]
  trigger:
    label: Make a change
---
Make the change.
`,
        },
      ],
      profiles: [profile],
    });

    expect(project.diagnostics).toEqual([]);

    const plan = buildVerificationPlan(project, "coding");

    expect(plan.blocked).toBe(false);
    expect(plan.steps).toEqual([]);
    expect(plan.unconfigured).toEqual([
      {
        moduleId: "guardrail.change-safety",
        moduleTitle: "Legacy evidence boundary",
        mode: "output_check",
      },
    ]);
    expect(plan.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-VERIFY-001",
        severity: "warning",
      }),
    );
  });

  it("rejects structured verification on schema 0.1", () => {
    const project = parseProjectSnapshot({
      root: "/invalid-verification",
      manifest,
      modules: [
        {
          path: "modules/guardrails/invalid.md",
          content: `---
type: guardrail
title: Invalid verification
harness:
  schema_version: "0.1"
  id: guardrail.change-safety
  version: 0.1.0
  applies_to: [code]
  enforcement: [instruction, rubric_eval]
  verification:
    - id: semantic-check
      kind: judgement
      label: Check meaning
      question: Does this satisfy the intended practice?
      evidence: [output]
  rules: []
---
Invalid because structured verification is a 0.2 feature.
`,
        },
        {
          path: "modules/tasks/change.md",
          content: `---
type: task
title: Make a change
harness:
  schema_version: "0.1"
  id: task.change
  version: 0.1.0
  applies_to: [code]
  trigger:
    label: Make a change
---
Make the change.
`,
        },
      ],
      profiles: [profile],
    });

    expect(project.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-SCHEMA-002",
        severity: "error",
        message: expect.stringContaining(
          "verification requires module schema_version 0.2",
        ),
      }),
    );
  });

  it("requires each structured check to declare its enforcement mode", () => {
    const project = parseProjectSnapshot({
      root: "/mismatched-verification",
      manifest,
      modules: [
        {
          path: "modules/guardrails/mismatch.md",
          content: `---
type: guardrail
title: Mismatched verification
harness:
  schema_version: "0.2"
  id: guardrail.change-safety
  version: 0.2.0
  applies_to: [code]
  enforcement: [instruction]
  verification:
    - id: semantic-check
      kind: judgement
      label: Check meaning
      question: Does this satisfy the intended practice?
      evidence: [output]
  rules: []
---
Invalid because rubric evaluation was not declared.
`,
        },
        {
          path: "modules/tasks/change.md",
          content: `---
type: task
title: Make a change
harness:
  schema_version: "0.1"
  id: task.change
  version: 0.1.0
  applies_to: [code]
  trigger:
    label: Make a change
---
Make the change.
`,
        },
      ],
      profiles: [profile],
    });

    expect(project.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-SCHEMA-002",
        severity: "error",
        message: expect.stringContaining(
          "judgement verification requires enforcement to include rubric_eval",
        ),
      }),
    );
  });
  it("maps semantic verdicts onto the configured gate without treating uncertainty as pass", () => {
    const project = parseProjectSnapshot({
      root: "/gate-decision",
      manifest,
      modules: [
        {
          path: "modules/guardrails/gate.md",
          content: `---
type: guardrail
title: Semantic gate
harness:
  schema_version: "0.2"
  id: guardrail.change-safety
  version: 0.2.0
  applies_to: [code]
  enforcement: [instruction, rubric_eval]
  verification:
    - id: semantic-check
      kind: judgement
      label: Check meaning
      question: Does this satisfy the intended practice?
      evidence: [output]
      on_fail: block
      on_uncertain: human_review
  rules: []
---
Verify the meaning of the completed work.
`,
        },
        {
          path: "modules/tasks/change.md",
          content: `---
type: task
title: Make a change
harness:
  schema_version: "0.1"
  id: task.change
  version: 0.1.0
  applies_to: [code]
  trigger:
    label: Make a change
---
Make the change.
`,
        },
      ],
      profiles: [profile],
    });

    const step = buildVerificationPlan(project, "coding").steps[0];
    expect(step?.kind).toBe("judgement");
    expect(resolveVerificationJudgementGate(step!, "pass")).toBe("continue");
    expect(resolveVerificationJudgementGate(step!, "fail")).toBe("block");
    expect(resolveVerificationJudgementGate(step!, "uncertain")).toBe(
      "human_review",
    );
    expect(resolveVerificationJudgementGate(step!, null)).toBe("incomplete");
  });

});
