import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  buildHostInstallationPlan,
  buildTarget,
  getHostIntegrationForDestination,
  listTargetAdapters,
  type DestinationId,
  type RackProject,
} from "@rack/core";
import {
  attachContextToPromptBuild,
  inspectPreparedTargetBuild,
  prepareTargetBuild,
  type InstalledTargetBuild,
  type PreparedTargetBuild,
  type TargetBuildInspection,
} from "@rack/core/build";
import { discoverAiHosts, type HostDiscovery } from "../hostDiscovery.js";
import {
  TopoContextPanel,
  type TopoContextSelection,
} from "./TopoContextPanel.js";

type PreviewSectionProps = {
  project: RackProject;
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
  onStatus: (message: string) => void;
  workRoot: string | null;
};

type InstallResult = {
  directory: string;
  backupDirectory: string | null;
};

type HostInstallInspection = {
  hostId: string;
  profileId: string;
  status: "ready" | "current" | "update-available" | "conflict";
  files: Array<{
    path: string;
    status: "create" | "current" | "update" | "remove" | "conflict";
    detail: string;
  }>;
  canInstall: boolean;
  canRemove: boolean;
};

type HostInstallResult = {
  status: "installed" | "removed";
  backupDirectory: string | null;
  installedPaths: string[];
};

const hostInstallLabels: Record<HostInstallInspection["status"], string> = {
  ready: "Ready to install",
  current: "Installed and current",
  "update-available": "Update available",
  conflict: "Needs manual review",
};

const stateLabels: Record<TargetBuildInspection["status"], string> = {
  missing: "Not built",
  current: "Current",
  stale: "Rebuild needed",
  modified: "Changed outside Rack",
  "stale-and-modified": "Changed and stale",
  invalid: "Cannot verify",
};

const destinations = listTargetAdapters().filter(
  (adapter) => adapter.status === "supported",
);

const fileName = (path: string): string => path.split("/").at(-1) ?? path;

export function PreviewSection({
  project,
  selectedProfile,
  onProfileChange,
  onStatus,
  workRoot,
}: PreviewSectionProps) {
  const [target, setTarget] = useState<DestinationId>("prompt");
  const targetBuild = useMemo(
    () => buildTarget(project, selectedProfile, target),
    [project, selectedProfile, target],
  );
  const adapter = useMemo(
    () => destinations.find((candidate) => candidate.id === target),
    [target],
  );
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string | null>(
    null,
  );
  const [topoContext, setTopoContext] = useState<TopoContextSelection>({
    enabled: false,
    snapshot: null,
  });
  const [contextualBuild, setContextualBuild] =
    useState<PreparedTargetBuild | null>(null);
  const previewTargetBuild = contextualBuild?.targetBuild ?? targetBuild;
  const selectedArtifact =
    previewTargetBuild.artifacts.find(
      (artifact) => artifact.path === selectedArtifactPath,
    ) ?? previewTargetBuild.artifacts[0] ?? null;
  const [inspection, setInspection] = useState<TargetBuildInspection | null>(null);
  const [checking, setChecking] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [hostDiscoveries, setHostDiscoveries] = useState<HostDiscovery[]>([]);
  const [hostInspection, setHostInspection] =
    useState<HostInstallInspection | null>(null);
  const [hostBusy, setHostBusy] = useState<"inspect" | "install" | "remove" | null>(
    null,
  );
  const [hostError, setHostError] = useState<string | null>(null);

  const hostIntegration = useMemo(
    () => getHostIntegrationForDestination(target),
    [target],
  );
  const hostDiscovery = hostIntegration
    ? hostDiscoveries.find((item) => item.id === hostIntegration.id)
    : null;
  const hostInstallPlan = useMemo(
    () =>
      hostIntegration
        ? buildHostInstallationPlan(hostIntegration.id, previewTargetBuild.artifacts)
        : null,
    [hostIntegration, previewTargetBuild.artifacts],
  );

  useEffect(() => {
    let active = true;
    void discoverAiHosts()
      .then((items) => {
        if (active) setHostDiscoveries(items);
      })
      .catch(() => {
        if (active) setHostDiscoveries([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const hostFiles = useMemo(
    () =>
      previewTargetBuild.artifacts.map((artifact) => ({
        path: artifact.path,
        content: artifact.content,
      })),
    [previewTargetBuild.artifacts],
  );

  const refreshHostInstallation = useCallback(async () => {
    if (
      !workRoot ||
      !hostIntegration ||
      hostIntegration.status !== "supported" ||
      hostFiles.length === 0
    ) {
      setHostInspection(null);
      setHostError(null);
      return;
    }

    setHostBusy("inspect");
    setHostError(null);
    try {
      const next = await invoke<HostInstallInspection>("inspect_host_install", {
        rackRoot: project.root,
        workRoot,
        hostId: hostIntegration.id,
        profileId: selectedProfile,
        files: hostFiles,
      });
      setHostInspection(next);
    } catch (reason) {
      setHostInspection(null);
      setHostError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not inspect this host installation.",
      );
    } finally {
      setHostBusy(null);
    }
  }, [hostFiles, hostIntegration, project.root, selectedProfile, workRoot]);

  useEffect(() => {
    void refreshHostInstallation();
  }, [refreshHostInstallation]);

  const installForHost = async () => {
    if (!workRoot || !hostIntegration || !hostInspection?.canInstall) return;
    const confirmed = window.confirm(
      "Install the reviewed Rack files for " +
        hostIntegration.displayName +
        " into " +
        workRoot +
        "? Rack will not overwrite pre-existing files it does not already manage.",
    );
    if (!confirmed) return;

    setHostBusy("install");
    setHostError(null);
    try {
      const result = await invoke<HostInstallResult>("install_host_files", {
        rackRoot: project.root,
        workRoot,
        hostId: hostIntegration.id,
        profileId: selectedProfile,
        files: hostFiles,
        confirmed: true,
      });
      onStatus(
        result.backupDirectory
          ? `${hostIntegration.displayName} updated. The previous Rack-managed host files were backed up locally.`
          : `${hostIntegration.displayName} host files installed into this project.`,
      );
      await refreshHostInstallation();
    } catch (reason) {
      setHostError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not install these host files.",
      );
    } finally {
      setHostBusy(null);
    }
  };

  const removeHostInstallation = async () => {
    if (!workRoot || !hostIntegration || !hostInspection?.canRemove) return;
    const confirmed = window.confirm(
      `Remove the Rack-managed ${hostIntegration.displayName} files from this project? Rack will stop if any managed file changed outside Rack.`,
    );
    if (!confirmed) return;

    setHostBusy("remove");
    setHostError(null);
    try {
      await invoke<HostInstallResult>("remove_host_install", {
        rackRoot: project.root,
        workRoot,
        hostId: hostIntegration.id,
        profileId: selectedProfile,
        confirmed: true,
      });
      onStatus(`${hostIntegration.displayName} Rack installation removed. A local backup was retained.`);
      await refreshHostInstallation();
    } catch (reason) {
      setHostError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not remove this host installation.",
      );
    } finally {
      setHostBusy(null);
    }
  };

  useEffect(() => {
    setSelectedArtifactPath(previewTargetBuild.artifacts[0]?.path ?? null);
  }, [previewTargetBuild]);

  useEffect(() => {
    if (target !== "prompt") {
      setTopoContext({ enabled: false, snapshot: null });
      setContextualBuild(null);
    }
  }, [target]);

  const prepareCurrentBuild = useCallback(async (): Promise<PreparedTargetBuild> => {
    let prepared = await prepareTargetBuild(project, selectedProfile, target);
    if (!topoContext.enabled) return prepared;

    if (target !== "prompt") {
      throw new Error(
        "TOPO context is only supported for the prompt destination in this alpha.",
      );
    }
    if (!topoContext.snapshot) {
      throw new Error("Preview TOPO context before building with it.");
    }

    prepared = await attachContextToPromptBuild(prepared, topoContext.snapshot);
    return prepared;
  }, [project, selectedProfile, target, topoContext]);

  const refreshBuildState = useCallback(async () => {
    setChecking(true);
    setBuildError(null);

    if (topoContext.enabled && !topoContext.snapshot) {
      setInspection(null);
      setContextualBuild(null);
      setChecking(false);
      return;
    }

    try {
      const prepared = await prepareCurrentBuild();
      setContextualBuild(topoContext.enabled ? prepared : null);
      const artifactPaths = prepared.targetBuild.artifacts.map(
        (artifact) => artifact.path,
      );
      const installed = await invoke<InstalledTargetBuild>(
        "read_generated_prompt_build",
        {
          root: project.root,
          profileId: selectedProfile,
          target,
          artifactPaths,
        },
      );
      setInspection(await inspectPreparedTargetBuild(prepared, installed));
    } catch (reason) {
      setInspection(null);
      setContextualBuild(null);
      setBuildError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not inspect the generated build.",
      );
    } finally {
      setChecking(false);
    }
  }, [
    prepareCurrentBuild,
    project.root,
    selectedProfile,
    target,
    topoContext.enabled,
    topoContext.snapshot,
  ]);

  useEffect(() => {
    void refreshBuildState();
  }, [refreshBuildState]);

  const copyArtifact = async () => {
    if (!selectedArtifact) return;
    await navigator.clipboard.writeText(selectedArtifact.content);
    onStatus(`${selectedArtifact.path} copied to the clipboard.`);
  };

  const exportArtifact = async () => {
    if (!selectedArtifact) return;
    const selected = await save({
      title: `Export ${selectedArtifact.path}`,
      defaultPath: fileName(selectedArtifact.path),
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!selected) return;

    await invoke("write_generated_file", {
      path: selected,
      content: selectedArtifact.content,
    });
    onStatus(`${selectedArtifact.path} exported to ${selected}.`);
  };

  const installBuild = async () => {
    setBuilding(true);
    setBuildError(null);
    try {
      const prepared = await prepareCurrentBuild();
      if (!prepared.manifest || prepared.outputFiles.length === 0) {
        const message = prepared.diagnostics
          .filter((item) => item.severity === "error")
          .map((item) => item.message)
          .join(" ");
        throw new Error(message || "This Set-up cannot be built yet.");
      }

      const artifactPaths = prepared.targetBuild.artifacts.map(
        (artifact) => artifact.path,
      );
      const result = await invoke<InstallResult>(
        "install_generated_prompt_build",
        {
          root: project.root,
          profileId: selectedProfile,
          target,
          artifactPaths,
          files: prepared.outputFiles,
        },
      );
      onStatus(
        result.backupDirectory
          ? `Build installed. The previous ${adapter?.displayName ?? target} output was retained at ${result.backupDirectory}.`
          : `Build installed at ${result.directory}.`,
      );
      await refreshBuildState();
    } catch (reason) {
      setBuildError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not install the generated build.",
      );
    } finally {
      setBuilding(false);
    }
  };

  const buildErrors = previewTargetBuild.diagnostics.filter(
    (item) => item.severity === "error",
  );
  const preparedErrors =
    inspection?.current.diagnostics.filter((item) => item.severity === "error") ?? [];
  const blocked =
    buildErrors.length > 0 ||
    preparedErrors.length > 0 ||
    (topoContext.enabled && !topoContext.snapshot);

  return (
    <section aria-labelledby="preview-heading">
      <div className="section-heading section-heading--top preview-heading">
        <div>
          <p className="eyebrow">Destination preview</p>
          <h2 id="preview-heading">Preview and export</h2>
        </div>
        <div className="preview-controls">
          <label className="compact-field">
            <span>Set-up</span>
            <select
              value={selectedProfile}
              onChange={(event) => onProfileChange(event.target.value)}
            >
              {project.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.title}
                </option>
              ))}
            </select>
          </label>
          <label className="compact-field">
            <span>Destination</span>
            <select
              value={target}
              onChange={(event) =>
                setTarget(event.target.value as DestinationId)
              }
            >
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {target === "prompt" ? (
        <TopoContextPanel
          projectName={project.manifest?.name ?? "rack"}
          onChange={setTopoContext}
          onStatus={onStatus}
        />
      ) : null}

      {hostIntegration ? (
        <aside className="degradation-panel" aria-label="AI tool hand-off">
          <p className="eyebrow">AI tool hand-off</p>
          <p>
            <strong>{hostIntegration.displayName}</strong>{" "}
            {hostDiscovery?.detected ? "is detected on this computer." : "is not currently detected on this computer."}
          </p>
          <p>
            Rack keeps standing practice, on-demand practice, transient context and
            verification as separate host capabilities. Any host installation will be
            reviewed before files or native integrations are changed.
          </p>
          {hostInstallPlan && hostInstallPlan.actions.length > 0 ? (
            <ul>
              {hostInstallPlan.actions.map((action) => (
                <li key={action.path}>
                  <code>{action.path}</code>{" "}
                  <span>
                    {action.purpose === "standing-practice"
                      ? "standing practice"
                      : "on-demand practice"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {hostIntegration.status === "supported" && !workRoot ? (
            <div className="notice">
              Choose a work project above before Rack inspects or installs AI-tool files.
            </div>
          ) : null}

          {hostIntegration.status === "supported" && hostInspection ? (
            <div className="host-install-review">
              <div className="build-state-line">
                <span className={`build-state build-state--${hostInspection.status === "conflict" ? "modified" : hostInspection.status === "current" ? "current" : "stale"}`}>
                  {hostInstallLabels[hostInspection.status]}
                </span>
                <span className="build-meta">
                  Rack only owns files it created through this installation.
                </span>
              </div>
              <ul>
                {hostInspection.files.map((file) => (
                  <li key={file.path}>
                    <code>{file.path}</code>{" "}
                    <strong>{file.status.replace("-", " ")}</strong>
                    <span> — {file.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <button
                  className="primary-action"
                  type="button"
                  disabled={!hostInspection.canInstall || Boolean(hostBusy)}
                  onClick={() => void installForHost()}
                >
                  {hostBusy === "install"
                    ? "Installing…"
                    : hostInspection.status === "update-available"
                      ? `Update ${hostIntegration.displayName}`
                      : `Install for ${hostIntegration.displayName}`}
                </button>
                {hostInspection.canRemove ? (
                  <button
                    className="quiet-action"
                    type="button"
                    disabled={Boolean(hostBusy)}
                    onClick={() => void removeHostInstallation()}
                  >
                    {hostBusy === "remove" ? "Removing…" : "Remove Rack installation"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {hostBusy === "inspect" ? <small>Checking project host files…</small> : null}
          {hostError ? (
            <div className="notice notice--error" role="alert">
              {hostError}
            </div>
          ) : null}
          {hostIntegration.status !== "supported" ? (
            <small>{hostIntegration.displayName} support is currently {hostIntegration.status}.</small>
          ) : null}
        </aside>
      ) : null}

      {buildError ? (
        <div className="notice notice--error" role="alert">
          <strong>Generated build problem</strong>
          <span>{buildError}</span>
        </div>
      ) : null}

      {buildErrors.length > 0 || !selectedArtifact ? (
        <div className="notice notice--error" role="alert">
          <strong>This Set-up cannot be built for this destination yet.</strong>
          {buildErrors.map((item) => (
            <span key={`${item.code}-${item.message}`}>
              {item.code}: {item.message}
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className="managed-build-row">
            <div>
              <p className="eyebrow">
                Managed local build · {adapter?.displayName ?? target}
              </p>
              <div className="build-state-line">
                <span
                  className={`build-state build-state--${inspection?.status ?? "checking"}`}
                >
                  {checking
                    ? "Checking…"
                    : inspection
                      ? stateLabels[inspection.status]
                      : "Unavailable"}
                </span>
                <span className="build-meta">
                  {inspection?.current.estimatedTokens != null
                    ? `About ${inspection.current.estimatedTokens.toLocaleString()} tokens · ${previewTargetBuild.artifacts.length} ${previewTargetBuild.artifacts.length === 1 ? "file" : "files"}`
                    : "Package estimate pending"}
                </span>
              </div>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={installBuild}
              disabled={building || checking || blocked}
            >
              {building
                ? "Building…"
                : inspection?.status === "current"
                  ? "Build again"
                  : "Build into Rack"}
            </button>
          </div>

          {previewTargetBuild.degradations.length > 0 ? (
            <aside className="degradation-panel" aria-label="Destination changes">
              <p className="eyebrow">What changes for this destination</p>
              <ul>
                {previewTargetBuild.degradations.map((degradation) => (
                  <li key={`${degradation.capability}-${degradation.title}`}>
                    <strong>{degradation.title}.</strong>{" "}
                    {degradation.explanation}
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          {preparedErrors.length > 0 ? (
            <div className="notice notice--error" role="alert">
              {preparedErrors.map((item) => (
                <span key={`${item.code}-${item.message}`}>
                  {item.code}: {item.message}
                </span>
              ))}
            </div>
          ) : null}

          <div className="package-files" aria-label="Generated package files">
            {previewTargetBuild.artifacts.map((artifact) => (
              <button
                className={`package-file ${selectedArtifact.path === artifact.path ? "package-file--active" : ""}`}
                type="button"
                key={artifact.path}
                onClick={() => setSelectedArtifactPath(artifact.path)}
              >
                <span>{fileName(artifact.path)}</span>
                <code>{artifact.path}</code>
              </button>
            ))}
          </div>

          <div className="preview-layout">
            <aside className="contribution-panel">
              <p className="eyebrow">What is carried across</p>
              <h3>{previewTargetBuild.compiled?.modules.length ?? 0} instructions</h3>
              <ol>
                {previewTargetBuild.compiled?.modules.map((module) => (
                  <li key={module.harness.id}>
                    <strong>{module.title}</strong>
                    <code>{module.harness.id}</code>
                  </li>
                ))}
              </ol>
            </aside>
            <div className="prompt-panel">
              <div className="prompt-toolbar">
                <div>
                  <span>{selectedArtifact.path}</span>
                  <small>
                    {selectedArtifact.content.length.toLocaleString()} characters
                  </small>
                </div>
                <div className="button-row">
                  <button className="quiet-action" type="button" onClick={copyArtifact}>
                    Copy file
                  </button>
                  <button className="primary-action" type="button" onClick={exportArtifact}>
                    Export file
                  </button>
                </div>
              </div>
              <pre className="prompt-preview">
                <code>{selectedArtifact.content}</code>
              </pre>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
