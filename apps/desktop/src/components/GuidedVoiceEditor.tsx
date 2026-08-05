import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  patchVoiceModuleSource,
  readVoiceModuleDraft,
  type ProjectSnapshot,
  type RackProject,
  type VoiceModuleDraft,
} from "@rack/core";
import { SourceDiffReview } from "./SourceDiffReview.js";

type VoiceModule = Extract<
  RackProject["modules"][number],
  { type: "voice" }
>;

type GuidedVoiceEditorProps = {
  projectRoot: string;
  module: VoiceModule;
  onClose: () => void;
  onAdvanced: () => void;
  onSaved: (snapshot: ProjectSnapshot) => void;
};

export function GuidedVoiceEditor({
  projectRoot,
  module,
  onClose,
  onAdvanced,
  onSaved,
}: GuidedVoiceEditorProps) {
  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState<VoiceModuleDraft | null>(null);
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
        setDraft(readVoiceModuleDraft(content));
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Rack could not prepare this voice instruction for guided editing.",
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
      return patchVoiceModuleSource(original, draft);
    } catch (reason) {
      return reason instanceof Error ? reason : new Error("The change is invalid.");
    }
  }, [draft, original]);

  const proposalError = proposal instanceof Error ? proposal.message : null;
  const canReview =
    draft !== null &&
    draft.title.trim().length > 0 &&
    draft.body.trim().length > 0 &&
    draft.avoid.every((entry) => entry.term.trim().length > 0) &&
    proposal !== null &&
    !(proposal instanceof Error) &&
    proposal.content !== original;

  const update = <Key extends keyof VoiceModuleDraft>(
    key: Key,
    value: VoiceModuleDraft[Key],
  ) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  const updateAvoid = (
    index: number,
    key: "term" | "reason",
    value: string,
  ) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            avoid: current.avoid.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, [key]: value } : entry,
            ),
          }
        : current,
    );

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
        aria-labelledby="guided-voice-title"
      >
        <header className="source-editor-header">
          <div>
            <p className="eyebrow">Guided voice editor</p>
            <h2 id="guided-voice-title">
              {step === "edit" ? module.title : "Review the source change"}
            </h2>
            <code>{module.path}</code>
          </div>
          <button className="quiet-action" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="editor-explanation">
          Maintain the voice guidance, explicit rules and language to avoid without rewriting the rest of the instruction.
        </p>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>The voice instruction was not saved.</strong>
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
            <div className="guided-form-scroll">
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

                <label className="field field--wide">
                  <span>Short description</span>
                  <textarea
                    rows={3}
                    value={draft.description}
                    onChange={(event) => update("description", event.target.value)}
                  />
                </label>

                <label className="field field--wide">
                  <span>Overall voice guidance</span>
                  <textarea
                    rows={6}
                    value={draft.body}
                    onChange={(event) => update("body", event.target.value)}
                    required
                  />
                </label>

                <label className="field field--wide">
                  <span>Explicit voice rules</span>
                  <textarea
                    rows={5}
                    value={draft.rules.join("\n")}
                    onChange={(event) =>
                      update("rules", event.target.value.split("\n"))
                    }
                    placeholder="One rule per line"
                  />
                  <small>One rule per line. Empty lines are removed when saved.</small>
                </label>
              </div>

              <section className="repeatable-editor" aria-labelledby="avoid-heading">
                <div className="repeatable-editor-heading">
                  <div>
                    <p className="eyebrow">Language choices</p>
                    <h3 id="avoid-heading">Words or phrases to avoid</h3>
                  </div>
                  <button
                    className="quiet-action"
                    type="button"
                    onClick={() =>
                      update("avoid", [...draft.avoid, { term: "", reason: "" }])
                    }
                  >
                    Add a term
                  </button>
                </div>

                {draft.avoid.length === 0 ? (
                  <p className="empty-editor-state">No avoided language is set.</p>
                ) : (
                  <div className="repeatable-rows">
                    {draft.avoid.map((entry, index) => (
                      <div className="repeatable-row" key={`avoid-${index}`}>
                        <label className="field">
                          <span>Term</span>
                          <input
                            value={entry.term}
                            onChange={(event) =>
                              updateAvoid(index, "term", event.target.value)
                            }
                            required
                          />
                        </label>
                        <label className="field">
                          <span>Reason</span>
                          <input
                            value={entry.reason}
                            onChange={(event) =>
                              updateAvoid(index, "reason", event.target.value)
                            }
                            placeholder="Optional"
                          />
                        </label>
                        <button
                          className="remove-row-action"
                          type="button"
                          aria-label={`Remove ${entry.term || "empty term"}`}
                          onClick={() =>
                            update(
                              "avoid",
                              draft.avoid.filter(
                                (_candidate, entryIndex) => entryIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
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
          <SourceDiffReview
            diff={proposal.diff}
            saving={saving}
            onBack={() => setStep("edit")}
            onSave={save}
          />
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
