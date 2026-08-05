import { describe, expect, it } from "vitest";
import { parseProjectSnapshot } from "@rack/core";
import { buildWritingRackFiles } from "./projectFiles.js";

const draft = {
  rackTitle: "Example Writing Rack",
  authorName: "Example Author",
  organisationContext: "We support small social purpose organisations.",
  audienceContext: "Readers are busy programme leads who need a clear decision.",
  voiceGuidance: "Use plain British English and make the important point early.",
  avoidTerms: "stakeholder, leverage",
  taskTitle: "Draft a project update",
  taskPurpose: "Explain what changed, why it matters and what happens next.",
};

describe("buildWritingRackFiles", () => {
  it("creates a valid local Rack proposal", () => {
    const proposal = buildWritingRackFiles(draft);
    const find = (path: string) => {
      const file = proposal.files.find((candidate) => candidate.path === path);
      if (!file) throw new Error(`Missing ${path}`);
      return file;
    };

    const project = parseProjectSnapshot({
      root: `/tmp/${proposal.folderName}`,
      manifest: find("rack.yaml"),
      modules: proposal.files.filter((file) => file.path.startsWith("modules/")),
      profiles: proposal.files.filter((file) => file.path.startsWith("profiles/")),
    });

    expect(proposal.folderName).toBe("example-writing-rack");
    expect(project.diagnostics).toEqual([]);
    expect(project.modules).toHaveLength(5);
    expect(project.profiles[0]?.id).toBe("writing");
  });
});
