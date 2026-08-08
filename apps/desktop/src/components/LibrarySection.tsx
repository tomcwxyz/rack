import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
  type RackProject,
} from "@rack/core";
import {
  planStarterImport,
  type StarterImportPlan,
} from "@rack/core/starter";
import {
  searchStarterCatalogue,
  starterCatalogue,
  starterTemplates,
  type StarterEntry,
} from "@rack/starter";

type LibrarySectionProps = {
  project: RackProject;
  onProjectChanged: (snapshot: ProjectSnapshot) => void;
  onStatus: (message: string) => void;
};

const errorMessage = (reason: unknown): string =>
  reason instanceof Error
    ? reason.message
    : typeof reason === "string"
      ? reason
      : "Rack could not complete the Starter library action.";

export function LibrarySection({
  project,
  onProjectChanged,
  onStatus,
}: LibrarySectionProps) {
  const [query, setQuery] = useState("");
  const [route, setRoute] = useState<"" | "writing" | "research" | "coding">("");
  const [type, setType] = useState<"" | StarterEntry["type"]>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState(project.manifest?.default_profile ?? "");
  const [plan, setPlan] = useState<StarterImportPlan | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      searchStarterCatalogue({
        query,
        route: route || undefined,
        type: type || undefined,
      }),
    [query, route, type],
  );

  const changeSelection = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setPlan(null);
    setError(null);
  };

  const useTemplate = (moduleIds: readonly string[]) => {
    setSelected(new Set(moduleIds));
    setPlan(null);
    setError(null);
  };

  const review = async () => {
    setReviewing(true);
    setError(null);
    try {
      const snapshot = await invoke<ProjectSnapshot>("read_rack_project", {
        path: project.root,
      });
      const freshProject = parseProjectSnapshot(snapshot);
      const nextPlan = planStarterImport(
        freshProject,
        snapshot,
        [...selected],
        profileId || null,
      );
      setPlan(nextPlan);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setReviewing(false);
    }
  };

  const apply = async () => {
    if (!plan || plan.blocked) return;
    setApplying(true);
    setError(null);
    try {
      const snapshot = await invoke<ProjectSnapshot>("apply_starter_import", {
        root: project.root,
        files: plan.files,
        profileChange: plan.profileChange
          ? {
              path: plan.profileChange.path,
              before: plan.profileChange.before,
              after: plan.profileChange.after,
            }
          : null,
      });
      const added = plan.items.filter((item) => item.status === "ready").length;
      const alreadyThere = plan.items.filter((item) => item.status === "identical").length;
      onProjectChanged(snapshot);
      onStatus(
        `Starter import complete: ${added} added${alreadyThere ? `, ${alreadyThere} already present` : ""}.`,
      );
      setSelected(new Set());
      setPlan(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="section-stack library-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bundled · local · CC BY 4.0</p>
          <h2>Starter library</h2>
          <p>
            Browse reusable instructions, inspect the exact source, then review what Rack would
            copy before anything changes. Imported files become ordinary local Rack source.
          </p>
        </div>
        <span className="count-badge">{starterCatalogue.length} instructions</span>
      </div>

      <div className="library-templates" aria-label="Starting templates">
        {starterTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="template-card"
            onClick={() => useTemplate(template.moduleIds)}
          >
            <span className="template-card__route">{template.route}</span>
            <strong>{template.title}</strong>
            <span>{template.description}</span>
            <small>{template.moduleIds.length} instructions</small>
          </button>
        ))}
      </div>

      <div className="library-toolbar">
        <label className="field library-search">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPlan(null);
            }}
            placeholder="e.g. evidence, client email, testing"
          />
        </label>
        <label className="field">
          <span>Route</span>
          <select
            value={route}
            onChange={(event) => {
              setRoute(event.target.value as typeof route);
              setPlan(null);
            }}
          >
            <option value="">All routes</option>
            <option value="writing">Writing</option>
            <option value="research">Research</option>
            <option value="coding">Coding</option>
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as typeof type);
              setPlan(null);
            }}
          >
            <option value="">All types</option>
            <option value="context">Context</option>
            <option value="voice">Voice</option>
            <option value="method">Method</option>
            <option value="craft">Craft</option>
            <option value="guardrail">Boundary</option>
            <option value="task">Repeatable task</option>
            <option value="tools">Tools</option>
          </select>
        </label>
      </div>

      <div className="library-list">
        {visible.map((entry) => (
          <article className="library-card" key={entry.id}>
            <div className="library-card__select">
              <input
                type="checkbox"
                checked={selected.has(entry.id)}
                onChange={(event) => changeSelection(entry.id, event.target.checked)}
                aria-label={`Select ${entry.title}`}
              />
            </div>
            <div className="library-card__body">
              <div className="library-card__meta">
                <span>{entry.type}</span>
                <span>{entry.routes.filter((value) => value !== "shared").join(" · ") || "shared"}</span>
                <code>{entry.digest.replace("fnv1a64-u16:", "")}</code>
              </div>
              <h3>{entry.title}</h3>
              <p>{entry.description}</p>
              <div className="tag-row">
                {entry.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <details className="source-inspection">
                <summary>Inspect exact source and attribution</summary>
                {entry.attribution ? (
                  <p className="source-attribution">
                    Method attribution: {entry.attribution.name}
                    {entry.attribution.note ? ` — ${entry.attribution.note}` : ""}
                    {entry.attribution.url ? (
                      <>
                        <br />
                        <code>{entry.attribution.url}</code>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <pre>{entry.source}</pre>
              </details>
            </div>
          </article>
        ))}
      </div>

      <div className="library-review-bar">
        <div>
          <strong>{selected.size} selected</strong>
          <p>Nothing is fetched remotely and no existing module will be replaced.</p>
        </div>
        <label className="field">
          <span>Also add to Set-up</span>
          <select
            value={profileId}
            onChange={(event) => {
              setProfileId(event.target.value);
              setPlan(null);
            }}
          >
            <option value="">Do not change a Set-up</option>
            {project.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button--primary"
          type="button"
          disabled={selected.size === 0 || reviewing}
          onClick={() => void review()}
        >
          {reviewing ? "Reviewing…" : "Review import"}
        </button>
      </div>

      {error ? (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      ) : null}

      {plan ? (
        <div className="library-plan" aria-live="polite">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">Exact change review</p>
              <h3>{plan.blocked ? "Import needs attention" : "Ready to add"}</h3>
            </div>
          </div>
          <div className="library-plan__items">
            {plan.items.map((item) => (
              <div className={`plan-item plan-item--${item.status}`} key={item.entry.id}>
                <strong>{item.entry.title}</strong>
                <span>{item.message}</span>
              </div>
            ))}
          </div>
          {plan.profileChange ? (
            <details className="source-inspection" open>
              <summary>Set-up change: {plan.profileId}</summary>
              <div className="library-diff" role="region" aria-label="Set-up source diff">
                {plan.profileChange.diff
                  .filter((line) => line.kind !== "same")
                  .map((line, index) => (
                    <code key={`${line.kind}-${index}`} className={`diff-line diff-line--${line.kind}`}>
                      {line.kind === "add" ? "+ " : "- "}
                      {line.text || " "}
                    </code>
                  ))}
              </div>
            </details>
          ) : null}
          {plan.blockedReasons.map((reason) => (
            <div className="notice notice--error" key={reason}>
              {reason}
            </div>
          ))}
          <div className="library-plan__actions">
            <button className="button" type="button" onClick={() => setPlan(null)}>
              Change selection
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={plan.blocked || applying}
              onClick={() => void apply()}
            >
              {applying ? "Adding…" : "Add to Rack"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
