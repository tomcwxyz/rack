import type { RackModule, RackProfile } from "@rack/schemas";
import type { Diagnostic, RackProject } from "./index.js";

export type CompiledProfile = {
  project: {
    name: string;
    title: string;
    version: string;
  };
  profile: RackProfile;
  modules: RackModule[];
  requiredModuleIds: string[];
  sourceModuleIds: string[];
};

export type ProfileResolution = {
  compiled: CompiledProfile | null;
  diagnostics: Diagnostic[];
};

export type GeneratedArtifact = {
  target: "prompt";
  path: "system-prompt.md";
  mediaType: "text/markdown";
  content: string;
  moduleIds: string[];
};

export type PromptBuild = {
  artifact: GeneratedArtifact | null;
  compiled: CompiledProfile | null;
  diagnostics: Diagnostic[];
};

type VisitRequest = {
  isRoot: boolean;
  requestedBy?: string;
  versionConstraint?: string;
};

const exactVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const moduleAppliesToProfile = (
  module: RackModule,
  profile: RackProfile,
): boolean => {
  const appliesTo = module.harness.applies_to;
  return (
    appliesTo === "all" ||
    appliesTo.some((domain) => profile.domains.includes(domain))
  );
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

export const resolveProfile = (
  project: RackProject,
  profileId: string,
): ProfileResolution => {
  const diagnostics = [...project.diagnostics];
  const diagnosticKeys = new Set(
    diagnostics.map((diagnostic) =>
      [diagnostic.code, diagnostic.message, ...(diagnostic.moduleIds ?? [])].join("|"),
    ),
  );
  const addDiagnostic = (diagnostic: Diagnostic) => {
    const key = [
      diagnostic.code,
      diagnostic.message,
      ...(diagnostic.moduleIds ?? []),
    ].join("|");
    if (!diagnosticKeys.has(key)) {
      diagnosticKeys.add(key);
      diagnostics.push(diagnostic);
    }
  };

  if (!project.manifest) {
    addDiagnostic({
      code: "RACK-COMPILE-001",
      severity: "error",
      title: "Rack cannot be built",
      message: "The Rack manifest must be valid before a Set-up can be built.",
      filePaths: ["rack.yaml"],
    });
    return { compiled: null, diagnostics };
  }

  const profile = project.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) {
    addDiagnostic({
      code: "RACK-PROFILE-001",
      severity: "error",
      title: "Set-up was not found",
      message: `No Set-up with the ID ${profileId} exists in this Rack.`,
    });
    return { compiled: null, diagnostics };
  }

  const modulesById = new Map(
    project.modules.map((module) => [module.harness.id, module]),
  );
  const excluded = new Set(profile.exclude);
  const visitState = new Map<string, "visiting" | "visited">();
  const ordered: RackModule[] = [];

  const visit = (
    id: string,
    request: VisitRequest,
    stack: string[],
  ): void => {
    if (excluded.has(id)) {
      addDiagnostic({
        code: request.isRoot ? "RACK-PROFILE-002" : "RACK-PROFILE-003",
        severity: "error",
        title: request.isRoot
          ? "Instruction is both included and excluded"
          : "A required instruction is excluded",
        message: request.isRoot
          ? `${id} appears in both include and exclude for ${profile.id}.`
          : `${request.requestedBy ?? "Another instruction"} requires ${id}, but ${id} is excluded from ${profile.id}.`,
        moduleIds: request.requestedBy
          ? [request.requestedBy, id]
          : [id],
      });
      return;
    }

    const module = modulesById.get(id);
    if (!module) {
      addDiagnostic({
        code: "RACK-DEPENDENCY-001",
        severity: "error",
        title: "Instruction is missing",
        message: request.requestedBy
          ? `${request.requestedBy} requires ${id}, but it is not present in the Rack.`
          : `${id} is included by ${profile.id}, but it is not present in the Rack.`,
        moduleIds: request.requestedBy
          ? [request.requestedBy, id]
          : [id],
      });
      return;
    }

    if (request.isRoot && !moduleAppliesToProfile(module, profile)) {
      addDiagnostic({
        code: "RACK-PROFILE-004",
        severity: "error",
        title: "Instruction does not apply to this Set-up",
        message: `${id} applies to ${
          module.harness.applies_to === "all"
            ? "all domains"
            : module.harness.applies_to.join(", ")
        }, not ${profile.domains.join(", ")}.`,
        filePaths: [module.path],
        moduleIds: [id],
      });
      return;
    }

    if (request.versionConstraint) {
      if (exactVersionPattern.test(request.versionConstraint)) {
        if (module.harness.version !== request.versionConstraint) {
          addDiagnostic({
            code: "RACK-DEPENDENCY-003",
            severity: "error",
            title: "Instruction version does not match",
            message: `${request.requestedBy ?? profile.id} requires ${id} ${request.versionConstraint}, but ${module.harness.version} is present.`,
            filePaths: [module.path],
            moduleIds: request.requestedBy
              ? [request.requestedBy, id]
              : [id],
          });
          return;
        }
      } else {
        addDiagnostic({
          code: "RACK-DEPENDENCY-004",
          severity: "warning",
          title: "Version range is not enforced yet",
          message: `${request.requestedBy ?? profile.id} requests ${id} ${request.versionConstraint}. Rack v0.1 currently enforces exact dependency versions only.`,
          filePaths: [module.path],
          moduleIds: request.requestedBy
            ? [request.requestedBy, id]
            : [id],
        });
      }
    }

    const state = visitState.get(id);
    if (state === "visited") return;
    if (state === "visiting") {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(Math.max(cycleStart, 0)), id];
      addDiagnostic({
        code: "RACK-DEPENDENCY-002",
        severity: "error",
        title: "Instruction dependency cycle",
        message: `Rack cannot determine an instruction order because ${cycle.join(" → ")}.`,
        moduleIds: cycle,
      });
      return;
    }

    visitState.set(id, "visiting");
    const nextStack = [...stack, id];
    const dependencies = [...module.harness.requires].sort((left, right) =>
      left.id.localeCompare(right.id),
    );

    for (const dependency of dependencies) {
      visit(
        dependency.id,
        {
          isRoot: false,
          requestedBy: id,
          versionConstraint: dependency.version,
        },
        nextStack,
      );
    }

    visitState.set(id, "visited");
    ordered.push(module);
  };

  const roots = [...new Set(profile.include)].sort((left, right) =>
    left.localeCompare(right),
  );

  if (roots.length === 0) {
    addDiagnostic({
      code: "RACK-PROFILE-005",
      severity: "warning",
      title: "Set-up contains no instructions",
      message: `${profile.title} has no explicitly included instructions.`,
    });
  }

  for (const id of roots) {
    visit(id, { isRoot: true }, []);
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { compiled: null, diagnostics };
  }

  const modules = ordered.filter(
    (module, index) =>
      ordered.findIndex(
        (candidate) => candidate.harness.id === module.harness.id,
      ) === index,
  );

  return {
    compiled: {
      project: {
        name: project.manifest.name,
        title: project.manifest.title,
        version: project.manifest.version,
      },
      profile,
      modules,
      requiredModuleIds: modules
        .filter((module) => module.harness.criticality === "required")
        .map((module) => module.harness.id)
        .sort((left, right) => left.localeCompare(right)),
      sourceModuleIds: modules
        .map((module) => module.harness.id)
        .sort((left, right) => left.localeCompare(right)),
    },
    diagnostics,
  };
};

const renderModuleDetails = (module: RackModule): string[] => {
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
          ...module.harness.stages.map((stage, index) =>
            `${index + 1}. ${stage}`,
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
        lines.push(`**Command:** /${module.harness.trigger.command}`);
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
          "**Declared tools**",
          ...module.harness.servers.map((server) =>
            `- ${server.name} (${server.transport})`,
          ),
        );
      }
      break;
    default:
      break;
  }

  return lines;
};

export const renderPrompt = (compiled: CompiledProfile): GeneratedArtifact => {
  const sections: string[] = [
    `# ${compiled.profile.title}`,
    compiled.profile.description,
    `Built from **${compiled.project.title}** (${compiled.project.version}).`,
    "Apply these instructions together. Required boundaries take precedence when instructions appear to conflict.",
  ].filter(Boolean);

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
      const details = renderModuleDetails(module);
      sections.push(
        `### ${module.title}`,
        `<!-- rack:${module.harness.id}@${module.harness.version}; criticality:${module.harness.criticality} -->`,
        ...details,
      );
    }
  }

  return {
    target: "prompt",
    path: "system-prompt.md",
    mediaType: "text/markdown",
    content: `${sections.join("\n\n").trim()}\n`,
    moduleIds: [...compiled.sourceModuleIds],
  };
};

export const buildPrompt = (
  project: RackProject,
  profileId: string,
): PromptBuild => {
  const resolution = resolveProfile(project, profileId);
  if (!resolution.compiled) {
    return {
      artifact: null,
      compiled: null,
      diagnostics: resolution.diagnostics,
    };
  }

  return {
    artifact: renderPrompt(resolution.compiled),
    compiled: resolution.compiled,
    diagnostics: resolution.diagnostics,
  };
};
