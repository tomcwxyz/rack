import { useMemo, useState } from "react";
import {
  assessPracticeReviews,
  outstandingPracticeReviews,
  type PracticeReviewDecision,
  type PracticeReviewItem,
  type RackProject,
} from "@rack/core";
import { localCalendarDate } from "../date.js";
import { usePracticeReviews, type PracticeReviewInput } from "../usePracticeReviews.js";
import { PracticeReviewDialog } from "./PracticeReviewDialog.js";

type GuidedModule = Extract<
  RackProject["modules"][number],
  { type: "context" | "voice" | "guardrail" | "task" }
>;

type RackSectionProps = {
  project: RackProject;
  onGuidedEdit: (module: GuidedModule) => void;
  onSourceEdit: (path: string, title: string) => void;
  onStatus: (message: string) => void;
};

const typeLabels: Record<string, string> = {
  context: "Context",
  voice: "Voice and language",
  method: "Ways of working",
  craft: "Practice",
  guardrail: "Boundaries",
  task: "Repeatable tasks",
  tools: "Tools expected",
};

const guidedTypes = new Set(["context", "voice", "guardrail", "task"]);

const verificationKindLabels = {
  automatic: "automatic check",
  judgement: "AI judgement",
  human: "human review",
} as const;

export function RackSection({
  project,
  onGuidedEdit,
  onSourceEdit,
  onStatus,
}: RackSectionProps) {
  const reviewHistory = usePracticeReviews(project.root);
  const [reviewing, setReviewing] = useState<{
    module: RackProject["modules"][number];
    review: PracticeReviewItem;
  } | null>(null);
  const groupedModules = useMemo(() => {
    const groups = new Map<string, RackProject["modules"]>();
    for (const module of project.modules) {
      groups.set(module.type, [...(groups.get(module.type) ?? []), module]);
    }
    return groups;
  }, [project]);
  const errors = project.diagnostics.filter((item) => item.severity === "error");
  const scheduledReviewReport = useMemo(
    () => assessPracticeReviews(project.modules, localCalendarDate()),
    [project.modules],
  );
  const reviewReport = useMemo(
    () =>
      outstandingPracticeReviews(
        scheduledReviewReport,
        reviewHistory.reviews,
      ),
    [reviewHistory.reviews, scheduledReviewReport],
  );
  const reviewByModuleId = useMemo(
    () => new Map(reviewReport.items.map((item) => [item.moduleId, item])),
    [reviewReport],
  );
  const latestReviewByModuleId = useMemo(() => {
    const latest = new Map<string, (typeof reviewHistory.reviews)[number]>();
    for (const item of reviewHistory.reviews) {
      const current = latest.get(item.moduleId);
      if (!current || item.reviewedAt >= current.reviewedAt) {
        latest.set(item.moduleId, item);
      }
    }
    return latest;
  }, [reviewHistory.reviews]);
  const ordinaryDueCount =
    reviewReport.dueCount - reviewReport.experimentDueCount;

  return (
    <>
      <section className="summary-strip" aria-label="Rack summary">
        <div><strong>{project.modules.length}</strong><span>instructions</span></div>
        <div><strong>{project.profiles.length}</strong><span>set-ups</span></div>
        <div><strong>{errors.length}</strong><span>blocking problems</span></div>
        <div>
          <strong>
            {project.modules.filter((module) => module.harness.experiment).length}
          </strong>
          <span>experiments</span>
        </div>
        <div className="summary-path">
          <span>{errors.length === 0 ? "Source is ready to build" : "Source needs attention"}</span>
        </div>
      </section>

      {reviewHistory.error ? (
        <div className="notice notice--error" role="alert">
          <strong>Local review history could not be read.</strong>
          <span>{reviewHistory.error}</span>
        </div>
      ) : null}

      {!reviewHistory.loading && reviewReport.experimentDueCount > 0 ? (
        <section aria-labelledby="experiment-review-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Experiments</p>
              <h2 id="experiment-review-heading">
                {reviewReport.experimentDueCount === 1
                  ? "One experiment is ready to learn from"
                  : `${reviewReport.experimentDueCount} experiments are ready to learn from`}
              </h2>
            </div>
            <span className="status-pill">Review · still active</span>
          </div>
          <p className="muted-copy">
            Revisit the learning question and decide whether to keep, change or
            remove the practice. Reaching the date does not switch the
            instruction off.
          </p>
        </section>
      ) : null}

      {!reviewHistory.loading && ordinaryDueCount > 0 ? (
        <section aria-labelledby="review-due-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Review dates</p>
              <h2 id="review-due-heading">
                {ordinaryDueCount === 1
                  ? "One instruction is ready for review"
                  : `${ordinaryDueCount} instructions are ready for review`}
              </h2>
            </div>
            <span className="status-pill">Review · not blocking</span>
          </div>
          <p className="muted-copy">
            Review dates do not disable instructions or change their authority.
            They are reminders to revisit whether the practice still makes sense.
          </p>
        </section>
      ) : null}

      {project.diagnostics.length > 0 ? (
        <section aria-labelledby="diagnostics-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Source checks</p>
              <h2 id="diagnostics-heading">Things to look at</h2>
            </div>
            <span className="status-pill">
              {errors.length > 0 ? "Needs attention" : "Warnings"}
            </span>
          </div>
          <div className="diagnostic-list">
            {project.diagnostics.map((item, index) => (
              <article className="diagnostic-card" key={`${item.code}-${index}`}>
                <code>{item.code}</code>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="instructions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Canonical source</p>
            <h2 id="instructions-heading">Instructions in this Rack</h2>
          </div>
          <span className="muted-copy">
            Context, voice, boundary and task instructions have guided maintenance. Advanced source editing remains available.
          </span>
        </div>

        <div className="instruction-groups">
          {[...groupedModules.entries()].map(([type, modules]) => (
            <section className="instruction-group" key={type}>
              <h3>{typeLabels[type] ?? type}</h3>
              <div className="card-grid">
                {modules.map((module) => {
                  const review = reviewByModuleId.get(module.harness.id);
                  const latestReview = latestReviewByModuleId.get(module.harness.id);
                  const experiment = module.harness.experiment;
                  const applicationLabels = [
                    ...(module.harness.enforcement.includes("instruction")
                      ? ["AI guidance"]
                      : []),
                    ...(module.harness.enforcement.includes("host_policy")
                      ? ["host rule"]
                      : []),
                  ];
                  const configuredKinds = new Set(
                    (module.harness.verification ?? []).map((step) => step.kind),
                  );
                  const checkLabels: string[] = (
                    module.harness.verification ?? []
                  ).map((step) => verificationKindLabels[step.kind]);
                  if (
                    module.harness.enforcement.includes("output_check") &&
                    !configuredKinds.has("automatic")
                  ) {
                    checkLabels.push("automatic check · not configured");
                  }
                  if (
                    module.harness.enforcement.includes("rubric_eval") &&
                    !configuredKinds.has("judgement")
                  ) {
                    checkLabels.push("AI judgement · not configured");
                  }
                  if (
                    module.harness.enforcement.includes("human_review") &&
                    !configuredKinds.has("human")
                  ) {
                    checkLabels.push("human review · not configured");
                  }
                  return (
                  <article className="instruction-card" key={module.harness.id}>
                    <div className="card-meta">
                      <span>{module.harness.criticality}</span>
                      {experiment ? <span>experiment</span> : null}
                      {review ? (
                        <span title={`Review after ${review.reviewAfter}`}>
                          {review.status === "due"
                            ? `review due · ${review.reviewAfter}`
                            : review.status === "upcoming"
                              ? `review soon · ${review.reviewAfter}`
                              : `review · ${review.reviewAfter}`}
                        </span>
                      ) : latestReview ? (
                        <span
                          title={`Reviewed ${new Date(latestReview.reviewedAt * 1000).toLocaleDateString()}`}
                        >
                          {latestReview.decision === "remove"
                            ? "remove decision · still active"
                            : `reviewed · ${latestReview.decision}`}
                        </span>
                      ) : null}
                      <code>{module.harness.id}</code>
                    </div>
                    <h4>{module.title}</h4>
                    <p>
                      {module.description ||
                        module.body.split("\n").find(Boolean) ||
                        "No description yet."}
                    </p>
                    {experiment ? (
                      <p className="practice-experiment-question">
                        <strong>Learning question:</strong>{" "}
                        {experiment.question}
                      </p>
                    ) : null}
                    <div className="practice-verification-summary">
                      <p>
                        <strong>How this is applied:</strong>{" "}
                        {applicationLabels.length > 0
                          ? applicationLabels.join(" · ")
                          : "Not added to AI guidance"}
                      </p>
                      <p>
                        <strong>How this is checked:</strong>{" "}
                        {checkLabels.length > 0
                          ? checkLabels.join(" · ")
                          : "Guidance only"}
                      </p>
                    </div>
                    <div className="card-footer">
                      <span className="source-label">Yours · local</span>
                      <div className="card-actions">
                        {review?.status === "due" ? (
                          <button
                            className="source-edit-button"
                            type="button"
                            onClick={() => setReviewing({ module, review })}
                          >
                            Review what happened
                          </button>
                        ) : null}
                        {guidedTypes.has(module.type) ? (
                          <button
                            className="source-edit-button"
                            type="button"
                            onClick={() => onGuidedEdit(module as GuidedModule)}
                          >
                            {module.type === "task" ? "Design task" : "Edit details"}
                          </button>
                        ) : null}
                        <button
                          className="source-edit-button source-edit-button--muted"
                          type="button"
                          onClick={() => onSourceEdit(module.path, module.title)}
                        >
                          Edit source
                        </button>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      {reviewing ? (
        <PracticeReviewDialog
          module={reviewing.module}
          review={reviewing.review}
          onClose={() => setReviewing(null)}
          onSaved={async (
            decision: PracticeReviewDecision,
            input: PracticeReviewInput,
          ) => {
            await reviewHistory.save(input);
            const module = reviewing.module;
            setReviewing(null);

            if (decision === "change") {
              onStatus(
                `Review saved for ${module.title}. Change the practice deliberately using the editor now.`,
              );
              if (guidedTypes.has(module.type)) {
                onGuidedEdit(module as GuidedModule);
              } else {
                onSourceEdit(module.path, module.title);
              }
              return;
            }

            if (decision === "remove") {
              onStatus(
                `Review saved for ${module.title}: remove was recorded as an explicit decision. The instruction remains active until you deliberately change the Rack or Set-up.`,
              );
              return;
            }

            onStatus(
              `Review saved for ${module.title}. This review date is complete and the practice remains active.`,
            );
          }}
        />
      ) : null}
    </>
  );
}
