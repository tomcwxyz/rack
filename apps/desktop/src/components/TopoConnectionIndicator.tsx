import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  topoStatusLabel,
  topoStatusMessage,
  type TopoLocalStatus,
} from "../topoStatus.js";

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

  const stateLabel = topoStatusLabel(status);
  const message = topoStatusMessage(status);

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
