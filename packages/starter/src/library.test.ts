import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { moduleFrontmatterSchema } from "@rack/schemas";
import {
  HONEY_UPSTREAM_REVISION,
  getStarterEntry,
  getStarterTemplate,
  honeyStarterCatalogue,
  searchStarterCatalogue,
  starterCatalogue,
  starterCatalogueMetadata,
  starterTemplates,
} from "./index.js";

const readFrontmatter = (source: string) => {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error("Starter source is missing YAML frontmatter.");
  return moduleFrontmatterSchema.parse(parse(match[1]));
};

describe("public Starter library", () => {
  it("combines RACK-authored content with the Honey external pack", () => {
    expect(starterCatalogue).toHaveLength(48);
    expect(starterTemplates).toHaveLength(9);
    expect(honeyStarterCatalogue).toHaveLength(8);
    expect(starterCatalogueMetadata.version).toBe("0.3.0");
    expect(starterCatalogueMetadata.license).toBe("mixed");
    expect(starterCatalogueMetadata.licenses).toEqual(["CC BY 4.0", "MIT"]);
  });

  it("keeps source provenance and licence on every public entry", () => {
    for (const entry of starterCatalogue) {
      expect(entry.sourceOrigin.length).toBeGreaterThan(0);
      expect(entry.contentLicense.length).toBeGreaterThan(0);
      const frontmatter = readFrontmatter(entry.source);
      expect(frontmatter.harness.source.origin).toBe(entry.sourceOrigin);
      expect(frontmatter.harness.source.license).toBe(entry.contentLicense);
    }
  });

  it("pins Honey adaptations to the reviewed upstream revision", () => {
    for (const entry of honeyStarterCatalogue) {
      expect(entry.id).toMatch(/^@rack-starter\/honey\./);
      expect(entry.routes).toContain("coding");
      expect(entry.tags).toContain("honey");
      expect(entry.contentLicense).toBe("MIT");
      expect(entry.upstreamRevision).toBe(HONEY_UPSTREAM_REVISION);
      expect(entry.source).toContain("External Starter source: Honey for Devs");
      expect(entry.source).toContain(`Upstream revision: ${HONEY_UPSTREAM_REVISION}`);
      expect(entry.source).toContain("Copyright (c) 2026 Green-PT");
    }
  });

  it("does not bundle Honey runtime hooks or executable helper tooling", () => {
    const bundled = honeyStarterCatalogue.map((entry) => entry.source).join("\n");
    expect(bundled).not.toContain("CLAUDE_PLUGIN_ROOT");
    expect(bundled).not.toContain("honey-state.js");
    expect(bundled).not.toContain("pxpipe-proxy");
    expect(bundled).not.toContain("eson stash");
    expect(bundled).not.toContain("node -e");
  });

  it("exposes a Honey template that composes external and existing RACK practice", () => {
    const template = getStarterTemplate("honey-lean-coding");
    expect(template?.route).toBe("coding");
    expect(template?.moduleIds).toContain("@rack-starter/honey.method.minimum-code");
    expect(template?.moduleIds).toContain("@rack-starter/guardrail.change-verification");
    expect(template?.moduleIds).toContain("@rack-starter/guardrail.security");
    expect(template?.moduleIds).toContain("@rack-starter/craft.testing");
    for (const id of template?.moduleIds ?? []) {
      expect(getStarterEntry(id), `missing template module ${id}`).toBeDefined();
    }
  });

  it("finds Honey by name, tag, source and licence", () => {
    expect(searchStarterCatalogue({ query: "Honey", route: "coding" })).toHaveLength(8);
    expect(searchStarterCatalogue({ tag: "honey" })).toHaveLength(8);
    expect(searchStarterCatalogue({ query: "green-pt" })).toHaveLength(8);
    expect(searchStarterCatalogue({ query: "MIT", route: "coding" })).toHaveLength(8);
  });

  it("keeps the lean review explicitly separate from correctness review", () => {
    const entry = getStarterEntry("@rack-starter/honey.task.lean-review");
    expect(entry).toBeDefined();
    const frontmatter = readFrontmatter(entry!.source);
    expect(frontmatter.harness.schema_version).toBe("0.2");
    expect(frontmatter.harness.enforcement).toContain("rubric_eval");
    expect(frontmatter.harness.verification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "lean-review-boundary",
          kind: "judgement",
          on_fail: "block",
          on_uncertain: "human_review",
        }),
      ]),
    );
  });
});
