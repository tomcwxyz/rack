import { describe, expect, it } from "vitest";
import { materializeSharedPractice } from "../src/sharedPractice.js";

const example = `format: rack.shared-practice
schema_version: "0.1"
id: good-ship
version: 0.1.0
title: The Good Ship practice
description: Shared working practice for AI-supported work.
published_by:
  name: The Good Ship
license: CC-BY-4.0
instructions:
  - type: guardrail
    title: Evidence boundaries
    harness:
      schema_version: "0.2"
      id: guardrail.evidence
      version: 0.2.0
      criticality: required
      authority:
        mode: binding
        propagation: shared
        rationale: Public-facing work must distinguish evidence from inference.
      rules:
        - id: evidence
          statement: Distinguish evidence from inference.
    body: |
      Make the source of important claims clear.

  - type: voice
    title: Plain language
    harness:
      schema_version: "0.2"
      id: voice.plain
      version: 0.2.0
      criticality: recommended
      authority:
        mode: adaptable
        propagation: shared
    body: |
      Prefer direct, concrete language.
`;

describe("shared practice files", () => {
  it("materialises one shared file into ordinary Rack modules and candidates", () => {
    const result = materializeSharedPractice(example, {
      sourceId: "good-ship-org",
      label: "The Good Ship",
      relationship: "organisation",
      precedence: 10,
      filePath: "/shared/good-ship.rack.yaml",
    });

    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.document).toMatchObject({
      id: "good-ship",
      version: "0.1.0",
      title: "The Good Ship practice",
    });
    expect(result.source).toMatchObject({
      id: "good-ship-org",
      kind: "shared-file",
      relationship: "organisation",
      precedence: 10,
      path: "/shared/good-ship.rack.yaml",
      version: "0.1.0",
    });
    expect(result.modules.map((module) => module.harness.id)).toEqual([
      "guardrail.evidence",
      "voice.plain",
    ]);
    expect(result.modules[0]?.path).toBe(
      "shared/good-ship-org/guardrail.evidence.md",
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.source.id).toBe("good-ship-org");
  });

  it("keeps precedence and relationship outside publisher-controlled YAML", () => {
    const result = materializeSharedPractice(example, {
      sourceId: "my-trusted-copy",
      relationship: "team",
      precedence: 25,
    });

    expect(result.source).toMatchObject({
      id: "my-trusted-copy",
      relationship: "team",
      precedence: 25,
    });
    expect(result.document).not.toHaveProperty("precedence");
    expect(result.document).not.toHaveProperty("relationship");
  });

  it("blocks the whole file when one published instruction is invalid", () => {
    const invalid = example.replace(
      "schema_version: \"0.2\"\n      id: voice.plain",
      "schema_version: \"0.1\"\n      id: voice.plain",
    ).replace(
      "      authority:\n        mode: adaptable\n        propagation: shared\n    body: |\n      Prefer direct, concrete language.",
      "      authority:\n        mode: adaptable\n        propagation: shared\n    body: |\n      Prefer direct, concrete language.",
    );

    const result = materializeSharedPractice(invalid, {
      sourceId: "good-ship-org",
      precedence: 10,
    });

    expect(result.blocked).toBe(true);
    expect(result.modules).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-SHARED-005",
        severity: "error",
      }),
    );
  });

  it("rejects local-only instructions in a published shared file", () => {
    const invalid = example.replace(
      "mode: adaptable\n        propagation: shared",
      "mode: adaptable\n        propagation: local-only",
    );

    const result = materializeSharedPractice(invalid, {
      sourceId: "good-ship-org",
      precedence: 10,
    });

    expect(result.blocked).toBe(true);
    expect(result.modules).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-SHARED-007",
        moduleIds: ["voice.plain"],
      }),
    );
  });

  it("requires a rationale before publishing a binding instruction", () => {
    const invalid = example.replace(
      "        rationale: Public-facing work must distinguish evidence from inference.\n",
      "",
    );

    const result = materializeSharedPractice(invalid, {
      sourceId: "good-ship-org",
      precedence: 10,
    });

    expect(result.blocked).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-SHARED-008",
        moduleIds: ["guardrail.evidence"],
      }),
    );
  });

  it("rejects duplicate instruction IDs atomically", () => {
    const duplicate = example.replace(
      "id: voice.plain",
      "id: guardrail.evidence",
    );

    const result = materializeSharedPractice(duplicate, {
      sourceId: "good-ship-org",
      precedence: 10,
    });

    expect(result.blocked).toBe(true);
    expect(result.modules).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-SHARED-006",
        moduleIds: ["guardrail.evidence"],
      }),
    );
  });
});
