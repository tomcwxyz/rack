import { stringify as stringifyYaml } from "yaml";
import {
  sharedPracticeFileSchema,
  type RackModule,
  type SharedPracticeFile,
} from "@rack/schemas";
import type { Diagnostic, RackProject } from "./index.js";
import { materializeSharedPractice } from "./sharedPractice.js";

export type SharedPracticePublicationInput = {
  id: string;
  version: string;
  title: string;
  description?: string;
  publishedBy: {
    name: string;
    organisation?: string;
  };
  license?: string | null;
  moduleIds: readonly string[];
};

export type SharedPracticePublicationResult = {
  document: SharedPracticeFile | null;
  content: string | null;
  modules: RackModule[];
  diagnostics: Diagnostic[];
  blocked: boolean;
};

const formatIssues = (
  issues: readonly { path: PropertyKey[]; message: string }[],
): string =>
  issues
    .map(
      (issue) =>
        `${issue.path.length ? issue.path.join(".") : "root"}: ${issue.message}`,
    )
    .join("; ");

const instructionRecord = (module: RackModule): Record<string, unknown> => {
  const { path: _path, body, ...frontmatter } = module;
  return {
    ...frontmatter,
    body,
  };
};

const selectionDiagnostics = (
  project: RackProject,
  moduleIds: readonly string[],
): { modules: RackModule[]; diagnostics: Diagnostic[] } => {
  const diagnostics: Diagnostic[] = [];
  if (moduleIds.length === 0) {
    diagnostics.push({
      code: "RACK-PUBLISH-001",
      severity: "error",
      title: "No shared instructions selected",
      message:
        "Choose at least one instruction explicitly. Rack will not publish a whole Set-up by default.",
    });
    return { modules: [], diagnostics };
  }

  const requested = new Set<string>();
  for (const moduleId of moduleIds) {
    if (requested.has(moduleId)) {
      diagnostics.push({
        code: "RACK-PUBLISH-002",
        severity: "error",
        title: "Instruction selected more than once",
        message: `${moduleId} was supplied more than once.`,
        moduleIds: [moduleId],
      });
    }
    requested.add(moduleId);
  }

  const selected: RackModule[] = [];
  for (const moduleId of [...requested].sort((a, b) => a.localeCompare(b))) {
    const matches = project.modules.filter(
      (module) => module.harness.id === moduleId,
    );
    if (matches.length === 0) {
      diagnostics.push({
        code: "RACK-PUBLISH-003",
        severity: "error",
        title: "Selected instruction was not found",
        message: `${moduleId} is not present in this Rack.`,
        moduleIds: [moduleId],
      });
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push({
        code: "RACK-PUBLISH-004",
        severity: "error",
        title: "Selected instruction ID is ambiguous",
        message: `${moduleId} is declared more than once, so Rack cannot publish it safely.`,
        moduleIds: [moduleId],
        filePaths: matches.map((module) => module.path),
      });
      continue;
    }

    const module = matches[0]!;
    if (module.harness.authority?.propagation === "local-only") {
      diagnostics.push({
        code: "RACK-PUBLISH-005",
        severity: "error",
        title: "Local-only instruction cannot be published",
        message: `${moduleId} is marked local-only. Change its propagation explicitly before sharing it.`,
        moduleIds: [moduleId],
        filePaths: [module.path],
      });
      continue;
    }

    selected.push(module);
  }

  return { modules: selected, diagnostics };
};

export const createSharedPracticePublication = (
  project: RackProject,
  input: SharedPracticePublicationInput,
): SharedPracticePublicationResult => {
  const selection = selectionDiagnostics(project, input.moduleIds);
  const diagnostics = [...selection.diagnostics];

  if (diagnostics.some((item) => item.severity === "error")) {
    return {
      document: null,
      content: null,
      modules: [],
      diagnostics,
      blocked: true,
    };
  }

  const rawDocument = {
    format: "rack.shared-practice",
    schema_version: "0.1",
    id: input.id,
    version: input.version,
    title: input.title,
    description: input.description?.trim() ?? "",
    published_by: {
      name: input.publishedBy.name,
      ...(input.publishedBy.organisation?.trim()
        ? { organisation: input.publishedBy.organisation.trim() }
        : {}),
    },
    license: input.license?.trim() || null,
    instructions: selection.modules.map(instructionRecord),
  };

  const parsed = sharedPracticeFileSchema.safeParse(rawDocument);
  if (!parsed.success) {
    diagnostics.push({
      code: "RACK-PUBLISH-006",
      severity: "error",
      title: "Shared publication metadata is invalid",
      message: formatIssues(parsed.error.issues),
      moduleIds: selection.modules.map((module) => module.harness.id),
    });
    return {
      document: null,
      content: null,
      modules: [],
      diagnostics,
      blocked: true,
    };
  }

  const document = parsed.data;
  const content = stringifyYaml(document, { lineWidth: 0 });
  const roundTrip = materializeSharedPractice(content, {
    sourceId: "publication-preview",
    relationship: "other",
    precedence: 10,
    label: document.title,
    filePath: `${document.id}.rack.yaml`,
  });

  diagnostics.push(...roundTrip.diagnostics);
  const blocked = diagnostics.some((item) => item.severity === "error");

  return {
    document: blocked ? null : document,
    content: blocked ? null : content,
    modules: blocked ? [] : selection.modules,
    diagnostics,
    blocked,
  };
};
