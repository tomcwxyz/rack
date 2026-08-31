import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  parseOosContextPacket,
  type ContextSnapshot,
} from "@rack/core";

export type TopoContextSelection = {
  enabled: boolean;
  snapshot: ContextSnapshot | null;
};

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

type TopoContextPanelProps = {
  projectName: string;
  onChange: (selection: TopoContextSelection) => void;
  onStatus: (message: string) => void;
};

export function TopoContextPanel({
  projectName,
  onChange,
  onStatus,
}: TopoContextPanelProps) {
  const [status, setStatus] = useState<TopoLocalStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [subject, setSubject] = useState("project:" + projectName);
  const [purpose, setPurpose] = useState("prepare this Rack build");
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback(
    (nextEnabled: boolean, nextSnapshot: ContextSnapshot | null) => {
      onChange({ enabled: nextEnabled, snapshot: nextSnapshot });
    },
    [onChange],
  );

  const checkTopo = useCallback(async (quiet = false) => {
    if (!quiet) setChecking(true);
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
    } finally {
      if (!quiet) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkTopo();
    const timer = window.setInterval(() => {
      void checkTopo(true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [checkTopo]);

  useEffect(() => {
    setSubject("project:" + projectName);
    setSnapshot(null);
    publish(enabled, null);
  }, [projectName, publish]);

  useEffect(() => {
    if (status && !status.available && snapshot) {
      setSnapshot(null);
      publish(enabled, null);
    }
  }, [enabled, publish, snapshot, status]);

  const clearSnapshot = () => {
    setSnapshot(null);
    setError(null);
    publish(enabled, null);
  };

  const requestContext = async () => {
    if (!subject.trim() || !purpose.trim()) {
      setError("Tell Rack what this context is for before reviewing it.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const packet = await invoke<unknown>("topo_local_context", {
        subject: subject.trim(),
        purpose: purpose.trim(),
        maxItems: 20,
      });
      const next = parseOosContextPacket(packet, {
        subject: subject.trim(),
        purpose: purpose.trim(),
      });
      setSnapshot(next);
      publish(true, next);
      onStatus(
        "TOPO selected " +
          next.objects.length +
          " context " +
          (next.objects.length === 1 ? "item" : "items") +
          " for this build.",
      );
    } catch (reason) {
      setSnapshot(null);
      publish(true, null);
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not request TOPO context.",
      );
      void checkTopo(true);
    } finally {
      setLoading(false);
    }
  };

  const statusText = checking
    ? "Looking for TOPO…"
    : status?.state === "connected"
      ? "Connected" + (status.version ? " · " + status.version : "")
      : status?.state === "sharing-off"
        ? "Permission needed"
        : status?.state === "unsupported"
          ? "Update needed"
          : status?.state === "unreachable"
            ? "Reconnecting…"
            : "Waiting for TOPO";

  const unavailableMessage =
    status?.state === "not-running"
      ? "Open TOPO on this computer. Rack will notice it automatically."
      : status?.state === "sharing-off"
        ? "TOPO is open. In TOPO, choose Allow local tools. Rack will connect automatically."
        : status?.state === "unreachable"
          ? "Rack found TOPO but cannot reach it yet. It will keep trying automatically."
          : status?.message ??
            "Open TOPO and Rack will connect automatically when local context is available.";

  return (
    <aside className="topo-context-panel" aria-label="TOPO organisational context">
      <div className="topo-context-heading">
        <div>
          <p className="eyebrow">TOPO memory</p>
          <h3>Connect context from TOPO</h3>
        </div>
        <span
          className={
            "topo-status" +
            (status?.available ? " topo-status--available" : "")
          }
          aria-live="polite"
        >
          {statusText}
        </span>
      </div>

      <p className="muted-copy">
        TOPO and Rack stay separate. When you choose to use memory here, Rack
        asks TOPO for only the context relevant to this build. Sensitive and
        restricted memory stays in TOPO.
      </p>

      {!status?.available ? (
        <div className="topo-context-unavailable">
          <span>{unavailableMessage}</span>
          <small>Connection is checked automatically.</small>
        </div>
      ) : (
        <>
          <label className="topo-context-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                const next = event.target.checked;
                setEnabled(next);
                setSnapshot(null);
                setError(null);
                publish(next, null);
              }}
            />
            <span>Use TOPO memory in this build</span>
          </label>

          {enabled ? (
            <>
              <div className="topo-context-fields">
                <label className="field">
                  <span>Context for</span>
                  <input
                    value={subject}
                    onChange={(event) => {
                      setSubject(event.target.value);
                      clearSnapshot();
                    }}
                    placeholder="project:rack"
                  />
                </label>
                <label className="field">
                  <span>What are you doing?</span>
                  <input
                    value={purpose}
                    onChange={(event) => {
                      setPurpose(event.target.value);
                      clearSnapshot();
                    }}
                    placeholder="prepare this Rack build"
                  />
                </label>
              </div>

              <div className="topo-context-actions">
                <button
                  className="quiet-action"
                  type="button"
                  disabled={loading || !subject.trim() || !purpose.trim()}
                  onClick={() => void requestContext()}
                >
                  {loading
                    ? "Asking TOPO…"
                    : snapshot
                      ? "Refresh context"
                      : "Review context"}
                </button>
                {snapshot ? (
                  <span>
                    {snapshot.objects.length} selected · ready for this build
                  </span>
                ) : (
                  <span>
                    Review what TOPO selected before it affects generated output.
                  </span>
                )}
              </div>

              {error ? (
                <div className="notice notice--error topo-context-error" role="alert">
                  <span>{error}</span>
                </div>
              ) : null}

              {snapshot && snapshot.objects.length > 0 ? (
                <ul className="topo-context-items">
                  {snapshot.objects.slice(0, 8).map((object) => (
                    <li key={object.id}>
                      <code>
                        {typeof object.value.key === "string"
                          ? object.value.key
                          : object.id}
                      </code>
                    </li>
                  ))}
                </ul>
              ) : snapshot ? (
                <p className="topo-context-empty">
                  TOPO found no shareable memory for this subject and purpose.
                </p>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </aside>
  );
}
