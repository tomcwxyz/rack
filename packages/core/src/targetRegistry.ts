import {
  destinationIdSchema,
  type DestinationId,
} from "@rack/schemas";
import { agentsMdAdapter } from "./agentsMd.js";
import type { TargetAdapter } from "./adapters.js";
import {
  renderPrompt,
  resolveProfile,
  type TargetBuild,
} from "./compiler.js";
import type { Diagnostic, RackProject } from "./index.js";

export type { DestinationId } from "@rack/schemas";

export const promptAdapter: TargetAdapter = {
  id: "prompt",
  version: "0.1.0",
  displayName: "Generic prompt",
  status: "supported",
  supportedHostVersions: "portable text",
  capabilities: {
    commands: false,
    skills: false,
    tools: false,
    bootstrapContext: false,
    hostPolicies: false,
    multipleFiles: false,
    onDemandModules: false,
  },
  render: (compiled) => ({
    artifacts: [renderPrompt(compiled)],
    degradations: [],
  }),
};

const adapters = new Map<DestinationId, TargetAdapter>([
  [promptAdapter.id, promptAdapter],
  [agentsMdAdapter.id, agentsMdAdapter],
]);

export const parseTargetId = (value: string): DestinationId => {
  const result = destinationIdSchema.safeParse(value);
  if (!result.success) throw new Error(`Unknown destination: ${value}`);
  return result.data;
};

export const listTargetAdapters = (): TargetAdapter[] =>
  [...adapters.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );

export const getTargetAdapter = (
  target: DestinationId,
): TargetAdapter | null => adapters.get(target) ?? null;

export const buildTarget = (
  project: RackProject,
  profileId: string,
  target: DestinationId,
): TargetBuild => {
  const adapter = getTargetAdapter(target);
  if (!adapter) {
    const diagnostic: Diagnostic = {
      code: "RACK-TARGET-001",
      severity: "error",
      title: "Destination is not available yet",
      message: `${target} is declared by Rack v0.1 but does not yet have an installed adapter.`,
    };
    return {
      artifacts: [],
      compiled: null,
      diagnostics: [...project.diagnostics, diagnostic],
      degradations: [],
    };
  }

  const resolution = resolveProfile(project, profileId);
  if (!resolution.compiled) {
    return {
      artifacts: [],
      compiled: null,
      diagnostics: resolution.diagnostics,
      degradations: [],
    };
  }

  const rendered = adapter.render(resolution.compiled);
  return {
    artifacts: rendered.artifacts,
    compiled: resolution.compiled,
    diagnostics: resolution.diagnostics,
    degradations: rendered.degradations,
  };
};

export const buildAgentsMd = (
  project: RackProject,
  profileId: string,
): TargetBuild => buildTarget(project, profileId, "agents-md");
