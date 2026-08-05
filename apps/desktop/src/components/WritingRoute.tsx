import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot } from "@rack/core";
import {
  buildWritingRackFiles,
  type WritingDraft,
} from "../projectFiles.js";

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

type WritingRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

export function WritingRoute({ onCancel, onCreated }: WritingRouteProps) {
  const [draft, setDraft] = useState<WritingDraft>(initialDraft);
  const [step, setStep] = useState<"questions" | "review">("questions");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposal = useMemo(() => buildWritingRackFiles(draft), [draft]);
  const requiredComplete = [
    draft.rackTitle,
    draft.organisationContext,
    draft.audienceContext,
    draft.voiceGuidance,
    draft.taskTitle,
    draft.taskPurpose,
  ].every((value) => value.trim().length > 0);

  const update = <Key extends keyof WritingDraft,>(
    key: Key,
    value: WritingDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

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

  return (
    <section className="route-shell" aria-labelledby="writing-route-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Writing and communications</p>
          <h1 id="writing-route-title">
            {step === "questions" ? "Make a useful first Rack" : "Review the proposed Rack"}
          </h1>
          <p className="lede">
            {step === "questions"
              ? "This local guide creates a small, editable starting point. It does not use an AI model or send anything away."
              : "Nothing has been written yet. Check what Rack has inferred from your answers before choosing a folder."}
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={onCancel}>
          Leave this guide
        </button>
      </header>

      {error ? (
        <div className="notice notice--error" role="alert">
          <strong>Rack was not created.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {step === "questions" ? (
        <form
          className="route-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (requiredComplete) setStep("review");
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Name this Rack</span>
              <input
                value={draft.rackTitle}
                onChange={(event) => update("rackTitle", event.target.value)}
                required
              />
              <small>The folder will be named {proposal.folderName}.</small>
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

            <label className="field field--wide">
              <span>How should it sound?</span>
              <textarea
                rows={4}
                value={draft.voiceGuidance}
                onChange={(event) => update("voiceGuidance", event.target.value)}
                required
              />
            </label>

            <label className="field field--wide">
              <span>Words or phrases to avoid</span>
              <textarea
                rows={3}
                value={draft.avoidTerms}
                onChange={(event) => update("avoidTerms", event.target.value)}
                placeholder="Separate terms with commas or new lines. Optional."
              />
            </label>

            <label className="field">
              <span>First repeatable task</span>
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
            <span>Six source files, one Set-up and local evaluation configuration will be proposed.</span>
            <button
              className="primary-action"
              type="submit"
              disabled={!requiredComplete}
            >
              Review the proposal
            </button>
          </div>
        </form>
      ) : (
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
              <p className="eyebrow">Voice and language</p>
              <h2>How it should sound</h2>
              <p>{draft.voiceGuidance}</p>
              <p className="muted-copy">
                {draft.avoidTerms.trim()
                  ? `Avoid: ${draft.avoidTerms}`
                  : "No specific avoided terms yet."}
              </p>
            </article>
            <article className="proposal-card">
              <p className="eyebrow">Boundary</p>
              <h2>Evidence honesty</h2>
              <p>
                Do not invent sources, quotations, evidence or certainty. Separate evidence, interpretation and recommendation.
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
              onClick={() => setStep("questions")}
            >
              Edit the answers
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={createRack}
              disabled={saving}
            >
              {saving ? "Creating…" : "Choose a folder and create Rack"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
