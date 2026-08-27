import { describe, expect, it } from "vitest";
import {
  buildTarget,
  parseProjectSnapshot,
  type DestinationId,
  type ProjectSnapshot,
} from "@rack/core";
import {
  buildCodingRackFiles,
  buildResearchRackFiles,
  buildWritingRackFiles,
  type CodingDraft,
  type WritingPracticeSelections,
  type RackProposal,
  type ResearchDraft,
  type WritingDraft,
} from "./projectFiles.js";

const toSnapshot = (proposal: RackProposal): ProjectSnapshot => {
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

const expectBuildsFor = (
  proposal: RackProposal,
  profileId: string,
  targets: DestinationId[],
) => {
  const project = parseProjectSnapshot(toSnapshot(proposal));
  expect(project.diagnostics).toEqual([]);

  for (const target of targets) {
    const result = buildTarget(project, profileId, target);
    expect(result.diagnostics, `${target} diagnostics`).toEqual([]);
    expect(result.artifacts.length, `${target} artifacts`).toBeGreaterThan(0);
    expect(result.compiled?.profile.id).toBe(profileId);
  }
};

const writingDraft: WritingDraft = {
  rackTitle: "Community writing",
  authorName: "Example team",
  organisationContext: "We work with neighbourhood organisations.",
  audienceContext: "Readers are busy practitioners and local partners.",
  voiceGuidance: "Use direct, warm British English.",
  avoidTerms: "leverage, low-hanging fruit",
  evidenceGuidance:
    "Do not invent evidence or certainty. Distinguish evidence from interpretation.",
  taskTitle: "Draft an update",
  taskPurpose: "Explain what changed, why it matters and what happens next.",
};

const researchDraft: ResearchDraft = {
  rackTitle: "Local evidence",
  authorName: "Example team",
  organisationContext:
    "We support a partnership deciding where to focus neighbourhood investment.",
  researchQuestion:
    "What evidence would help the partnership choose a useful first area of work?",
  evidenceContext:
    "Use supplied local data, interviews and published research. Note coverage and quality gaps.",
  methodGuidance:
    "Clarify the decision, assess each source, compare perspectives and keep findings separate from recommendations.",
  taskTitle: "Investigate a question",
  taskPurpose:
    "Produce a grounded synthesis with uncertainty, gaps and proportionate next steps.",
};

const codingDraft: CodingDraft = {
  rackTitle: "Product engineering",
  authorName: "Example team",
  projectContext:
    "This is an existing local-first desktop application. Preserve user-owned source files and current CLI behaviour.",
  technologyContext:
    "Use TypeScript, React and Tauri. Keep the shared compiler independent from desktop infrastructure.",
  codingPrinciples:
    "Inspect the existing implementation, use established libraries and add tests for changed behaviour.",
  safetyBoundaries:
    "Do not expose credentials or silently change compatibility. Report checks honestly.",
  taskTitle: "Implement a feature",
  taskPurpose:
    "Make the smallest coherent componentised change and leave the repository buildable.",
};

describe("guided Rack proposal builders", () => {
  it("builds deterministic Writing source that compiles", () => {
    const first = buildWritingRackFiles(writingDraft);
    const second = buildWritingRackFiles(writingDraft);

    expect(first).toEqual(second);
    expectBuildsFor(first, "writing", ["prompt"]);
  });

  it("makes proposition choices change the actual Writing source and Set-up", () => {
    const choices: WritingPracticeSelections = {
      voice: "changed",
      evidence: "dropped",
    };
    const proposal = buildWritingRackFiles(
      {
        ...writingDraft,
        voiceGuidance: "Use short, concrete sentences and avoid consultancy language.",
      },
      choices,
    );
    const project = parseProjectSnapshot(toSnapshot(proposal));

    expect(project.diagnostics).toEqual([]);
    expect(project.modules.map((module) => module.harness.id)).not.toContain(
      "guardrail.evidence",
    );
    expect(project.profiles[0]?.include).not.toContain("guardrail.evidence");
    expect(
      proposal.files.find((file) => file.path === "modules/guardrails/evidence.md"),
    ).toBeUndefined();
    expect(
      proposal.files.find((file) => file.path === "modules/voice/tone.md")?.content,
    ).toContain("Use short, concrete sentences and avoid consultancy language.");

    const build = buildTarget(project, "writing", "prompt");
    expect(build.diagnostics).toEqual([]);
    expect(build.artifacts[0]?.content).toContain(
      "Use short, concrete sentences and avoid consultancy language.",
    );
    expect(build.artifacts[0]?.content).not.toContain(
      "Do not invent sources, quotations, evidence or certainty.",
    );
  });

  it("supports changing the evidence proposition rather than only accepting the default", () => {
    const proposal = buildWritingRackFiles(
      {
        ...writingDraft,
        evidenceGuidance:
          "Flag uncertainty plainly and never turn an assumption into a fact.",
      },
      { voice: "right", evidence: "changed" },
    );
    const project = parseProjectSnapshot(toSnapshot(proposal));
    const build = buildTarget(project, "writing", "prompt");

    expect(build.diagnostics).toEqual([]);
    expect(build.artifacts[0]?.content).toContain(
      "Flag uncertainty plainly and never turn an assumption into a fact.",
    );
  });

  it("builds deterministic Research source for portable destinations", () => {
    const first = buildResearchRackFiles(researchDraft);
    const second = buildResearchRackFiles(researchDraft);

    expect(first).toEqual(second);
    expectBuildsFor(first, "research", ["prompt", "agents-md"]);
  });

  it("builds deterministic Coding source for every supported coding host", () => {
    const first = buildCodingRackFiles(codingDraft);
    const second = buildCodingRackFiles(codingDraft);

    expect(first).toEqual(second);
    expectBuildsFor(first, "coding", [
      "prompt",
      "agents-md",
      "claude-code",
      "opencode",
      "codex",
    ]);
  });
});
