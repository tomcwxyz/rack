import type { ProjectSnapshot } from "@rack/core";
import {
  buildCodingRackFiles,
  type CodingDraft,
} from "../projectFiles.js";
import {
  GuidedCreationRoute,
  type GuidedCreationConfig,
} from "./GuidedCreationRoute.js";

const initialDraft: CodingDraft = {
  rackTitle: "My coding Rack",
  authorName: "",
  projectContext: "",
  technologyContext: "",
  codingPrinciples:
    "Understand the existing implementation before changing it. Reuse sound architecture and well-maintained libraries. Keep domain logic separate from interfaces and infrastructure. Add or update tests for changed behaviour.",
  safetyBoundaries:
    "Prefer the smallest coherent change. Make security, compatibility and migration consequences explicit before implementation. Leave the repository in a buildable state.",
  taskTitle: "Implement a feature",
  taskPurpose:
    "Implement an agreed feature or fix using the existing architecture where it is sound, with clear verification and no hidden changes to behaviour.",
};

const config: GuidedCreationConfig<CodingDraft> = {
  routeId: "coding-route",
  routeName: "Coding and technical work",
  questionTitle: "Create a practical coding Rack",
  questionIntro:
    "Capture the project context, technical constraints and implementation practice you want coding agents to carry across hosts. Nothing connects to a repository or tool automatically.",
  reviewIntro:
    "Nothing has been written yet. Review the proposed project context, implementation practice, safety boundaries and repeatable task before choosing a folder.",
  titleKey: "rackTitle",
  setUpName: "Coding and technical work",
  initialDraft,
  requiredKeys: [
    "rackTitle",
    "projectContext",
    "technologyContext",
    "codingPrinciples",
    "safetyBoundaries",
    "taskTitle",
    "taskPurpose",
  ],
  fields: [
    {
      key: "rackTitle",
      label: "Name this Rack",
      kind: "input",
      wide: false,
      help: "Rack will turn this into a safe local folder name.",
    },
    {
      key: "authorName",
      label: "Your name or team",
      kind: "input",
      wide: false,
      placeholder: "Optional",
      optional: true,
    },
    {
      key: "projectContext",
      label: "What repository, product or system should it understand?",
      rows: 5,
      placeholder:
        "Describe the users, important behaviour, architecture and the kinds of changes normally made.",
    },
    {
      key: "technologyContext",
      label: "What stack and constraints should it respect?",
      rows: 5,
      placeholder:
        "Include languages, frameworks, supported platforms, conventions, deployment or compatibility constraints.",
    },
    {
      key: "codingPrinciples",
      label: "How should it design and implement changes?",
      rows: 5,
    },
    {
      key: "safetyBoundaries",
      label: "What safety and compatibility boundaries matter?",
      rows: 4,
    },
    {
      key: "taskTitle",
      label: "First repeatable technical task",
      kind: "input",
      wide: false,
    },
    {
      key: "taskPurpose",
      label: "What should a good result achieve?",
      rows: 4,
    },
  ],
  buildProposal: buildCodingRackFiles,
  proposalSummary: (proposal) =>
    `${proposal.files.length} local source files will be proposed, including one Coding Set-up and evaluation configuration.`,
  reviewCards: (draft) => [
    {
      eyebrow: "Project context",
      title: "The system and its constraints",
      paragraphs: [draft.projectContext, draft.technologyContext],
    },
    {
      eyebrow: "Implementation practice",
      title: "How changes should be made",
      paragraphs: [draft.codingPrinciples],
    },
    {
      eyebrow: "Safety",
      title: "What must be protected",
      paragraphs: [
        draft.safetyBoundaries,
        "Rack will add explicit rules for sensitive data, compatibility and honest verification.",
      ],
    },
    {
      eyebrow: "Repeatable task",
      title: draft.taskTitle,
      paragraphs: [draft.taskPurpose],
    },
  ],
};

type CodingRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

export function CodingRoute(props: CodingRouteProps) {
  return <GuidedCreationRoute config={config} {...props} />;
}
