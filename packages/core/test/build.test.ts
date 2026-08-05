import { describe, expect, it } from "vitest";
import { parseProjectSnapshot, type ProjectSnapshot } from "../src/index.js";
import {
  canonicalJson,
  inspectPromptBuild,
  preparePromptBuild,
  sha256Text,
} from "../src/build.js";

const snapshot = (body = "Write clearly.", maximumTokens = 16000): ProjectSnapshot => ({
  root: "/writing",
  manifest: {
    path: "rack.yaml",
    content: `
schema_version: "0.1"
name: writing-rack
version: 0.1.0
title: Writing Rack
author: { name: Example Author }
default_profile: writing
profiles: [writing]
`,
  },
  modules: [
    {
      path: "modules/context/organisation.md",
      content: `---
type: context
title: Organisation context
description: Context for clear writing.
harness:
  schema_version: "0.1"
  id: context.organisation
  version: 0.1.0
  context_kind: organisation
  applies_to: [writing]
---
${body}
`,
    },
  ],
  profiles: [
    {
      path: "profiles/writing.yaml",
      content: `
schema_version: "0.1"
id: writing
title: Writing
description: A focused writing Set-up.
domains: [writing]
include: [context.organisation]
budgets:
  prompt:
    recommended_tokens: ${Math.min(10000, maximumTokens)}
    maximum_tokens: ${maximumTokens}
`,
    },
  ],
});

describe("canonical build state", () => {
  it("canonicalises object keys and line endings", async () => {
    expect(canonicalJson({ z: 1, a: { y: true, b: false } })).toBe(
      '{"a":{"b":false,"y":true},"z":1}',
    );
    expect(await sha256Text("one\r\ntwo\r")).toBe(
      await sha256Text("one\ntwo\n"),
    );
  });

  it("creates the same manifest from the same Rack", async () => {
    const project = parseProjectSnapshot(snapshot());
    const first = await preparePromptBuild(project, "writing");
    const second = await preparePromptBuild(project, "writing");

    expect(first.diagnostics).toEqual([]);
    expect(first.manifestContent).toBe(second.manifestContent);
    expect(first.manifest?.source.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.outputFiles.map((file) => file.path)).toEqual([
      "system-prompt.md",
      "build.json",
    ]);
  });

  it("blocks a build above its maximum budget without truncating", async () => {
    const project = parseProjectSnapshot(snapshot("Write clearly.", 1));
    const build = await preparePromptBuild(project, "writing");

    expect(build.manifest).toBeNull();
    expect(build.outputFiles).toEqual([]);
    expect(build.promptBuild.artifact?.content).toContain("Write clearly.");
    expect(build.diagnostics).toContainEqual(
      expect.objectContaining({ code: "RACK-BUDGET-002", severity: "error" }),
    );
  });

  it("distinguishes current, stale and manually modified output", async () => {
    const project = parseProjectSnapshot(snapshot());
    const prepared = await preparePromptBuild(project, "writing");
    const installed = {
      manifestContent: prepared.manifestContent,
      artifactContent: prepared.promptBuild.artifact?.content ?? null,
    };

    expect((await inspectPromptBuild(project, "writing", installed)).status).toBe(
      "current",
    );

    const changedProject = parseProjectSnapshot(snapshot("Write very clearly."));
    const staleInspection = await inspectPromptBuild(
      changedProject,
      "writing",
      installed,
    );
    expect(staleInspection.status).toBe("stale");
    expect(staleInspection.sourceChanged).toBe(true);
    expect(staleInspection.rendererChanged).toBe(false);

    expect(
      (
        await inspectPromptBuild(project, "writing", {
          ...installed,
          artifactContent: `${installed.artifactContent}\nManual change`,
        })
      ).status,
    ).toBe("modified");
  });
});
