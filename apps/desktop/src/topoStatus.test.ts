import { describe, expect, it } from "vitest";
import {
  topoStatusLabel,
  topoStatusMessage,
  type TopoLocalStatus,
} from "./topoStatus.js";

const status = (
  state: TopoLocalStatus["state"],
  available = false,
): TopoLocalStatus => ({
  available,
  state,
  nodeId: state === "not-running" || state === "discovery-error" ? null : "topo",
  version: state === "not-running" || state === "discovery-error" ? null : "0.1.0",
  message: state,
});

describe("TOPO connection copy", () => {
  it("distinguishes absence, permission, invalid discovery and reconnection", () => {
    expect(topoStatusLabel(status("not-running"))).toBe("Waiting for TOPO");
    expect(topoStatusLabel(status("sharing-off"))).toBe("Permission needed");
    expect(topoStatusLabel(status("discovery-error"))).toBe("Connection issue");
    expect(topoStatusLabel(status("unreachable"))).toBe("Reconnecting…");
  });

  it("keeps connection detail plain-language", () => {
    expect(topoStatusMessage(status("discovery-error"))).toContain(
      "could not be used safely",
    );
    expect(topoStatusMessage(status("not-running"))).toContain("Open TOPO");
    expect(topoStatusLabel(status("connected", true))).toBe("Connected · 0.1.0");
  });
});
