import { describe, expect, it } from "vitest";
import {
  buildHostInstallationPlan,
  buildHostRuntimePlan,
  getHostIntegration,
  type HostIntegrationId,
} from "../src/index.js";
import type { GeneratedArtifact } from "../src/compiler.js";

const hostArtifact = (hostId: HostIntegrationId): GeneratedArtifact[] => {
  const host = getHostIntegration(hostId);
  if (!host?.destinationId) return [];
  const path =
    hostId === "claude-code"
      ? "CLAUDE.md"
      : "AGENTS.md";
  return [
    {
      target: host.destinationId,
      path,
      mediaType: "text/markdown",
      content: "# Rack practice\n",
      moduleIds: ["method.test"],
    },
  ];
};

describe("coding host conformance", () => {
  for (const hostId of ["claude-code", "codex", "opencode"] as const) {
    it(`${hostId} never installs transient task context as standing practice`, () => {
      const install = buildHostInstallationPlan(hostId, hostArtifact(hostId));
      expect(install?.canonicalSourceChanged).toBe(false);
      expect(install?.transientContextWritten).toBe(false);
      expect(install?.actions.length).toBeGreaterThan(0);
    });
  }

  for (const hostId of ["claude-code", "codex"] as const) {
    it(`${hostId} has a proven stdin-only transient channel`, () => {
      const host = getHostIntegration(hostId);
      const runtime = buildHostRuntimePlan(hostId);
      expect(host?.delivery.standingPractice).toBe("supported");
      expect(host?.delivery.transientContext).toBe("supported");
      expect(runtime).toMatchObject({
        status: "available",
        contextDelivery: "stdin",
        taskDelivery: "stdin",
        persistsContextInRack: false,
        writesProjectFiles: false,
        requiresConfirmation: true,
      });
    });
  }

  it("reports OpenCode transient delivery as a known degradation", () => {
    const host = getHostIntegration("opencode");
    const runtime = buildHostRuntimePlan("opencode");
    expect(host?.delivery.standingPractice).toBe("supported");
    expect(host?.delivery.transientContext).toBe("planned");
    expect(runtime?.status).toBe("planned");
    expect(runtime?.displayCommand).toBeNull();
  });
});
