import { describe, expect, it } from "vitest";
import {
  attachContextToPromptBuild,
  type PreparedTargetBuild,
} from "./build.js";
import type { ContextSnapshot } from "./contextSources.js";

const zeros = `sha256:${"0".repeat(64)}`;

const baseBuild = (): PreparedTargetBuild =>
  ({
    target: "prompt",
    targetBuild: {
      artifacts: [
        {
          target: "prompt",
          path: "system-prompt.md",
          mediaType: "text/markdown",
          content: "# Coding practice\n\nFollow the Rack instructions.\n",
          moduleIds: ["method.test"],
        },
      ],
      compiled: {
        project: { name: "example", title: "Example", version: "0.1.0" },
        profile: {
          id: "coding",
          title: "Coding",
          description: "",
          domains: ["coding"],
          include: [],
          exclude: [],
          overrides: { emit_priority: {}, target_waivers: {} },
          budgets: {},
        },
        modules: [],
        requiredModuleIds: [],
        sourceModuleIds: ["method.test"],
      },
      diagnostics: [],
      degradations: [],
    },
    manifest: {
      schema_version: "0.2",
      compiler: { name: "rack", version: "0.0.0" },
      adapter: { id: "prompt", version: "0.1.0", status: "supported" },
      project: { name: "example", version: "0.1.0" },
      profile: { id: "coding", title: "Coding" },
      source: { digest: zeros, module_ids: ["method.test"] },
      artifacts: [
        {
          path: "system-prompt.md",
          media_type: "text/markdown",
          digest: zeros,
          bytes: 1,
          estimated_tokens: 1,
        },
      ],
      package: {
        estimated_tokens: 1,
        token_estimator: "utf8-bytes-divided-by-4",
      },
      degradations: [],
      modules: [{ id: "method.test", version: "0.1.0" }],
    },
    manifestContent: "{}\n",
    outputDirectory: ".rack/generated/prompt/coding",
    outputFiles: [],
    estimatedTokens: 1,
    diagnostics: [],
    degradations: [],
  }) as PreparedTargetBuild;

const snapshot: ContextSnapshot = {
  id: "ctx-1",
  sourceId: "topo",
  subject: "project:rack",
  purpose: "prepare implementation",
  objects: [
    {
      type: "topo.memory_claim",
      id: "claim-1",
      value: {
        key: "writing.locale",
        value: "en-GB",
        confidence: 1,
      },
    },
  ],
  evidenceRefs: ["source-1"],
  generatedAt: "2026-08-31T09:00:00Z",
  expiresAt: "2999-01-01T00:00:00Z",
  permissions: ["local-use-only"],
  provenance: {
    source_type: "application",
    created_by: { type: "system", id: "topo" },
  },
  extensions: {},
};

describe("context-aware prompt builds", () => {
  it("uses transient context without changing canonical Rack source provenance", async () => {
    const build = await attachContextToPromptBuild(baseBuild(), snapshot);

    expect(build.manifest?.source.digest).toBe(zeros);
    expect(build.manifest?.context).toMatchObject({
      source: "topo",
      packet_id: "ctx-1",
      subject: "project:rack",
      purpose: "prepare implementation",
      object_ids: ["claim-1"],
    });
    expect(build.manifest?.context?.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    const prompt = build.targetBuild.artifacts[0]?.content ?? "";
    expect(prompt).toContain("# Coding practice");
    expect(prompt).toContain("# Organisational context");
    expect(prompt).toContain("does not override Rack instructions");
    expect(prompt).toContain('"value": "en-GB"');

    expect(build.outputFiles.map((file) => file.path)).toEqual([
      "system-prompt.md",
      "build.json",
    ]);
  });

  it("refuses to apply context to non-prompt targets", async () => {
    await expect(
      attachContextToPromptBuild(
        { ...baseBuild(), target: "agents-md" },
        snapshot,
      ),
    ).rejects.toThrow(/only supported for prompt builds/);
  });
});
