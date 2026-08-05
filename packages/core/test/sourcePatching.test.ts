import { describe, expect, it } from "vitest";
import {
  diffSourceLines,
  patchContextModuleSource,
  patchVoiceModuleSource,
  readContextModuleDraft,
  readVoiceModuleDraft,
  SourcePatchError,
} from "../src/sourcePatching.js";

const contextSource = `---
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

const voiceSource = `---
type: voice
title: Existing voice # Keep voice comment
description: Existing description
harness:
  schema_version: "0.1"
  id: voice.tone
  version: 0.1.0
  applies_to: [writing]
  lexicon:
    never:
      - term: forbidden phrase
    prefer:
      - use: social purpose organisations
        instead_of: [charities]
    avoid:
      - term: leverage
        reason: It sounds like consultancy language.
    rules:
      - Use British English.
    future_lexicon_setting: keep-me
---
Write as a thoughtful practitioner.
`;

describe("guided context source patching", () => {
  it("reads a supported context instruction", () => {
    expect(readContextModuleDraft(contextSource)).toEqual({
      title: "Old title",
      description: "Old description",
      contextKind: "organisation",
      body: "Old context body.",
    });
  });

  it("changes supported fields without discarding comments or unknown fields", () => {
    const result = patchContextModuleSource(contextSource, {
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
    const windowsSource = contextSource.replace(/\n/g, "\r\n");
    const result = patchContextModuleSource(windowsSource, {
      ...readContextModuleDraft(windowsSource),
      body: "Changed on Windows.",
    });

    expect(result.content).toContain("\r\n");
    expect(result.content.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("refuses an unsupported module rather than rewriting it", () => {
    const unsupported = contextSource.replace("type: context", "type: voice");
    expect(() => readContextModuleDraft(unsupported)).toThrowError(
      SourcePatchError,
    );
  });
});

describe("guided voice source patching", () => {
  it("reads voice guidance, rules and avoided terms", () => {
    expect(readVoiceModuleDraft(voiceSource)).toEqual({
      title: "Existing voice",
      description: "Existing description",
      body: "Write as a thoughtful practitioner.",
      rules: ["Use British English."],
      avoid: [
        {
          term: "leverage",
          reason: "It sounds like consultancy language.",
        },
      ],
    });
  });

  it("updates supported voice fields while preserving other lexicon data", () => {
    const result = patchVoiceModuleSource(voiceSource, {
      title: "Plain and warm voice",
      description: "How authored prose should sound.",
      body: "Write clearly and make the important point early.",
      rules: ["Use British English.", "Prefer ordinary words."],
      avoid: [
        { term: "leverage", reason: "Use a precise verb instead." },
        { term: "stakeholders", reason: "Name the people involved." },
      ],
    });

    expect(result.content).toContain("# Keep voice comment");
    expect(result.content).toContain("future_lexicon_setting: keep-me");
    expect(result.content).toContain("never:");
    expect(result.content).toContain("term: forbidden phrase");
    expect(result.content).toContain("prefer:");
    expect(result.content).toContain("use: social purpose organisations");
    expect(result.content).toContain("id: voice.tone");
    expect(result.content).toContain("version: 0.1.0");
    expect(readVoiceModuleDraft(result.content)).toMatchObject({
      title: "Plain and warm voice",
      body: "Write clearly and make the important point early.",
      rules: ["Use British English.", "Prefer ordinary words."],
      avoid: [
        { term: "leverage", reason: "Use a precise verb instead." },
        { term: "stakeholders", reason: "Name the people involved." },
      ],
    });
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
