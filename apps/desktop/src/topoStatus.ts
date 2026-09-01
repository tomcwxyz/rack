export type TopoConnectionState =
  | "not-running"
  | "sharing-off"
  | "unsupported"
  | "connected"
  | "unreachable"
  | "discovery-error";

export type TopoLocalStatus = {
  available: boolean;
  state: TopoConnectionState;
  nodeId: string | null;
  version: string | null;
  message: string;
};

export function topoStatusLabel(
  status: TopoLocalStatus | null,
  checking = false,
): string {
  if (checking || !status) return "Looking for TOPO…";

  switch (status.state) {
    case "connected":
      return "Connected" + (status.version ? " · " + status.version : "");
    case "sharing-off":
      return "Permission needed";
    case "unsupported":
      return "Update needed";
    case "unreachable":
      return "Reconnecting…";
    case "discovery-error":
      return "Connection issue";
    case "not-running":
      return "Waiting for TOPO";
  }
}

export function topoStatusMessage(status: TopoLocalStatus | null): string {
  if (!status) return "Looking for TOPO on this computer.";

  switch (status.state) {
    case "connected":
      return "TOPO is available on this computer.";
    case "sharing-off":
      return "TOPO is open. Choose Allow local tools in TOPO.";
    case "unsupported":
      return "TOPO is open, but this version cannot share context with Rack.";
    case "unreachable":
      return "Rack found TOPO and is trying to reconnect.";
    case "discovery-error":
      return "Rack found TOPO connection information, but it could not be used safely. Restart TOPO or check its local-sharing setup.";
    case "not-running":
      return "Open TOPO and Rack will find it automatically.";
  }
}
