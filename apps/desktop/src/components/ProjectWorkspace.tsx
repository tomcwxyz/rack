import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSnapshot, RackProject } from "@rack/core";
import { resolveAttachedSharedPractice } from "../sharedPractice.js";
import { useSharedPracticeLifecycle } from "../useSharedPracticeLifecycle.js";
import { ChecksSection } from "./ChecksSection.js";
import { FirstValueSection } from "./FirstValueSection.js";
import { GuidedContextEditor } from "./GuidedContextEditor.js";
import { GuidedSetupEditor } from "./GuidedSetupEditor.js";
import { GuidedStructuredEditor } from "./GuidedStructuredEditor.js";
import { GuidedVoiceEditor } from "./GuidedVoiceEditor.js";
import { LibrarySection } from "./LibrarySection.js";
import { PreviewSection } from "./PreviewSection.js";
import { RackSection } from "./RackSection.js";
import { SetupsSection } from "./SetupsSection.js";
import { SharedPracticeSection } from "./SharedPracticeSection.js";
import { SourceEditor } from "./SourceEditor.js";
import { TopoConnectionIndicator } from "./TopoConnectionIndicator.js";
import { VerificationSection } from "./VerificationSection.js";

type WorkspaceSection =
  | "home"
  | "rack"
  | "shared"
  | "setups"
  | "preview"
  | "verify"
  | "checks"
  | "library";
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
  const [section, setSection] = useState<WorkspaceSection>("home");
  const [selectedProfile, setSelectedProfile] = useState(defaultProfile);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [workRoot, setWorkRoot] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void invoke<string | null>("read_work_target", { rackRoot: project.root })
      .then((value) => {
        if (active) setWorkRoot(value);
      })
      .catch(() => {
        if (active) setWorkRoot(null);
      });
    return () => {
      active = false;
    };
  }, [project.root]);

  const sharedPractice = useSharedPracticeLifecycle(project.root);
  const [editing, setEditing] = useState<EditingSource | null>(null);
  const sharedResolution = useMemo(
    () => resolveAttachedSharedPractice(project, sharedPractice.accepted),
    [project, sharedPractice.accepted],
  );
  const effectiveProject = sharedResolution?.project ?? project;
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

  const chooseWorkRoot = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose the project this Rack should work with",
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (path) {
      const canonical = await invoke<string>("set_work_target", {
        rackRoot: project.root,
        workRoot: path,
      });
      setWorkRoot(canonical);
      setActionStatus(
        "Work project selected. AI-tool hand-off and local checks will use this folder.",
      );
    }
  };

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

  const advancedActive = ["shared", "setups", "checks", "library"].includes(section);
  const showWorkTarget = ["preview", "verify", "checks"].includes(section);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="wordmark wordmark--button"
          type="button"
          onClick={() => setSection("home")}
          aria-label="Rack home"
        >
          rack
        </button>
        <nav aria-label="Primary navigation">
          <button
            className={`nav-item ${section === "home" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("home")}
          >
            Work
          </button>
          <button
            className={`nav-item ${section === "rack" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("rack")}
          >
            Improve
          </button>
          <button
            className={`nav-item ${section === "preview" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("preview")}
          >
            Use with AI
          </button>
          <button
            className={`nav-item ${section === "verify" ? "nav-item--active" : ""}`}
            type="button"
            onClick={() => setSection("verify")}
          >
            Check work
          </button>

          <details className="sidebar-advanced" open={advancedActive || undefined}>
            <summary>More</summary>
            <button
              className={`nav-item ${section === "shared" ? "nav-item--active" : ""}`}
              type="button"
              onClick={() => setSection("shared")}
            >
              Shared practice
            </button>
            <button
              className={`nav-item ${section === "setups" ? "nav-item--active" : ""}`}
              type="button"
              onClick={() => setSection("setups")}
            >
              Set-ups
            </button>
            <button
              className={`nav-item ${section === "checks" ? "nav-item--active" : ""}`}
              type="button"
              onClick={() => setSection("checks")}
            >
              Test this Rack
            </button>
            <button
              className={`nav-item ${section === "library" ? "nav-item--active" : ""}`}
              type="button"
              onClick={() => setSection("library")}
            >
              Starter library
            </button>
          </details>
        </nav>
        <div className="sidebar-footer">
          <TopoConnectionIndicator
            compact
            onOpenContext={() => setSection("preview")}
          />
          <p className="sidebar-note">Teach AI how you work.</p>
          <button className="sidebar-link" type="button" onClick={onOpenAnother}>
            Open another Rack
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">
              {section === "home"
                ? "Ready to work"
                : `Local source · ${project.manifest?.version ?? "unknown version"}`}
            </p>
            <h1>{project.manifest?.title ?? "Your Rack"}</h1>
            <p className="lede">
              {section === "home"
                ? "Your working practice is local, inspectable and ready to use with the tools you already have."
                : project.manifest?.description ||
                  "Maintain the source once, then use it across different AI tools."}
            </p>
          </div>
          {section !== "home" ? (
            <div className="header-path" title={project.root}>
              <span>Stored locally</span>
              <code>{project.root}</code>
            </div>
          ) : null}
        </header>

        {actionStatus ? (
          <div className="notice notice--success" role="status">
            <span>{actionStatus}</span>
          </div>
        ) : null}

        {showWorkTarget ? (
          <div className="work-target-bar">
            <div>
              <p className="eyebrow">Work project</p>
              {workRoot ? (
                <>
                  <strong>AI-tool hand-off and local checks use this folder</strong>
                  <code title={workRoot}>{workRoot}</code>
                </>
              ) : (
                <>
                  <strong>Choose where this Rack should apply</strong>
                  <span>
                    Your Rack source stays separate. Choose the actual project or
                    repository before installing AI-tool files or running local checks.
                  </span>
                </>
              )}
            </div>
            <div className="button-row">
              <button
                className="quiet-action"
                type="button"
                onClick={() => void chooseWorkRoot()}
              >
                {workRoot ? "Change work project" : "Choose work project"}
              </button>
              {!workRoot ? (
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() => {
                    void invoke<string>("set_work_target", {
                      rackRoot: project.root,
                      workRoot: project.root,
                    }).then((canonical) => {
                      setWorkRoot(canonical);
                      setActionStatus("Using the Rack folder itself as the work project.");
                    });
                  }}
                >
                  Use Rack folder
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {section === "home" ? (
          <FirstValueSection
            workRoot={workRoot}
            onChooseWorkRoot={() => void chooseWorkRoot()}
            onUseWithAi={() => setSection("preview")}
            onImprovePractice={() => setSection("rack")}
            onCheckWork={() => setSection("verify")}
          />
        ) : null}

        {section === "rack" ? (
          <RackSection
            project={project}
            onGuidedEdit={(module) => setEditing({ kind: "guided", module })}
            onSourceEdit={sourceEdit}
          />
        ) : null}

        {section === "shared" ? (
          <SharedPracticeSection
            project={project}
            lifecycle={sharedPractice}
            resolution={sharedResolution}
            onStatus={setActionStatus}
          />
        ) : null}

        {section === "setups" ? (
          <SetupsSection
            project={effectiveProject}
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
            project={effectiveProject}
            selectedProfile={selectedProfile}
            onProfileChange={setSelectedProfile}
            onStatus={setActionStatus}
            workRoot={workRoot}
          />
        ) : null}

        {section === "verify" ? (
          <VerificationSection
            project={effectiveProject}
            selectedProfile={selectedProfile}
            onProfileChange={setSelectedProfile}
            workRoot={workRoot}
          />
        ) : null}

        {section === "checks" ? (
          <ChecksSection
            project={effectiveProject}
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
          modules={effectiveProject.modules}
          sharedBindingIds={
            sharedResolution?.profileChanges.find(
              (change) => change.profileId === editing.profile.id,
            )?.applicableBindingIds ?? []
          }
          sharedAdaptableDefaultIds={
            sharedResolution?.profileChanges.find(
              (change) => change.profileId === editing.profile.id,
            )?.applicableAdaptableDefaultIds ?? []
          }
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
