import { parse as parseYaml } from "yaml";
import {
  moduleFrontmatterSchema,
  practiceSourceSchema,
  sharedPracticeFileSchema,
  type PracticeSource,
  type PracticeSourceRelationship,
  type RackModule,
  type SharedPracticeFile,
} from "@rack/schemas";
import type { Diagnostic } from "./index.js";
import type { PracticeCandidate } from "./practiceResolution.js";

export type SharedPracticeSourceOptions = {
  sourceId: string;
  precedence: number;
  relationship?: PracticeSourceRelationship;
  label?: string;
  filePath?: string;
};

export type SharedPracticeMaterialization = {
  document: SharedPracticeFile | null;
  source: PracticeSource | null;
  modules: RackModule[];
  candidates: PracticeCandidate[];
  diagnostics: Diagnostic[];
  blocked: boolean;
};

const formatIssues = (
  issues: readonly { path: PropertyKey[]; message: string }[],
): string =>
  issues
    .map((issue) =>
      `${issue.path.length ? issue.path.join(".") : "root"}: ${issue.message}`,
    )
    .join("; ");

const safeSegment = (value: string): string => {
  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalised || "instruction";
};

const diagnosticPath = (
  filePath: string,
  index?: number,
): string =>
  index === undefined ? filePath : `${filePath}#instructions[${index}]`;

export const materializeSharedPractice = (
  content: string,
  options: SharedPracticeSourceOptions,
): SharedPracticeMaterialization => {
  const diagnostics: Diagnostic[] = [];
  const filePath = options.filePath?.trim() || "shared-practice.rack.yaml";

  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (error) {
    diagnostics.push({
      code: "RACK-SHARED-001",
      severity: "error",
      title: "Shared practice file could not be read",
      message: error instanceof Error ? error.message : "Unknown YAML error.",
      filePaths: [filePath],
    });
    return {
      document: null,
      source: null,
      modules: [],
      candidates: [],
      diagnostics,
      blocked: true,
    };
  }

  const documentResult = sharedPracticeFileSchema.safeParse(raw);
  if (!documentResult.success) {
    diagnostics.push({
      code: "RACK-SHARED-002",
      severity: "error",
      title: "Shared practice file is invalid",
      message: formatIssues(documentResult.error.issues),
      filePaths: [filePath],
    });
    return {
      document: null,
      source: null,
      modules: [],
      candidates: [],
      diagnostics,
      blocked: true,
    };
  }

  const document = documentResult.data;
  let source: PracticeSource;
  try {
    source = practiceSourceSchema.parse({
      id: options.sourceId,
      label: options.label?.trim() || document.title,
      kind: "shared-file",
      relationship: options.relationship,
      precedence: options.precedence,
      path: filePath,
      version: document.version,
    });
  } catch (error) {
    const message =
      error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown[] }).issues)
        ? formatIssues(
            (error as { issues: { path: PropertyKey[]; message: string }[] }).issues,
          )
        : error instanceof Error
          ? error.message
          : "Invalid shared-practice source metadata.";

    diagnostics.push({
      code: "RACK-SHARED-003",
      severity: "error",
      title: "Shared practice source metadata is invalid",
      message,
      filePaths: [filePath],
    });
    return {
      document,
      source: null,
      modules: [],
      candidates: [],
      diagnostics,
      blocked: true,
    };
  }

  const modules: RackModule[] = [];
  const seen = new Set<string>();

  document.instructions.forEach((instruction, index) => {
    const { body, ...frontmatter } = instruction;
    if (body !== undefined && typeof body !== "string") {
      diagnostics.push({
        code: "RACK-SHARED-004",
        severity: "error",
        title: "Shared instruction body is invalid",
        message: "body must be plain text when supplied.",
        filePaths: [diagnosticPath(filePath, index)],
      });
      return;
    }

    const parsed = moduleFrontmatterSchema.safeParse(frontmatter);
    if (!parsed.success) {
      diagnostics.push({
        code: "RACK-SHARED-005",
        severity: "error",
        title: "Shared instruction is invalid",
        message: formatIssues(parsed.error.issues),
        filePaths: [diagnosticPath(filePath, index)],
      });
      return;
    }

    const moduleId = parsed.data.harness.id;
    if (seen.has(moduleId)) {
      diagnostics.push({
        code: "RACK-SHARED-006",
        severity: "error",
        title: "Shared practice contains a duplicate instruction ID",
        message: `${moduleId} is published more than once in the same shared practice file.`,
        filePaths: [diagnosticPath(filePath, index)],
        moduleIds: [moduleId],
      });
      return;
    }
    seen.add(moduleId);

    const authority = parsed.data.harness.authority;
    if (authority?.propagation === "local-only") {
      diagnostics.push({
        code: "RACK-SHARED-007",
        severity: "error",
        title: "Local-only practice cannot be published",
        message: `${moduleId} is marked local-only, so it cannot be distributed in a shared practice file.`,
        filePaths: [diagnosticPath(filePath, index)],
        moduleIds: [moduleId],
      });
      return;
    }

    if (authority?.mode === "binding" && !authority.rationale?.trim()) {
      diagnostics.push({
        code: "RACK-SHARED-008",
        severity: "error",
        title: "Binding shared practice needs a rationale",
        message: `${moduleId} is binding but does not explain why the boundary is necessary.`,
        filePaths: [diagnosticPath(filePath, index)],
        moduleIds: [moduleId],
      });
      return;
    }

    modules.push({
      ...parsed.data,
      body: typeof body === "string" ? body.trim() : "",
      path: `shared/${safeSegment(source.id)}/${safeSegment(moduleId)}.md`,
    });
  });

  const blocked = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const appliedModules = blocked ? [] : modules;
  const candidates: PracticeCandidate[] = appliedModules.map((module) => ({
    module,
    source,
  }));

  return {
    document,
    source,
    modules: appliedModules,
    candidates,
    diagnostics,
    blocked,
  };
};
