import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type TopoConnectionState =
  | "not-running"
  | "sharing-off"
  | "unsupported"
  | "connected"
  | "unreachable";

type TopoLocalStatus = {
  available: boolean;
  state: TopoConnectionState;
  nodeId: string | null;
  version: string | null;
  message: string;
};

type TopoConnectionIndicatorProps = {
  compact?: boolean;
  onOpenContext?: () => void;
};

export function TopoConnectionIndicator({
  compact = false,
  onOpenContext,
}: TopoConnectionIndicatorProps) {
  const [status, setStatus] = useState<TopoLocalStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await invoke<TopoLocalStatus>("topo_local_status"));
    } catch (reason) {
      setStatus({
        available: false,
        state: "unreachable",
        nodeId: null,
        version: null,
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Rack could not check TOPO.",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stateLabel =
    status?.state === "connected"
      ? "Connected"
      : status?.state === "sharing-off"
        ? "Permission needed"
        : status?.state === "unsupported"
          ? "Update needed"
          : status?.state === "unreachable"
            ? "Reconnecting"
            : "Not connected";

  const message =
    status?.state === "connected"
      ? "TOPO is available on this computer."
      : status?.state === "sharing-off"
        ? "TOPO is open. Choose Allow local tools in TOPO."
        : status?.state === "unsupported"
          ? "TOPO is open, but this version cannot share context with Rack."
          : status?.state === "unreachable"
            ? "Rack found TOPO and is trying to reconnect."
            : "Open TOPO and Rack will find it automatically.";

  const body = (
    <>
      <div className="topo-connection-title">
        <span className="topo-connection-mark" aria-hidden="true">T</span>
        <div>
          <strong>TOPO memory</strong>
          <span
            className={
              "topo-connection-state" +
              (status?.state === "connected"
                ? " topo-connection-state--connected"
                : "")
            }
            aria-live="polite"
          >
            {stateLabel}
            {status?.state === "connected" && status.version
              ? " · " + status.version
              : ""}
          </span>
        </div>
      </div>
      {!compact ? <p>{message}</p> : null}
      {status?.state === "connected" && onOpenContext ? (
        <span className="topo-connection-action">Use in this Rack →</span>
      ) : null}
    </>
  );

  if (onOpenContext && status?.state === "connected") {
    return (
      <button
        className={
          "topo-connection-indicator topo-connection-indicator--button" +
          (compact ? " topo-connection-indicator--compact" : "")
        }
        type="button"
        onClick={onOpenContext}
        title={message}
      >
        {body}
      </button>
    );
  }

  return (
    <aside
      className={
        "topo-connection-indicator" +
        (compact ? " topo-connection-indicator--compact" : "")
      }
      aria-label="TOPO connection"
      title={compact ? message : undefined}
    >
      {body}
    </aside>
  );
}
