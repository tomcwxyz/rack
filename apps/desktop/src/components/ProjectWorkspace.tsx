import { useEffect, useRef, useState } from "react";
import type { ProjectSnapshot, RackProject } from "@rack/core";
import { ChecksSection } from "./ChecksSection.js";
import { GuidedContextEditor } from "./GuidedContextEditor.js";
import { GuidedSetupEditor } from "./GuidedSetupEditor.js";
import { GuidedStructuredEditor } from "./GuidedStructuredEditor.js";
import { GuidedVoiceEditor } from "./GuidedVoiceEditor.js";
import { LibrarySection } from "./LibrarySection.js";
import { PreviewSection } from "./PreviewSection.js";
import { RackSection } from "./RackSection.js";
import { SetupsSection } from "./SetupsSection.js";
import { SourceEditor } from "./SourceEditor.js";

type WorkspaceSection = "rack" | "setups" | "preview" | "checks" | "library";
type GuidedModule = Extract<
  RackProject["modules"][number],
  { type: "context" | "voice" | "guardrail" | "task" }
>;
type RackProfile = RackProject["profiles"][number];
type EditingSource =
  | { kind: "source"; path: string; title: string }
  | { kind: "guided"; module: GuidedModule }
  | { kind: "setup"; profile: RackProfile };

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
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const editingOpen = editing !== null;
  const editingIdentity = editing
    ? editing.kind === "source"
      ? `source:${editing.path}`
      : editing.kind === "guided"
        ? `guided:${editing.module.path}`
        : `setup:${editing.profile.path}`
    : "closed";

  useEffect(() => {
    if (!editingOpen) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setEditing(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target = previouslyFocused.current;
      previouslyFocused.current = null;
      window.requestAnimationFrame(() => {
        if (target?.isConnected) target.focus();
      });
    };
  }, [editingOpen]);

  useEffect(() => {
    if (!editingOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        '[role="dialog"] input:not([disabled]), [role="dialog"] textarea:not([disabled]), [role="dialog"] select:not([disabled]), [role="dialog"] button:not([disabled])',
      );
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingIdentity, editingOpen]);

  const sourceEdit = (path: string, title: string) =>
    setEditing({ kind: "source", path, title });

  const guidedProps = editing?.kind === "guided"
    ? {
        projectRoot: project.root,
        onClose: () => setEditing(null),
        onAdvanced: () =>
          setEditing({
            kind: "source" as const,
            path: editing.module.path,
            title: editing.module.title,
          }),
        onSaved: (snapshot: ProjectSnapshot) => {
          const title = editing.module.title;
          setEditing(null);
          setActionStatus(`${title} was saved and rechecked.`);
          onProjectChanged(snapshot);
        },
      }
    : null;

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
          <button
            className={`nav-item ${section === "checks" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("checks")}
          >
            Checks
          </button>
          <button
            className={`nav-item ${section === "library" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("library")}
          >
            Library
          </button>
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
            onGuidedEdit={(module) => setEditing({ kind: "guided", module })}
            onSourceEdit={sourceEdit}
          />
        ) : null}

        {section === "setups" ? (
          <SetupsSection
            project={project}
            selectedProfile={selectedProfile}
            onGuidedEdit={(profile) => setEditing({ kind: "setup", profile })}
            onSourceEdit={sourceEdit}
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

        {section === "checks" ? (
          <ChecksSection
            project={project}
            selectedProfile={selectedProfile}
            onProfileChange={setSelectedProfile}
          />
        ) : null}

        {section === "library" ? (
          <LibrarySection
            project={project}
            onProjectChanged={onProjectChanged}
            onStatus={setActionStatus}
          />
        ) : null}
      </main>

      {editing?.kind === "source" ? (
        <SourceEditor
          projectRoot={project.root}
          path={editing.path}
          title={editing.title}
          onClose={() => setEditing(null)}
          onSaved={(snapshot) => {
            const title = editing.title;
            setEditing(null);
            setActionStatus(`${title} was saved and rechecked.`);
            onProjectChanged(snapshot);
          }}
        />
      ) : null}

      {editing?.kind === "guided" && editing.module.type === "context" && guidedProps ? (
        <GuidedContextEditor module={editing.module} {...guidedProps} />
      ) : null}

      {editing?.kind === "guided" && editing.module.type === "voice" && guidedProps ? (
        <GuidedVoiceEditor module={editing.module} {...guidedProps} />
      ) : null}

      {editing?.kind === "guided" &&
      (editing.module.type === "guardrail" || editing.module.type === "task") &&
      guidedProps ? (
        <GuidedStructuredEditor module={editing.module} {...guidedProps} />
      ) : null}

      {editing?.kind === "setup" ? (
        <GuidedSetupEditor
          projectRoot={project.root}
          profile={editing.profile}
          modules={project.modules}
          onClose={() => setEditing(null)}
          onAdvanced={() =>
            setEditing({
              kind: "source",
              path: editing.profile.path,
              title: `${editing.profile.title} Set-up`,
            })
          }
          onSaved={(snapshot) => {
            const title = editing.profile.title;
            setEditing(null);
            setActionStatus(`${title} Set-up was saved and rechecked.`);
            onProjectChanged(snapshot);
          }}
        />
      ) : null}
    </div>
  );
}
