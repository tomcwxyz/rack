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

type TopoLocalStatus = {
  available: boolean;
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
  const [checking, setChecking] = useState(false);
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

  const checkTopo = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await invoke<TopoLocalStatus>("topo_local_status"));
    } catch (reason) {
      setStatus({
        available: false,
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
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkTopo();
  }, [checkTopo]);

  useEffect(() => {
    setSubject("project:" + projectName);
    setSnapshot(null);
    publish(enabled, null);
  }, [projectName]);

  const clearSnapshot = () => {
    setSnapshot(null);
    setError(null);
    publish(enabled, null);
  };

  const requestContext = async () => {
    if (!subject.trim() || !purpose.trim()) {
      setError("Give TOPO a subject and a purpose before requesting context.");
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
    } finally {
      setLoading(false);
    }
  };

  const statusText = checking
    ? "Checking…"
    : status?.available
      ? "Available" + (status.version ? " · " + status.version : "")
      : "Not available";

  return (
    <aside className="topo-context-panel" aria-label="TOPO organisational context">
      <div className="topo-context-heading">
        <div>
          <p className="eyebrow">Organisational context · TOPO</p>
          <h3>Use current local memory in this build</h3>
        </div>
        <span
          className={
            "topo-status" +
            (status?.available ? " topo-status--available" : "")
          }
        >
          {statusText}
        </span>
      </div>

      <p className="muted-copy">
        Rack asks the running TOPO desktop for purpose-bound context. It does
        not read TOPO's database. This local connection can share ordinary and
        personal memory only; sensitive and restricted memory stays in TOPO.
      </p>

      {!status?.available ? (
        <div className="topo-context-unavailable">
          <span>
            {status?.message ??
              "Open TOPO desktop to make local context available."}
          </span>
          <button
            className="quiet-action"
            type="button"
            onClick={() => void checkTopo()}
            disabled={checking}
          >
            Check again
          </button>
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
            <span>Include TOPO context in this prompt build</span>
          </label>

          {enabled ? (
            <>
              <div className="topo-context-fields">
                <label className="field">
                  <span>Subject</span>
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
                  <span>Purpose</span>
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
                    ? "Requesting…"
                    : snapshot
                      ? "Refresh context"
                      : "Preview context"}
                </button>
                {snapshot ? (
                  <span>
                    {snapshot.objects.length} selected · packet {snapshot.id}
                  </span>
                ) : (
                  <span>Preview exactly what TOPO would supply before building.</span>
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
              ) : null}
            </>
          ) : null}
        </>
      )}
    </aside>
  );
}
