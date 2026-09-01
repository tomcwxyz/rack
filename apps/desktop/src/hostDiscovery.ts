import { invoke } from "@tauri-apps/api/core";
import type { HostIntegrationId } from "@rack/core";

export type HostDiscovery = {
  id: HostIntegrationId;
  displayName: string;
  detected: boolean;
  evidence: string[];
};

export const discoverAiHosts = async (): Promise<HostDiscovery[]> =>
  invoke<HostDiscovery[]>("discover_ai_hosts");
