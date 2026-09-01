import {
  contextFlowDecision,
  type ContextSnapshot,
} from "./contextSources.js";
import {
  getHostIntegration,
  type HostIntegrationId,
} from "./hostIntegration.js";

export type HostRuntimeMode = "read-only";

export type HostRuntimePlan = {
  hostId: HostIntegrationId;
  displayName: string;
  status: "available" | "planned";
  mode: HostRuntimeMode;
  contextDelivery: "stdin";
  taskDelivery: "stdin";
  persistsContextInRack: false;
  writesProjectFiles: false;
  requiresConfirmation: true;
  displayCommand: string | null;
  message: string;
};

export const buildHostRuntimePlan = (
  hostId: HostIntegrationId,
): HostRuntimePlan | null => {
  const host = getHostIntegration(hostId);
  if (!host) return null;

  const available =
    hostId === "claude-code" || hostId === "codex";

  return {
    hostId,
    displayName: host.displayName,
    status: available ? "available" : "planned",
    mode: "read-only",
    contextDelivery: "stdin",
    taskDelivery: "stdin",
    persistsContextInRack: false,
    writesProjectFiles: false,
    requiresConfirmation: true,
    displayCommand:
      hostId === "claude-code"
        ? "claude -p … --permission-mode plan"
        : hostId === "codex"
          ? "codex exec --ephemeral --sandbox read-only …"
          : null,
    message: available
      ? "Rack can pass this task and reviewed context transiently over stdin without installing it into the work project."
      : "Rack has not yet proved a safe transient-context channel for this host.",
  };
};

const cleanTask = (task: string): string => {
  const value = task.trim();
  if (!value) throw new Error("Describe the task before handing it to an AI tool.");
  if (value.length > 8_000) {
    throw new Error("The task is too large for the transient host hand-off.");
  }
  return value;
};

export const renderTransientHostInput = (
  snapshot: ContextSnapshot | null,
  task: string,
): string => {
  const normalisedTask = cleanTask(task);
  if (!snapshot) {
    return [
      "# RACK transient task hand-off",
      "",
      "## Task",
      normalisedTask,
      "",
      "No additional TOPO context was selected for this task.",
      "",
    ].join("\n");
  }

  const flow = contextFlowDecision(snapshot, "transient-task");
  if (!flow.allowed) throw new Error(flow.reason);

  const objects = snapshot.objects.map((object) => ({
    type: object.type,
    id: object.id,
    value: object.value,
  }));

  return [
    "# RACK transient task hand-off",
    "",
    "## Task",
    normalisedTask,
    "",
    "## Context handling",
    `Purpose: ${snapshot.purpose}`,
    `Relationship boundary: ${snapshot.boundary}`,
    "Use the reviewed context below only for this task. Do not turn it into standing project instructions or durable memory merely because it appears in this hand-off.",
    "",
    "## Reviewed TOPO context",
    "~~~json",
    JSON.stringify(objects, null, 2),
    "~~~",
    "",
  ].join("\n");
};
