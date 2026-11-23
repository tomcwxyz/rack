import { describe, expect, it } from "vitest";
import { starterTemplates } from "@rack/starter";
import { firstRunApproaches } from "./firstRun.js";
import { preparedFirstRun } from "./preparedFirstRun.js";

describe("desktop starter selection", () => {
  it.each(starterTemplates.map(pack => [pack.id, pack.route] as const))("includes real practices from %s", (id, route) => {
    const { proposal, instructions } = preparedFirstRun(route, "A pilot task", firstRunApproaches[route], id);
    const basic = preparedFirstRun(route, "A pilot task", firstRunApproaches[route], null);
    const pack = starterTemplates.find(item => item.id === id);
    expect(instructions).not.toBe(basic.instructions);
    expect(proposal.files.filter(file => file.path.startsWith("modules/starter/")).length).toBeGreaterThan(0);
    for (const moduleId of pack?.moduleIds || []) {
      expect(proposal.files.some(file => file.content.includes(moduleId))).toBe(true);
    }
  });
  it("rejects a pack from another route", () => {
    expect(() => preparedFirstRun("writing", "A report", firstRunApproaches.writing, "honey-lean-coding")).toThrow();
  });
});
