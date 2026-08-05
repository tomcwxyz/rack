import type { RackProject } from "./index.js";
import type {
  AdapterDegradation,
  AdapterRenderResult,
  TargetAdapter,
} from "./adapters.js";
import {
  resolveProfile,
  type CompiledProfile,
  type GeneratedArtifact,
  type TargetBuild,
} from "./compiler.js";
import { renderFlatInstructionSections } from "./flatInstructions.js";

const degradationsFor = (compiled: CompiledProfile): AdapterDegradation[] => {
  const taskModuleIds = compiled.modules
    .filter(
      (module) => module.type === "task" && module.harness.trigger.command,
    )
    .map((module) => module.harness.id);
  const toolModuleIds = compiled.modules
    .filter(
      (module) =>
        module.type === "tools" && module.harness.servers.length > 0,
    )
    .map((module) => module.harness.id);
  const degradations: AdapterDegradation[] = [];

  if (taskModuleIds.length > 0) {
    degradations.push({
      capability: "commands",
      title: "Commands become procedures",
      explanation:
        "AGENTS.md can describe a repeatable task and suggested invocation, but this portable file does not register executable commands.",
      moduleIds: taskModuleIds,
    });
  }

  if (toolModuleIds.length > 0) {
    degradations.push({
      capability: "tools",
      title: "Tools become expectations",
      explanation:
        "Tool declarations are included as configuration expectations only. Rack does not start, authenticate or grant access to tools.",
      moduleIds: toolModuleIds,
    });
  }

  return degradations;
};

export const renderAgentsMd = (
  compiled: CompiledProfile,
): AdapterRenderResult => {
  const degradations = degradationsFor(compiled);
  const sections = [
    "# AGENTS.md",
    `This file carries the **${compiled.profile.title}** Set-up from **${compiled.project.title}** (${compiled.project.version}).`,
    compiled.profile.description,
    "Use these instructions as standing project guidance. Required boundaries take precedence when instructions appear to conflict.",
  ].filter(Boolean);

  if (degradations.length > 0) {
    sections.push(
      "## Destination notes",
      ...degradations.map(
        (degradation) =>
          `- **${degradation.title}.** ${degradation.explanation}`,
      ),
    );
  }

  sections.push(
    ...renderFlatInstructionSections(compiled, {
      taskCommands: "procedures",
      tools: "expectations",
    }),
  );

  const artifact: GeneratedArtifact = {
    target: "agents-md",
    path: "AGENTS.md",
    mediaType: "text/markdown",
    content: `${sections.join("\n\n").trim()}\n`,
    moduleIds: [...compiled.sourceModuleIds],
  };

  return { artifacts: [artifact], degradations };
};

export const agentsMdAdapter: TargetAdapter = {
  id: "agents-md",
  version: "0.1.0",
  displayName: "AGENTS.md",
  status: "supported",
  supportedHostVersions: "portable file; host interpretation varies",
  capabilities: {
    commands: false,
    skills: false,
    tools: false,
    bootstrapContext: false,
    hostPolicies: false,
    multipleFiles: false,
    onDemandModules: false,
  },
  render: renderAgentsMd,
};

export const buildAgentsMd = (
  project: RackProject,
  profileId: string,
): TargetBuild => {
  const resolution = resolveProfile(project, profileId);
  if (!resolution.compiled) {
    return {
      artifacts: [],
      compiled: null,
      diagnostics: resolution.diagnostics,
      degradations: [],
    };
  }

  const rendered = agentsMdAdapter.render(resolution.compiled);
  return {
    artifacts: rendered.artifacts,
    compiled: resolution.compiled,
    diagnostics: resolution.diagnostics,
    degradations: rendered.degradations,
  };
};
