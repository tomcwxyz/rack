import { useState } from "react";
import { FirstRun } from "./components/FirstRun.js";
import type { FirstRunHost } from "./components/FirstRunHandoff.js";
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
import { StarterPackChooser } from "./components/StarterPackChooser.js";
import { TopoConnectionIndicator } from "./components/TopoConnectionIndicator.js";
import type { StarterPackIntent } from "./creationStarterPack.js";

type CreationState = "choose" | "pack" | CreationRouteId | null;

export function App() {
  const [initialHost, setInitialHost] = useState<FirstRunHost | null>(null);
  const [project, setProject] = useState<RackProject | null>(null);
  const [creating, setCreating] = useState<CreationState>(null);
  const [creationRoute, setCreationRoute] = useState<CreationRouteId | null>(null);
  const [starterPackId, setStarterPackId] = useState<string | null>(null);
  const [starterPackModuleIds, setStarterPackModuleIds] =
    useState<string[] | null>(null);
  const [starterPackIntent, setStarterPackIntent] =
    useState<StarterPackIntent>("use");
  const [loading, setLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const applySnapshot = (snapshot: ProjectSnapshot) => {
    setInitialHost(null);
    setProject(parseProjectSnapshot(snapshot));
    setCreating(null);
    setCreationRoute(null);
    setStarterPackId(null);
    setStarterPackModuleIds(null);
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
        initialHost={initialHost}
        onOpenAnother={() => {
          void chooseRack();
        }}
        onProjectChanged={applySnapshot}
      />
    );
  }

  if (creating) {
    const routeProps = {
      starterPackId,
      starterPackModuleIds,
      starterPackIntent,
      onCancel: () => setCreating(creationRoute ? "pack" : "choose"),
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
              Start with your work
            </button>
          </nav>
          <div className="sidebar-footer">
            <TopoConnectionIndicator compact />
            <p className="sidebar-note">
              TOPO can help with context if it is running, but you do not need it to use Rack.
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
              onSelect={(route) => {
                setCreationRoute(route);
                setStarterPackId(null);
                setStarterPackModuleIds(null);
                setCreating("pack");
              }}
            />
          ) : null}
          {creating === "pack" && creationRoute ? (
            <StarterPackChooser
              route={creationRoute}
              onBack={() => {
                setCreationRoute(null);
                setStarterPackId(null);
                setStarterPackModuleIds(null);
                setCreating("choose");
              }}
              onSelect={(templateId, intent, moduleIds) => {
                setStarterPackId(templateId);
                setStarterPackModuleIds(moduleIds);
                setStarterPackIntent(intent);
                setCreating(creationRoute);
              }}
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
    <FirstRun
      onOpen={() => void chooseRack()}
      opening={loading}
      openError={openError}
      onAdvanced={() => setCreating("choose")}
      onCreated={(snapshot, host) => {
        applySnapshot(snapshot);
        setInitialHost(host);
      }}
    />
  );
}
