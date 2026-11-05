import { describe, expect, it } from "vitest";
import { firstRunApproaches } from "@rack/creation";
import { starterTemplates } from "@rack/starter";
import { buildStarterPractice } from "./starterPacks.js";

describe("real starter packs in the browser pilot", () => {
  it.each(starterTemplates.map(template => [template.id, template.route] as const))(
    "compiles and exports %s for %s",
    (id, route) => {
      const { proposal, instructions } = buildStarterPractice(route, "A realistic pilot task", firstRunApproaches[route], id);
      expect(proposal.files.some(file => file.path.startsWith("modules/starter/"))).toBe(true);
      expect(instructions).toContain("A realistic pilot task");
      expect(instructions.length).toBeGreaterThan(200);
      expect(proposal.files.some(file => file.path.startsWith("profiles/"))).toBe(true);
    },
  );
  it("keeps basic routes available", () => {
    const result = buildStarterPractice("writing", "A report", firstRunApproaches.writing, null);
    expect(result.instructions).toContain("A report");
  });
  it("rejects cross-route packs", () => {
    expect(() => buildStarterPractice("writing", "An email", firstRunApproaches.writing, "honey-lean-coding")).toThrow();
  });
});
