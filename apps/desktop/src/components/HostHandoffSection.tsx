import { useMemo } from "react";
import {
  buildTarget,
  getHostIntegration,
  type HostIntegrationId,
  type RackProject,
} from "@rack/core";
import { useHostInstallation } from "../useHostInstallation.js";
import { HostRuntimePanel } from "./HostRuntimePanel.js";

type HostHandoffSectionProps = {
  project: RackProject;
  selectedProfile: string;
  hostId: HostIntegrationId;
  workRoot: string | null;
  onChooseWorkRoot: () => void;
  onStatus: (message: string) => void;
  onOpenAdvanced: () => void;
  onChooseAnother: () => void;
};

const installLabel = (status: "ready" | "current" | "update-available" | "conflict") => {
  switch (status) {
    case "current":
      return "Ready";
    case "update-available":
      return "Update available";
    case "conflict":
      return "Needs review";
    default:
      return "Ready to add";
  }
};

export function HostHandoffSection({
  project,
  selectedProfile,
  hostId,
  workRoot,
  onChooseWorkRoot,
  onStatus,
  onOpenAdvanced,
  onChooseAnother,
}: HostHandoffSectionProps) {
  const integration = getHostIntegration(hostId);
  const targetBuild = useMemo(
    () =>
      integration?.destinationId
        ? buildTarget(project, selectedProfile, integration.destinationId)
        : null,
    [integration, project, selectedProfile],
  );
  const files = useMemo(
    () =>
      targetBuild?.artifacts.map((artifact) => ({
        path: artifact.path,
        content: artifact.content,
      })) ?? [],
    [targetBuild],
  );
  const host = useHostInstallation({
    rackRoot: project.root,
    workRoot,
    profileId: selectedProfile,
    hostId,
    files,
    onStatus,
  });

  if (!integration || !integration.destinationId || integration.status !== "supported") {
    return (
      <section className="host-handoff" aria-labelledby="host-handoff-title">
        <div className="host-handoff__heading">
          <div>
            <p className="eyebrow">AI tool hand-off</p>
            <h2 id="host-handoff-title">This tool is not ready for one-click hand-off yet.</h2>
            <p className="section-intro">
              Rack can still show the available destination and export options without pretending the integration is complete.
            </p>
          </div>
          <button className="quiet-action" type="button" onClick={onChooseAnother}>
            Choose another tool
          </button>
        </div>
        <button className="primary-action" type="button" onClick={onOpenAdvanced}>
          Open advanced hand-off
        </button>
      </section>
    );
  }

  const displayName = integration.displayName;
  const commandDetected = Boolean(
    host.discovery?.evidence.some((item) => item.startsWith("command:")),
  );
  const hasBuildErrors = Boolean(
    targetBuild?.diagnostics.some((item) => item.severity === "error"),
  );

  return (
    <section className="host-handoff" aria-labelledby="host-handoff-title">
      <div className="host-handoff__heading">
        <div>
          <p className="eyebrow">AI tool hand-off</p>
          <h2 id="host-handoff-title">Use this Rack with {displayName}</h2>
          <p className="section-intro">
            Rack has already chosen the right destination. Review the small set of files it will manage, add them to your work project, then hand over a task.
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={onChooseAnother}>
          Choose another tool
        </button>
      </div>

      <div className="host-handoff__status-row">
        <div className="host-handoff__status-card">
          <span>AI tool</span>
          <strong>{displayName}</strong>
          <small>
            {host.discovery?.detected
              ? "Found on this computer"
              : "Not detected on this computer"}
          </small>
        </div>
        <div className="host-handoff__status-card">
          <span>Work project</span>
          <strong>{workRoot ? "Selected" : "Needed"}</strong>
          {workRoot ? (
            <code title={workRoot}>{workRoot}</code>
          ) : (
            <button className="quiet-action" type="button" onClick={onChooseWorkRoot}>
              Choose project
            </button>
          )}
        </div>
        <div className="host-handoff__status-card">
          <span>Rack practice</span>
          <strong>{host.inspection ? installLabel(host.inspection.status) : "Checking…"}</strong>
          <small>{files.length} {files.length === 1 ? "managed file" : "managed files"}</small>
        </div>
      </div>

      {hasBuildErrors ? (
        <div className="notice notice--error" role="alert">
          <strong>This Rack cannot be prepared for {displayName} yet.</strong>
          <span>Open the technical preview to see the blocking source or destination problem.</span>
        </div>
      ) : null}

      {!workRoot ? (
        <div className="host-handoff__next">
          <p className="eyebrow">First</p>
          <h3>Choose where you want {displayName} to use this practice.</h3>
          <p>
            Rack keeps its own source separate and only manages the generated AI-tool files inside the project you choose.
          </p>
          <button className="primary-action" type="button" onClick={onChooseWorkRoot}>
            Choose work project
          </button>
        </div>
      ) : host.busy === "inspect" && !host.inspection ? (
        <div className="host-handoff__next" aria-live="polite">
          <p className="eyebrow">Checking</p>
          <h3>Looking at the existing {displayName} project files…</h3>
          <p>Rack is checking what it can safely add without taking ownership of files it did not create.</p>
        </div>
      ) : host.inspection?.status === "conflict" ? (
        <div className="host-handoff__next host-handoff__next--warning">
          <p className="eyebrow">Manual review needed</p>
          <h3>Rack found a file it should not change automatically.</h3>
          <p>
            Nothing has been overwritten. Open the technical preview to inspect the conflict and decide how to proceed.
          </p>
          <button className="primary-action" type="button" onClick={onOpenAdvanced}>
            Review the conflict
          </button>
        </div>
      ) : host.inspection?.status === "current" ? (
        <>
          <div className="host-handoff__ready">
            <div>
              <p className="eyebrow">Ready</p>
              <h3>{displayName} now has this Rack’s standing practice.</h3>
              <p>
                Your enduring practice is installed. A task and any reviewed TOPO context stay transient and are passed separately at runtime.
              </p>
            </div>
            <span className="host-handoff__ready-mark" aria-hidden="true">✓</span>
          </div>
          <HostRuntimePanel
            projectName={project.manifest?.name ?? "rack"}
            hostId={hostId}
            detected={commandDetected}
            practiceCurrent
            workRoot={workRoot}
            onStatus={onStatus}
          />
        </>
      ) : host.inspection ? (
        <div className="host-handoff__next">
          <div className="host-handoff__review-heading">
            <div>
              <p className="eyebrow">Review once</p>
              <h3>
                {host.inspection.status === "update-available"
                  ? `Update this Rack for ${displayName}`
                  : `Add this Rack to ${displayName}`}
              </h3>
            </div>
            <span className="status-pill">{installLabel(host.inspection.status)}</span>
          </div>
          <p>
            Rack will manage only the generated files below. Existing files outside this managed installation remain yours.
          </p>
          <ul className="host-handoff__files">
            {host.inspection.files.map((file) => (
              <li key={file.path}>
                <div>
                  <code>{file.path}</code>
                  <span>{file.detail}</span>
                </div>
                <strong>{file.status.replace("-", " ")}</strong>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button
              className="primary-action"
              type="button"
              disabled={!host.inspection.canInstall || Boolean(host.busy)}
              onClick={() => void host.install()}
            >
              {host.busy === "install"
                ? "Adding Rack…"
                : host.inspection.status === "update-available"
                  ? `Update ${displayName}`
                  : `Use this Rack with ${displayName}`}
            </button>
            <button className="quiet-action" type="button" onClick={onOpenAdvanced}>
              Technical details
            </button>
          </div>
        </div>
      ) : null}

      {host.error ? (
        <div className="notice notice--error" role="alert">
          <strong>Hand-off problem</strong>
          <span>{host.error}</span>
        </div>
      ) : null}

      <details className="host-handoff__details">
        <summary>What Rack will manage</summary>
        <p>
          This hand-off never changes canonical Rack source and does not write transient task or TOPO context into standing AI-tool files.
        </p>
        {host.plan?.actions.length ? (
          <ul>
            {host.plan.actions.map((action) => (
              <li key={action.path}>
                <code>{action.path}</code> — {action.purpose.replace("-", " ")}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  );
}
