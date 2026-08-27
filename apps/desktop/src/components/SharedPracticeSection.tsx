import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  assessPracticeReviews,
  type PracticeProjectResolution,
  type PracticeReviewItem,
  type RackProject,
  type SharedPracticeTighteningReason,
} from "@rack/core";
import {
  attachSharedPracticeContent,
  type AttachedSharedPractice,
  type SharedPracticeFile,
} from "../sharedPractice.js";
import { localCalendarDate } from "../date.js";
import type { SharedPracticeLifecycleController } from "../useSharedPracticeLifecycle.js";
import "../shared-practice.css";

type SharedPracticeSectionProps = {
  project: RackProject;
  lifecycle: SharedPracticeLifecycleController;
  resolution: PracticeProjectResolution | null;
  onStatus: (message: string) => void;
};

const authorityLabel = (
  mode: "adaptable" | "binding",
): string => mode === "binding" ? "Binding" : "Adaptable";

const tighteningReasonLabel: Record<SharedPracticeTighteningReason, string> = {
  "new-binding": "New binding instruction",
  "became-binding": "Changed to binding",
  "new-required": "New required instruction",
  "criticality-increased": "Criticality increased",
  "binding-review-removed": "Binding review removed",
  "binding-review-deferred": "Binding review pushed later",
};

const changeLabel = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
} as const;

export function SharedPracticeSection({
  project,
  lifecycle,
  resolution,
  onStatus,
}: SharedPracticeSectionProps) {
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [invalidCandidate, setInvalidCandidate] =
    useState<AttachedSharedPractice | null>(null);

  const attachment = lifecycle.accepted;
  const incoming = lifecycle.incoming;

  const run = async (
    action: () => Promise<void>,
    success?: string,
  ) => {
    setBusy(true);
    setReadError(null);
    try {
      await action();
      if (success) onStatus(success);
    } catch (reason) {
      setReadError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not update shared-practice state.",
      );
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    setBusy(true);
    setReadError(null);
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: "Attach shared practice",
        filters: [
          {
            name: "Rack shared practice",
            extensions: ["yaml", "yml"],
          },
        ],
      });
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      const file = await invoke<SharedPracticeFile>(
        "read_shared_practice_file",
        { path },
      );
      const candidate = attachSharedPracticeContent(file);
      if (candidate.materialization.blocked) {
        setInvalidCandidate(candidate);
        return;
      }

      const accepted = await lifecycle.attachFile(file);
      setInvalidCandidate(null);
      onStatus(
        `${accepted.materialization.document?.title ?? "Shared practice"} accepted locally. Rack will check its source for updates when this Rack opens.`,
      );
    } catch (reason) {
      setReadError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not read that shared practice file.",
      );
    } finally {
      setBusy(false);
    }
  };

  const modules = attachment?.materialization.modules ?? [];
  const reviewReport = useMemo(
    () => assessPracticeReviews(modules, localCalendarDate()),
    [modules],
  );
  const reviewByModuleId = useMemo(
    () =>
      new Map<string, PracticeReviewItem>(
        reviewReport.items.map((item) => [item.moduleId, item]),
      ),
    [reviewReport],
  );
  const ordinaryDueCount =
    reviewReport.dueCount - reviewReport.experimentDueCount;
  const counts = useMemo(() => {
    let binding = 0;
    let adaptable = 0;
    let experiments = 0;
    for (const module of modules) {
      if (module.harness.authority?.mode === "binding") binding += 1;
      else adaptable += 1;
      if (module.harness.experiment) experiments += 1;
    }
    return { binding, adaptable, experiments };
  }, [modules]);

  const relevantResolutionDiagnostics =
    resolution?.project.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "RACK-PRACTICE-101" ||
        diagnostic.code === "RACK-PRACTICE-102",
    ) ?? [];

  const invalidDiagnostics = invalidCandidate?.materialization.diagnostics ?? [];

  if (!attachment) {
    return (
      <section aria-labelledby="shared-practice-heading">
        <div className="section-heading section-heading--top">
          <div>
            <p className="eyebrow">Optional · local attachment</p>
            <h2 id="shared-practice-heading">Shared practice</h2>
            <p className="section-intro">
              Bring in practice published by a team or organisation without
              copying it into your Rack.
            </p>
          </div>
        </div>

        {lifecycle.loading ? (
          <div className="notice" role="status">
            Restoring shared-practice state…
          </div>
        ) : null}

        {readError || lifecycle.sourceError ? (
          <div className="notice notice--error" role="alert">
            {readError ?? lifecycle.sourceError}
          </div>
        ) : null}

        {invalidCandidate ? (
          <div className="notice notice--error" role="alert">
            <strong>That file was not attached.</strong>
            {invalidDiagnostics.map((diagnostic) => (
              <span key={`${diagnostic.code}-${diagnostic.message}`}>
                {diagnostic.code}: {diagnostic.message}
              </span>
            ))}
          </div>
        ) : null}

        <div className="shared-practice-empty">
          <div>
            <h3>Attach one shared-practice file</h3>
            <p>
              Rack keeps an accepted local snapshot and checks the original file
              for newer content. A source change never changes your effective
              Rack until you explicitly accept it.
            </p>
            <ul>
              <li>No account or Git required.</li>
              <li>Your local Rack files are not rewritten.</li>
              <li>Updates are reviewed before they apply.</li>
            </ul>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={() => void attach()}
            disabled={busy || lifecycle.loading}
          >
            {busy ? "Opening…" : "Attach shared practice"}
          </button>
        </div>
      </section>
    );
  }

  const materialization = attachment.materialization;
  const document = materialization.document;
  const publisher =
    document?.published_by.organisation ??
    document?.published_by.name ??
    "Unknown publisher";
  const acceptedVersion = document?.version ?? "Unknown";
  const incomingDocument = incoming?.materialization.document;

  return (
    <section aria-labelledby="shared-practice-heading">
      <div className="section-heading section-heading--top shared-practice-heading">
        <div>
          <p className="eyebrow">
            {materialization.blocked
              ? "Accepted locally · needs attention"
              : "Accepted locally"}
          </p>
          <h2 id="shared-practice-heading">
            {document?.title ?? "Shared practice"}
          </h2>
          <p className="section-intro">
            {document?.description ||
              "Shared working practice composed with your local Rack at build time."}
          </p>
        </div>
        <div className="button-row">
          <button
            className="quiet-action"
            type="button"
            onClick={() =>
              void run(
                lifecycle.refresh,
                "Checked the shared-practice source for changes.",
              )
            }
            disabled={busy || lifecycle.loading}
          >
            Check source
          </button>
          <button
            className="quiet-action"
            type="button"
            onClick={() => void attach()}
            disabled={busy}
          >
            Replace
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() =>
              void run(
                async () => {
                  await lifecycle.detach();
                  setInvalidCandidate(null);
                },
                "Shared practice detached. Your local Rack was not changed.",
              )
            }
            disabled={busy}
          >
            Detach
          </button>
        </div>
      </div>

      <div className="shared-practice-source">
        <div>
          <span>Published by</span>
          <strong>{publisher}</strong>
        </div>
        <div>
          <span>Accepted version</span>
          <strong>{acceptedVersion}</strong>
        </div>
        <div className="shared-practice-source__path" title={attachment.file.path}>
          <span>Source file</span>
          <code>{attachment.file.path}</code>
        </div>
      </div>

      {readError ? (
        <div className="notice notice--error" role="alert">
          {readError}
        </div>
      ) : null}

      {invalidCandidate ? (
        <div className="notice notice--error" role="alert">
          <strong>The replacement file was not accepted.</strong>
          {invalidDiagnostics.map((diagnostic) => (
            <span key={`${diagnostic.code}-${diagnostic.message}`}>
              {diagnostic.code}: {diagnostic.message}
            </span>
          ))}
        </div>
      ) : null}

      {lifecycle.sourceError ? (
        <div className="notice notice--warning" role="status">
          <strong>Using the last accepted version.</strong>
          <span>
            Rack could not read the source file: {lifecycle.sourceError}
          </span>
        </div>
      ) : null}

      {incoming ? (
        <div
          className={`shared-practice-update ${
            lifecycle.diff?.tightening ? "shared-practice-update--tightening" : ""
          }`}
        >
          <div className="shared-practice-update__heading">
            <div>
              <p className="eyebrow">
                {incoming.materialization.blocked
                  ? "Source changed · invalid update"
                  : lifecycle.diff?.tightening
                    ? "Source changed · tightening update"
                    : "Source changed · update available"}
              </p>
              <h3>
                {incomingDocument
                  ? `Version ${acceptedVersion} → ${incomingDocument.version}`
                  : "The source file has changed"}
              </h3>
              <p>
                Your accepted snapshot remains active until you choose to use
                this content.
              </p>
            </div>
          </div>

          {incoming.materialization.blocked ? (
            <div className="notice notice--error">
              <strong>The new source content is invalid and cannot be applied.</strong>
              {incoming.materialization.diagnostics.map((diagnostic) => (
                <span key={`${diagnostic.code}-${diagnostic.message}`}>
                  {diagnostic.code}: {diagnostic.message}
                </span>
              ))}
            </div>
          ) : lifecycle.diff?.changes.length ? (
            <div className="shared-practice-change-list">
              {lifecycle.diff.changes.map((change) => (
                <article key={change.moduleId}>
                  <div>
                    <strong>{change.moduleId}</strong>
                    <span>{changeLabel[change.kind]}</span>
                  </div>
                  {change.tighteningReasons.length > 0 ? (
                    <div className="shared-practice-change-tags">
                      {change.tighteningReasons.map((reason) => (
                        <span key={reason}>{tighteningReasonLabel[reason]}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="shared-practice-update__metadata">
              The publication metadata or version changed, but the materialised
              instructions are unchanged.
            </p>
          )}

          {lifecycle.diff?.tightening ? (
            <div className="notice notice--warning">
              <strong>This update tightens shared practice.</strong>
              <span>
                Review the affected instructions before accepting it. Rack does
                not apply tightening changes automatically.
              </span>
            </div>
          ) : null}

          <div className="button-row">
            {!incoming.materialization.blocked ? (
              <button
                className="primary-action"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    lifecycle.acceptIncoming,
                    `${incomingDocument?.title ?? "Shared practice"} update accepted.`,
                  )
                }
              >
                Use this update
              </button>
            ) : null}
            <button
              className="secondary-action"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  lifecycle.declineIncoming,
                  "Kept the current accepted shared practice. This exact source content will not be offered again.",
                )
              }
            >
              Keep current
            </button>
          </div>
        </div>
      ) : null}

      {lifecycle.declinedCurrent ? (
        <div className="notice shared-practice-declined" role="status">
          <strong>You chose to keep version {acceptedVersion}.</strong>
          <span>
            Rack will not offer this exact source content again. If the source
            changes, the newer content will be reviewed separately.
          </span>
          <button
            className="quiet-action"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                lifecycle.reconsiderDeclined,
                "The declined update is available to review again.",
              )
            }
          >
            Review this update again
          </button>
        </div>
      ) : null}

      {materialization.blocked ? (
        <div className="notice notice--error" role="alert">
          <strong>The accepted snapshot can no longer be materialised.</strong>
          {materialization.diagnostics.map((diagnostic) => (
            <span key={`${diagnostic.code}-${diagnostic.message}`}>
              {diagnostic.code}: {diagnostic.message}
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className="shared-practice-summary">
            <article>
              <span>Instructions</span>
              <strong>{modules.length}</strong>
            </article>
            <article>
              <span>Binding</span>
              <strong>{counts.binding}</strong>
            </article>
            <article>
              <span>Adaptable</span>
              <strong>{counts.adaptable}</strong>
            </article>
            <article>
              <span>Experiments</span>
              <strong>{counts.experiments}</strong>
            </article>
            <article>
              <span>Review due</span>
              <strong>{reviewReport.dueCount}</strong>
            </article>
          </div>

          {reviewReport.experimentDueCount > 0 ? (
            <div className="notice notice--warning shared-practice-review-notice">
              <strong>
                {reviewReport.experimentDueCount === 1
                  ? "One shared experiment is ready to learn from."
                  : `${reviewReport.experimentDueCount} shared experiments are ready to learn from.`}
              </strong>
              <span>
                The experiment remains active until revised shared practice is
                published and you choose whether to accept it.
              </span>
            </div>
          ) : null}

          {ordinaryDueCount > 0 ? (
            <div className="notice notice--warning shared-practice-review-notice">
              <strong>
                {ordinaryDueCount === 1
                  ? "One shared instruction has reached its review date."
                  : `${ordinaryDueCount} shared instructions have reached their review dates.`}
              </strong>
              <span>
                The accepted practice remains active and keeps the same authority.
                The date is a prompt to revisit the rule, not an automatic expiry
                or downgrade.
              </span>
            </div>
          ) : null}

          {relevantResolutionDiagnostics.length > 0 ? (
            <div className="shared-practice-impact">
              <p className="eyebrow">What changes in this Rack</p>
              {relevantResolutionDiagnostics.map((diagnostic) => (
                <div
                  className={
                    diagnostic.severity === "warning"
                      ? "notice notice--warning"
                      : "notice"
                  }
                  key={`${diagnostic.code}-${diagnostic.message}`}
                >
                  <strong>{diagnostic.title}</strong>
                  <span>{diagnostic.message}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="shared-practice-list">
            {modules.map((module) => {
              const mode = module.harness.authority?.mode ?? "adaptable";
              const review = reviewByModuleId.get(module.harness.id);
              const experiment = module.harness.experiment;
              return (
                <article className="shared-practice-item" key={module.harness.id}>
                  <div>
                    <h3>{module.title}</h3>
                    <code>{module.harness.id}</code>
                  </div>
                  <div className="shared-practice-tags">
                    <span className={`practice-authority practice-authority--${mode}`}>
                      {authorityLabel(mode)}
                    </span>
                    <span>{module.harness.criticality}</span>
                    {experiment ? <span>Experiment</span> : null}
                    {review ? (
                      <span
                        className={`practice-review practice-review--${review.status}`}
                        title={`Review after ${review.reviewAfter}`}
                      >
                        {review.status === "due"
                          ? `Review due · ${review.reviewAfter}`
                          : review.status === "upcoming"
                            ? `Review soon · ${review.reviewAfter}`
                            : `Review · ${review.reviewAfter}`}
                      </span>
                    ) : null}
                  </div>
                  {experiment ? (
                    <p className="shared-practice-experiment">
                      <strong>Learning question:</strong>{" "}
                      {experiment.question}
                    </p>
                  ) : null}
                  {mode === "binding" && module.harness.authority?.rationale ? (
                    <p className="shared-practice-rationale">
                      <strong>Why binding:</strong>{" "}
                      {module.harness.authority.rationale}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <aside className="shared-practice-boundary">
            <strong>Your local source stays yours.</strong>
            <p>
              Preview, Export and Checks use this accepted snapshot. Editing,
              Starter imports and Set-up source continue to use the files in{" "}
              <code>{project.root}</code>. A changed shared file is only applied
              after you accept it here.
            </p>
          </aside>
        </>
      )}
    </section>
  );
}
