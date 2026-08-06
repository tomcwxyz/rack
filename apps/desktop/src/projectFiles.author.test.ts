import { describe, expect, it } from "vitest";
import { parseProjectSnapshot, type ProjectSnapshot } from "@rack/core";
import {
  buildCodingRackFiles,
  buildResearchRackFiles,
  buildWritingRackFiles,
  type RackProposal,
} from "./projectFiles.js";

const snapshotFor = (proposal: RackProposal): ProjectSnapshot => {
  const manifest = proposal.files.find((file) => file.path === "rack.yaml");
  if (!manifest) throw new Error("Proposal does not contain rack.yaml.");

  return {
    root: `/tmp/${proposal.folderName}`,
    manifest,
    modules: proposal.files.filter(
      (file) => file.path.startsWith("modules/") && file.path.endsWith(".md"),
    ),
    profiles: proposal.files.filter(
      (file) => file.path.startsWith("profiles/") && file.path.endsWith(".yaml"),
    ),
  };
};

const expectFallbackAuthor = (proposal: RackProposal) => {
  const project = parseProjectSnapshot(snapshotFor(proposal));
  expect(project.diagnostics).toEqual([]);
  expect(project.manifest?.author.name).toBe("Rack author");
};

describe("guided creation author fallback", () => {
  it("uses the fallback after trimming whitespace-only optional names", () => {
    expectFallbackAuthor(
      buildWritingRackFiles({
        rackTitle: "Writing",
        authorName: "   ",
        organisationContext: "Organisation context.",
        audienceContext: "Audience context.",
        voiceGuidance: "Write plainly.",
        avoidTerms: "",
        taskTitle: "Draft an update",
        taskPurpose: "Produce a useful update.",
      }),
    );

    expectFallbackAuthor(
      buildResearchRackFiles({
        rackTitle: "Research",
        authorName: "\n\t",
        organisationContext: "Decision context.",
        researchQuestion: "What should we learn?",
        evidenceContext: "Use the supplied evidence.",
        methodGuidance: "Assess and synthesise the evidence.",
        taskTitle: "Investigate a question",
        taskPurpose: "Produce a grounded synthesis.",
      }),
    );

    expectFallbackAuthor(
      buildCodingRackFiles({
        rackTitle: "Coding",
        authorName: "  ",
        projectContext: "An existing application.",
        technologyContext: "TypeScript and Tauri.",
        codingPrinciples: "Inspect before changing.",
        safetyBoundaries: "Protect private data and existing behaviour.",
        taskTitle: "Implement a feature",
        taskPurpose: "Make a small verified change.",
      }),
    );
  });
});
