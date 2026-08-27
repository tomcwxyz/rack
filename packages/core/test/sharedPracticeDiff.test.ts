import { describe, expect, it } from "vitest";
import type { RackModule } from "@rack/schemas";
import { compareSharedPracticeModules } from "../src/sharedPracticeDiff.js";

const moduleFor = (
  id: string,
  options: {
    body?: string;
    criticality?: "required" | "recommended" | "optional";
    mode?: "adaptable" | "binding";
    reviewAfter?: string;
  } = {},
): RackModule => ({
  type: "context",
  title: id,
  description: null,
  tags: [],
  harness: {
    schema_version: "0.2",
    id,
    version: "0.2.0",
    applies_to: "all",
    requires: [],
    criticality: options.criticality ?? "recommended",
    authority: {
      mode: options.mode ?? "adaptable",
      propagation: "shared",
      ...(options.mode === "binding"
        ? { rationale: "This boundary is shared." }
        : {}),
      ...(options.reviewAfter ? { review_after: options.reviewAfter } : {}),
    },
    enforcement: ["instruction"],
    capabilities: { required: [] },
    emit: { priority: 50, targets: "all" },
    source: { origin: "local", license: null },
    context_kind: "reference",
  },
  path: `shared/example/${id}.md`,
  body: options.body ?? id,
});

describe("shared practice update comparison", () => {
  it("reports ordinary content changes without calling them tightening", () => {
    const result = compareSharedPracticeModules(
      [moduleFor("voice.plain", { body: "Old wording" })],
      [moduleFor("voice.plain", { body: "New wording" })],
    );

    expect(result).toMatchObject({
      changed: true,
      tightening: false,
      tighteningModuleIds: [],
    });
    expect(result.changes).toEqual([
      {
        moduleId: "voice.plain",
        kind: "changed",
        tightening: false,
        tighteningReasons: [],
      },
    ]);
  });

  it("flags a newly published binding instruction", () => {
    const result = compareSharedPracticeModules(
      [],
      [moduleFor("guardrail.evidence", {
        mode: "binding",
        criticality: "required",
      })],
    );

    expect(result.tightening).toBe(true);
    expect(result.changes[0]).toMatchObject({
      moduleId: "guardrail.evidence",
      kind: "added",
      tightening: true,
      tighteningReasons: ["new-binding", "new-required"],
    });
  });

  it("flags an adaptable instruction becoming binding", () => {
    const result = compareSharedPracticeModules(
      [moduleFor("guardrail.evidence")],
      [moduleFor("guardrail.evidence", { mode: "binding" })],
    );

    expect(result.changes[0]?.tighteningReasons).toContain("became-binding");
  });

  it("flags increased criticality", () => {
    const result = compareSharedPracticeModules(
      [moduleFor("voice.plain", { criticality: "recommended" })],
      [moduleFor("voice.plain", { criticality: "required" })],
    );

    expect(result.changes[0]?.tighteningReasons).toContain(
      "criticality-increased",
    );
  });

  it("flags a binding review date being removed", () => {
    const result = compareSharedPracticeModules(
      [moduleFor("guardrail.evidence", {
        mode: "binding",
        reviewAfter: "2027-02-01",
      })],
      [moduleFor("guardrail.evidence", { mode: "binding" })],
    );

    expect(result.changes[0]?.tighteningReasons).toContain(
      "binding-review-removed",
    );
  });

  it("flags a binding review date being pushed further out", () => {
    const result = compareSharedPracticeModules(
      [moduleFor("guardrail.evidence", {
        mode: "binding",
        reviewAfter: "2027-02-01",
      })],
      [moduleFor("guardrail.evidence", {
        mode: "binding",
        reviewAfter: "2027-06-01",
      })],
    );

    expect(result.changes[0]?.tighteningReasons).toContain(
      "binding-review-deferred",
    );
  });

  it("does not call removal tightening and keeps deterministic ID order", () => {
    const result = compareSharedPracticeModules(
      [
        moduleFor("voice.plain"),
        moduleFor("context.project"),
      ],
      [],
    );

    expect(result.tightening).toBe(false);
    expect(result.changes.map((change) => change.moduleId)).toEqual([
      "context.project",
      "voice.plain",
    ]);
    expect(result.changes.every((change) => change.kind === "removed")).toBe(true);
  });
});
