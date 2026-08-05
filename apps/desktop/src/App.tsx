import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  parseProjectSnapshot,
  type ProjectSnapshot,
  type RackProject,
} from "@rack/core";
import { ProjectWorkspace } from "./components/ProjectWorkspace.js";
import { WritingRoute } from "./components/WritingRoute.js";

export function App() {
  const [project, setProject] = useState<RackProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const applySnapshot = (snapshot: ProjectSnapshot) => {
    setProject(parseProjectSnapshot(snapshot));
    setCreating(false);
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
        project={project}
        onOpenAnother={() => {
          void chooseRack();
        }}
      />
    );
  }

  if (creating) {
    return (
      <main className="standalone-workspace">
        <WritingRoute
          onCancel={() => setCreating(false)}
          onCreated={applySnapshot}
        />
      </main>
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

      <section className="welcome-hero">
        <div>
          <p className="eyebrow">Local-first · implementation preview</p>
          <h1>Carry the useful parts of how you work.</h1>
          <p className="lede">
            Create one inspectable source for your context, voice, methods, boundaries and repeatable tasks—then build it for different AI tools.
          </p>
          <div className="button-row button-row--large">
            <button
              className="primary-action"
              type="button"
              onClick={() => setCreating(true)}
            >
              Create a Writing Rack
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
          <p className="eyebrow">First guided route</p>
          <h2>Writing and communications</h2>
          <p>
            Capture organisation and audience context, choose a voice, add an evidence boundary and make one repeatable task.
          </p>
          <ul>
            <li>No account</li>
            <li>No model connection</li>
            <li>Review before files are written</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
