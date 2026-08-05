import type {
  AdapterCapabilityId,
  DestinationId,
} from "@rack/schemas";
import type { CompiledProfile, GeneratedArtifact } from "./compiler.js";

export type AdapterStatus =
  | "supported"
  | "preview"
  | "community"
  | "deprecated";

export type AdapterCapabilities = Record<AdapterCapabilityId, boolean>;

export type AdapterDegradation = {
  capability: AdapterCapabilityId;
  title: string;
  explanation: string;
  moduleIds: string[];
};

export type AdapterRenderResult = {
  artifacts: GeneratedArtifact[];
  degradations: AdapterDegradation[];
};

export interface TargetAdapter {
  id: DestinationId;
  version: string;
  displayName: string;
  status: AdapterStatus;
  supportedHostVersions: string;
  capabilities: AdapterCapabilities;
  render(compiled: CompiledProfile): AdapterRenderResult;
}
