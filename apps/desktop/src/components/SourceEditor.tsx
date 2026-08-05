import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProjectSnapshot } from "@rack/core";

type SourceEditorProps = {
  projectRoot: string;
  path: string;
  title: string;
  onClose: () => void;
  onSaved: (snapshot: ProjectSnapshot) => void;
};

export function SourceEditor({
  projectRoot,
  path,
  title,
  onClose,
  onSaved,
}: SourceEditorProps) {
  const [original, setOriginal] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void invoke<string>("read_project_file", {
      root: projectRoot,
      relativePath: path,
    })
      .then((value) => {
        if (!active) return;
        setOriginal(value);
        setContent(value);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Rack could not read this source file.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [path, projectRoot]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const snapshot = await invoke<ProjectSnapshot>("write_project_file", {
        root: projectRoot,
        relativePath: path,
        content,
        expectedContent: original,
      });
      onSaved(snapshot);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not save this source file.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-backdrop" role="presentation">
      <section
        className="source-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-editor-title"
      >
        <header className="source-editor-header">
          <div>
            <p className="eyebrow">Advanced source editor</p>
            <h2 id="source-editor-title">{title}</h2>
            <code>{path}</code>
          </div>
          <button className="quiet-action" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="editor-explanation">
          This edits the canonical Markdown directly. Rack compares the file with the version you opened and refuses to overwrite an external change.
        </p>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>The source was not saved.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="editor-loading">Reading local source…</div>
        ) : (
          <textarea
            className="source-textarea"
            aria-label={`${title} source`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
          />
        )}

        <footer className="source-editor-actions">
          <span>
            {content === original ? "No local changes" : "Unsaved local changes"}
          </span>
          <div className="button-row">
            <button className="quiet-action" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={save}
              disabled={loading || saving || content === original}
            >
              {saving ? "Saving…" : "Save source"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
