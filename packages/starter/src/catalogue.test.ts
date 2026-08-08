import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { moduleFrontmatterSchema } from "@rack/schemas";
import {
  getStarterEntry,
  searchStarterCatalogue,
  starterCatalogue,
  starterCatalogueMetadata,
  starterContentDigest,
  starterSourcesEqual,
  starterTemplates,
} from "./catalogue.js";

const parseSource = (source: string) => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  expect(lines[0]).toBe("---");
  const closing = lines.findIndex((line, index) => index > 0 && line === "---");
  expect(closing).toBeGreaterThan(0);
  return moduleFrontmatterSchema.parse(parseYaml(lines.slice(1, closing).join("\n")));
};

describe("Starter catalogue", () => {
  it("ships the accepted first catalogue and six templates", () => {
    expect(starterCatalogue).toHaveLength(35);
    expect(starterTemplates).toHaveLength(6);
    expect(new Set(starterCatalogue.map((entry) => entry.id)).size).toBe(35);
    expect(new Set(starterTemplates.map((template) => template.id)).size).toBe(6);
    expect(starterCatalogueMetadata.version).toBe("0.1.0");
    expect(starterCatalogueMetadata.license).toBe("CC BY 4.0");

    const titles = starterCatalogue.map((entry) => entry.title);
    expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right)));
  });

  it("renders every entry as valid Rack source with attached provenance", () => {
    for (const entry of starterCatalogue) {
      const parsed = parseSource(entry.source);
      expect(parsed.harness.id).toBe(entry.id);
      expect(parsed.harness.source.origin).toBe("rack-starter");
      expect(parsed.harness.source.license).toBe("CC BY 4.0");
      expect(entry.digest).toBe(starterContentDigest(entry.source));
      if (entry.attribution) {
        expect(entry.source).toContain(`# Starter attribution: ${entry.attribution.name}`);
        if (entry.attribution.url) expect(entry.source).toContain(`# Source: ${entry.attribution.url}`);
      }
    }
  });

  it("keeps templates limited to real catalogue entries", () => {
    const ids = new Set(starterCatalogue.map((entry) => entry.id));
    for (const template of starterTemplates) {
      expect(template.moduleIds.length).toBeGreaterThan(0);
      expect(new Set(template.moduleIds).size).toBe(template.moduleIds.length);
      for (const moduleId of template.moduleIds) expect(ids.has(moduleId)).toBe(true);
    }
  });

  it("searches deterministically across route, type, tag and text", () => {
    const coding = searchStarterCatalogue({ route: "coding" });
    expect(coding.length).toBeGreaterThan(0);
    expect(coding.every((entry) => entry.routes.includes("coding"))).toBe(true);

    const researchMethods = searchStarterCatalogue({
      route: "research",
      type: "method",
    });
    expect(researchMethods.map((entry) => entry.id)).toContain(
      "@rack-starter/method.source-assessment",
    );

    expect(searchStarterCatalogue({ query: "client email" })[0]?.id).toBe(
      "@rack-starter/task.client-email",
    );
    expect(searchStarterCatalogue({ tag: "security" })[0]?.id).toBe(
      "@rack-starter/guardrail.security",
    );
  });

  it("normalises line endings for safe identical-content detection", () => {
    const entry = getStarterEntry("@rack-starter/voice.plain-language");
    expect(entry).toBeDefined();
    expect(starterSourcesEqual(entry!.source, entry!.source.replace(/\n/g, "\r\n"))).toBe(
      true,
    );
    expect(starterSourcesEqual(entry!.source, `${entry!.source}\nchanged`)).toBe(false);
  });
});
