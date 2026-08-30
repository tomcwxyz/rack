import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type ImportedMaterial = {
  path: string;
  fileName: string;
  format: string;
  markdown: string;
};

type MaterialImportProps = {
  onUse: (material: ImportedMaterial) => void;
  buttonLabel?: string;
  hasExistingContent?: boolean;
};

const extensions = [
  "doc",
  "docx",
  "docm",
  "odt",
  "pdf",
  "ppt",
  "pps",
  "pot",
  "pptx",
  "pptm",
  "ppsx",
  "ppsm",
  "rtf",
  "epub",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "ods",
  "odp",
  "csv",
];

export function MaterialImport({
  onUse,
  buttonLabel = "Import existing material",
  hasExistingContent = false,
}: MaterialImportProps) {
  const [material, setMaterial] = useState<ImportedMaterial | null>(null);
  const [reviewMarkdown, setReviewMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseDocument = async () => {
    setError(null);
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Choose existing material",
      filters: [
        {
          name: "Documents",
          extensions,
        },
      ],
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return;

    setLoading(true);
    try {
      const imported = await invoke<ImportedMaterial>("import_document", { path });
      setMaterial(imported);
      setReviewMarkdown(imported.markdown);
    } catch (reason) {
      setMaterial(null);
      setReviewMarkdown("");
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not import that document.",
      );
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setMaterial(null);
    setReviewMarkdown("");
    setError(null);
  };

  return (
    <div className="material-import">
      {!material ? (
        <button
          className="quiet-action"
          type="button"
          onClick={() => void chooseDocument()}
          disabled={loading}
        >
          {loading ? "Converting locally…" : buttonLabel}
        </button>
      ) : (
        <section className="material-import-review" aria-label="Imported material review">
          <div className="material-import-heading">
            <div>
              <strong>{material.fileName}</strong>
              <span>{material.format.toUpperCase()} · converted locally to Markdown</span>
            </div>
            <button
              className="source-edit-button source-edit-button--muted"
              type="button"
              onClick={cancel}
            >
              Choose another
            </button>
          </div>

          <p>
            Review the extracted text before using it. Importing material does not
            make it binding or shared practice.
          </p>
          {hasExistingContent ? (
            <p className="material-import-warning">
              Using this will replace the current text in this field. Nothing is
              saved until you complete the normal Rack review.
            </p>
          ) : null}

          <textarea
            className="material-import-preview"
            rows={10}
            value={reviewMarkdown}
            onChange={(event) => setReviewMarkdown(event.target.value)}
            aria-label="Imported Markdown"
          />

          <div className="button-row">
            <button className="quiet-action" type="button" onClick={cancel}>
              Cancel
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={!reviewMarkdown.trim()}
              onClick={() =>
                onUse({
                  ...material,
                  markdown: reviewMarkdown,
                })
              }
            >
              Use this material
            </button>
          </div>
        </section>
      )}

      {error ? (
        <div className="notice notice--error material-import-error" role="alert">
          <strong>The document was not imported.</strong>
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
