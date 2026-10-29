import { describe, expect, it } from "vitest";
import { buildRackTar } from "./archive.js";
import { firstRunApproaches, firstRunProposal, firstRunInstructions } from "../../../desktop/src/firstRun.js";

describe("portable Rack exports", () => {
  it("includes the exact canonical files for all three routes", () => {
    for (const route of ["writing", "research", "coding"] as const) {
      const proposal = firstRunProposal(route, "An example task", firstRunApproaches[route]);
      expect(firstRunInstructions(proposal, route).length).toBeGreaterThan(10);
      const tar = buildRackTar(proposal);
      const data = new TextDecoder().decode(tar);
      expect(data).toContain("rack.yaml");
      expect(data).toContain(proposal.files.find(f => f.path === "rack.yaml")!.content);
      expect(tar.byteLength % 512).toBe(0);
      expect(tar.slice(-1024).every(b => b === 0)).toBe(true);
    }
  });
  it("rejects directory traversal", () => {
    expect(() => buildRackTar({ folderName: "bad", files: [{ path: "../secret", content: "secret" }] })).toThrow("unsafe");
  });
});
