import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  buildPrompt,
  type ProjectSnapshot,
  type RackProject,
} from "@rack/core";
import { SourceEditor } from "./SourceEditor.js";

type WorkspaceSection = "rack" | "setups" | "preview";
type EditingSource = { path: string; title: string };

type ProjectWorkspaceProps = {
  project: RackProject;
  onOpenAnother: () => void;
  onProjectChanged: (snapshot: ProjectSnapshot) => void;
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

export function ProjectWorkspace({
  project,
  onOpenAnother,
  onProjectChanged,
}: ProjectWorkspaceProps) {
  const defaultProfile =
    project.manifest?.default_profile ?? project.profiles[0]?.id ?? "";
  const [section, setSection] = useState<WorkspaceSection>("rack");
  const [selectedProfile, setSelectedProfile] = useState(defaultProfile);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingSource | null>(null);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, RackProject["modules"]>();
    for (const module of project.modules) {
      groups.set(module.type, [...(groups.get(module.type) ?? []), module]);
    }
    return groups;
  }, [project]);

  const promptBuild = useMemo(
    () => buildPrompt(project, selectedProfile),
    [project, selectedProfile],
  );
  const errors = project.diagnostics.filter((item) => item.severity === "error");
  const buildErrors = promptBuild.diagnostics.filter(
    (item) => item.severity === "error",
  );

  const copyPrompt = async () => {
    if (!promptBuild.artifact) return;
    await navigator.clipboard.writeText(promptBuild.artifact.content);
    setActionStatus("Prompt copied to the clipboard.");
  };

  const exportPrompt = async () => {
    if (!promptBuild.artifact) return;
    const selected = await save({
      title: "Export generic prompt",
      defaultPath: promptBuild.artifact.path,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!selected) return;

    await invoke("write_generated_file", {
      path: selected,
      content: promptBuild.artifact.content,
    });
    setActionStatus(`Prompt exported to ${selected}.`);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="wordmark wordmark--button"
          type="button"
          onClick={() => setSection("rack")}
          aria-label="Rack home"
        >
          rack
        </button>
        <nav aria-label="Primary navigation">
          <button
            className={`nav-item ${section === "rack" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("rack")}
          >
            Your Rack
          </button>
          <button
            className={`nav-item ${section === "setups" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("setups")}
          >
            Set-ups
          </button>
          <button
            className={`nav-item ${section === "preview" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("preview")}
          >
            Preview and export
          </button>
          <span className="nav-item nav-item--muted">Checks</span>
          <span className="nav-item nav-item--muted">Library</span>
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-note">Build your AI working practices.</p>
          <button className="sidebar-link" type="button" onClick={onOpenAnother}>
            Open another Rack
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">
              Local source · {project.manifest?.version ?? "unknown version"}
            </p>
            <h1>{project.manifest?.title ?? "Your Rack"}</h1>
            <p className="lede">
              {project.manifest?.description ||
                "Maintain the source once, then build it for different destinations."}
            </p>
          </div>
          <div className="header-path" title={project.root}>
            <span>Stored locally</span>
            <code>{project.root}</code>
          </div>
        </header>

        {actionStatus ? (
          <div className="notice notice--success" role="status">
            <span>{actionStatus}</span>
          </div>
        ) : null}

        {section === "rack" ? (
          <>
            <section className="summary-strip" aria-label="Rack summary">
              <div>
                <strong>{project.modules.length}</strong>
                <span>instructions</span>
              </div>
              <div>
                <strong>{project.profiles.length}</strong>
                <span>set-ups</span>
              </div>
              <div>
                <strong>{errors.length}</strong>
                <span>blocking problems</span>
              </div>
              <div className="summary-path">
                <span>
                  {errors.length === 0
                    ? "Source is ready to build"
                    : "Source needs attention"}
                </span>
              </div>
            </section>

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
                    <article
                      className="diagnostic-card"
                      key={`${item.code}-${index}`}
                    >
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
                  Source editing is advanced in this iteration; guided editors follow.
                </span>
              </div>

              <div className="instruction-groups">
                {[...groupedModules.entries()].map(([type, modules]) => (
                  <section className="instruction-group" key={type}>
                    <h3>{typeLabels[type] ?? type}</h3>
                    <div className="card-grid">
                      {modules.map((module) => (
                        <article
                          className="instruction-card"
                          key={module.harness.id}
                        >
                          <div className="card-meta">
                            <span>{module.harness.criticality}</span>
                            <code>{module.harness.id}</code>
                          </div>
                          <h4>{module.title}</h4>
                          <p>
                            {module.description ||
                              module.body.split("\n").find(Boolean) ||
                              "No description yet."}
                          </p>
                          <div className="card-footer">
                            <span className="source-label">Yours · local</span>
                            <button
                              className="source-edit-button"
                              type="button"
                              onClick={() =>
                                setEditing({
                                  path: module.path,
                                  title: module.title,
                                })
                              }
                            >
                              Edit source
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {section === "setups" ? (
          <section aria-labelledby="setups-heading">
            <div className="section-heading section-heading--top">
              <div>
                <p className="eyebrow">Assemble for a purpose</p>
                <h2 id="setups-heading">Set-ups</h2>
              </div>
            </div>
            <p className="section-intro">
              A Set-up selects the instructions needed for a particular kind of
              work. Destinations are chosen separately.
            </p>
            <div className="setup-grid">
              {project.profiles.map((profile) => {
                const build = buildPrompt(project, profile.id);
                const blocked = build.diagnostics.some(
                  (item) => item.severity === "error",
                );
                return (
                  <article
                    className={`setup-card ${selectedProfile === profile.id ? "setup-card--selected" : ""}`}
                    key={profile.id}
                  >
                    <div>
                      <p className="eyebrow">{profile.domains.join(" · ")}</p>
                      <h3>{profile.title}</h3>
                      <p>{profile.description}</p>
                    </div>
                    <dl className="setup-facts">
                      <div>
                        <dt>Selected instructions</dt>
                        <dd>{build.compiled?.modules.length ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{blocked ? "Blocked" : "Ready"}</dd>
                      </div>
                    </dl>
                    <div className="setup-actions">
                      <button
                        className="quiet-action"
                        type="button"
                        onClick={() =>
                          setEditing({
                            path: profile.path,
                            title: `${profile.title} Set-up`,
                          })
                        }
                      >
                        Edit Set-up source
                      </button>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() => {
                          setSelectedProfile(profile.id);
                          setSection("preview");
                        }}
                      >
                        Preview this Set-up
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {section === "preview" ? (
          <section aria-labelledby="preview-heading">
            <div className="section-heading section-heading--top preview-heading">
              <div>
                <p className="eyebrow">Generic prompt destination</p>
                <h2 id="preview-heading">Preview and export</h2>
              </div>
              <label className="compact-field">
                <span>Set-up</span>
                <select
                  value={selectedProfile}
                  onChange={(event) => setSelectedProfile(event.target.value)}
                >
                  {project.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {buildErrors.length > 0 || !promptBuild.artifact ? (
              <div className="notice notice--error" role="alert">
                <strong>This Set-up cannot be built yet.</strong>
                {buildErrors.map((item) => (
                  <span key={`${item.code}-${item.message}`}>
                    {item.code}: {item.message}
                  </span>
                ))}
              </div>
            ) : (
              <div className="preview-layout">
                <aside className="contribution-panel">
                  <p className="eyebrow">What is carried across</p>
                  <h3>
                    {promptBuild.compiled?.modules.length ?? 0} instructions
                  </h3>
                  <ol>
                    {promptBuild.compiled?.modules.map((module) => (
                      <li key={module.harness.id}>
                        <strong>{module.title}</strong>
                        <code>{module.harness.id}</code>
                      </li>
                    ))}
                  </ol>
                </aside>
                <div className="prompt-panel">
                  <div className="prompt-toolbar">
                    <div>
                      <span>system-prompt.md</span>
                      <small>
                        {promptBuild.artifact.content.length.toLocaleString()} characters
                      </small>
                    </div>
                    <div className="button-row">
                      <button
                        className="quiet-action"
                        type="button"
                        onClick={copyPrompt}
                      >
                        Copy prompt
                      </button>
                      <button
                        className="primary-action"
                        type="button"
                        onClick={exportPrompt}
                      >
                        Export Markdown
                      </button>
                    </div>
                  </div>
                  <pre className="prompt-preview">
                    <code>{promptBuild.artifact.content}</code>
                  </pre>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </main>

      {editing ? (
        <SourceEditor
          projectRoot={project.root}
          path={editing.path}
          title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={(snapshot) => {
            setEditing(null);
            setActionStatus(`${editing.title} was saved and rechecked.`);
            onProjectChanged(snapshot);
          }}
        />
      ) : null}
    </div>
  );
}
