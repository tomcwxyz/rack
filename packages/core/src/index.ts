import { parse as parseYaml } from "yaml";
import {
  moduleFrontmatterSchema,
  profileSchema,
  rackManifestSchema,
  type RackManifest,
  type RackModule,
  type RackProfile,
} from "@rack/schemas";

export type Diagnostic = {
  code: string;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  filePaths?: string[];
  moduleIds?: string[];
};

export type ProjectSourceFile = { path: string; content: string };
export type ProjectSnapshot = {
  root: string;
  manifest: ProjectSourceFile;
  modules: ProjectSourceFile[];
  profiles: ProjectSourceFile[];
};
export type RackProject = {
  root: string;
  manifest: RackManifest | null;
  modules: RackModule[];
  profiles: RackProfile[];
  diagnostics: Diagnostic[];
};

type ParsedMarkdown = { data: unknown; body: string };

const parseMarkdown = (content: string): ParsedMarkdown => {
  const normalised = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalised.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new Error(
      "Instruction files must begin with YAML frontmatter marked by ---.",
    );
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );

  if (closingIndex < 0) {
    throw new Error("Instruction frontmatter is missing its closing --- marker.");
  }

  return {
    data: parseYaml(lines.slice(1, closingIndex).join("\n")),
    body: lines.slice(closingIndex + 1).join("\n").trim(),
  };
};

const formatIssues = (
  issues: readonly { path: PropertyKey[]; message: string }[],
) =>
  issues
    .map(
      (issue) =>
        `${issue.path.length ? issue.path.join(".") : "root"}: ${issue.message}`,
    )
    .join("; ");

export const parseProjectSnapshot = (snapshot: ProjectSnapshot): RackProject => {
  const diagnostics: Diagnostic[] = [];
  let manifest: RackManifest | null = null;

  try {
    const result = rackManifestSchema.safeParse(
      parseYaml(snapshot.manifest.content),
    );
    if (result.success) manifest = result.data;
    else
      diagnostics.push({
        code: "RACK-SCHEMA-001",
        severity: "error",
        title: "Rack manifest is invalid",
        message: formatIssues(result.error.issues),
        filePaths: [snapshot.manifest.path],
      });
  } catch (error) {
    diagnostics.push({
      code: "RACK-YAML-001",
      severity: "error",
      title: "Rack manifest could not be read",
      message: error instanceof Error ? error.message : "Unknown YAML error.",
      filePaths: [snapshot.manifest.path],
    });
  }

  const modules: RackModule[] = [];
  for (const file of snapshot.modules) {
    if (file.path === "modules/index.md" || file.path.endsWith("/index.md")) {
      continue;
    }

    try {
      const parsed = parseMarkdown(file.content);
      const result = moduleFrontmatterSchema.safeParse(parsed.data);
      if (result.success) {
        modules.push({ ...result.data, path: file.path, body: parsed.body });
      } else {
        diagnostics.push({
          code: "RACK-SCHEMA-002",
          severity: "error",
          title: "Instruction is invalid",
          message: formatIssues(result.error.issues),
          filePaths: [file.path],
        });
      }
    } catch (error) {
      diagnostics.push({
        code: "RACK-MARKDOWN-001",
        severity: "error",
        title: "Instruction could not be read",
        message: error instanceof Error ? error.message : "Unknown Markdown error.",
        filePaths: [file.path],
      });
    }
  }

  const profiles: RackProfile[] = [];
  for (const file of snapshot.profiles) {
    try {
      const result = profileSchema.safeParse(parseYaml(file.content));
      if (result.success) profiles.push(result.data);
      else
        diagnostics.push({
          code: "RACK-SCHEMA-003",
          severity: "error",
          title: "Set-up is invalid",
          message: formatIssues(result.error.issues),
          filePaths: [file.path],
        });
    } catch (error) {
      diagnostics.push({
        code: "RACK-YAML-002",
        severity: "error",
        title: "Set-up could not be read",
        message: error instanceof Error ? error.message : "Unknown YAML error.",
        filePaths: [file.path],
      });
    }
  }

  const seen = new Map<string, string>();
  for (const module of modules) {
    const previous = seen.get(module.harness.id);
    if (previous) {
      diagnostics.push({
        code: "RACK-CONFLICT-001",
        severity: "error",
        title: "Duplicate instruction ID",
        message: `${module.harness.id} is declared more than once.`,
        filePaths: [previous, module.path],
        moduleIds: [module.harness.id],
      });
    } else {
      seen.set(module.harness.id, module.path);
    }
  }

  return {
    root: snapshot.root,
    manifest,
    modules: modules.sort((a, b) =>
      a.harness.id.localeCompare(b.harness.id),
    ),
    profiles: profiles.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics,
  };
};

export * from "./compiler.js";
