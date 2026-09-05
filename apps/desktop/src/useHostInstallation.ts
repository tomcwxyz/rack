import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  buildHostInstallationPlan,
  getHostIntegration,
  type GeneratedArtifact,
  type HostIntegrationId,
} from "@rack/core";
import { discoverAiHosts, type HostDiscovery } from "./hostDiscovery.js";

export type HostInstallInspection = {
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

type UseHostInstallationArgs = {
  rackRoot: string;
  workRoot: string | null;
  profileId: string;
  hostId: HostIntegrationId | null;
  artifacts: GeneratedArtifact[];
  onStatus: (message: string) => void;
};

export function useHostInstallation({
  rackRoot,
  workRoot,
  profileId,
  hostId,
  artifacts,
  onStatus,
}: UseHostInstallationArgs) {
  const integration = useMemo(
    () => (hostId ? getHostIntegration(hostId) : null),
    [hostId],
  );
  const [discoveries, setDiscoveries] = useState<HostDiscovery[]>([]);
  const [inspection, setInspection] = useState<HostInstallInspection | null>(null);
  const [busy, setBusy] = useState<"inspect" | "install" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discovery = integration
    ? discoveries.find((item) => item.id === integration.id) ?? null
    : null;
  const files = useMemo(
    () => artifacts.map((artifact) => ({ path: artifact.path, content: artifact.content })),
    [artifacts],
  );
  const plan = useMemo(
    () =>
      integration
        ? buildHostInstallationPlan(integration.id, artifacts)
        : null,
    [artifacts, integration],
  );

  useEffect(() => {
    let active = true;
    void discoverAiHosts()
      .then((items) => {
        if (active) setDiscoveries(items);
      })
      .catch(() => {
        if (active) setDiscoveries([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (
      !workRoot ||
      !integration ||
      integration.status !== "supported" ||
      files.length === 0
    ) {
      setInspection(null);
      setError(null);
      return;
    }

    setBusy("inspect");
    setError(null);
    try {
      const next = await invoke<HostInstallInspection>("inspect_host_install", {
        rackRoot,
        workRoot,
        hostId: integration.id,
        profileId,
        files,
      });
      setInspection(next);
    } catch (reason) {
      setInspection(null);
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not inspect this AI-tool installation.",
      );
    } finally {
      setBusy(null);
    }
  }, [files, integration, profileId, rackRoot, workRoot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = useCallback(async () => {
    if (!workRoot || !integration || !inspection?.canInstall) return false;
    const confirmed = window.confirm(
      `Install the reviewed Rack files for ${integration.displayName} into ${workRoot}? Rack will not overwrite pre-existing files it does not already manage.`,
    );
    if (!confirmed) return false;

    setBusy("install");
    setError(null);
    try {
      const result = await invoke<HostInstallResult>("install_host_files", {
        rackRoot,
        workRoot,
        hostId: integration.id,
        profileId,
        files,
        confirmed: true,
      });
      onStatus(
        result.backupDirectory
          ? `${integration.displayName} updated. The previous Rack-managed files were backed up locally.`
          : `${integration.displayName} is ready to use with this Rack.`,
      );
      await refresh();
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not install these AI-tool files.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  }, [files, inspection?.canInstall, integration, onStatus, profileId, rackRoot, refresh, workRoot]);

  const remove = useCallback(async () => {
    if (!workRoot || !integration || !inspection?.canRemove) return false;
    const confirmed = window.confirm(
      `Remove the Rack-managed ${integration.displayName} files from this project? Rack will stop if any managed file changed outside Rack.`,
    );
    if (!confirmed) return false;

    setBusy("remove");
    setError(null);
    try {
      await invoke<HostInstallResult>("remove_host_install", {
        rackRoot,
        workRoot,
        hostId: integration.id,
        profileId,
        confirmed: true,
      });
      onStatus(
        `${integration.displayName} Rack installation removed. A local backup was retained.`,
      );
      await refresh();
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not remove this AI-tool installation.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  }, [inspection?.canRemove, integration, onStatus, profileId, rackRoot, refresh, workRoot]);

  return {
    integration,
    discovery,
    plan,
    inspection,
    busy,
    error,
    refresh,
    install,
    remove,
  };
}
