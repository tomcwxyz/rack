import type { ReactNode } from "react";
import type { PracticeDecision } from "../projectFiles.js";

export type PracticeChoice = PracticeDecision | null;

export const practiceChoiceLabel: Record<PracticeDecision, string> = {
  right: "That’s right",
  changed: "Not quite",
  dropped: "Not me",
};

type PracticePropositionProps = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  detail: string;
  choice: PracticeChoice;
  onChoice: (choice: PracticeDecision) => void;
  children?: ReactNode;
};

export function PracticeProposition({
  id,
  eyebrow,
  title,
  summary,
  detail,
  choice,
  onChoice,
  children,
}: PracticePropositionProps) {
  return (
    <article className="practice-proposition" aria-labelledby={`${id}-title`}>
      <div className="practice-proposition__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <p className="practice-proposition__summary">{summary}</p>
        <p className="practice-proposition__detail">{detail}</p>
      </div>

      <div className="practice-choice-group" aria-label={`Choose for ${title}`}>
        {(["right", "changed", "dropped"] as const).map((option) => (
          <button
            className={`practice-choice ${choice === option ? "practice-choice--active" : ""}`}
            type="button"
            key={option}
            aria-pressed={choice === option}
            onClick={() => onChoice(option)}
          >
            {practiceChoiceLabel[option]}
          </button>
        ))}
      </div>

      {choice === "changed" ? (
        <div className="practice-proposition__edit">{children}</div>
      ) : null}
    </article>
  );
}

export type CreationStep = "questions" | "practice" | "review";

export function CreationProgress({ step }: { step: CreationStep }) {
  return (
    <div className="creation-progress" aria-label="Creation progress">
      <span className={step === "questions" ? "creation-progress__active" : ""}>
        1 · Your context
      </span>
      <span className={step === "practice" ? "creation-progress__active" : ""}>
        2 · Suggested practice
      </span>
      <span className={step === "review" ? "creation-progress__active" : ""}>
        3 · Review
      </span>
    </div>
  );
}
