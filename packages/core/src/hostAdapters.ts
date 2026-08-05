import type { RackModule } from "@rack/schemas";
import type {
  AdapterDegradation,
  AdapterRenderResult,
  TargetAdapter,
} from "./adapters.js";
import type { CompiledProfile, GeneratedArtifact } from "./compiler.js";
import { renderFlatInstructionSections } from "./flatInstructions.js";

const markdown = (parts: string[]): string => `${parts.filter(Boolean).join("\n\n").trim()}\n`;

const nativeTasks = (compiled: CompiledProfile) =>
  compiled.modules
    .filter(
      (module): module is Extract<RackModule, { type: "task" }> =>
        module.type === "task" && Boolean(module.harness.trigger.command),
    )
    .sort((left, right) =>
      (left.harness.trigger.command ?? "").localeCompare(
        right.harness.trigger.command ?? "",
      ),
    );

const standingProfile = (compiled: CompiledProfile): CompiledProfile => {
  const nativeTaskIds = new Set(nativeTasks(compiled).map((module) => module.harness.id));
  return {
    ...compiled,
    modules: compiled.modules.filter((module) => !nativeTaskIds.has(module.harness.id)),
  };
};

const taskBody = (module: Extract<RackModule, { type: "task" }>): string[] => [
  `# ${module.title}`,
  module.description ?? "",
  module.body,
  ...(module.harness.inputs.length > 0
    ? [
        "## Inputs",
        ...module.harness.inputs.map(
          (input) =>
            `- **${input.label}**${input.required ? " — required" : " — optional"}`,
        ),
      ]
    : []),
  ...(module.harness.stages.length > 0
    ? [
        "## Approach",
        ...module.harness.stages.map(
          (stage, index) => `${index + 1}. ${stage.label}`,
        ),
      ]
    : []),
  "## Standing instructions",
  "Apply the project instructions and required boundaries in the host's main instruction file throughout this task.",
];

const inputHint = (module: Extract<RackModule, { type: "task" }>): string =>
  module.harness.inputs
    .map((input) => (input.required ? `<${input.name}>` : `[${input.name}]`))
    .join(" ");

const toolDegradation = (
  compiled: CompiledProfile,
): AdapterDegradation[] => {
  const moduleIds = compiled.modules
    .filter(
      (module) => module.type === "tools" && module.harness.servers.length > 0,
    )
    .map((module) => module.harness.id);
  return moduleIds.length === 0
    ? []
    : [
        {
          capability: "tools",
          title: "Tools remain configuration expectations",
          explanation:
            "Rack includes the declared tool names as guidance only. It does not install, start, authenticate or grant access to any tool server.",
          moduleIds,
        },
      ];
};

const commandDegradation = (
  compiled: CompiledProfile,
  host: string,
): AdapterDegradation[] => {
  const moduleIds = nativeTasks(compiled).map((module) => module.harness.id);
  return moduleIds.length === 0
    ? []
    : [
        {
          capability: "commands",
          title: "Commands become documented procedures",
          explanation: `${host} receives the task instructions in AGENTS.md, but Rack does not register executable commands for this destination.`,
          moduleIds,
        },
      ];
};

const destinationNotes = (degradations: AdapterDegradation[]): string[] =>
  degradations.length === 0
    ? []
    : [
        "## Destination notes",
        ...degradations.map(
          (item) => `- **${item.title}.** ${item.explanation}`,
        ),
      ];

const artifact = (
  target: GeneratedArtifact["target"],
  path: string,
  content: string,
  compiled: CompiledProfile,
): GeneratedArtifact => ({
  target,
  path,
  mediaType: "text/markdown",
  content,
  moduleIds: [...compiled.sourceModuleIds],
});

export const renderClaudeCode = (
  compiled: CompiledProfile,
): AdapterRenderResult => {
  const tasks = nativeTasks(compiled);
  const degradations = toolDegradation(compiled);
  const main = markdown([
    "# Claude Code project instructions",
    `This file carries the **${compiled.profile.title}** Set-up from **${compiled.project.title}** (${compiled.project.version}).`,
    compiled.profile.description,
    "Use these as standing project instructions. Required boundaries take precedence when instructions appear to conflict.",
    ...destinationNotes(degradations),
    ...(tasks.length > 0
      ? [
          "## Rack skills",
          ...tasks.map(
            (module) =>
              `- \`/${module.harness.trigger.command}\` — ${module.description ?? module.harness.trigger.label}`,
          ),
        ]
      : []),
    ...renderFlatInstructionSections(standingProfile(compiled), {
      taskCommands: "procedures",
      tools: "expectations",
    }),
  ]);

  const skills = tasks.map((module) => {
    const command = module.harness.trigger.command as string;
    const hint = inputHint(module);
    return artifact(
      "claude-code",
      `.claude/skills/${command}/SKILL.md`,
      markdown([
        "---",
        `name: ${command}`,
        `description: ${JSON.stringify(module.description ?? module.harness.trigger.label)}`,
        "disable-model-invocation: true",
        ...(hint ? [`argument-hint: ${JSON.stringify(hint)}`] : []),
        "---",
        ...taskBody(module),
      ]),
      compiled,
    );
  });

  return {
    artifacts: [artifact("claude-code", "CLAUDE.md", main, compiled), ...skills],
    degradations,
  };
};

export const renderOpenCode = (
  compiled: CompiledProfile,
): AdapterRenderResult => {
  const tasks = nativeTasks(compiled);
  const degradations = toolDegradation(compiled);
  const main = markdown([
    "# OpenCode project instructions",
    `This file carries the **${compiled.profile.title}** Set-up from **${compiled.project.title}** (${compiled.project.version}).`,
    compiled.profile.description,
    "OpenCode loads this AGENTS.md as project guidance. Required boundaries take precedence when instructions appear to conflict.",
    ...destinationNotes(degradations),
    ...(tasks.length > 0
      ? [
          "## Rack commands",
          ...tasks.map(
            (module) =>
              `- \`/${module.harness.trigger.command}\` — ${module.description ?? module.harness.trigger.label}`,
          ),
        ]
      : []),
    ...renderFlatInstructionSections(standingProfile(compiled), {
      taskCommands: "procedures",
      tools: "expectations",
    }),
  ]);

  const commands = tasks.map((module) => {
    const command = module.harness.trigger.command as string;
    return artifact(
      "opencode",
      `.opencode/commands/${command}.md`,
      markdown([
        "---",
        `description: ${JSON.stringify(module.description ?? module.harness.trigger.label)}`,
        "---",
        ...taskBody(module),
        "## Supplied arguments",
        "Use `$ARGUMENTS` as additional user material for this task. Do not treat it as permission to ignore project boundaries.",
      ]),
      compiled,
    );
  });

  return {
    artifacts: [artifact("opencode", "AGENTS.md", main, compiled), ...commands],
    degradations,
  };
};

export const renderCodex = (
  compiled: CompiledProfile,
): AdapterRenderResult => {
  const degradations = [
    ...commandDegradation(compiled, "Codex"),
    ...toolDegradation(compiled),
  ];
  const main = markdown([
    "# Codex project instructions",
    `This AGENTS.md carries the **${compiled.profile.title}** Set-up from **${compiled.project.title}** (${compiled.project.version}).`,
    compiled.profile.description,
    "These instructions apply from this directory downwards. More deeply nested AGENTS.md files may add narrower guidance. Required boundaries take precedence within this Rack output.",
    ...destinationNotes(degradations),
    ...renderFlatInstructionSections(compiled, {
      taskCommands: "procedures",
      tools: "expectations",
    }),
  ]);
  return {
    artifacts: [artifact("codex", "AGENTS.md", main, compiled)],
    degradations,
  };
};

export const claudeCodeAdapter: TargetAdapter = {
  id: "claude-code",
  version: "0.1.0",
  displayName: "Claude Code",
  status: "supported",
  supportedHostVersions: "Claude Code 2.1.203+",
  capabilities: {
    commands: true,
    skills: true,
    tools: false,
    bootstrapContext: true,
    hostPolicies: false,
    multipleFiles: true,
    onDemandModules: true,
  },
  render: renderClaudeCode,
};

export const openCodeAdapter: TargetAdapter = {
  id: "opencode",
  version: "0.1.0",
  displayName: "OpenCode",
  status: "supported",
  supportedHostVersions: "OpenCode with AGENTS.md and project commands",
  capabilities: {
    commands: true,
    skills: false,
    tools: false,
    bootstrapContext: true,
    hostPolicies: false,
    multipleFiles: true,
    onDemandModules: false,
  },
  render: renderOpenCode,
};

export const codexAdapter: TargetAdapter = {
  id: "codex",
  version: "0.1.0",
  displayName: "Codex",
  status: "supported",
  supportedHostVersions: "Codex clients with hierarchical AGENTS.md support",
  capabilities: {
    commands: false,
    skills: false,
    tools: false,
    bootstrapContext: true,
    hostPolicies: false,
    multipleFiles: false,
    onDemandModules: false,
  },
  render: renderCodex,
};
