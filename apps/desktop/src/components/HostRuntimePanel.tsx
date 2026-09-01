import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  buildHostRuntimePlan,
  renderTransientHostInput,
  type HostIntegrationId,
} from "@rack/core";
import {
  TopoContextPanel,
  type TopoContextSelection,
} from "./TopoContextPanel.js";

type HostRuntimePanelProps = {
  projectName: string;
  hostId: HostIntegrationId;
  detected: boolean;
  practiceCurrent: boolean;
  workRoot: string | null;
  onStatus: (message: string) => void;
};

type HostRuntimeExecution = {
  hostId: string;
  status: "completed" | "failed" | "timeout";
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  contextDelivery: "stdin";
  persistedInput: false;
};

export function HostRuntimePanel({
  projectName,
  hostId,
  detected,
  practiceCurrent,
  workRoot,
  onStatus,
}: HostRuntimePanelProps) {
  const plan = useMemo(() => buildHostRuntimePlan(hostId), [hostId]);
  const [task, setTask] = useState("");
  const [topoContext, setTopoContext] = useState<TopoContextSelection>({
    enabled: false,
    snapshot: null,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HostRuntimeExecution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleContextChange = useCallback((selection: TopoContextSelection) => {
    setTopoContext(selection);
    setResult(null);
    setError(null);
  }, []);

  if (!plan) return null;

  if (plan.status !== "available") {
    return (
      <div className="host-runtime-panel">
        <p className="eyebrow">Transient task context</p>
        <h3>Runtime hand-off is still planned</h3>
        <p>{plan.message}</p>
        <small>
          Rack will not fall back to writing personal context into standing host
          files merely to claim support.
        </small>
      </div>
    );
  }

  const runTask = async () => {
    if (!workRoot || !detected || !practiceCurrent || !task.trim()) return;
    if (topoContext.enabled && !topoContext.snapshot) {
      setError("Review the selected TOPO context before handing this task to the AI tool.");
      return;
    }

    setError(null);
    setResult(null);
    let input: string;
    try {
      input = renderTransientHostInput(
        topoContext.enabled ? topoContext.snapshot : null,
        task,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Rack could not prepare this task.");
      return;
    }

    const confirmed = window.confirm(
      `Run this task with ${plan.displayName} in read-only mode?\n\nWork project: ${workRoot}\n\nTask and reviewed TOPO context are passed over stdin. Rack does not add them to command-line arguments, generated host files or Rack source. The AI tool itself may apply its own provider-side data policies.\n\nCommand shape: ${plan.displayCommand}`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const execution = await invoke<HostRuntimeExecution>(
        "run_transient_host_task",
        {
          workRoot,
          hostId,
          input,
          confirmed: true,
        },
      );
      setResult(execution);
      onStatus(
        execution.status === "completed"
          ? `${plan.displayName} completed the read-only task hand-off.`
          : `${plan.displayName} task hand-off ended with ${execution.status}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not run the transient host task.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="host-runtime-panel">
      <div>
        <p className="eyebrow">Transient task context · read-only</p>
        <h3>Use this Rack with {plan.displayName}</h3>
        <p>{plan.message}</p>
      </div>

      {!workRoot ? (
        <div className="notice">Choose a work project before running a task.</div>
      ) : !detected ? (
        <div className="notice">
          Rack has not detected {plan.displayName} on this computer.
        </div>
      ) : !practiceCurrent ? (
        <div className="notice">
          Install or update this Rack for {plan.displayName} before running the
          transient task. Runtime context should sit on top of current standing
          practice, not replace it.
        </div>
      ) : (
        <>
          <label className="check-field">
            <span>Task</span>
            <textarea
              rows={5}
              value={task}
              placeholder="Describe the piece of work you want the AI tool to inspect or plan."
              onChange={(event) => {
                setTask(event.target.value);
                setResult(null);
                setError(null);
              }}
            />
          </label>

          <TopoContextPanel
            projectName={projectName}
            useLabel="Use TOPO memory for this task"
            defaultPurpose={
              task.trim()
                ? `support transient AI task: ${task.trim().slice(0, 500)}`
                : "support this transient AI task"
            }
            onChange={handleContextChange}
            onStatus={onStatus}
          />

          <div className="notice">
            <strong>Runtime boundary</strong>
            <span>
              Task and selected context go to the host over stdin for this invocation.
              They are not installed into CLAUDE.md, AGENTS.md or Rack source.
            </span>
          </div>

          <button
            className="primary-action"
            type="button"
            disabled={
              busy ||
              !task.trim() ||
              (topoContext.enabled && !topoContext.snapshot)
            }
            onClick={() => void runTask()}
          >
            {busy ? `Running ${plan.displayName}…` : `Review and run with ${plan.displayName}`}
          </button>
        </>
      )}

      {result ? (
        <div className={"check-result check-result--" + (result.status === "completed" ? "pass" : "fail")}>
          <h3>
            {result.status === "completed"
              ? "Host task completed"
              : result.status === "timeout"
                ? "Host task timed out"
                : "Host task failed"}
          </h3>
          <small>
            {(result.durationMs / 1000).toFixed(1)}s · context delivered via{" "}
            {result.contextDelivery} · input persisted by Rack?{" "}
            {result.persistedInput ? "yes" : "no"}
          </small>
          {result.stdout ? (
            <pre><code>{result.stdout}</code></pre>
          ) : null}
          {result.stderr ? (
            <details>
              <summary>Host diagnostic output</summary>
              <pre><code>{result.stderr}</code></pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="notice notice--error" role="alert">{error}</div>
      ) : null}
    </div>
  );
}
