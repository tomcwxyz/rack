import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot } from "@rack/core";
import {
  buildResearchRackFiles,
  type ResearchDraft,
  type ResearchPracticeSelections,
} from "../projectFiles.js";
import {
  CreationProgress,
  PracticeProposition,
  practiceChoiceLabel,
  type CreationStep,
  type PracticeChoice,
} from "./PracticeProposition.js";
import { MaterialImport } from "./MaterialImport.js";
import "../proposition-creation.css";

type ResearchRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

const initialDraft: ResearchDraft = {
  rackTitle: "My research Rack",
  authorName: "",
  organisationContext: "",
  researchQuestion: "",
  evidenceContext:
    "Use the sources provided for the task. Note important gaps, conflicting evidence and practical limits on access or time.",
  methodGuidance:
    "Start by clarifying the decision or useful answer. Assess source relevance and quality before synthesising. Keep findings, interpretation and recommendations distinct.",
  evidenceBoundary:
    "Do not invent sources, quotations, findings or certainty. Make gaps and conflicting evidence visible, and keep evidence, inference and recommendation distinct.",
  taskTitle: "Investigate a question",
  taskPurpose:
    "Produce a proportionate, evidence-aware synthesis that answers the question, explains uncertainty and identifies sensible next steps.",
};

export function ResearchRoute({ onCancel, onCreated }: ResearchRouteProps) {
  const [draft, setDraft] = useState<ResearchDraft>(initialDraft);
  const [step, setStep] = useState<CreationStep>("questions");
  const [methodChoice, setMethodChoice] = useState<PracticeChoice>(null);
  const [evidenceChoice, setEvidenceChoice] = useState<PracticeChoice>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof ResearchDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const questionsComplete = [
    draft.rackTitle,
    draft.organisationContext,
    draft.researchQuestion,
    draft.evidenceContext,
    draft.taskTitle,
    draft.taskPurpose,
  ].every((value) => value.trim().length > 0);

  const practiceComplete =
    methodChoice !== null &&
    evidenceChoice !== null &&
    (methodChoice !== "changed" || draft.methodGuidance.trim().length > 0) &&
    (evidenceChoice !== "changed" || draft.evidenceBoundary.trim().length > 0);

  const practice: ResearchPracticeSelections = {
    method: methodChoice ?? "right",
    evidence: evidenceChoice ?? "right",
  };

  const proposal = useMemo(
    () => buildResearchRackFiles(draft, practice),
    [draft, practice.method, practice.evidence],
  );

  const createRack = async () => {
    setError(null);
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose where to create this Rack",
    });
    const parentPath = Array.isArray(selected) ? selected[0] : selected;
    if (!parentPath) return;

    setSaving(true);
    try {
      const snapshot = await invoke<ProjectSnapshot>("create_rack_project", {
        parentPath,
        folderName: proposal.folderName,
        files: proposal.files,
      });
      onCreated(snapshot);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not create the project.",
      );
    } finally {
      setSaving(false);
    }
  };

  const header = {
    questions: {
      title: "Start with the question and evidence you actually have",
      intro:
        "Give Rack the decision context, question and source expectations. It will propose a reusable research method and evidence boundary next.",
    },
    practice: {
      title: "How should AI investigate and handle uncertainty?",
      intro:
        "Keep these suggestions, change them or leave them out. They become ordinary editable Rack instructions only after you create the project.",
    },
    review: {
      title: "Review the proposed Rack",
      intro:
        "Check the research context, the practice you kept or changed, and anything you chose to leave out.",
    },
  }[step];

  return (
    <section className="route-shell" aria-labelledby="research-route-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Research and knowledge work</p>
          <h1 id="research-route-title">{header.title}</h1>
          <p className="lede">{header.intro}</p>
        </div>
        <button className="quiet-action" type="button" onClick={onCancel}>
          Choose another route
        </button>
      </header>

      <CreationProgress step={step} />

      {error ? (
        <div className="notice notice--error" role="alert">
          <strong>Rack was not created.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {step === "questions" ? (
        <form
          className="route-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (questionsComplete) setStep("practice");
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Name this Rack</span>
              <input
                value={draft.rackTitle}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  update("rackTitle", event.target.value)
                }
                required
              />
              <small>Rack will turn this into a safe local folder name.</small>
            </label>

            <label className="field">
              <span>Your name or team</span>
              <input
                value={draft.authorName}
                onChange={(event) => update("authorName", event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label className="field field--wide">
              <span>What organisation, project or decision should it understand?</span>
              <textarea
                rows={5}
                value={draft.organisationContext}
                onChange={(event) =>
                  update("organisationContext", event.target.value)
                }
                placeholder="Describe the setting, people involved and how the research will be used."
                required
              />
            </label>

            <div className="field field--wide material-import-slot">
              <span>Start from existing material</span>
              <small>
                Import a brief, strategy, report or other source locally and use
                the reviewed Markdown as decision and organisation context.
              </small>
              <MaterialImport
                buttonLabel="Import into decision context"
                hasExistingContent={draft.organisationContext.trim().length > 0}
                onUse={(material) =>
                  update("organisationContext", material.markdown)
                }
              />
            </div>

            <label className="field field--wide">
              <span>What question, decision or uncertainty should it investigate?</span>
              <textarea
                rows={4}
                value={draft.researchQuestion}
                onChange={(event) => update("researchQuestion", event.target.value)}
                placeholder="State the question and what a useful answer would enable."
                required
              />
            </label>

            <label className="field field--wide">
              <span>What sources, evidence or practical limits should it know about?</span>
              <textarea
                rows={4}
                value={draft.evidenceContext}
                onChange={(event) => update("evidenceContext", event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>A repeatable research task</span>
              <input
                value={draft.taskTitle}
                onChange={(event) => update("taskTitle", event.target.value)}
                required
              />
            </label>

            <label className="field field--wide">
              <span>What should a good result achieve?</span>
              <textarea
                rows={4}
                value={draft.taskPurpose}
                onChange={(event) => update("taskPurpose", event.target.value)}
                required
              />
            </label>
          </div>

          <div className="route-actions">
            <span>Question and evidence first. Reusable practice comes next.</span>
            <button
              className="primary-action"
              type="submit"
              disabled={!questionsComplete}
            >
              Review suggested practice
            </button>
          </div>
        </form>
      ) : null}

      {step === "practice" ? (
        <div className="practice-propositions">
          <PracticeProposition
            id="research-method-proposition"
            eyebrow="Research method"
            title="Clarify, assess, synthesise"
            summary={draft.methodGuidance}
            detail="This becomes the reusable method for framing the question, assessing sources, synthesising and making gaps visible."
            choice={methodChoice}
            onChoice={setMethodChoice}
          >
            <label className="field field--wide">
              <span>How should it investigate instead?</span>
              <textarea
                rows={5}
                value={draft.methodGuidance}
                onChange={(event) => update("methodGuidance", event.target.value)}
                required
              />
            </label>
          </PracticeProposition>

          <PracticeProposition
            id="research-evidence-proposition"
            eyebrow="Evidence boundary"
            title="Make uncertainty and gaps visible"
            summary={draft.evidenceBoundary}
            detail="The suggested boundary is required once included in this local Set-up, but it is still your choice whether to keep, change or omit it."
            choice={evidenceChoice}
            onChoice={setEvidenceChoice}
          >
            <label className="field field--wide">
              <span>What evidence boundary would fit better?</span>
              <textarea
                rows={4}
                value={draft.evidenceBoundary}
                onChange={(event) =>
                  update("evidenceBoundary", event.target.value)
                }
                required
              />
            </label>
          </PracticeProposition>

          <div className="route-actions">
            <button
              className="quiet-action"
              type="button"
              onClick={() => setStep("questions")}
            >
              Edit your context
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={!practiceComplete}
              onClick={() => setStep("review")}
            >
              Review this Rack
            </button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="proposal-review">
          <div className="proposal-summary">
            <div><span>Rack</span><strong>{draft.rackTitle}</strong></div>
            <div><span>Folder</span><code>{proposal.folderName}</code></div>
            <div><span>Set-up</span><strong>Research and knowledge work</strong></div>
          </div>

          <div className="proposal-grid">
            <article className="proposal-card">
              <p className="eyebrow">Question and context</p>
              <h2>What this research should serve</h2>
              <p>{draft.organisationContext}</p>
              <p>{draft.researchQuestion}</p>
              <p>{draft.evidenceContext}</p>
            </article>

            <article className="proposal-card">
              <p className="eyebrow">
                Method · {practiceChoiceLabel[practice.method]}
              </p>
              <h2>How it should investigate</h2>
              <p>
                {practice.method === "dropped"
                  ? "No reusable research-method instruction will be created."
                  : draft.methodGuidance}
              </p>
            </article>

            <article className="proposal-card">
              <p className="eyebrow">
                Evidence · {practiceChoiceLabel[practice.evidence]}
              </p>
              <h2>How it should handle uncertainty</h2>
              <p>
                {practice.evidence === "dropped"
                  ? "No evidence-boundary instruction will be created."
                  : draft.evidenceBoundary}
              </p>
            </article>

            <article className="proposal-card">
              <p className="eyebrow">Repeatable task</p>
              <h2>{draft.taskTitle}</h2>
              <p>{draft.taskPurpose}</p>
            </article>
          </div>

          <details className="file-plan">
            <summary>Show the files Rack will create</summary>
            <ul>
              {proposal.files.map((file) => (
                <li key={file.path}><code>{file.path}</code></li>
              ))}
            </ul>
          </details>

          <div className="route-actions">
            <button
              className="quiet-action"
              type="button"
              onClick={() => setStep("practice")}
            >
              Change the practice
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={() => void createRack()}
              disabled={saving}
            >
              {saving ? "Creating…" : "Choose a folder and create Rack"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
