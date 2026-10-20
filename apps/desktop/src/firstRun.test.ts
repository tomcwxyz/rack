import { describe, expect, it } from "vitest";
import { buildTarget, parseProjectSnapshot } from "@rack/core";
import {
  firstRunApproaches,
  firstRunInstructions,
  firstRunProposal,
  firstRunSnapshot,
} from "./firstRun.js";

describe("simple first use", () => {
  for (const route of ["writing", "research", "coding"] as const) {
    it(`${route} reaches usable instructions without personal context or a folder`, () => {
      const proposal = firstRunProposal(route, "", firstRunApproaches[route]);
      const project = parseProjectSnapshot(firstRunSnapshot(proposal));
      expect(project.diagnostics).toEqual([]);
      const instructions = firstRunInstructions(proposal, route);
      for (const line of [
        firstRunApproaches[route].guidance,
        firstRunApproaches[route].boundary,
      ].flatMap((text) => text.split("\n"))) {
        expect(instructions).toContain(line);
      }
      expect(instructions).not.toContain("/rack-unsaved-preview");
    });

    it(`${route} carries the actual task and edits through to saved source`, () => {
      const task =
        'A report for trustees: "what changed?"\nInclude uncertainty.';
      const approach = {
        ...firstRunApproaches[route],
        guidance: "Explain each decision using a concrete example.",
        boundary: "State what remains unknown.",
      };
      const proposal = firstRunProposal(route, task, approach);
      const preview = firstRunInstructions(proposal, route);
      expect(preview).toContain(
        "Explain each decision using a concrete example.",
      );
      expect(preview).toContain("State what remains unknown.");
      expect(preview).toContain("A report for trustees");
      expect(preview).not.toContain(
        firstRunApproaches[route].guidance.split("\n")[0],
      );
      const saved = {
        ...firstRunSnapshot(proposal),
        root: "/saved/my-approach",
      };
      expect(
        buildTarget(parseProjectSnapshot(saved), route, "prompt")
          .artifacts.map((file) => file.content)
          .join("\n\n"),
      ).toBe(preview);
    });
  }

  it("keeps all supported coding destinations available after optional saving", () => {
    const project = parseProjectSnapshot(
      firstRunSnapshot(
        firstRunProposal("coding", "Fix the menu", firstRunApproaches.coding),
      ),
    );
    for (const target of ["claude-code", "codex", "opencode"] as const) {
      const result = buildTarget(project, "coding", target);
      expect(
        result.diagnostics.filter((item) => item.severity === "error"),
      ).toEqual([]);
      expect(result.artifacts.length).toBeGreaterThan(0);
    }
  });

  it("rejects empty adjusted instructions instead of exporting incomplete practice", () => {
    expect(() =>
      firstRunProposal("writing", "", {
        ...firstRunApproaches.writing,
        guidance: " ",
      }),
    ).toThrow();
    expect(() =>
      firstRunProposal("coding", "", {
        ...firstRunApproaches.coding,
        boundary: " ",
      }),
    ).toThrow();
  });
});
