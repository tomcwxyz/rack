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
import { StarterPackChooser } from "./components/StarterPackChooser.js";
import {ScratchRackCreator} from "./components/ScratchRackCreator.js";
import { TopoConnectionIndicator } from "./components/TopoConnectionIndicator.js";
import type { StarterPackIntent } from "./creationStarterPack.js";

type CreationState = "choose" | "pack" | "scratch" | CreationRouteId | null;

export function App() {
  const [project, setProject] = useState<RackProject | null>(null);
  const [creating, setCreating] = useState<CreationState>("choose");
  const [creationRoute, setCreationRoute] = useState<CreationRouteId | null>(null);
  const [starterPackId, setStarterPackId] = useState<string | null>(null);
  const [starterPackModuleIds, setStarterPackModuleIds] =
    useState<string[] | null>(null);
  const [starterPackIntent, setStarterPackIntent] =
    useState<StarterPackIntent>("use");
  const [loading, setLoading] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const applySnapshot = (snapshot: ProjectSnapshot) => {
    setProject(parseProjectSnapshot(snapshot));
    setCreating(null);
    setCreationRoute(null);
    setStarterPackId(null);
    setStarterPackModuleIds(null);
    setOpenError(null);
  };

  const chooseRack = async (expectedRoute?: CreationRouteId | null) => {
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
      if (expectedRoute) {
        const opened = parseProjectSnapshot(snapshot);
        const domains = opened.profiles.flatMap(profile => profile.domains);
        if (!domains.includes(expectedRoute === "coding" ? "code" : expectedRoute)) throw new Error(`This RACK is not configured for ${expectedRoute}. Choose its work type first.`);
      }
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
      starterPackId,
      starterPackModuleIds,
      starterPackIntent,
      onCancel: () => setCreating(creationRoute ? "pack" : "choose"),
      onCreated: applySnapshot,
    };

    return (
      <div className="app-shell app-shell--creation" aria-busy={loading}>
        <aside className="sidebar">
          <button
            className="wordmark wordmark--button"
            type="button"
            onClick={() => setCreating("choose")}
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
              onClick={() => setCreating("choose")}
            >
              Choose work type
            </button>
          </div>
        </aside>
        <main className="workspace creation-workspace">
          {openError ? <div className="notice notice--error" role="alert">{openError}</div> : null}
          {creating === "choose" ? (
            <RouteChooser
              onSelect={(route) => {
                setCreationRoute(route);
                setStarterPackId(null);
                setStarterPackModuleIds(null);
                setOpenError(null);
                setCreating("pack");
              }}
            />
          ) : null}
          {creating === "pack" && creationRoute ? (
            <StarterPackChooser
              route={creationRoute}
              onOpenExisting={() => void chooseRack(creationRoute)}
              onScratch={() => setCreating("scratch")}
              onBack={() => {
                setCreationRoute(null);
                setStarterPackId(null);
                setStarterPackModuleIds(null);
                setOpenError(null);
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
          {creating === "scratch" && creationRoute ? <ScratchRackCreator route={creationRoute} onBack={()=>setCreating("pack")} onCreated={applySnapshot}/> : null}
          {creating === "writing" ? <WritingRoute {...routeProps} /> : null}
          {creating === "research" ? <ResearchRoute {...routeProps} /> : null}
          {creating === "coding" ? <CodingRoute {...routeProps} /> : null}
        </main>
      </div>
    );
  }

  return null;
}
