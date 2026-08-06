import type { SourceDiffLine } from "@rack/core";

type SourceDiffReviewProps = {
  diff: SourceDiffLine[];
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
};

const changeCount = (diff: SourceDiffLine[]): number =>
  diff.filter((line) => line.kind !== "same").length;

export function SourceDiffReview({
  diff,
  saving,
  onBack,
  onSave,
}: SourceDiffReviewProps) {
  return (
    <div className="guided-review">
      <div className="change-summary">
        <strong>{changeCount(diff)} changed lines</strong>
        <span>
          The file has not been written. Unchanged lines are shown for context.
        </span>
      </div>

      <div className="source-diff" aria-label="Proposed source diff">
        {diff.map((line, index) => (
          <div
            className={`source-diff-line source-diff-line--${line.kind}`}
            key={`${line.kind}-${line.oldLine}-${line.newLine}-${index}`}
          >
            <span className="source-diff-marker" aria-hidden="true">
              {line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}
            </span>
            <span className="source-diff-number">{line.oldLine ?? ""}</span>
            <span className="source-diff-number">{line.newLine ?? ""}</span>
            <code>{line.text || " "}</code>
          </div>
        ))}
      </div>

      <footer className="source-editor-actions">
        <button className="quiet-action" type="button" onClick={onBack}>
          Back to the form
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Accept and save change"}
        </button>
      </footer>
    </div>
  );
}
