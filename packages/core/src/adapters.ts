import type { DestinationId } from "@rack/schemas";
import type { CompiledProfile, GeneratedArtifact } from "./compiler.js";

export type AdapterStatus =
  | "supported"
  | "preview"
  | "community"
  | "deprecated";

export type AdapterCapabilities = {
  commands: boolean;
  skills: boolean;
  tools: boolean;
  bootstrapContext: boolean;
  hostPolicies: boolean;
  multipleFiles: boolean;
  onDemandModules: boolean;
};

export type AdapterDegradation = {
  capability: keyof AdapterCapabilities;
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
