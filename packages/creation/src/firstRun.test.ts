import { describe, expect, it } from "vitest";
import { firstRunApproaches, firstRunProposal, firstRunInstructions } from "./firstRun.js";

describe("shared practice creator", () => {
  it.each(["writing", "research", "coding"] as const)("builds the same portable source and instructions for %s", route => {
    const proposal = firstRunProposal(route, "A real pilot task", firstRunApproaches[route]);
    expect(proposal.files.some(file => file.path === "rack.yaml")).toBe(true);
    expect(firstRunInstructions(proposal, route)).toContain("A real pilot task");
  });
});
