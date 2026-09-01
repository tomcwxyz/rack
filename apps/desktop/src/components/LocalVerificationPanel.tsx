import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  buildVerificationPlan,
  resolveAutomaticVerifiers,
  type RackProject,
  type VerificationStepResult,
} from "@rack/core";

type LocalVerificationPanelProps = {
  project: RackProject;
  selectedProfile: string;
  workRoot: string | null;
  onEvidence: (evidence: string) => void;
  onResult: (result: VerificationStepResult | null) => void;
};

type RepositoryCheckPlan = {
  status: "available" | "unavailable";
  packageManager: string | null;
  checks: Array<{
    id: string;
    label: string;
    script: string;
    definition: string;
    lifecycleScripts: Array<{ name: string; definition: string }>;
    displayCommand: string;
  }>;
  fingerprint: string | null;
  message: string;
};

type RepositoryCheckExecution = {
  status: "pass" | "fail" | "incomplete";
  fingerprint: string;
  checks: Array<{
    id: string;
    label: string;
    displayCommand: string;
    status: "pass" | "fail" | "timeout" | "error";
    exitCode: number | null;
    timedOut: boolean;
    durationMs: number;
    stdout: string;
    stderr: string;
    definition: string;
    lifecycleScripts: Array<{ name: string; definition: string }>;
  }>;
  evidence: string;
};

export function LocalVerificationPanel({
  project,
  selectedProfile,
  workRoot,
  onEvidence,
  onResult,
}: LocalVerificationPanelProps) {
  const verificationPlan = useMemo(
    () => buildVerificationPlan(project, selectedProfile),
    [project, selectedProfile],
  );
  const automatic = useMemo(
    () => resolveAutomaticVerifiers(verificationPlan),
    [verificationPlan],
  );
  const repositoryStep = verificationPlan.steps.find(
    (step) => step.kind === "automatic" && step.check === "repository-checks",
  );
  const registry = automatic.find((item) => item.check === "repository-checks");

  const [plan, setPlan] = useState<RepositoryCheckPlan | null>(null);
  const [result, setResult] = useState<RepositoryCheckExecution | null>(null);
  const [busy, setBusy] = useState<"inspect" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!workRoot || !repositoryStep || registry?.status !== "available") {
      setPlan(null);
      setResult(null);
      onResult(null);
      setError(null);
      return;
    }

    setBusy("inspect");
    setError(null);
    try {
      const next = await invoke<RepositoryCheckPlan>("inspect_repository_checks", {
        rackRoot: project.root,
        workRoot,
      });
      setPlan(next);
      setResult(null);
      onResult(null);
    } catch (reason) {
      setPlan(null);
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not inspect this repository.",
      );
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, [project.root, repositoryStep?.id, registry?.status, workRoot]);

  const runChecks = async () => {
    if (!plan?.fingerprint || plan.status !== "available") return;

    const commands = plan.checks.map((check) => check.displayCommand).join("\n");
    const confirmed = window.confirm(
      "Run these local repository commands from " +
        workRoot +
        "?\n\n" +
        commands +
        "\n\nThe command and the repository-defined script/lifecycle contents shown on screen come from this work project's package.json, not from Starter or shared Rack practice.",
    );
    if (!confirmed) return;

    setBusy("run");
    setError(null);
    try {
      const execution = await invoke<RepositoryCheckExecution>(
        "run_repository_checks",
        {
          rackRoot: project.root,
          workRoot,
          fingerprint: plan.fingerprint,
          confirmed: true,
        },
      );
      setResult(execution);
      onEvidence(execution.evidence);
      onResult({
        stepId: repositoryStep.id,
        outcome: execution.status,
      });
    } catch (reason) {
      setResult(null);
      onResult(null);
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Rack could not run the local repository checks.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (!workRoot) {
    return (
      <div className="check-panel local-verification-panel">
        <p className="eyebrow">Local verification</p>
        <h3>Choose a work project first</h3>
        <p className="section-intro">
          Rack source and the repository being checked can be different folders. Choose
          the work project above before Rack inspects package.json or runs local checks.
        </p>
      </div>
    );
  }

  if (!repositoryStep) {
    return (
      <div className="check-panel local-verification-panel">
        <p className="eyebrow">Local verification</p>
        <h3>No automatic repository check is active</h3>
        <p className="section-intro">
          This Set-up can still use human or bounded AI judgement. Add a trusted
          automatic verification step when deterministic repository checks should
          gate completion.
        </p>
      </div>
    );
  }

  return (
    <div className="check-panel local-verification-panel">
      <div className="local-verification-heading">
        <div>
          <p className="eyebrow">Local verification · no managed service</p>
          <h3>{repositoryStep.label}</h3>
          <p className="section-intro">{repositoryStep.requirement}</p>
        </div>
        {result ? (
          <span className={"check-mode-badge check-result--" + result.status}>
            {result.status}
          </span>
        ) : null}
      </div>

      {registry?.status !== "available" ? (
        <div className="notice">
          The verifier is registered but is not available in this Rack build.
        </div>
      ) : busy === "inspect" && !plan ? (
        <p className="checks-loading" role="status">
          Inspecting repository checks…
        </p>
      ) : plan ? (
        <>
          <p>{plan.message}</p>
          {plan.status === "available" ? (
            <>
              <div className="repository-command-list">
                {plan.checks.map((check) => (
                  <div key={check.id} className="repository-command">
                    <div>
                      <strong>{check.label}</strong>
                      <small>{check.script}</small>
                      <code>{check.definition}</code>
                      {check.lifecycleScripts.map((lifecycle) => (
                        <small key={lifecycle.name}>
                          {lifecycle.name}: <code>{lifecycle.definition}</code>
                        </small>
                      ))}
                    </div>
                    <code>{check.displayCommand}</code>
                  </div>
                ))}
              </div>
              <button
                className="primary-action"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void runChecks()}
              >
                {busy === "run"
                  ? "Running local checks…"
                  : "Review and run " +
                    plan.checks.length +
                    " " +
                    (plan.checks.length === 1 ? "check" : "checks")}
              </button>
              <small className="check-confirm-note">
                Rack re-inspects the plan at execution time and refuses to run if
                package.json changed after this review. Each command is run directly,
                without a shell, with a three-minute limit and bounded captured output.
              </small>
            </>
          ) : (
            <div className="notice">{plan.message}</div>
          )}
        </>
      ) : null}

      {result ? (
        <div className={"check-result check-result--" + result.status}>
          <div className="check-result-heading">
            <h3>
              {result.status === "pass"
                ? "Repository checks passed"
                : result.status === "fail"
                  ? "Repository checks failed"
                  : "Repository checks incomplete"}
            </h3>
          </div>
          {result.checks.map((check) => (
            <details className="check-output" key={check.id}>
              <summary>
                {check.label +
                  " · " +
                  check.status +
                  " · " +
                  (check.durationMs / 1000).toFixed(1) +
                  "s"}
              </summary>
              <p>
                <code>{check.displayCommand}</code>
              </p>
              <p>
                Repository script: <code>{check.definition}</code>
              </p>
              {check.lifecycleScripts.length > 0 ? (
                <ul>
                  {check.lifecycleScripts.map((lifecycle) => (
                    <li key={lifecycle.name}>
                      {lifecycle.name}: <code>{lifecycle.definition}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
              {check.stdout ? (
                <pre>
                  <code>{check.stdout}</code>
                </pre>
              ) : null}
              {check.stderr ? (
                <pre>
                  <code>{check.stderr}</code>
                </pre>
              ) : null}
            </details>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
