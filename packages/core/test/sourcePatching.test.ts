import { describe, expect, it } from "vitest";
import {
  diffSourceLines,
  patchContextModuleSource,
  readContextModuleDraft,
  SourcePatchError,
} from "../src/sourcePatching.js";

const source = `---
# Keep this module comment
type: context
title: Old title # Keep this title note
description: Old description
future_field:
  enabled: true
harness:
  schema_version: "0.1"
  id: context.organisation
  version: 0.1.0
  context_kind: organisation
  applies_to: [writing]
  future_setting: keep-me
---
Old context body.
`;

describe("guided source patching", () => {
  it("reads a supported context instruction", () => {
    expect(readContextModuleDraft(source)).toEqual({
      title: "Old title",
      description: "Old description",
      contextKind: "organisation",
      body: "Old context body.",
    });
  });

  it("changes supported fields without discarding comments or unknown fields", () => {
    const result = patchContextModuleSource(source, {
      title: "Organisation and work",
      description: "What the assistant should understand about the work.",
      contextKind: "organisation",
      body: "New context body.",
    });

    expect(result.content).toContain("# Keep this module comment");
    expect(result.content).toContain("# Keep this title note");
    expect(result.content).toContain("future_field:");
    expect(result.content).toContain("future_setting: keep-me");
    expect(result.content).toContain("id: context.organisation");
    expect(result.content).toContain("version: 0.1.0");
    expect(result.content).toContain("title: Organisation and work");
    expect(result.content).toContain("New context body.");
    expect(readContextModuleDraft(result.content)).toMatchObject({
      title: "Organisation and work",
      body: "New context body.",
    });
    expect(result.diff.some((line) => line.kind === "remove")).toBe(true);
    expect(result.diff.some((line) => line.kind === "add")).toBe(true);
  });

  it("preserves the original line-ending convention", () => {
    const windowsSource = source.replace(/\n/g, "\r\n");
    const result = patchContextModuleSource(windowsSource, {
      ...readContextModuleDraft(windowsSource),
      body: "Changed on Windows.",
    });

    expect(result.content).toContain("\r\n");
    expect(result.content.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("refuses an unsupported module rather than rewriting it", () => {
    const voiceSource = source.replace("type: context", "type: voice");
    expect(() => readContextModuleDraft(voiceSource)).toThrowError(
      SourcePatchError,
    );
  });
});

describe("source line diffs", () => {
  it("records stable old and new line numbers", () => {
    expect(diffSourceLines("one\ntwo\nthree", "one\nchanged\nthree")).toEqual([
      { kind: "same", text: "one", oldLine: 1, newLine: 1 },
      { kind: "remove", text: "two", oldLine: 2, newLine: null },
      { kind: "add", text: "changed", oldLine: null, newLine: 2 },
      { kind: "same", text: "three", oldLine: 3, newLine: 3 },
    ]);
  });
});
