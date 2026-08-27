import { describe, expect, it } from "vitest";
import type {
  PracticeAuthority,
  PracticeSource,
  RackModule,
} from "@rack/schemas";
import {
  resolvePracticeCandidates,
  type PracticeCandidate,
} from "../src/practiceResolution.js";

const source = (
  id: string,
  precedence: number,
  kind: PracticeSource["kind"] = "shared-file",
): PracticeSource => ({
  id,
  label: id,
  kind,
  precedence,
});

const authority = (
  mode: PracticeAuthority["mode"] = "adaptable",
  propagation: PracticeAuthority["propagation"] = "shared",
): PracticeAuthority => ({
  mode,
  propagation,
});

const moduleFor = (
  id: string,
  body: string,
): RackModule => ({
  type: "context",
  title: body,
  description: null,
  tags: [],
  harness: {
    schema_version: "0.1",
    id,
    version: "0.1.0",
    applies_to: "all",
    requires: [],
    criticality: "recommended",
    enforcement: ["instruction"],
    capabilities: { required: [] },
    emit: { priority: 50, targets: "all" },
    source: { origin: "local", license: null },
    context_kind: "reference",
  },
  path: `modules/context/${id.replace(".", "-")}.md`,
  body,
});

const candidate = (
  moduleId: string,
  body: string,
  practiceSource: PracticeSource,
  practiceAuthority: PracticeAuthority = authority(),
): PracticeCandidate => ({
  module: moduleFor(moduleId, body),
  source: practiceSource,
  authority: practiceAuthority,
});

describe("practice resolution", () => {
  it("lets the nearest adaptable source win", () => {
    const result = resolvePracticeCandidates([
      candidate("voice.tone", "organisation", source("organisation", 10)),
      candidate("voice.tone", "team", source("team", 20)),
      candidate("voice.tone", "local", source("local", 30, "local")),
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.instructions).toHaveLength(1);
    expect(result.instructions[0]?.module.body).toBe("local");
    expect(result.instructions[0]?.provenance.id).toBe("local");
    expect(result.instructions[0]?.resolution.bindingApplied).toBe(false);
  });

  it("lets an upstream binding instruction beat a nearer adaptation", () => {
    const result = resolvePracticeCandidates([
      candidate(
        "guardrail.evidence",
        "organisation",
        source("organisation", 10),
        authority("binding"),
      ),
      candidate(
        "guardrail.evidence",
        "local adaptation",
        source("local", 30, "local"),
      ),
    ]);

    expect(result.instructions[0]?.module.body).toBe("organisation");
    expect(result.instructions[0]?.provenance.id).toBe("organisation");
    expect(result.instructions[0]?.resolution.bindingApplied).toBe(true);
    expect(result.instructions[0]?.resolution.adaptationBlocked).toBe(true);
    expect(result.instructions[0]?.resolution.supersededSourceIds).toEqual([
      "local",
    ]);
  });

  it("reads authority from v0.2 module metadata when no wrapper override is supplied", () => {
    const upstreamModule = {
      ...moduleFor("guardrail.evidence", "organisation"),
      harness: {
        ...moduleFor("guardrail.evidence", "organisation").harness,
        schema_version: "0.2" as const,
        authority: authority("binding"),
      },
    };

    const result = resolvePracticeCandidates([
      {
        module: upstreamModule,
        source: source("organisation", 10),
      },
      candidate(
        "guardrail.evidence",
        "local adaptation",
        source("local", 30, "local"),
      ),
    ]);

    expect(result.instructions[0]?.provenance.id).toBe("organisation");
    expect(result.instructions[0]?.authority.mode).toBe("binding");
    expect(result.instructions[0]?.resolution.adaptationBlocked).toBe(true);
  });

  it("uses the furthest-upstream binding instruction when bindings conflict", () => {
    const result = resolvePracticeCandidates([
      candidate(
        "guardrail.evidence",
        "organisation",
        source("organisation", 10),
        authority("binding"),
      ),
      candidate(
        "guardrail.evidence",
        "team",
        source("team", 20),
        authority("binding"),
      ),
    ]);

    expect(result.instructions[0]?.provenance.id).toBe("organisation");
    expect(result.instructions[0]?.resolution.supersededSourceIds).toEqual([
      "team",
    ]);
  });

  it("does not propagate local-only instructions from a shared source", () => {
    const result = resolvePracticeCandidates([
      candidate(
        "voice.tone",
        "private upstream preference",
        source("organisation", 10),
        authority("adaptable", "local-only"),
      ),
      candidate(
        "voice.tone",
        "local",
        source("local", 30, "local"),
      ),
    ]);

    expect(result.instructions[0]?.module.body).toBe("local");
    expect(result.instructions[0]?.resolution.discardedLocalOnlySourceIds)
      .toEqual(["organisation"]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-PRACTICE-001",
        severity: "info",
        moduleIds: ["voice.tone"],
      }),
    );
  });

  it("keeps a local local-only instruction", () => {
    const result = resolvePracticeCandidates([
      candidate(
        "voice.tone",
        "private local preference",
        source("local", 30, "local"),
        authority("adaptable", "local-only"),
      ),
    ]);

    expect(result.diagnostics).toEqual([]);
    expect(result.instructions[0]?.module.body).toBe(
      "private local preference",
    );
    expect(result.instructions[0]?.authority.propagation).toBe("local-only");
  });

  it("rejects ambiguous sources at the same precedence", () => {
    const result = resolvePracticeCandidates([
      candidate("voice.tone", "one", source("one", 10)),
      candidate("voice.tone", "two", source("two", 10)),
    ]);

    expect(result.instructions).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "RACK-PRACTICE-002",
        severity: "error",
        moduleIds: ["voice.tone"],
        sourceIds: ["one", "two"],
      }),
    );
  });

  it("returns resolved instructions in deterministic ID order", () => {
    const result = resolvePracticeCandidates([
      candidate("voice.tone", "voice", source("local", 30, "local")),
      candidate("context.project", "context", source("local", 30, "local")),
    ]);

    expect(result.instructions.map((item) => item.module.harness.id)).toEqual([
      "context.project",
      "voice.tone",
    ]);
  });
});
