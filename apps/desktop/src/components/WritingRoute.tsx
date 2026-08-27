import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot } from "@rack/core";
import {
  buildWritingRackFiles,
  type WritingDraft,
  type WritingPracticeSelections,
} from "../projectFiles.js";
import {
  CreationProgress,
  PracticeProposition,
  practiceChoiceLabel,
  type CreationStep,
  type PracticeChoice,
} from "./PracticeProposition.js";
import "../proposition-creation.css";

type WritingRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

const initialDraft: WritingDraft = {
  rackTitle: "My writing Rack",
  authorName: "",
  organisationContext: "",
  audienceContext: "",
  voiceGuidance:
    "Use clear, warm British English. Be direct without becoming abrupt.",
  avoidTerms: "",
  evidenceGuidance:
    "Do not invent sources, quotations, evidence or certainty. Distinguish evidence, interpretation and recommendation.",
  taskTitle: "Draft a project update",
  taskPurpose:
    "Turn notes into a concise update that explains what changed, why it matters and what happens next.",
};

export function WritingRoute({ onCancel, onCreated }: WritingRouteProps) {
  const [draft, setDraft] = useState<WritingDraft>(initialDraft);
  const [step, setStep] = useState<CreationStep>("questions");
  const [voiceChoice, setVoiceChoice] = useState<PracticeChoice>(null);
  const [evidenceChoice, setEvidenceChoice] = useState<PracticeChoice>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (
    key: keyof WritingDraft,
    value: string,
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const questionsComplete = [
    draft.rackTitle,
    draft.organisationContext,
    draft.audienceContext,
    draft.taskTitle,
    draft.taskPurpose,
  ].every((value) => value.trim().length > 0);

  const practiceComplete =
    voiceChoice !== null &&
    evidenceChoice !== null &&
    (voiceChoice !== "changed" || draft.voiceGuidance.trim().length > 0) &&
    (evidenceChoice !== "changed" || draft.evidenceGuidance.trim().length > 0);

  const practice: WritingPracticeSelections = {
    voice: voiceChoice ?? "right",
    evidence: evidenceChoice ?? "right",
  };

  const proposal = useMemo(
    () => buildWritingRackFiles(draft, practice),
    [draft, practice.voice, practice.evidence],
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
      title: "Tell Rack what it cannot reasonably guess",
      intro:
        "Start with the context that is genuinely yours. Rack will suggest common working practice next, so you do not have to write a policy from scratch.",
    },
    practice: {
      title: "Does this sound like how you want AI to work?",
      intro:
        "These are suggestions, not hidden defaults. Keep them, change them or leave them out before Rack writes anything.",
    },
    review: {
      title: "Review the proposed Rack",
      intro:
        "Nothing has been written yet. Check the context, the practice you kept or changed, and what you chose to leave out.",
    },
  }[step];

  return (
    <section className="route-shell" aria-labelledby="writing-route-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Writing and communications</p>
          <h1 id="writing-route-title">{header.title}</h1>
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
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  update("authorName", event.target.value)
                }
                placeholder="Optional"
              />
            </label>

            <label className="field field--wide">
              <span>What should it understand about your work?</span>
              <textarea
                rows={5}
                value={draft.organisationContext}
                onChange={(event) =>
                  update("organisationContext", event.target.value)
                }
                placeholder="Describe the organisation, project or setting in ordinary language."
                required
              />
            </label>

            <label className="field field--wide">
              <span>Who is the writing normally for?</span>
              <textarea
                rows={4}
                value={draft.audienceContext}
                onChange={(event) => update("audienceContext", event.target.value)}
                placeholder="What do these readers know, need and care about?"
                required
              />
            </label>

            <label className="field">
              <span>A repeatable writing task</span>
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
            <span>
              Six short prompts first. Suggested practice comes next.
            </span>
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
            id="voice-proposition"
            eyebrow="Voice and language"
            title="Clear, warm and direct"
            summary={draft.voiceGuidance}
            detail="This becomes an editable voice instruction that is reused whenever the Writing Set-up is built."
            choice={voiceChoice}
            onChoice={setVoiceChoice}
          >
            <label className="field field--wide">
              <span>How should it sound instead?</span>
              <textarea
                rows={4}
                value={draft.voiceGuidance}
                onChange={(event) => update("voiceGuidance", event.target.value)}
                required
              />
            </label>
            <label className="field field--wide">
              <span>Any words or phrases to avoid?</span>
              <textarea
                rows={3}
                value={draft.avoidTerms}
                onChange={(event) => update("avoidTerms", event.target.value)}
                placeholder="Optional · commas or new lines"
              />
            </label>
          </PracticeProposition>

          <PracticeProposition
            id="evidence-proposition"
            eyebrow="Evidence boundary"
            title="Do not make weak information look stronger"
            summary={draft.evidenceGuidance}
            detail="The suggested version is a required instruction inside this Set-up, but this is your local Rack: you can change it or leave it out."
            choice={evidenceChoice}
            onChoice={setEvidenceChoice}
          >
            <label className="field field--wide">
              <span>What boundary would fit better?</span>
              <textarea
                rows={4}
                value={draft.evidenceGuidance}
                onChange={(event) =>
                  update("evidenceGuidance", event.target.value)
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
            <div>
              <span>Rack</span>
              <strong>{draft.rackTitle}</strong>
            </div>
            <div>
              <span>Folder</span>
              <code>{proposal.folderName}</code>
            </div>
            <div>
              <span>Set-up</span>
              <strong>Writing and communications</strong>
            </div>
          </div>

          <div className="proposal-grid">
            <article className="proposal-card">
              <p className="eyebrow">Context</p>
              <h2>Organisation and audience</h2>
              <p>{draft.organisationContext}</p>
              <p>{draft.audienceContext}</p>
            </article>

            <article className="proposal-card">
              <p className="eyebrow">Voice · {practiceChoiceLabel[practice.voice]}</p>
              <h2>How it should sound</h2>
              {practice.voice === "dropped" ? (
                <p>No voice instruction will be created.</p>
              ) : (
                <>
                  <p>{draft.voiceGuidance}</p>
                  {draft.avoidTerms.trim() ? <p>Avoid: {draft.avoidTerms}</p> : null}
                </>
              )}
            </article>

            <article className="proposal-card">
              <p className="eyebrow">
                Evidence · {practiceChoiceLabel[practice.evidence]}
              </p>
              <h2>Evidence honesty</h2>
              <p>
                {practice.evidence === "dropped"
                  ? "No evidence-boundary instruction will be created."
                  : draft.evidenceGuidance}
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
                <li key={file.path}>
                  <code>{file.path}</code>
                </li>
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
