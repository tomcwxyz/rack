import {
  destinationIdSchema,
  type AdapterCapabilityId,
  type DestinationId,
} from "@rack/schemas";
import { agentsMdAdapter } from "./agentsMd.js";
import type { TargetAdapter } from "./adapters.js";
import {
  renderPrompt,
  resolveProfile,
  type CompiledProfile,
  type TargetBuild,
} from "./compiler.js";
import {
  claudeCodeAdapter,
  codexAdapter,
  openCodeAdapter,
} from "./hostAdapters.js";
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
  [claudeCodeAdapter.id, claudeCodeAdapter],
  [openCodeAdapter.id, openCodeAdapter],
  [codexAdapter.id, codexAdapter],
]);

const capabilityLabels: Record<AdapterCapabilityId, string> = {
  commands: "commands",
  skills: "skills",
  tools: "tool configuration",
  bootstrapContext: "automatic project context",
  hostPolicies: "host-enforced policies",
  multipleFiles: "multiple generated files",
  onDemandModules: "on-demand instructions",
};

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

const capabilityDiagnostics = (
  compiled: CompiledProfile,
  adapter: TargetAdapter,
): Diagnostic[] => {
  const waived = new Set(
    compiled.profile.overrides?.target_waivers?.[adapter.id] ?? [],
  );
  const diagnostics: Diagnostic[] = [];

  for (const module of compiled.modules) {
    for (const capability of module.harness.capabilities?.required ?? []) {
      if (adapter.capabilities[capability]) continue;
      if (waived.has(module.harness.id)) {
        diagnostics.push({
          code: "RACK-TARGET-003",
          severity: "warning",
          title: "Required destination capability was waived",
          message: `${module.title} requires ${capabilityLabels[capability]}, which ${adapter.displayName} does not provide. ${compiled.profile.title} explicitly waives this requirement for ${module.harness.id}.`,
          filePaths: [module.path],
          moduleIds: [module.harness.id],
        });
      } else {
        diagnostics.push({
          code: "RACK-TARGET-002",
          severity: "error",
          title: "Destination lacks a required capability",
          message: `${module.title} requires ${capabilityLabels[capability]}, but ${adapter.displayName} does not provide it. Choose another destination or add an explicit target waiver for ${module.harness.id}.`,
          filePaths: [module.path],
          moduleIds: [module.harness.id],
        });
      }
    }
  }

  return diagnostics;
};

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

  const diagnostics = [
    ...resolution.diagnostics,
    ...capabilityDiagnostics(resolution.compiled, adapter),
  ];
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      artifacts: [],
      compiled: resolution.compiled,
      diagnostics,
      degradations: [],
    };
  }

  const rendered = adapter.render(resolution.compiled);
  return {
    artifacts: rendered.artifacts,
    compiled: resolution.compiled,
    diagnostics,
    degradations: rendered.degradations,
  };
};

export const buildAgentsMd = (
  project: RackProject,
  profileId: string,
): TargetBuild => buildTarget(project, profileId, "agents-md");
