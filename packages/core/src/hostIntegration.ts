import type { DestinationId } from "@rack/schemas";
import type { GeneratedArtifact } from "./compiler.js";

export type HostIntegrationId =
  | "claude-code"
  | "codex"
  | "opencode"
  | "hermes-agent"
  | "openclaw"
  | "copilot-cli"
  | "gemini-cli"
  | "cursor"
  | "windsurf";

export type HostIntegrationStatus = "supported" | "preview" | "research";
export type HostSurfaceSupport = "supported" | "planned" | "not-supported";
export type HostProbe =
  | { kind: "command"; value: string }
  | { kind: "home-directory"; value: string };

export type HostIntegration = {
  id: HostIntegrationId;
  displayName: string;
  destinationId: DestinationId | null;
  status: HostIntegrationStatus;
  detection: readonly HostProbe[];
  delivery: {
    standingPractice: HostSurfaceSupport;
    onDemandPractice: HostSurfaceSupport;
    transientContext: HostSurfaceSupport;
    verificationGate: HostSurfaceSupport;
  };
  installation: {
    mode: "rack-managed-files" | "native-extension" | "native-skills" | "manual-preview";
    requiresReview: true;
    writesCanonicalSource: false;
    note: string;
  };
};

const integrations: readonly HostIntegration[] = [
  {
    id: "claude-code",
    displayName: "Claude Code",
    destinationId: "claude-code",
    status: "supported",
    detection: [
      { kind: "command", value: "claude" },
      { kind: "home-directory", value: ".claude" },
    ],
    delivery: {
      standingPractice: "supported",
      onDemandPractice: "supported",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "rack-managed-files",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Install reviewed project instructions and skills as generated Rack output.",
    },
  },
  {
    id: "codex",
    displayName: "Codex",
    destinationId: "codex",
    status: "supported",
    detection: [
      { kind: "command", value: "codex" },
      { kind: "home-directory", value: ".codex" },
    ],
    delivery: {
      standingPractice: "supported",
      onDemandPractice: "not-supported",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "rack-managed-files",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Install reviewed hierarchical AGENTS.md output inside the selected project.",
    },
  },
  {
    id: "opencode",
    displayName: "OpenCode",
    destinationId: "opencode",
    status: "supported",
    detection: [
      { kind: "command", value: "opencode" },
      { kind: "home-directory", value: ".opencode" },
    ],
    delivery: {
      standingPractice: "supported",
      onDemandPractice: "supported",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "rack-managed-files",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Install reviewed AGENTS.md and command files; host registration remains explicit.",
    },
  },
  {
    id: "hermes-agent",
    displayName: "Hermes Agent",
    destinationId: "hermes-agent",
    status: "preview",
    detection: [
      { kind: "command", value: "hermes" },
      { kind: "home-directory", value: ".hermes" },
    ],
    delivery: {
      standingPractice: "planned",
      onDemandPractice: "planned",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "native-skills",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Experiment with portable SKILL.md delivery plus per-project standing practice.",
    },
  },
  {
    id: "openclaw",
    displayName: "OpenClaw",
    destinationId: "openclaw",
    status: "preview",
    detection: [
      { kind: "command", value: "openclaw" },
      { kind: "command", value: "clawhub" },
      { kind: "home-directory", value: ".openclaw" },
    ],
    delivery: {
      standingPractice: "planned",
      onDemandPractice: "planned",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "native-skills",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Experiment with native skill delivery without allowing shared practice to install executable code.",
    },
  },
  {
    id: "copilot-cli",
    displayName: "GitHub Copilot CLI",
    destinationId: null,
    status: "research",
    detection: [{ kind: "command", value: "copilot" }],
    delivery: {
      standingPractice: "planned",
      onDemandPractice: "planned",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "native-extension",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Research Copilot's native extension and project-instruction surfaces before adding a Rack destination.",
    },
  },
  {
    id: "gemini-cli",
    displayName: "Gemini CLI",
    destinationId: null,
    status: "research",
    detection: [{ kind: "command", value: "gemini" }],
    delivery: {
      standingPractice: "planned",
      onDemandPractice: "planned",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "native-extension",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Research Gemini CLI extensions and project context before adding a Rack destination.",
    },
  },
  {
    id: "cursor",
    displayName: "Cursor",
    destinationId: null,
    status: "research",
    detection: [
      { kind: "command", value: "cursor" },
      { kind: "home-directory", value: ".cursor" },
    ],
    delivery: {
      standingPractice: "planned",
      onDemandPractice: "planned",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "rack-managed-files",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Research current project rule conventions and avoid assuming they are equivalent to AGENTS.md.",
    },
  },
  {
    id: "windsurf",
    displayName: "Windsurf",
    destinationId: null,
    status: "research",
    detection: [{ kind: "command", value: "windsurf" }],
    delivery: {
      standingPractice: "planned",
      onDemandPractice: "planned",
      transientContext: "planned",
      verificationGate: "planned",
    },
    installation: {
      mode: "rack-managed-files",
      requiresReview: true,
      writesCanonicalSource: false,
      note: "Research current project rule conventions before adding a Rack destination.",
    },
  },
] as const;

export const listHostIntegrations = (): HostIntegration[] =>
  [...integrations].sort((left, right) => left.displayName.localeCompare(right.displayName));

export const getHostIntegration = (
  id: HostIntegrationId,
): HostIntegration | null => integrations.find((item) => item.id === id) ?? null;

export const getHostIntegrationForDestination = (
  destinationId: DestinationId,
): HostIntegration | null =>
  integrations.find((item) => item.destinationId === destinationId) ?? null;

export type HostInstallAction = {
  path: string;
  purpose: "standing-practice" | "on-demand-practice";
};

export type HostInstallationPlan = {
  host: HostIntegration;
  actions: HostInstallAction[];
  reviewRequired: true;
  canonicalSourceChanged: false;
  transientContextWritten: false;
  warnings: string[];
};

const artifactPurpose = (artifact: GeneratedArtifact): HostInstallAction["purpose"] =>
  artifact.path.includes("/skills/") || artifact.path.includes("/commands/")
    ? "on-demand-practice"
    : "standing-practice";

export const buildHostInstallationPlan = (
  hostId: HostIntegrationId,
  artifacts: readonly GeneratedArtifact[],
): HostInstallationPlan | null => {
  const host = getHostIntegration(hostId);
  if (!host) return null;

  const warnings: string[] = [];
  if (host.status !== "supported") {
    warnings.push(
      host.displayName +
        " integration is " +
        host.status +
        "; Rack should preview the hand-off before offering installation.",
    );
  }

  if (
    host.destinationId &&
    artifacts.some((artifact) => artifact.target !== host.destinationId)
  ) {
    warnings.push(
      "Some generated files belong to a different Rack destination and must not be installed for this host.",
    );
  }

  return {
    host,
    actions: artifacts
      .filter((artifact) => !host.destinationId || artifact.target === host.destinationId)
      .map((artifact) => ({ path: artifact.path, purpose: artifactPurpose(artifact) })),
    reviewRequired: true,
    canonicalSourceChanged: false,
    transientContextWritten: false,
    warnings,
  };
};
