import type { ProjectSnapshot } from "@rack/core";
import {
  buildWritingRackFiles,
  type WritingDraft,
} from "../projectFiles.js";
import {
  GuidedCreationRoute,
  type GuidedCreationConfig,
} from "./GuidedCreationRoute.js";

const initialDraft: WritingDraft = {
  rackTitle: "My writing Rack",
  authorName: "",
  organisationContext: "",
  audienceContext: "",
  voiceGuidance: "Use clear, warm British English. Be direct without becoming abrupt.",
  avoidTerms: "",
  taskTitle: "Draft a project update",
  taskPurpose:
    "Turn notes into a concise update that explains what changed, why it matters and what happens next.",
};

const config: GuidedCreationConfig<WritingDraft> = {
  routeId: "writing-route",
  routeName: "Writing and communications",
  questionTitle: "Make a useful first Rack",
  questionIntro:
    "This local guide creates a small, editable starting point. It does not use an AI model or send anything away.",
  reviewIntro:
    "Nothing has been written yet. Check what Rack has inferred from your answers before choosing a folder.",
  titleKey: "rackTitle",
  setUpName: "Writing and communications",
  initialDraft,
  requiredKeys: [
    "rackTitle",
    "organisationContext",
    "audienceContext",
    "voiceGuidance",
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
      label: "What should it understand about your work?",
      rows: 5,
      placeholder:
        "Describe the organisation, project or setting in ordinary language.",
    },
    {
      key: "audienceContext",
      label: "Who is the writing normally for?",
      rows: 4,
      placeholder: "What do these readers know, need and care about?",
    },
    {
      key: "voiceGuidance",
      label: "How should it sound?",
      rows: 4,
    },
    {
      key: "avoidTerms",
      label: "Words or phrases to avoid",
      rows: 3,
      placeholder: "Separate terms with commas or new lines. Optional.",
      optional: true,
    },
    {
      key: "taskTitle",
      label: "First repeatable task",
      kind: "input",
      wide: false,
    },
    {
      key: "taskPurpose",
      label: "What should a good result achieve?",
      rows: 4,
    },
  ],
  buildProposal: buildWritingRackFiles,
  proposalSummary: (proposal) =>
    `${proposal.files.length} local source files will be proposed, including one Set-up and evaluation configuration.`,
  reviewCards: (draft) => [
    {
      eyebrow: "Context",
      title: "Organisation and audience",
      paragraphs: [draft.organisationContext, draft.audienceContext],
    },
    {
      eyebrow: "Voice and language",
      title: "How it should sound",
      paragraphs: [
        draft.voiceGuidance,
        draft.avoidTerms.trim()
          ? `Avoid: ${draft.avoidTerms}`
          : "No specific avoided terms yet.",
      ],
    },
    {
      eyebrow: "Boundary",
      title: "Evidence honesty",
      paragraphs: [
        "Do not invent sources, quotations, evidence or certainty. Separate evidence, interpretation and recommendation.",
      ],
    },
    {
      eyebrow: "Repeatable task",
      title: draft.taskTitle,
      paragraphs: [draft.taskPurpose],
    },
  ],
};

type WritingRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

export function WritingRoute(props: WritingRouteProps) {
  return <GuidedCreationRoute config={config} {...props} />;
}
