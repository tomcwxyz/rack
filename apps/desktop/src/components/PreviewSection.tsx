import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { buildPrompt, type RackProject } from "@rack/core";
import {
  inspectPromptBuild,
  preparePromptBuild,
  type InstalledPromptBuild,
  type PromptBuildInspection,
} from "@rack/core/build";

type PreviewSectionProps = {
  project: RackProject;
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
  onStatus: (message: string) => void;
};

type InstallResult = {
  directory: string;
  backupDirectory: string | null;
};

const stateLabels: Record<PromptBuildInspection["status"], string> = {
  missing: "Not built",
  current: "Current",
  stale: "Rebuild needed",
  modified: "Changed outside Rack",
  "stale-and-modified": "Changed and stale",
  invalid: "Cannot verify",
};

export function PreviewSection({
  project,
  selectedProfile,
  onProfileChange,
  onStatus,
}: PreviewSectionProps) {
  const promptBuild = useMemo(
    () => buildPrompt(project, selectedProfile),
    [project, selectedProfile],
  );
  const [inspection, setInspection] = useState<PromptBuildInspection | null>(null);
  const [checking, setChecking] = useState(true);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const refreshBuildState = useCallback(async () => {
    setChecking(true);
    setBuildError(null);
    try {
      const installed = await invoke<InstalledPromptBuild>(
        "read_generated_prompt_build",
        { root: project.root, profileId: selectedProfile },
      );
      setInspection(
        await inspectPromptBuild(project, selectedProfile, installed),
      );
    } catch (reason) {
      setInspection(null);
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
  }, [project, selectedProfile]);

  useEffect(() => {
    void refreshBuildState();
  }, [refreshBuildState]);

  const copyPrompt = async () => {
    if (!promptBuild.artifact) return;
    await navigator.clipboard.writeText(promptBuild.artifact.content);
    onStatus("Prompt copied to the clipboard.");
  };

  const exportPrompt = async () => {
    if (!promptBuild.artifact) return;
    const selected = await save({
      title: "Export generic prompt",
      defaultPath: promptBuild.artifact.path,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!selected) return;

    await invoke("write_generated_file", {
      path: selected,
      content: promptBuild.artifact.content,
    });
    onStatus(`Prompt exported to ${selected}.`);
  };

  const installBuild = async () => {
    setBuilding(true);
    setBuildError(null);
    try {
      const prepared = await preparePromptBuild(project, selectedProfile);
      if (!prepared.manifest || prepared.outputFiles.length === 0) {
        const message = prepared.diagnostics
          .filter((item) => item.severity === "error")
          .map((item) => item.message)
          .join(" ");
        throw new Error(message || "This Set-up cannot be built yet.");
      }

      const result = await invoke<InstallResult>(
        "install_generated_prompt_build",
        {
          root: project.root,
          profileId: selectedProfile,
          files: prepared.outputFiles,
        },
      );
      onStatus(
        result.backupDirectory
          ? `Build installed. The previous generated output was retained at ${result.backupDirectory}.`
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

  const buildErrors = promptBuild.diagnostics.filter(
    (item) => item.severity === "error",
  );
  const preparedErrors =
    inspection?.current.diagnostics.filter((item) => item.severity === "error") ?? [];
  const blocked = buildErrors.length > 0 || preparedErrors.length > 0;

  return (
    <section aria-labelledby="preview-heading">
      <div className="section-heading section-heading--top preview-heading">
        <div>
          <p className="eyebrow">Generic prompt destination</p>
          <h2 id="preview-heading">Preview and export</h2>
        </div>
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
      </div>

      {buildError ? (
        <div className="notice notice--error" role="alert">
          <strong>Generated build problem</strong>
          <span>{buildError}</span>
        </div>
      ) : null}

      {buildErrors.length > 0 || !promptBuild.artifact ? (
        <div className="notice notice--error" role="alert">
          <strong>This Set-up cannot be built yet.</strong>
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
              <p className="eyebrow">Managed local build</p>
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
                    ? `About ${inspection.current.estimatedTokens.toLocaleString()} tokens`
                    : "Token estimate pending"}
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

          {preparedErrors.length > 0 ? (
            <div className="notice notice--error" role="alert">
              {preparedErrors.map((item) => (
                <span key={`${item.code}-${item.message}`}>
                  {item.code}: {item.message}
                </span>
              ))}
            </div>
          ) : null}

          <div className="preview-layout">
            <aside className="contribution-panel">
              <p className="eyebrow">What is carried across</p>
              <h3>{promptBuild.compiled?.modules.length ?? 0} instructions</h3>
              <ol>
                {promptBuild.compiled?.modules.map((module) => (
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
                  <span>system-prompt.md</span>
                  <small>
                    {promptBuild.artifact.content.length.toLocaleString()} characters
                  </small>
                </div>
                <div className="button-row">
                  <button className="quiet-action" type="button" onClick={copyPrompt}>
                    Copy prompt
                  </button>
                  <button className="primary-action" type="button" onClick={exportPrompt}>
                    Export Markdown
                  </button>
                </div>
              </div>
              <pre className="prompt-preview">
                <code>{promptBuild.artifact.content}</code>
              </pre>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
