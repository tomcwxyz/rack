import {
  buildManifestSchema,
  type BuildManifest,
} from "@rack/schemas/build";
import { buildPrompt, type PromptBuild } from "./compiler.js";
import type { Diagnostic, RackProject } from "./index.js";

const compilerVersion = "0.0.0";
const promptAdapterVersion = "0.1.0";
const encoder = new TextEncoder();

type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

const canonicalise = (value: unknown): CanonicalValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalise(entry)]),
    );
  }

  throw new TypeError(`Cannot canonicalise a ${typeof value} value.`);
};

export const canonicalJson = (value: unknown): string =>
  JSON.stringify(canonicalise(value));

const bytesToHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

export const sha256Text = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value.replace(/\r\n?/g, "\n")),
  );
  return `sha256:${bytesToHex(digest)}`;
};

export const estimatePromptTokens = (value: string): number =>
  Math.ceil(encoder.encode(value).byteLength / 4);

export type PreparedPromptBuild = {
  promptBuild: PromptBuild;
  manifest: BuildManifest | null;
  manifestContent: string | null;
  outputDirectory: string | null;
  outputFiles: { path: string; content: string }[];
  estimatedTokens: number | null;
  diagnostics: Diagnostic[];
};

const addBudgetDiagnostics = (
  promptBuild: PromptBuild,
  estimatedTokens: number,
): Diagnostic[] => {
  const diagnostics = [...promptBuild.diagnostics];
  const budget = promptBuild.compiled?.profile.budgets.prompt;
  if (!budget) return diagnostics;

  if (estimatedTokens > budget.maximum_tokens) {
    diagnostics.push({
      code: "RACK-BUDGET-002",
      severity: "error",
      title: "Prompt is over the maximum budget",
      message: `The prompt is estimated at ${estimatedTokens.toLocaleString()} tokens, above the ${budget.maximum_tokens.toLocaleString()} token maximum for this Set-up. Rack will not truncate it automatically.`,
    });
  } else if (estimatedTokens > budget.recommended_tokens) {
    diagnostics.push({
      code: "RACK-BUDGET-001",
      severity: "warning",
      title: "Prompt is above the recommended budget",
      message: `The prompt is estimated at ${estimatedTokens.toLocaleString()} tokens, above the ${budget.recommended_tokens.toLocaleString()} token recommendation for this Set-up.`,
    });
  }

  return diagnostics;
};

export const preparePromptBuild = async (
  project: RackProject,
  profileId: string,
): Promise<PreparedPromptBuild> => {
  const promptBuild = buildPrompt(project, profileId);
  if (!promptBuild.artifact || !promptBuild.compiled) {
    return {
      promptBuild,
      manifest: null,
      manifestContent: null,
      outputDirectory: null,
      outputFiles: [],
      estimatedTokens: null,
      diagnostics: promptBuild.diagnostics,
    };
  }

  const estimatedTokens = estimatePromptTokens(promptBuild.artifact.content);
  const diagnostics = addBudgetDiagnostics(promptBuild, estimatedTokens);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      promptBuild,
      manifest: null,
      manifestContent: null,
      outputDirectory: null,
      outputFiles: [],
      estimatedTokens,
      diagnostics,
    };
  }

  const sourceDigest = await sha256Text(
    canonicalJson({
      project: promptBuild.compiled.project,
      profile: promptBuild.compiled.profile,
      modules: promptBuild.compiled.modules,
    }),
  );
  const artifactBytes = encoder.encode(promptBuild.artifact.content).byteLength;
  const artifactDigest = await sha256Text(promptBuild.artifact.content);

  const manifest = buildManifestSchema.parse({
    schema_version: "0.1",
    compiler: { name: "rack", version: compilerVersion },
    adapter: { id: "prompt", version: promptAdapterVersion },
    project: {
      name: promptBuild.compiled.project.name,
      version: promptBuild.compiled.project.version,
    },
    profile: {
      id: promptBuild.compiled.profile.id,
      title: promptBuild.compiled.profile.title,
    },
    source: {
      digest: sourceDigest,
      module_ids: promptBuild.compiled.sourceModuleIds,
    },
    artifact: {
      path: promptBuild.artifact.path,
      media_type: promptBuild.artifact.mediaType,
      digest: artifactDigest,
      bytes: artifactBytes,
      estimated_tokens: estimatedTokens,
      token_estimator: "utf8-bytes-divided-by-4",
    },
    modules: promptBuild.compiled.modules.map((module) => ({
      id: module.harness.id,
      version: module.harness.version,
    })),
  });
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const outputDirectory = `.rack/generated/prompt/${profileId}`;

  return {
    promptBuild,
    manifest,
    manifestContent,
    outputDirectory,
    outputFiles: [
      { path: promptBuild.artifact.path, content: promptBuild.artifact.content },
      { path: "build.json", content: manifestContent },
    ],
    estimatedTokens,
    diagnostics,
  };
};

export type InstalledPromptBuild = {
  artifactContent: string | null;
  manifestContent: string | null;
};

export type BuildInspectionStatus =
  | "missing"
  | "current"
  | "stale"
  | "modified"
  | "stale-and-modified"
  | "invalid";

export type PromptBuildInspection = {
  status: BuildInspectionStatus;
  sourceChanged: boolean;
  rendererChanged: boolean;
  outputModified: boolean;
  current: PreparedPromptBuild;
  installedManifest: BuildManifest | null;
  diagnostics: Diagnostic[];
};

export const inspectPromptBuild = async (
  project: RackProject,
  profileId: string,
  installed: InstalledPromptBuild,
): Promise<PromptBuildInspection> => {
  const current = await preparePromptBuild(project, profileId);
  if (!installed.manifestContent && !installed.artifactContent) {
    return {
      status: "missing",
      sourceChanged: false,
      rendererChanged: false,
      outputModified: false,
      current,
      installedManifest: null,
      diagnostics: current.diagnostics,
    };
  }

  let installedManifest: BuildManifest;
  try {
    installedManifest = buildManifestSchema.parse(
      JSON.parse(installed.manifestContent ?? ""),
    );
  } catch (error) {
    return {
      status: "invalid",
      sourceChanged: false,
      rendererChanged: false,
      outputModified: Boolean(installed.artifactContent),
      current,
      installedManifest: null,
      diagnostics: [
        ...current.diagnostics,
        {
          code: "RACK-BUILD-001",
          severity: "error",
          title: "Generated build manifest is invalid",
          message:
            error instanceof Error
              ? error.message
              : "The generated build manifest could not be read.",
        },
      ],
    };
  }

  if (!current.manifest) {
    return {
      status: "invalid",
      sourceChanged: false,
      rendererChanged: false,
      outputModified: false,
      current,
      installedManifest,
      diagnostics: current.diagnostics,
    };
  }

  const sourceChanged =
    installedManifest.source.digest !== current.manifest.source.digest;
  const rendererChanged =
    installedManifest.compiler.version !== current.manifest.compiler.version ||
    installedManifest.adapter.version !== current.manifest.adapter.version;
  const outputDigest = installed.artifactContent
    ? await sha256Text(installed.artifactContent)
    : null;
  const outputModified = outputDigest !== installedManifest.artifact.digest;
  const stale = sourceChanged || rendererChanged;
  const status: BuildInspectionStatus = stale
    ? outputModified
      ? "stale-and-modified"
      : "stale"
    : outputModified
      ? "modified"
      : "current";

  return {
    status,
    sourceChanged,
    rendererChanged,
    outputModified,
    current,
    installedManifest,
    diagnostics: current.diagnostics,
  };
};
