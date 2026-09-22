import { useEffect, useMemo, useState } from "react";
import type {
  PracticeReviewDecision,
  PracticeReviewItem,
  RackProject,
} from "@rack/core";
import type { PracticeReviewInput } from "../usePracticeReviews.js";

type ReviewableModule = RackProject["modules"][number];

type PracticeReviewDialogProps = {
  module: ReviewableModule;
  review: PracticeReviewItem;
  onClose: () => void;
  onSaved: (
    decision: PracticeReviewDecision,
    review: PracticeReviewInput,
  ) => Promise<void>;
};

const decisionCopy: Record<
  PracticeReviewDecision,
  { title: string; detail: string }
> = {
  keep: {
    title: "Keep it",
    detail: "The practice still earns its place. Record what you learned and keep using it.",
  },
  change: {
    title: "Change it",
    detail: "Something about the practice needs adjusting. Save the learning first, then edit the practice.",
  },
  remove: {
    title: "Remove it",
    detail: "You think this practice should stop applying. RACK will record that decision, but will not silently delete or disable the source.",
  },
};

export function PracticeReviewDialog({
  module,
  review,
  onClose,
  onSaved,
}: PracticeReviewDialogProps) {
  const [decision, setDecision] = useState<PracticeReviewDecision>("keep");
  const [reflection, setReflection] = useState("");
  const requestId = useMemo(
    () => `practice-review:${module.harness.id}:${review.reviewAfter}`,
    [module.harness.id, review.reviewAfter],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = useMemo(
    () =>
      review.experimentQuestion ??
      "What happened when you used this practice in real work?",
    [review.experimentQuestion],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const save = async () => {
    if (!reflection.trim()) {
      setError("Add a short note about what happened before saving the review.");
      return;
    }

    const input: PracticeReviewInput = {
      requestId,
      moduleId: module.harness.id,
      moduleTitle: module.title,
      modulePath: module.path,
      reviewAfter: review.reviewAfter,
      experimentQuestion: review.experimentQuestion,
      reflection: reflection.trim(),
      decision,
    };

    setSaving(true);
    setError(null);
    try {
      await onSaved(decision, input);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Rack could not save this practice review.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-backdrop" role="presentation">
      <section
        className="practice-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="practice-review-title"
      >
        <header className="source-editor-header">
          <div>
            <p className="eyebrow">
              {review.experimentQuestion ? "Learn from an experiment" : "Review your practice"}
            </p>
            <h2 id="practice-review-title">{module.title}</h2>
            <span className="muted-copy">Review due {review.reviewAfter}</span>
          </div>
          <button className="quiet-action" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="practice-review-dialog__question">
          <strong>{prompt}</strong>
          {review.experimentQuestion ? (
            <span>
              This is the learning question you set when you made this practice an experiment.
            </span>
          ) : null}
        </div>

        <label className="field">
          <span>What happened?</span>
          <textarea
            rows={7}
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="A short account of what you noticed in real work…"
            autoFocus
          />
          <small>
            Keep this focused on what you observed. RACK does not collect full prompts,
            outputs or passive usage telemetry for this review.
          </small>
        </label>

        <fieldset className="practice-review-dialog__decisions">
          <legend>What should happen to this practice?</legend>
          {(["keep", "change", "remove"] as PracticeReviewDecision[]).map(
            (value) => (
              <label
                key={value}
                className={
                  decision === value
                    ? "practice-review-choice practice-review-choice--selected"
                    : "practice-review-choice"
                }
              >
                <input
                  type="radio"
                  name="practice-review-decision"
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                <span>
                  <strong>{decisionCopy[value].title}</strong>
                  <small>{decisionCopy[value].detail}</small>
                </span>
              </label>
            ),
          )}
        </fieldset>

        {decision === "remove" ? (
          <div className="notice notice--warning">
            <strong>Recording “Remove” does not disable this instruction.</strong>
            <span>
              RACK keeps the decision visible, but the canonical source remains active
              until you deliberately change the Rack or its Set-up.
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>The review was not saved.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <footer className="source-editor-actions">
          <span>
            Review history stays local in <code>.rack/practice-reviews.json</code>.
          </span>
          <div className="button-row">
            <button className="quiet-action" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-action"
              type="button"
              onClick={() => void save()}
              disabled={saving || !reflection.trim()}
            >
              {saving
                ? "Saving…"
                : decision === "change"
                  ? "Save learning and edit"
                  : "Save review"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
