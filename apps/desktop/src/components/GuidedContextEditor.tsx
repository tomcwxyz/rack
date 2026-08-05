import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  patchContextModuleSource,
  readContextModuleDraft,
  type ContextModuleDraft,
  type ProjectSnapshot,
  type RackProject,
  type SourceDiffLine,
} from "@rack/core";

type ContextModule = Extract<
  RackProject["modules"][number],
  { type: "context" }
>;

type GuidedContextEditorProps = {
  projectRoot: string;
  module: ContextModule;
  onClose: () => void;
  onAdvanced: () => void;
  onSaved: (snapshot: ProjectSnapshot) => void;
};

const changeCount = (diff: SourceDiffLine[]): number =>
  diff.filter((line) => line.kind !== "same").length;

export function GuidedContextEditor({
  projectRoot,
  module,
  onClose,
  onAdvanced,
  onSaved,
}: GuidedContextEditorProps) {
  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState<ContextModuleDraft | null>(null);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void invoke<string>("read_project_file", {
      root: projectRoot,
      relativePath: module.path,
    })
      .then((content) => {
        if (!active) return;
        setOriginal(content);
        setDraft(readContextModuleDraft(content));
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Rack could not prepare this context instruction for guided editing.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [module.path, projectRoot]);

  const proposal = useMemo(() => {
    if (!draft || !original) return null;
    try {
      return patchContextModuleSource(original, draft);
    } catch (reason) {
      return reason instanceof Error ? reason : new Error("The change is invalid.");
    }
  }, [draft, original]);

  const proposalError = proposal instanceof Error ? proposal.message : null;
  const canReview =
    draft !== null &&
    draft.title.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    proposal !== null &&
    !(proposal instanceof Error) &&
    proposal.content !== original;

  const update = <Key extends keyof ContextModuleDraft>(
    key: Key,
    value: ContextModuleDraft[Key],
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!proposal || proposal instanceof Error) return;
    setSaving(true);
    setError(null);
    try {
      const snapshot = await invoke<ProjectSnapshot>("write_project_file", {
        root: projectRoot,
        relativePath: module.path,
        content: proposal.content,
        expectedContent: original,
      });
      onSaved(snapshot);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not save this guided change.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-backdrop" role="presentation">
      <section
        className="guided-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-context-title"
      >
        <header className="source-editor-header">
          <div>
            <p className="eyebrow">Guided context editor</p>
            <h2 id="guided-context-title">
              {step === "edit" ? module.title : "Review the source change"}
            </h2>
            <code>{module.path}</code>
          </div>
          <button className="quiet-action" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="editor-explanation">
          Rack changes only the supported context fields and keeps the remaining frontmatter in place. You will see the exact source change before it is written.
        </p>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>The context was not saved.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="editor-loading">Reading local source…</div>
        ) : draft && step === "edit" ? (
          <form
            className="guided-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canReview) setStep("review");
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Instruction title</span>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Kind of context</span>
                <select
                  value={draft.contextKind}
                  onChange={(event) =>
                    update(
                      "contextKind",
                      event.target.value as ContextModuleDraft["contextKind"],
                    )
                  }
                >
                  <option value="organisation">Organisation or work</option>
                  <option value="audience">Audience</option>
                  <option value="domain">Domain knowledge</option>
                  <option value="project">Project</option>
                  <option value="reference">Reference material</option>
                </select>
              </label>

              <label className="field field--wide">
                <span>Short description</span>
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="A short explanation of what this instruction contains."
                />
              </label>

              <label className="field field--wide">
                <span>Context the AI should understand</span>
                <textarea
                  rows={10}
                  value={draft.body}
                  onChange={(event) => update("body", event.target.value)}
                  required
                />
                <small>
                  Write this in ordinary language. It remains local canonical source.
                </small>
              </label>
            </div>

            {proposalError ? (
              <div className="notice notice--error" role="alert">
                <span>{proposalError}</span>
              </div>
            ) : null}

            <footer className="source-editor-actions">
              <button className="quiet-action" type="button" onClick={onAdvanced}>
                Edit advanced source instead
              </button>
              <button
                className="primary-action"
                type="submit"
                disabled={!canReview}
              >
                Review source change
              </button>
            </footer>
          </form>
        ) : draft && proposal && !(proposal instanceof Error) ? (
          <div className="guided-review">
            <div className="change-summary">
              <strong>{changeCount(proposal.diff)} changed lines</strong>
              <span>
                The file has not been written. Unchanged lines are shown for context.
              </span>
            </div>

            <div className="source-diff" aria-label="Proposed source diff">
              {proposal.diff.map((line, index) => (
                <div
                  className={`source-diff-line source-diff-line--${line.kind}`}
                  key={`${line.kind}-${line.oldLine}-${line.newLine}-${index}`}
                >
                  <span className="source-diff-marker" aria-hidden="true">
                    {line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}
                  </span>
                  <span className="source-diff-number">
                    {line.oldLine ?? ""}
                  </span>
                  <span className="source-diff-number">
                    {line.newLine ?? ""}
                  </span>
                  <code>{line.text || " "}</code>
                </div>
              ))}
            </div>

            <footer className="source-editor-actions">
              <button
                className="quiet-action"
                type="button"
                onClick={() => setStep("edit")}
              >
                Back to the form
              </button>
              <button
                className="primary-action"
                type="button"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Accept and save change"}
              </button>
            </footer>
          </div>
        ) : (
          <div className="notice notice--error" role="alert">
            <strong>Guided editing is not available for this source.</strong>
            <span>{proposalError ?? "Open the advanced editor to inspect it."}</span>
            <button className="quiet-action" type="button" onClick={onAdvanced}>
              Open advanced source editor
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
