import type { RackModule } from "@rack/schemas";
import type { CompiledProfile } from "./compiler.js";

export type FlatInstructionRenderOptions = {
  taskCommands: "commands" | "procedures";
  tools: "declared" | "expectations";
};

const defaultOptions: FlatInstructionRenderOptions = {
  taskCommands: "commands",
  tools: "declared",
};

const typeOrder: RackModule["type"][] = [
  "context",
  "voice",
  "method",
  "craft",
  "guardrail",
  "task",
  "tools",
];

const typeLabels: Record<RackModule["type"], string> = {
  context: "Context",
  voice: "Voice and language",
  method: "Ways of working",
  craft: "Practice",
  guardrail: "Boundaries",
  task: "Repeatable tasks",
  tools: "Tools expected",
};

const renderModuleDetails = (
  module: RackModule,
  options: FlatInstructionRenderOptions,
): string[] => {
  const lines: string[] = [];

  if (module.description) lines.push(module.description);
  if (module.body) lines.push(module.body);

  switch (module.type) {
    case "voice": {
      const { lexicon } = module.harness;
      if (lexicon.rules.length > 0) {
        lines.push(
          "**Voice rules**",
          ...lexicon.rules.map((rule) => `- ${rule}`),
        );
      }
      if (lexicon.never.length > 0) {
        lines.push(
          "**Never use in authored prose**",
          ...lexicon.never.map((entry) => `- ${entry.term}`),
        );
      }
      if (lexicon.prefer.length > 0) {
        lines.push(
          "**Prefer**",
          ...lexicon.prefer.map(
            (entry) =>
              `- ${entry.use} instead of ${entry.instead_of.join(", ")}`,
          ),
        );
      }
      break;
    }
    case "method":
      if (module.harness.stages.length > 0) {
        lines.push(
          "**Stages**",
          ...module.harness.stages.map(
            (stage, index) => `${index + 1}. ${stage}`,
          ),
        );
      }
      break;
    case "guardrail":
      if (module.harness.rules.length > 0) {
        lines.push(
          "**Rules**",
          ...module.harness.rules.flatMap((rule) => [
            `- ${rule.statement}`,
            ...(rule.refusal ? [`  - When needed: ${rule.refusal}`] : []),
          ]),
        );
      }
      break;
    case "task":
      lines.push(`**Task:** ${module.harness.trigger.label}`);
      if (module.harness.trigger.command) {
        lines.push(
          options.taskCommands === "commands"
            ? `**Command:** /${module.harness.trigger.command}`
            : `**Suggested invocation:** /${module.harness.trigger.command} — reference only; this file does not install a command.`,
        );
      }
      if (module.harness.inputs.length > 0) {
        lines.push(
          "**Inputs**",
          ...module.harness.inputs.map(
            (input) =>
              `- ${input.label}${input.required ? " — required" : " — optional"}`,
          ),
        );
      }
      if (module.harness.stages.length > 0) {
        lines.push(
          "**Approach**",
          ...module.harness.stages.map(
            (stage, index) => `${index + 1}. ${stage.label}`,
          ),
        );
      }
      break;
    case "tools":
      if (module.harness.servers.length > 0) {
        lines.push(
          options.tools === "declared"
            ? "**Declared tools**"
            : "**Tool expectations — configuration only; nothing is started or authenticated by this file**",
          ...module.harness.servers.map(
            (server) => `- ${server.name} (${server.transport})`,
          ),
        );
      }
      break;
    default:
      break;
  }

  return lines;
};

export const renderFlatInstructionSections = (
  compiled: CompiledProfile,
  options: Partial<FlatInstructionRenderOptions> = {},
): string[] => {
  const resolved = { ...defaultOptions, ...options };
  const sections: string[] = [];

  for (const type of typeOrder) {
    const modules = compiled.modules
      .filter((module) => module.type === type)
      .sort(
        (left, right) =>
          left.harness.emit.priority - right.harness.emit.priority ||
          left.harness.id.localeCompare(right.harness.id),
      );

    if (modules.length === 0) continue;
    sections.push(`## ${typeLabels[type]}`);

    for (const module of modules) {
      sections.push(
        `### ${module.title}`,
        `<!-- rack:${module.harness.id}@${module.harness.version}; criticality:${module.harness.criticality} -->`,
        ...renderModuleDetails(module, resolved),
      );
    }
  }

  return sections;
};
