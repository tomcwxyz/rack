import type { ProjectSnapshot } from "@rack/core";
import {
  buildResearchRackFiles,
  type ResearchDraft,
} from "../projectFiles.js";
import {
  GuidedCreationRoute,
  type GuidedCreationConfig,
} from "./GuidedCreationRoute.js";

const initialDraft: ResearchDraft = {
  rackTitle: "My research Rack",
  authorName: "",
  organisationContext: "",
  researchQuestion: "",
  evidenceContext:
    "Use the sources provided for the task. Note important gaps, conflicting evidence and practical limits on access or time.",
  methodGuidance:
    "Start by clarifying the decision or useful answer. Assess source relevance and quality before synthesising. Keep findings, interpretation and recommendations distinct.",
  taskTitle: "Investigate a question",
  taskPurpose:
    "Produce a proportionate, evidence-aware synthesis that answers the question, explains uncertainty and identifies sensible next steps.",
};

const config: GuidedCreationConfig<ResearchDraft> = {
  routeId: "research-route",
  routeName: "Research and knowledge work",
  questionTitle: "Create a careful research Rack",
  questionIntro:
    "Capture the question, evidence expectations and method you want to reuse. Everything stays local and remains editable source.",
  reviewIntro:
    "Nothing has been written yet. Review the proposed question, method, evidence boundaries and repeatable task before choosing a folder.",
  titleKey: "rackTitle",
  setUpName: "Research and knowledge work",
  initialDraft,
  requiredKeys: [
    "rackTitle",
    "organisationContext",
    "researchQuestion",
    "evidenceContext",
    "methodGuidance",
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
      key: "organisationContext",
      label: "What organisation, project or decision should it understand?",
      rows: 5,
      placeholder:
        "Describe the setting, people involved and how the research will be used.",
    },
    {
      key: "researchQuestion",
      label: "What question, decision or uncertainty should it investigate?",
      rows: 4,
      placeholder:
        "State the question in ordinary language and describe what a useful answer would enable.",
    },
    {
      key: "evidenceContext",
      label: "What evidence and source expectations should it follow?",
      rows: 4,
      placeholder:
        "Describe likely sources, evidence standards, access limits and known gaps.",
    },
    {
      key: "methodGuidance",
      label: "How should it approach the research?",
      rows: 5,
    },
    {
      key: "taskTitle",
      label: "First repeatable research task",
      kind: "input",
      wide: false,
    },
    {
      key: "taskPurpose",
      label: "What should a good result achieve?",
      rows: 4,
    },
  ],
  buildProposal: buildResearchRackFiles,
  proposalSummary: (proposal) =>
    `${proposal.files.length} local source files will be proposed, including one Research Set-up and evaluation configuration.`,
  reviewCards: (draft) => [
    {
      eyebrow: "Question and context",
      title: "What this research should serve",
      paragraphs: [draft.organisationContext, draft.researchQuestion],
    },
    {
      eyebrow: "Evidence",
      title: "Sources, quality and gaps",
      paragraphs: [draft.evidenceContext],
    },
    {
      eyebrow: "Method",
      title: "How it should investigate",
      paragraphs: [draft.methodGuidance],
    },
    {
      eyebrow: "Boundary and task",
      title: draft.taskTitle,
      paragraphs: [
        draft.taskPurpose,
        "Rack will add explicit rules against invented sources, hidden assumptions and false certainty.",
      ],
    },
  ],
};

type ResearchRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

export function ResearchRoute(props: ResearchRouteProps) {
  return <GuidedCreationRoute config={config} {...props} />;
}
