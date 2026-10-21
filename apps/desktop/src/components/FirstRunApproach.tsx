import type { FirstRunApproach as Approach } from "../firstRun.js";

type Props = {
  approach: Approach;
  task: string;
  adjusting: boolean;
  onAdjust: () => void;
  onChange: (approach: Approach) => void;
  onContinue: () => void;
};

export function FirstRunApproach({
  approach,
  task,
  adjusting,
  onAdjust,
  onChange,
  onContinue,
}: Props) {
  const valid = Boolean(approach.guidance.trim() && approach.boundary.trim());
  return (
    <section className="first-run-card" aria-label="Suggested approach">
      <p className="eyebrow">A good starting point</p>
      <h2>{approach.title}</h2>
      {task.trim() ? (
        <p className="first-run-task">For your task: {task.trim()}</p>
      ) : null}
      <p>Ask your AI to:</p>
      {adjusting ? (
        <div className="first-run-fields">
          <label className="field">
            <span>How should it approach the work?</span>
            <textarea
              rows={4}
              value={approach.guidance}
              maxLength={8000}
              onChange={(event) =>
                onChange({ ...approach, guidance: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>What should it take care with?</span>
            <textarea
              rows={4}
              value={approach.boundary}
              maxLength={8000}
              onChange={(event) =>
                onChange({ ...approach, boundary: event.target.value })
              }
            />
          </label>
          {!valid ? (
            <p role="status">Add both parts of the approach to continue.</p>
          ) : null}
        </div>
      ) : (
        <ul className="first-run-principles">
          {[approach.guidance, approach.boundary]
            .flatMap((text) => text.split("\n"))
            .filter((line) => line.trim())
            .map((line, index) => (
              <li key={index}>{line}</li>
            ))}
        </ul>
      )}
      <p className="first-run-note">
        You can change this now, or try it and see what helps.
      </p>
      <div className="button-row">
        <button
          className="primary-action"
          type="button"
          disabled={!valid}
          onClick={onContinue}
        >
          Use this approach
        </button>
        {!adjusting ? (
          <button className="quiet-action" type="button" onClick={onAdjust}>
            Adjust it
          </button>
        ) : null}
      </div>
    </section>
  );
}
