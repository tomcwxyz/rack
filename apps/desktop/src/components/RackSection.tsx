import { useMemo } from "react";
import type { RackProject } from "@rack/core";

type GuidedModule = Extract<
  RackProject["modules"][number],
  { type: "context" | "voice" }
>;

type RackSectionProps = {
  project: RackProject;
  onGuidedEdit: (module: GuidedModule) => void;
  onSourceEdit: (path: string, title: string) => void;
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

export function RackSection({
  project,
  onGuidedEdit,
  onSourceEdit,
}: RackSectionProps) {
  const groupedModules = useMemo(() => {
    const groups = new Map<string, RackProject["modules"]>();
    for (const module of project.modules) {
      groups.set(module.type, [...(groups.get(module.type) ?? []), module]);
    }
    return groups;
  }, [project]);
  const errors = project.diagnostics.filter((item) => item.severity === "error");

  return (
    <>
      <section className="summary-strip" aria-label="Rack summary">
        <div><strong>{project.modules.length}</strong><span>instructions</span></div>
        <div><strong>{project.profiles.length}</strong><span>set-ups</span></div>
        <div><strong>{errors.length}</strong><span>blocking problems</span></div>
        <div className="summary-path">
          <span>{errors.length === 0 ? "Source is ready to build" : "Source needs attention"}</span>
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
            Context and voice instructions have guided maintenance. Advanced source editing remains available.
          </span>
        </div>

        <div className="instruction-groups">
          {[...groupedModules.entries()].map(([type, modules]) => (
            <section className="instruction-group" key={type}>
              <h3>{typeLabels[type] ?? type}</h3>
              <div className="card-grid">
                {modules.map((module) => (
                  <article className="instruction-card" key={module.harness.id}>
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
                      <div className="card-actions">
                        {module.type === "context" || module.type === "voice" ? (
                          <button
                            className="source-edit-button"
                            type="button"
                            onClick={() => onGuidedEdit(module)}
                          >
                            Edit details
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
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
