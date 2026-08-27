import { describe, expect, it } from "vitest";
import {
  createSharedPracticePublication,
  materializeSharedPractice,
  parseProjectSnapshot,
  type ProjectSnapshot,
} from "../src/index.js";

const snapshot: ProjectSnapshot = {
  root: "/rack",
  manifest: {
    path: "rack.yaml",
    content: `schema_version: "0.1"
name: publisher-rack
version: 0.1.0
title: Publisher Rack
description: Example
author:
  name: Publisher
license: null
default_profile: writing
profiles:
  - writing
`,
  },
  modules: [
    {
      path: "modules/guardrails/evidence.md",
      content: `---
type: guardrail
title: Evidence boundary
description: Keep evidence and inference distinct.
tags: [evidence]
harness:
  schema_version: "0.2"
  id: guardrail.evidence
  version: 0.2.0
  criticality: required
  authority:
    mode: binding
    propagation: shared
    rationale: Public claims need a consistent evidence boundary.
  rules:
    - id: evidence
      statement: Distinguish evidence from inference.
---
Make uncertainty visible.
`,
    },
    {
      path: "modules/method/decision-notes.md",
      content: `---
type: method
title: Decision notes
description: Try short notes after consequential decisions.
harness:
  schema_version: "0.2"
  id: method.decision-notes
  version: 0.2.0
  authority:
    mode: adaptable
    propagation: shared
    review_after: 2026-11-01
  experiment:
    question: Do short decision notes reduce repeated discussion?
---
Write a short note recording the decision and why it was made.
`,
    },
    {
      path: "modules/context/private.md",
      content: `---
type: context
title: Private context
harness:
  schema_version: "0.2"
  id: context.private
  version: 0.2.0
  authority:
    mode: adaptable
    propagation: local-only
---
This stays local.
`,
    },
  ],
  profiles: [
    {
      path: "profiles/writing.yaml",
      content: `schema_version: "0.1"
id: writing
title: Writing
domains: [writing]
include:
  - guardrail.evidence
exclude: []
`,
    },
  ],
};

const publicationInput = {
  id: "example-org",
  version: "1.2.0",
  title: "Example organisation practice",
  description: "Shared working practice.",
  publishedBy: {
    name: "Practice team",
    organisation: "Example Organisation",
  },
  license: "CC-BY-4.0",
  moduleIds: ["method.decision-notes", "guardrail.evidence"],
} as const;

describe("shared practice publisher", () => {
  it("publishes only explicitly selected instructions in deterministic ID order", () => {
    const project = parseProjectSnapshot(snapshot);
    const result = createSharedPracticePublication(project, publicationInput);

    expect(result.blocked).toBe(false);
    expect(result.document?.instructions.map((instruction) =>
      (instruction.harness as { id: string }).id,
    )).toEqual(["guardrail.evidence", "method.decision-notes"]);
  });

  it("round-trips generated YAML through the receiver materialiser", () => {
    const project = parseProjectSnapshot(snapshot);
    const result = createSharedPracticePublication(project, publicationInput);
    expect(result.content).not.toBeNull();

    const materialized = materializeSharedPractice(result.content!, {
      sourceId: "receiver",
      precedence: 10,
      relationship: "organisation",
      filePath: "/shared/example-org.rack.yaml",
    });

    expect(materialized.blocked).toBe(false);
    expect(materialized.modules.map((module) => module.harness.id)).toEqual([
      "guardrail.evidence",
      "method.decision-notes",
    ]);
  });

  it("preserves binding rationale and experiment learning questions", () => {
    const project = parseProjectSnapshot(snapshot);
    const result = createSharedPracticePublication(project, publicationInput);
    const materialized = materializeSharedPractice(result.content!, {
      sourceId: "receiver",
      precedence: 10,
    });

    expect(
      materialized.modules.find(
        (module) => module.harness.id === "guardrail.evidence",
      )?.harness.authority?.rationale,
    ).toContain("consistent evidence boundary");
    expect(
      materialized.modules.find(
        (module) => module.harness.id === "method.decision-notes",
      )?.harness.experiment?.question,
    ).toContain("repeated discussion");
  });

  it("blocks local-only instructions", () => {
    const project = parseProjectSnapshot(snapshot);
    const result = createSharedPracticePublication(project, {
      ...publicationInput,
      moduleIds: ["context.private"],
    });

    expect(result.blocked).toBe(true);
    expect(result.diagnostics.some((item) => item.code === "RACK-PUBLISH-005")).toBe(true);
  });

  it("blocks missing and duplicate explicit selections", () => {
    const project = parseProjectSnapshot(snapshot);

    expect(
      createSharedPracticePublication(project, {
        ...publicationInput,
        moduleIds: ["method.missing"],
      }).diagnostics.some((item) => item.code === "RACK-PUBLISH-003"),
    ).toBe(true);

    expect(
      createSharedPracticePublication(project, {
        ...publicationInput,
        moduleIds: ["guardrail.evidence", "guardrail.evidence"],
      }).diagnostics.some((item) => item.code === "RACK-PUBLISH-002"),
    ).toBe(true);
  });

  it("requires at least one explicit instruction", () => {
    const project = parseProjectSnapshot(snapshot);
    const result = createSharedPracticePublication(project, {
      ...publicationInput,
      moduleIds: [],
    });

    expect(result.blocked).toBe(true);
    expect(result.diagnostics[0]?.code).toBe("RACK-PUBLISH-001");
  });

  it("blocks invalid publication metadata", () => {
    const project = parseProjectSnapshot(snapshot);
    const result = createSharedPracticePublication(project, {
      ...publicationInput,
      id: "Not A Slug",
    });

    expect(result.blocked).toBe(true);
    expect(result.diagnostics.some((item) => item.code === "RACK-PUBLISH-006")).toBe(true);
  });

  it("does not mutate the source Rack", () => {
    const project = parseProjectSnapshot(snapshot);
    const before = structuredClone(project);
    createSharedPracticePublication(project, publicationInput);
    expect(project).toEqual(before);
  });
});
