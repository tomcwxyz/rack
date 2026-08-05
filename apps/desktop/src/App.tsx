import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
  type RackProject,
} from "@rack/core";

const typeLabels: Record<string, string> = {
  context: "Context",
  voice: "Voice and language",
  method: "Ways of working",
  craft: "Practice",
  guardrail: "Boundaries",
  task: "Repeatable tasks",
  tools: "Tools expected",
};

export function App() {
  const [project, setProject] = useState<RackProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const groupedModules = useMemo(() => {
    const groups = new Map<string, RackProject["modules"]>();

    for (const module of project?.modules ?? []) {
      groups.set(module.type, [...(groups.get(module.type) ?? []), module]);
    }

    return groups;
  }, [project]);

  const chooseRack = async () => {
    setOpenError(null);
    setLoading(true);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open a Rack",
      });

      if (!selected) {
        return;
      }

      const snapshot = await invoke<ProjectSnapshot>("read_rack_project", {
        path: selected,
      });
      setProject(parseProjectSnapshot(snapshot));
    } catch (error) {
      setOpenError(
        error instanceof Error
          ? error.message
          : "Rack could not open that folder.",
      );
    } finally {
      setLoading(false);
    }
  };

  const errors =
    project?.diagnostics.filter((item) => item.severity === "error") ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="wordmark" href="#top" aria-label="Rack home">
          rack
        </a>
        <nav aria-label="Primary navigation">
          <a className="nav-item nav-item--active" href="#rack">
            Your Rack
          </a>
          <span className="nav-item nav-item--muted">Set-ups</span>
          <span className="nav-item nav-item--muted">Preview and export</span>
          <span className="nav-item nav-item--muted">Checks</span>
          <span className="nav-item nav-item--muted">Library</span>
        </nav>
        <p className="sidebar-note">Build your AI working practices.</p>
      </aside>

      <main id="top" className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Local-first · implementation preview</p>
            <h1>{project?.manifest?.title ?? "Your Rack"}</h1>
            <p className="lede">
              {project?.manifest?.description ||
                "Open a Rack folder to see the instructions it carries."}
            </p>
          </div>
          <button
            className="primary-action"
            onClick={chooseRack}
            disabled={loading}
          >
            {loading
              ? "Opening…"
              : project
                ? "Open another Rack"
                : "Open a Rack"}
          </button>
        </header>

        {openError ? (
          <section className="notice notice--error" role="alert">
            <strong>That Rack could not be opened.</strong>
            <span>{openError}</span>
          </section>
        ) : null}

        {!project ? (
          <section className="empty-state">
            <div className="empty-mark" aria-hidden="true">
              /
            </div>
            <h2>Start with the source</h2>
            <p>
              Rack projects stay on your computer. Choose a folder containing a
              <code> rack.yaml </code> file and Rack will read it locally.
            </p>
            <button className="secondary-action" onClick={chooseRack}>
              Choose a folder
            </button>
          </section>
        ) : (
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
              <div className="summary-path" title={project.root}>
                <span>{project.root}</span>
              </div>
            </section>

            {project.diagnostics.length > 0 ? (
              <section
                className="diagnostics"
                aria-labelledby="diagnostics-heading"
              >
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

            <section id="rack" aria-labelledby="instructions-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Canonical source</p>
                  <h2 id="instructions-heading">Instructions in this Rack</h2>
                </div>
                <button className="quiet-action" type="button">
                  Add an instruction
                </button>
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
                          <span className="source-label">Yours · local</span>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
