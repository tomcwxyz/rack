import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
  type RackProject,
} from "@rack/core";
import { CodingRoute } from "./components/CodingRoute.js";
import { ProjectWorkspace } from "./components/ProjectWorkspace.js";
import { ResearchRoute } from "./components/ResearchRoute.js";
import {
  RouteChooser,
  type CreationRouteId,
} from "./components/RouteChooser.js";
import { WritingRoute } from "./components/WritingRoute.js";
import { TopoConnectionIndicator } from "./components/TopoConnectionIndicator.js";

type CreationState = "choose" | CreationRouteId | null;

export function App() {
  const [project, setProject] = useState<RackProject | null>(null);
  const [creating, setCreating] = useState<CreationState>(null);
  const [loading, setLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const applySnapshot = (snapshot: ProjectSnapshot) => {
    setProject(parseProjectSnapshot(snapshot));
    setCreating(null);
    setOpenError(null);
  };

  const chooseRack = async () => {
    setOpenError(null);
    setLoading(true);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open a Rack",
      });
      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      const snapshot = await invoke<ProjectSnapshot>("read_rack_project", {
        path,
      });
      applySnapshot(snapshot);
    } catch (reason) {
      setOpenError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not open that folder.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (project) {
    return (
      <ProjectWorkspace
        key={project.root}
        project={project}
        onOpenAnother={() => {
          void chooseRack();
        }}
        onProjectChanged={applySnapshot}
      />
    );
  }

  if (creating) {
    const routeProps = {
      onCancel: () => setCreating("choose" as const),
      onCreated: applySnapshot,
    };

    return (
      <div className="app-shell app-shell--creation">
        <aside className="sidebar">
          <button
            className="wordmark wordmark--button"
            type="button"
            onClick={() => setCreating(null)}
            aria-label="Rack home"
          >
            rack
          </button>
          <nav aria-label="Creation navigation">
            <button
              className="nav-item nav-item--active"
              type="button"
              onClick={() => setCreating("choose")}
            >
              Create a Rack
            </button>
          </nav>
          <div className="sidebar-footer">
            <TopoConnectionIndicator compact />
            <p className="sidebar-note">
              TOPO stays visible while you create this Rack.
            </p>
            <button
              className="sidebar-link"
              type="button"
              onClick={() => setCreating(null)}
            >
              Back to Rack home
            </button>
          </div>
        </aside>
        <main className="workspace creation-workspace">
          {creating === "choose" ? (
            <RouteChooser
              onCancel={() => setCreating(null)}
              onSelect={setCreating}
            />
          ) : null}
          {creating === "writing" ? <WritingRoute {...routeProps} /> : null}
          {creating === "research" ? <ResearchRoute {...routeProps} /> : null}
          {creating === "coding" ? <CodingRoute {...routeProps} /> : null}
        </main>
      </div>
    );
  }

  return (
    <main className="welcome-shell">
      <header className="welcome-header">
        <span className="wordmark">rack</span>
        <p>Build your AI working practices.</p>
      </header>

      {openError ? (
        <div className="notice notice--error" role="alert">
          <strong>That Rack could not be opened.</strong>
          <span>{openError}</span>
        </div>
      ) : null}

      <TopoConnectionIndicator />

      <section className="welcome-hero">
        <div>
          <p className="eyebrow">Local-first · working pre-release</p>
          <h1>Carry the useful parts of how you work.</h1>
          <p className="lede">
            Create one inspectable source for your context, methods, boundaries
            and repeatable tasks—then build it for different AI tools.
          </p>
          <div className="button-row button-row--large">
            <button
              className="primary-action"
              type="button"
              onClick={() => setCreating("choose")}
            >
              Create a Rack
            </button>
            <button
              className="secondary-action secondary-action--light"
              type="button"
              onClick={chooseRack}
              disabled={loading}
            >
              {loading ? "Opening…" : "Open an existing Rack"}
            </button>
          </div>
        </div>
        <aside className="welcome-card">
          <p className="eyebrow">Three guided starting routes</p>
          <h2>Writing, research or coding</h2>
          <p>
            Start with the work you need to support. Review every proposed
            instruction before Rack writes local files.
          </p>
          <ul>
            <li>No account or model connection</li>
            <li>Plain-language guided questions</li>
            <li>Editable Markdown and YAML source</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
