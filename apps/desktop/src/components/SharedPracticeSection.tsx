import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  PracticeProjectResolution,
  RackProject,
} from "@rack/core";
import {
  attachSharedPracticeContent,
  type AttachedSharedPractice,
  type SharedPracticeFile,
} from "../sharedPractice.js";
import "../shared-practice.css";

type SharedPracticeSectionProps = {
  project: RackProject;
  attachment: AttachedSharedPractice | null;
  resolution: PracticeProjectResolution | null;
  onAttachmentChange: (attachment: AttachedSharedPractice | null) => void;
  onStatus: (message: string) => void;
};

const authorityLabel = (
  mode: "adaptable" | "binding",
): string => mode === "binding" ? "Binding" : "Adaptable";

export function SharedPracticeSection({
  project,
  attachment,
  resolution,
  onAttachmentChange,
  onStatus,
}: SharedPracticeSectionProps) {
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

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
      const next = attachSharedPracticeContent(file);
      onAttachmentChange(next);
      if (!next.materialization.blocked) {
        onStatus(
          `${next.materialization.document?.title ?? "Shared practice"} attached for this session.`,
        );
      }
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
  const counts = useMemo(() => {
    let binding = 0;
    let adaptable = 0;
    for (const module of modules) {
      if (module.harness.authority?.mode === "binding") binding += 1;
      else adaptable += 1;
    }
    return { binding, adaptable };
  }, [modules]);

  const relevantResolutionDiagnostics =
    resolution?.project.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "RACK-PRACTICE-101" ||
        diagnostic.code === "RACK-PRACTICE-102",
    ) ?? [];

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

        {readError ? (
          <div className="notice notice--error" role="alert">
            {readError}
          </div>
        ) : null}

        <div className="shared-practice-empty">
          <div>
            <h3>Attach one shared-practice file</h3>
            <p>
              Rack reads the file from where it already lives. It stays
              separate from your local source and is composed only when Rack
              previews, builds or checks a Set-up.
            </p>
            <ul>
              <li>No account or Git required.</li>
              <li>Your local Rack files are not rewritten.</li>
              <li>Binding boundaries are shown when they affect a Set-up.</li>
            </ul>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={() => void attach()}
            disabled={busy}
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
    document?.published_by.organisation ?? document?.published_by.name ?? "Unknown publisher";

  return (
    <section aria-labelledby="shared-practice-heading">
      <div className="section-heading section-heading--top shared-practice-heading">
        <div>
          <p className="eyebrow">
            {materialization.blocked
              ? "Attached · needs attention"
              : "Attached for this session"}
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
            onClick={() => void attach()}
            disabled={busy}
          >
            Replace
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              onAttachmentChange(null);
              onStatus("Shared practice detached. Your local Rack was not changed.");
            }}
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
          <span>Version</span>
          <strong>{document?.version ?? "Unknown"}</strong>
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

      {materialization.blocked ? (
        <div className="notice notice--error" role="alert">
          <strong>This shared practice is not being applied.</strong>
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
          </div>

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
                  </div>
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
              This attachment affects Preview, Export and Checks. Editing,
              Starter imports and Set-up source continue to use the files in{" "}
              <code>{project.root}</code>.
            </p>
          </aside>
        </>
      )}
    </section>
  );
}
