import type { DestinationId } from "@rack/schemas";
import {
  buildManifestSchema,
  type BuildManifest,
} from "@rack/schemas/build";
import type { AdapterDegradation } from "./adapters.js";
import {
  buildPrompt,
  type GeneratedArtifact,
  type PromptBuild,
  type TargetBuild,
} from "./compiler.js";
import type { Diagnostic, RackProject } from "./index.js";
import { buildTarget, getTargetAdapter } from "./targetRegistry.js";

const compilerVersion = "0.0.0";
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

  if (Array.isArray(value)) return value.map(canonicalise);

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

export const estimateInstructionTokens = (value: string): number =>
  Math.ceil(encoder.encode(value).byteLength / 4);
export const estimatePromptTokens = estimateInstructionTokens;

export type PreparedTargetBuild = {
  target: DestinationId;
  targetBuild: TargetBuild;
  manifest: BuildManifest | null;
  manifestContent: string | null;
  outputDirectory: string | null;
  outputFiles: { path: string; content: string }[];
  estimatedTokens: number | null;
  diagnostics: Diagnostic[];
  degradations: AdapterDegradation[];
};

const addBudgetDiagnostics = (
  targetBuild: TargetBuild,
  target: DestinationId,
  estimatedTokens: number,
): Diagnostic[] => {
  const diagnostics = [...targetBuild.diagnostics];
  const budget = targetBuild.compiled?.profile.budgets[target];
  if (!budget) return diagnostics;

  if (estimatedTokens > budget.maximum_tokens) {
    diagnostics.push({
      code: "RACK-BUDGET-002",
      severity: "error",
      title: "Generated instructions are over the maximum budget",
      message: `The ${target} package is estimated at ${estimatedTokens.toLocaleString()} tokens, above the ${budget.maximum_tokens.toLocaleString()} token maximum for this Set-up. Rack will not truncate it automatically.`,
    });
  } else if (estimatedTokens > budget.recommended_tokens) {
    diagnostics.push({
      code: "RACK-BUDGET-001",
      severity: "warning",
      title: "Generated instructions are above the recommended budget",
      message: `The ${target} package is estimated at ${estimatedTokens.toLocaleString()} tokens, above the ${budget.recommended_tokens.toLocaleString()} token recommendation for this Set-up.`,
    });
  }

  return diagnostics;
};

const artifactManifestEntry = async (artifact: GeneratedArtifact) => ({
  path: artifact.path,
  media_type: artifact.mediaType,
  digest: await sha256Text(artifact.content),
  bytes: encoder.encode(artifact.content).byteLength,
  estimated_tokens: estimateInstructionTokens(artifact.content),
});

export const prepareTargetBuild = async (
  project: RackProject,
  profileId: string,
  target: DestinationId,
): Promise<PreparedTargetBuild> => {
  const targetBuild = buildTarget(project, profileId, target);
  const adapter = getTargetAdapter(target);
  if (!targetBuild.compiled || !adapter || targetBuild.artifacts.length === 0) {
    return {
      target,
      targetBuild,
      manifest: null,
      manifestContent: null,
      outputDirectory: null,
      outputFiles: [],
      estimatedTokens: null,
      diagnostics: targetBuild.diagnostics,
      degradations: targetBuild.degradations,
    };
  }

  const estimatedTokens = targetBuild.artifacts.reduce(
    (total, artifact) => total + estimateInstructionTokens(artifact.content),
    0,
  );
  const diagnostics = addBudgetDiagnostics(
    targetBuild,
    target,
    estimatedTokens,
  );
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      target,
      targetBuild,
      manifest: null,
      manifestContent: null,
      outputDirectory: null,
      outputFiles: [],
      estimatedTokens,
      diagnostics,
      degradations: targetBuild.degradations,
    };
  }

  const sourceDigest = await sha256Text(
    canonicalJson({
      project: targetBuild.compiled.project,
      profile: targetBuild.compiled.profile,
      modules: targetBuild.compiled.modules,
    }),
  );
  const artifacts = await Promise.all(
    targetBuild.artifacts.map(artifactManifestEntry),
  );
  const manifest = buildManifestSchema.parse({
    schema_version: "0.2",
    compiler: { name: "rack", version: compilerVersion },
    adapter: {
      id: adapter.id,
      version: adapter.version,
      status: adapter.status,
    },
    project: {
      name: targetBuild.compiled.project.name,
      version: targetBuild.compiled.project.version,
    },
    profile: {
      id: targetBuild.compiled.profile.id,
      title: targetBuild.compiled.profile.title,
    },
    source: {
      digest: sourceDigest,
      module_ids: targetBuild.compiled.sourceModuleIds,
    },
    artifacts,
    package: {
      estimated_tokens: estimatedTokens,
      token_estimator: "utf8-bytes-divided-by-4",
    },
    degradations: targetBuild.degradations.map((degradation) => ({
      capability: degradation.capability,
      title: degradation.title,
      module_ids: degradation.moduleIds,
    })),
    modules: targetBuild.compiled.modules.map((module) => ({
      id: module.harness.id,
      version: module.harness.version,
    })),
  });
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;

  return {
    target,
    targetBuild,
    manifest,
    manifestContent,
    outputDirectory: `.rack/generated/${target}/${profileId}`,
    outputFiles: [
      ...targetBuild.artifacts.map((artifact) => ({
        path: artifact.path,
        content: artifact.content,
      })),
      { path: "build.json", content: manifestContent },
    ],
    estimatedTokens,
    diagnostics,
    degradations: targetBuild.degradations,
  };
};

export type PreparedPromptBuild = Omit<
  PreparedTargetBuild,
  "target" | "targetBuild"
> & {
  target: "prompt";
  targetBuild: TargetBuild;
  promptBuild: PromptBuild;
};

export const preparePromptBuild = async (
  project: RackProject,
  profileId: string,
): Promise<PreparedPromptBuild> => {
  const prepared = await prepareTargetBuild(project, profileId, "prompt");
  const promptBuild = buildPrompt(project, profileId);
  return { ...prepared, target: "prompt", promptBuild };
};

export type InstalledTargetBuild = {
  artifactContents: Record<string, string | null>;
  manifestContent: string | null;
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

export type TargetBuildInspection = {
  status: BuildInspectionStatus;
  sourceChanged: boolean;
  rendererChanged: boolean;
  outputModified: boolean;
  current: PreparedTargetBuild;
  installedManifest: BuildManifest | null;
  diagnostics: Diagnostic[];
};
export type PromptBuildInspection = TargetBuildInspection;

export const inspectTargetBuild = async (
  project: RackProject,
  profileId: string,
  target: DestinationId,
  installed: InstalledTargetBuild,
): Promise<TargetBuildInspection> => {
  const current = await prepareTargetBuild(project, profileId, target);
  const hasInstalledArtifact = Object.values(installed.artifactContents).some(
    (content) => content !== null,
  );
  if (!installed.manifestContent && !hasInstalledArtifact) {
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
      outputModified: hasInstalledArtifact,
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

  if (installedManifest.adapter.id !== target || !current.manifest) {
    return {
      status: "invalid",
      sourceChanged: false,
      rendererChanged: false,
      outputModified: false,
      current,
      installedManifest,
      diagnostics: [
        ...current.diagnostics,
        ...(installedManifest.adapter.id !== target
          ? [
              {
                code: "RACK-BUILD-002",
                severity: "error" as const,
                title: "Generated build is for another destination",
                message: `Expected ${target}, but the manifest describes ${installedManifest.adapter.id}.`,
              },
            ]
          : []),
      ],
    };
  }

  const sourceChanged =
    installedManifest.source.digest !== current.manifest.source.digest;
  const rendererChanged =
    installedManifest.compiler.version !== current.manifest.compiler.version ||
    installedManifest.adapter.version !== current.manifest.adapter.version;
  const outputChecks = await Promise.all(
    installedManifest.artifacts.map(async (artifact) => {
      const content = installed.artifactContents[artifact.path] ?? null;
      return content === null || (await sha256Text(content)) !== artifact.digest;
    }),
  );
  const outputModified = outputChecks.some(Boolean);
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

export const inspectPromptBuild = async (
  project: RackProject,
  profileId: string,
  installed: InstalledPromptBuild,
): Promise<PromptBuildInspection> =>
  inspectTargetBuild(project, profileId, "prompt", {
    artifactContents: { "system-prompt.md": installed.artifactContent },
    manifestContent: installed.manifestContent,
  });
