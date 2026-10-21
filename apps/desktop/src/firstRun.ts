import {
  buildTarget,
  parseProjectSnapshot,
  type ProjectSnapshot,
} from "@rack/core";
import {
  buildWritingRackFiles,
  buildResearchRackFiles,
  buildCodingRackFiles,
  type RackProposal,
} from "./projectFiles.js";
import type { CreationRouteId } from "./components/RouteChooser.js";

export type FirstRunApproach = {
  title: string;
  guidance: string;
  boundary: string;
};

export const firstRunApproaches: Record<CreationRouteId, FirstRunApproach> = {
  writing: {
    title: "Clear, evidence-led writing",
    guidance:
      "Start with what the reader needs to understand or decide.\nUse plain language and explain unfamiliar terms.",
    boundary:
      "Separate evidence, interpretation and uncertainty.\nFlag missing information rather than inventing it.",
  },
  research: {
    title: "Research you can reason from",
    guidance:
      "Start with the question and the decision it will inform.\nCompare relevant sources and explain their strengths and limits.",
    boundary:
      "Separate findings from assumptions and recommendations.\nNever invent sources; make gaps and disagreement visible.",
  },
  coding: {
    title: "A careful, useful code change",
    guidance:
      "Understand the existing code before changing it.\nMake the smallest useful change, reusing existing components and libraries.",
    boundary:
      "Protect sensitive information and explain changes to existing behaviour.\nRun relevant checks and say honestly what remains untested.",
  },
};

export function firstRunProposal(
  route: CreationRouteId,
  task: string,
  approach: FirstRunApproach,
): RackProposal {
  if (
    !approach.title.trim() ||
    !approach.guidance.trim() ||
    !approach.boundary.trim()
  ) {
    throw new Error("Add an approach and its boundaries before continuing.");
  }
  const purpose =
    task.trim() ||
    {
      writing: "Help me write something useful.",
      research: "Help me investigate a question.",
      coding: "Help me build or improve software.",
    }[route];
  const common = {
    rackTitle: approach.title,
    authorName: "",
    taskTitle: "The work I want help with",
    taskPurpose: purpose,
  };
  if (route === "writing")
    return buildWritingRackFiles(
      {
        ...common,
        organisationContext:
          "Use the context supplied with the task. Ask about important missing context rather than assuming it.",
        audienceContext:
          "Use the audience specified for the task. Ask who the writing is for when that is unclear.",
        voiceGuidance: approach.guidance,
        avoidTerms: "",
        evidenceGuidance: approach.boundary,
      },
      { voice: "changed", evidence: "changed" },
    );
  if (route === "research")
    return buildResearchRackFiles(
      {
        ...common,
        organisationContext:
          "Use the purpose and context supplied for this task. Clarify important gaps.",
        researchQuestion: purpose,
        evidenceContext:
          "Use sources available for the task. State access limitations rather than implying unavailable sources were reviewed.",
        methodGuidance: approach.guidance,
        evidenceBoundary: approach.boundary,
      },
      { method: "changed", evidence: "changed" },
    );
  return buildCodingRackFiles(
    {
      ...common,
      projectContext:
        "Inspect the project supplied for this task. Ask for access or context when it is missing.",
      technologyContext:
        "Follow the repository's existing technology, conventions and documented constraints. Do not assume a stack.",
      codingPrinciples: approach.guidance,
      safetyBoundaries: approach.boundary,
    },
    { craft: "changed", safety: "changed" },
  );
}

export function firstRunSnapshot(proposal: RackProposal): ProjectSnapshot {
  const manifest = proposal.files.find((file) => file.path === "rack.yaml");
  if (!manifest) throw new Error("The approach could not be prepared.");
  return {
    root: "/rack-unsaved-preview",
    manifest,
    modules: proposal.files.filter(
      (file) => file.path.startsWith("modules/") && file.path.endsWith(".md"),
    ),
    profiles: proposal.files.filter(
      (file) =>
        file.path.startsWith("profiles/") && file.path.endsWith(".yaml"),
    ),
  };
}

export function firstRunInstructions(
  proposal: RackProposal,
  route: CreationRouteId,
) {
  const result = buildTarget(
    parseProjectSnapshot(firstRunSnapshot(proposal)),
    route,
    "prompt",
  );
  const errors = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errors.length || !result.artifacts.length)
    throw new Error(
      errors.map((error) => error.message).join(" ") ||
        "The instructions could not be prepared.",
    );
  return result.artifacts.map((artifact) => artifact.content).join("\n\n");
}
