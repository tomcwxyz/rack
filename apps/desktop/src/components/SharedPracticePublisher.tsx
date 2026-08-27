import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  createSharedPracticePublication,
  type RackProject,
} from "@rack/core";

type SharedPracticePublisherProps = {
  project: RackProject;
  onStatus: (message: string) => void;
};

type PublisherDraft = {
  id: string;
  version: string;
  title: string;
  description: string;
  publisherName: string;
  organisation: string;
  license: string;
  moduleIds: string[];
};

const initialDraft = (project: RackProject): PublisherDraft => ({
  id: project.manifest?.name ?? "shared-practice",
  version: project.manifest?.version ?? "0.1.0",
  title: project.manifest?.title
    ? `${project.manifest.title} shared practice`
    : "Shared practice",
  description: "",
  publisherName: project.manifest?.author.name ?? "",
  organisation: project.manifest?.author.organisation ?? "",
  license: project.manifest?.license ?? "",
  moduleIds: [],
});

const messageFor = (reason: unknown): string =>
  reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Rack could not save the shared-practice file.";

export function SharedPracticePublisher({
  project,
  onStatus,
}: SharedPracticePublisherProps) {
  const [draft, setDraft] = useState<PublisherDraft>(() => initialDraft(project));
  const [step, setStep] = useState<"choose" | "review">("choose");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialDraft(project));
    setStep("choose");
    setReplaceExisting(false);
    setError(null);
  }, [project.root]);

  const publication = useMemo(
    () =>
      createSharedPracticePublication(project, {
        id: draft.id.trim(),
        version: draft.version.trim(),
        title: draft.title.trim(),
        description: draft.description,
        publishedBy: {
          name: draft.publisherName.trim(),
          ...(draft.organisation.trim()
            ? { organisation: draft.organisation.trim() }
            : {}),
        },
        license: draft.license.trim() || null,
        moduleIds: draft.moduleIds,
      }),
    [draft, project],
  );

  const selectableModules = useMemo(
    () =>
      [...project.modules].sort((left, right) =>
        left.harness.id.localeCompare(right.harness.id),
      ),
    [project.modules],
  );

  const update = <Key extends keyof PublisherDraft>(
    key: Key,
    value: PublisherDraft[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleModule = (moduleId: string, checked: boolean) =>
    update(
      "moduleIds",
      checked
        ? [...draft.moduleIds, moduleId]
        : draft.moduleIds.filter((id) => id !== moduleId),
    );

  const savePublication = async () => {
    if (!publication.content || !publication.document) return;
    setSaving(true);
    setError(null);
    try {
      const selected = await save({
        title: "Save shared practice",
        defaultPath: `${publication.document.id}.rack.yaml`,
        filters: [
          {
            name: "Rack shared practice",
            extensions: ["yaml", "yml"],
          },
        ],
      });
      if (!selected) return;

      await invoke("write_shared_practice_publication", {
        path: selected,
        content: publication.content,
        replaceExisting,
      });
      onStatus(
        `${publication.document.title} saved to ${selected}. Share that file through the place your organisation already uses.`,
      );
      setStep("choose");
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  };

  const errors = publication.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );

  return (
    <details className="shared-practice-publisher">
      <summary>Publish practice from this Rack</summary>
      <div className="shared-practice-publisher__body">
        <div className="shared-practice-publisher__intro">
          <div>
            <p className="eyebrow">Your local source only</p>
            <h3>Create a shared-practice file</h3>
            <p>
              Choose exactly which local instructions to share. Rack will not
              publish a whole Set-up or include practice you only received from
              another source.
            </p>
          </div>
          <span className="status-pill">
            {draft.moduleIds.length} selected
          </span>
        </div>

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>Shared practice was not saved.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {step === "choose" ? (
          <form
            className="shared-practice-publisher__form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!publication.blocked) setStep("review");
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>File ID</span>
                <input
                  required
                  value={draft.id}
                  onChange={(event) => update("id", event.target.value)}
                  placeholder="organisation-practice"
                />
              </label>
              <label className="field">
                <span>Version</span>
                <input
                  required
                  value={draft.version}
                  onChange={(event) => update("version", event.target.value)}
                  placeholder="1.0.0"
                />
              </label>
              <label className="field field--wide">
                <span>Title</span>
                <input
                  required
                  value={draft.title}
                  onChange={(event) => update("title", event.target.value)}
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
              <label className="field">
                <span>Published by</span>
                <input
                  required
                  value={draft.publisherName}
                  onChange={(event) =>
                    update("publisherName", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Organisation</span>
                <input
                  value={draft.organisation}
                  onChange={(event) =>
                    update("organisation", event.target.value)
                  }
                  placeholder="Optional"
                />
              </label>
              <label className="field field--wide">
                <span>Licence</span>
                <input
                  value={draft.license}
                  onChange={(event) => update("license", event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            <section
              className="shared-practice-publisher__selection"
              aria-labelledby="publish-instructions-heading"
            >
              <div className="repeatable-editor-heading">
                <div>
                  <p className="eyebrow">Publication boundary</p>
                  <h4 id="publish-instructions-heading">
                    Instructions to share
                  </h4>
                </div>
                <span className="muted-copy">
                  Nothing is selected automatically.
                </span>
              </div>

              <div className="notice">
                <span>
                  Context instructions can contain organisation, project or
                  audience details. Only select them when those details are
                  intended to be shared.
                </span>
              </div>

              <div className="shared-practice-publisher__modules">
                {selectableModules.map((module) => {
                  const localOnly =
                    module.harness.authority?.propagation === "local-only";
                  const checked = draft.moduleIds.includes(module.harness.id);
                  const mode = module.harness.authority?.mode ?? "adaptable";
                  return (
                    <label
                      className={`shared-practice-publisher__module ${
                        localOnly
                          ? "shared-practice-publisher__module--disabled"
                          : ""
                      }`}
                      key={module.harness.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={localOnly}
                        onChange={(event) =>
                          toggleModule(module.harness.id, event.target.checked)
                        }
                      />
                      <span>
                        <strong>{module.title}</strong>
                        <code>{module.harness.id}</code>
                        <small>
                          {localOnly
                            ? "Stays local · not available to publish"
                            : `${module.type} · ${mode === "binding" ? "Binding" : "Adaptable"} · ${module.harness.criticality}`}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {errors.length > 0 && draft.moduleIds.length > 0 ? (
              <div className="notice notice--error" role="alert">
                {errors.map((diagnostic) => (
                  <span key={`${diagnostic.code}-${diagnostic.message}`}>
                    {diagnostic.message}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="route-actions">
              <span>
                Review the exact publication before choosing where to save it.
              </span>
              <button
                className="primary-action"
                type="submit"
                disabled={publication.blocked}
              >
                Review publication
              </button>
            </div>
          </form>
        ) : publication.content && publication.document ? (
          <div className="shared-practice-publisher__review">
            <div className="proposal-summary">
              <div>
                <span>Publication</span>
                <strong>{publication.document.title}</strong>
              </div>
              <div>
                <span>Version</span>
                <strong>{publication.document.version}</strong>
              </div>
              <div>
                <span>Instructions</span>
                <strong>{publication.modules.length}</strong>
              </div>
            </div>

            <div className="shared-practice-publisher__review-list">
              {publication.modules.map((module) => (
                <article key={module.harness.id}>
                  <div>
                    <strong>{module.title}</strong>
                    <code>{module.harness.id}</code>
                  </div>
                  <span>
                    {module.harness.authority?.mode === "binding"
                      ? "Binding"
                      : "Adaptable"}
                  </span>
                </article>
              ))}
            </div>

            <details className="file-plan">
              <summary>Show the shared-practice file</summary>
              <pre className="prompt-preview">
                <code>{publication.content}</code>
              </pre>
            </details>

            <label className="shared-practice-publisher__replace">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              <span>
                Allow replacing an existing file I explicitly choose in the
                save dialog.
              </span>
            </label>

            <div className="route-actions">
              <button
                className="quiet-action"
                type="button"
                onClick={() => setStep("choose")}
              >
                Change publication
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={saving}
                onClick={() => void savePublication()}
              >
                {saving ? "Saving…" : "Choose where to save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="notice notice--error" role="alert">
            Rack could not prepare this publication. Go back and review the
            selected instructions and details.
          </div>
        )}
      </div>
    </details>
  );
}
