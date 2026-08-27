import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot } from "@rack/core";
import {
  buildCodingRackFiles,
  type CodingDraft,
  type CodingPracticeSelections,
} from "../projectFiles.js";
import {
  CreationProgress,
  PracticeProposition,
  practiceChoiceLabel,
  type CreationStep,
  type PracticeChoice,
} from "./PracticeProposition.js";
import "../proposition-creation.css";

type CodingRouteProps = {
  onCancel: () => void;
  onCreated: (snapshot: ProjectSnapshot) => void;
};

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

export function CodingRoute({ onCancel, onCreated }: CodingRouteProps) {
  const [draft, setDraft] = useState<CodingDraft>(initialDraft);
  const [step, setStep] = useState<CreationStep>("questions");
  const [craftChoice, setCraftChoice] = useState<PracticeChoice>(null);
  const [safetyChoice, setSafetyChoice] = useState<PracticeChoice>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof CodingDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const questionsComplete = [
    draft.rackTitle,
    draft.projectContext,
    draft.technologyContext,
    draft.taskTitle,
    draft.taskPurpose,
  ].every((value) => value.trim().length > 0);

  const practiceComplete =
    craftChoice !== null &&
    safetyChoice !== null &&
    (craftChoice !== "changed" || draft.codingPrinciples.trim().length > 0) &&
    (safetyChoice !== "changed" || draft.safetyBoundaries.trim().length > 0);

  const practice: CodingPracticeSelections = {
    craft: craftChoice ?? "right",
    safety: safetyChoice ?? "right",
  };

  const proposal = useMemo(
    () => buildCodingRackFiles(draft, practice),
    [draft, practice.craft, practice.safety],
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
      title: "Tell Rack about the system it must not guess at",
      intro:
        "Start with the repository, product and technical constraints. Rack will propose implementation and safety practice next.",
    },
    practice: {
      title: "How should a coding agent make changes here?",
      intro:
        "Treat these as starting propositions. Keep them, rewrite them or leave them out before Rack writes the source.",
    },
    review: {
      title: "Review the proposed Rack",
      intro:
        "Check the project context, the implementation practice you kept or changed, and anything you chose to omit.",
    },
  }[step];

  return (
    <section className="route-shell" aria-labelledby="coding-route-title">
      <header className="route-header">
        <div>
          <p className="eyebrow">Coding and technical work</p>
          <h1 id="coding-route-title">{header.title}</h1>
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
              <span>What repository, product or system should it understand?</span>
              <textarea
                rows={5}
                value={draft.projectContext}
                onChange={(event) => update("projectContext", event.target.value)}
                placeholder="Describe users, important behaviour, architecture and the kinds of changes normally made."
                required
              />
            </label>

            <label className="field field--wide">
              <span>What stack and constraints should it respect?</span>
              <textarea
                rows={5}
                value={draft.technologyContext}
                onChange={(event) =>
                  update("technologyContext", event.target.value)
                }
                placeholder="Languages, frameworks, platforms, conventions, deployment or compatibility constraints."
                required
              />
            </label>

            <label className="field">
              <span>A repeatable technical task</span>
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
            <span>Project facts first. Implementation practice comes next.</span>
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
            id="coding-craft-proposition"
            eyebrow="Implementation practice"
            title="Inspect first, then make the smallest coherent change"
            summary={draft.codingPrinciples}
            detail="This becomes portable craft guidance across prompt, AGENTS.md, Claude Code, OpenCode and Codex destinations."
            choice={craftChoice}
            onChoice={setCraftChoice}
          >
            <label className="field field--wide">
              <span>How should it implement changes instead?</span>
              <textarea
                rows={5}
                value={draft.codingPrinciples}
                onChange={(event) =>
                  update("codingPrinciples", event.target.value)
                }
                required
              />
            </label>
          </PracticeProposition>

          <PracticeProposition
            id="coding-safety-proposition"
            eyebrow="Safety boundary"
            title="Protect secrets, compatibility and honest verification"
            summary={draft.safetyBoundaries}
            detail="The suggested safety module is required once present in this local Set-up, but you still decide whether to keep, rewrite or omit the Starter suggestion."
            choice={safetyChoice}
            onChoice={setSafetyChoice}
          >
            <label className="field field--wide">
              <span>What safety boundary would fit better?</span>
              <textarea
                rows={4}
                value={draft.safetyBoundaries}
                onChange={(event) =>
                  update("safetyBoundaries", event.target.value)
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
            <div><span>Set-up</span><strong>Coding and technical work</strong></div>
          </div>

          <div className="proposal-grid">
            <article className="proposal-card">
              <p className="eyebrow">Project context</p>
              <h2>The system and its constraints</h2>
              <p>{draft.projectContext}</p>
              <p>{draft.technologyContext}</p>
            </article>

            <article className="proposal-card">
              <p className="eyebrow">
                Implementation · {practiceChoiceLabel[practice.craft]}
              </p>
              <h2>How changes should be made</h2>
              <p>
                {practice.craft === "dropped"
                  ? "No implementation-practice instruction will be created."
                  : draft.codingPrinciples}
              </p>
            </article>

            <article className="proposal-card">
              <p className="eyebrow">
                Safety · {practiceChoiceLabel[practice.safety]}
              </p>
              <h2>What must be protected</h2>
              <p>
                {practice.safety === "dropped"
                  ? "No code-safety instruction will be created."
                  : draft.safetyBoundaries}
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
