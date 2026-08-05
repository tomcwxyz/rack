import { useState } from "react";
import type { ProjectSnapshot, RackProject } from "@rack/core";
import { PreviewSection } from "./PreviewSection.js";
import { RackSection } from "./RackSection.js";
import { SetupsSection } from "./SetupsSection.js";
import { SourceEditor } from "./SourceEditor.js";

type WorkspaceSection = "rack" | "setups" | "preview";
type EditingSource = { path: string; title: string };

type ProjectWorkspaceProps = {
  project: RackProject;
  onOpenAnother: () => void;
  onProjectChanged: (snapshot: ProjectSnapshot) => void;
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
          <RackSection
            project={project}
            onEdit={(path, title) => setEditing({ path, title })}
          />
        ) : null}

        {section === "setups" ? (
          <SetupsSection
            project={project}
            selectedProfile={selectedProfile}
            onEdit={(path, title) => setEditing({ path, title })}
            onPreview={(profileId) => {
              setSelectedProfile(profileId);
              setSection("preview");
            }}
          />
        ) : null}

        {section === "preview" ? (
          <PreviewSection
            project={project}
            selectedProfile={selectedProfile}
            onProfileChange={setSelectedProfile}
            onStatus={setActionStatus}
          />
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
