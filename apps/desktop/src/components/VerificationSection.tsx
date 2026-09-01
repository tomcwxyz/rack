import { useEffect, useMemo, useState } from "react";
import {
  buildVerificationPlan,
  prepareTargetBuild,
  resolveVerificationCompletionGate,
  resolveVerificationJudgementGate,
  type RackProject,
  type VerificationCompletionStatus,
  type VerificationGateDecision,
  type VerificationPlanStep,
  type VerificationStepResult,
} from "@rack/core";
import {
  confirmVerificationJudgement,
  createManagedServiceClient,
  prepareVerificationJudgement,
  type VerificationJudgementExecution,
  type VerificationJudgementPlan,
} from "@rack/managed";
import { ManagedSignIn, useManagedAuth } from "../managedAuth.js";
import { LocalVerificationPanel } from "./LocalVerificationPanel.js";
import { formatMicrousd, settledCostMicrousd } from "../managedChecks.js";
import "../checks.css";

type VerificationSectionProps = {
  project: RackProject;
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
  workRoot: string | null;
};

type JudgementStep = VerificationPlanStep & { kind: "judgement"; question: string };
type HumanStep = VerificationPlanStep & { kind: "human"; prompt: string };
type EvidenceKind = JudgementStep["evidence"][number];

type VerificationResult = {
  execution: VerificationJudgementExecution;
  gate: VerificationGateDecision;
};

const evidenceLabels: Record<EvidenceKind, string> = {
  output: "Output to verify",
  diff: "Change diff",
  "test-results": "Test results",
  "build-results": "Build results",
  "task-input": "Task or request",
  source: "Source material",
};

const gateLabels: Record<VerificationGateDecision, string> = {
  continue: "Pass · continue",
  block: "Fail · stop here",
  warn: "Warning · review before continuing",
  human_review: "Needs human review",
  incomplete: "Incomplete · no decision",
};

const gateExplanation: Record<VerificationGateDecision, string> = {
  continue: "The supplied evidence passed this verification question.",
  block: "The configured practice says this result should block completion.",
  warn: "The configured practice allows continuation with a warning.",
  human_review:
    "Rack cannot make a safe final decision from this result. A person should review it.",
  incomplete:
    "Rack did not obtain a valid structured judgement, so it has not treated the work as passing.",
};

const completionStatusLabels: Record<VerificationCompletionStatus, string> = {
  pass: "Pass · completion requirements satisfied",
  fail: "Fail · completion is blocked",
  "review-required": "Review required",
  uncertain: "Uncertain · do not treat as pass",
  incomplete: "Incomplete · evidence is still missing",
};

export function VerificationSection({
  project,
  selectedProfile,
  onProfileChange,
  workRoot,
}: VerificationSectionProps) {
  const auth = useManagedAuth();
  const verificationPlan = useMemo(
    () => buildVerificationPlan(project, selectedProfile),
    [project, selectedProfile],
  );
  const judgementSteps = useMemo(
    () =>
      verificationPlan.steps.filter(
        (step): step is JudgementStep =>
          step.kind === "judgement" && typeof step.question === "string",
      ),
    [verificationPlan],
  );
  const humanSteps = useMemo(
    () =>
      verificationPlan.steps.filter(
        (step): step is HumanStep =>
          step.kind === "human" && typeof step.prompt === "string",
      ),
    [verificationPlan],
  );
  const [selectedStepId, setSelectedStepId] = useState(
    judgementSteps[0]?.id ?? "",
  );
  const [evidence, setEvidence] = useState<Partial<Record<EvidenceKind, string>>>(
    {},
  );
  const [plan, setPlan] = useState<VerificationJudgementPlan | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preflight" | "run" | null>(null);
  const [localEvidence, setLocalEvidence] = useState("");
  const [automaticResult, setAutomaticResult] =
    useState<VerificationStepResult | null>(null);
  const [judgementResults, setJudgementResults] = useState<
    Record<string, VerificationStepResult>
  >({});
  const [humanResults, setHumanResults] = useState<
    Record<string, "pass" | "fail">
  >({});

  const selectedStep =
    judgementSteps.find((step) => step.id === selectedStepId) ??
    judgementSteps[0] ??
    null;

  const client = useMemo(
    () =>
      auth.serviceUrl
        ? createManagedServiceClient({
            baseUrl: auth.serviceUrl,
            getAccessToken: auth.getAccessToken,
          })
        : null,
    [auth.getAccessToken, auth.serviceUrl],
  );

  useEffect(() => {
    if (selectedStep && selectedStep.id !== selectedStepId) {
      setSelectedStepId(selectedStep.id);
    }
  }, [selectedStep, selectedStepId]);

  useEffect(() => {
    if (!localEvidence || !selectedStep) return;
    setEvidence((current) => {
      const next = { ...current };
      let changed = false;
      if (
        selectedStep.evidence.includes("test-results") &&
        !current["test-results"]?.trim()
      ) {
        next["test-results"] = localEvidence;
        changed = true;
      }
      if (
        selectedStep.evidence.includes("build-results") &&
        !current["build-results"]?.trim()
      ) {
        next["build-results"] = localEvidence;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [localEvidence, selectedStep]);

  const invalidate = (clearRecorded = true) => {
    setPlan(null);
    setResult(null);
    setError(null);
    if (clearRecorded && selectedStepId) {
      setJudgementResults((current) => {
        if (!(selectedStepId in current)) return current;
        const next = { ...current };
        delete next[selectedStepId];
        return next;
      });
    }
  };

  const changeStep = (stepId: string) => {
    setSelectedStepId(stepId);
    setEvidence({});
    invalidate(false);
  };

  const evidenceItems = () => {
    if (!selectedStep) return [];
    return selectedStep.evidence.map((kind) => ({
      kind,
      content: evidence[kind]?.trim() ?? "",
    }));
  };

  const checkCost = async () => {
    if (!client || !selectedStep) return;

    const supplied = evidenceItems();
    const missing = supplied.filter((item) => !item.content);
    if (missing.length > 0) {
      setError(
        `Add ${missing.map((item) => evidenceLabels[item.kind].toLowerCase()).join(", ")} before checking the cost.`,
      );
      return;
    }

    setBusy("preflight");
    setError(null);
    setResult(null);
    try {
      const prepared = await prepareTargetBuild(project, selectedProfile, "prompt");
      const buildError = prepared.diagnostics.find(
        (diagnostic) => diagnostic.severity === "error",
      );
      if (buildError) throw new Error(buildError.message);

      const rackFingerprint = prepared.manifest?.source.digest;
      if (!rackFingerprint) {
        throw new Error("Rack could not fingerprint this Set-up for verification.");
      }

      const nextPlan = await prepareVerificationJudgement(client, {
        rackFingerprint,
        profileId: selectedProfile,
        modelAlias: auth.quickModelAlias,
        question: selectedStep.question,
        evidence: supplied,
      });
      setPlan(nextPlan);
    } catch (caught) {
      setPlan(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Rack could not prepare this verification.",
      );
    } finally {
      setBusy(null);
    }
  };

  const runVerification = async () => {
    if (
      !client ||
      !selectedStep ||
      !plan ||
      !plan.response.eligibleForConfirmation
    ) {
      return;
    }

    setBusy("run");
    setError(null);
    try {
      const execution = await confirmVerificationJudgement(
        client,
        plan,
        globalThis.crypto.randomUUID(),
      );
      const gate = resolveVerificationJudgementGate(
        selectedStep,
        execution.judgement?.verdict ?? null,
      );
      setResult({ execution, gate });
      setJudgementResults((current) => ({
        ...current,
        [selectedStep.id]: {
          stepId: selectedStep.id,
          outcome: execution.judgement?.verdict ?? "incomplete",
        },
      }));
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Rack could not complete this verification.",
      );
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    setAutomaticResult(null);
    setJudgementResults({});
    setHumanResults({});
    setLocalEvidence("");
    setPlan(null);
    setResult(null);
    setEvidence({});
  }, [selectedProfile]);

  const selectedProfileTitle =
    project.profiles.find((profile) => profile.id === selectedProfile)?.title ??
    selectedProfile;

  const completionResults = useMemo<VerificationStepResult[]>(
    () => [
      ...(automaticResult ? [automaticResult] : []),
      ...Object.values(judgementResults),
      ...Object.entries(humanResults).map(([stepId, outcome]) => ({
        stepId,
        outcome,
      })),
    ],
    [automaticResult, humanResults, judgementResults],
  );

  const completionGate = useMemo(
    () => resolveVerificationCompletionGate(verificationPlan, completionResults),
    [completionResults, verificationPlan],
  );

  const localPanel = (
    <LocalVerificationPanel
      project={project}
      selectedProfile={selectedProfile}
      workRoot={workRoot}
      onEvidence={(value) => {
        setLocalEvidence(value);
        setPlan(null);
        setResult(null);
      }}
      onResult={setAutomaticResult}
    />
  );

  const completionGatePanel = (
    <div className="check-panel completion-gate-panel">
      <div className="local-verification-heading">
        <div>
          <p className="eyebrow">Completion gate</p>
          <h3>{completionStatusLabels[completionGate.status]}</h3>
          <p className="section-intro">
            Rack combines deterministic checks, fresh bounded judgement and
            explicit human review without converting missing or uncertain
            evidence into a pass.
          </p>
        </div>
        <span className={"check-mode-badge check-result--" + completionGate.status}>
          {completionGate.status}
        </span>
      </div>

      {completionGate.steps.length > 0 ? (
        <div className="repository-command-list">
          {completionGate.steps.map((step) => (
            <div className="repository-command" key={step.stepId}>
              <div>
                <strong>{step.label}</strong>
                <small>
                  {step.kind} · {step.requiredForCompletion ? "required" : "advisory"}
                </small>
              </div>
              <code>{step.decision}</code>
            </div>
          ))}
        </div>
      ) : (
        <p className="section-intro">No verification steps are active for this Set-up.</p>
      )}

      {completionGate.warnings.length > 0 ? (
        <div className="notice">
          {completionGate.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {humanSteps.length > 0 ? (
        <div className="human-review-list">
          <p className="eyebrow">Human review</p>
          {humanSteps.map((step) => (
            <div className="repository-command" key={step.id}>
              <div>
                <strong>{step.label}</strong>
                <small>{step.prompt}</small>
              </div>
              <div className="button-row">
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() =>
                    setHumanResults((current) => ({
                      ...current,
                      [step.id]: "pass",
                    }))
                  }
                >
                  Reviewed · satisfied
                </button>
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() =>
                    setHumanResults((current) => ({
                      ...current,
                      [step.id]: "fail",
                    }))
                  }
                >
                  Needs changes
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  const verificationPanels = (
    <>
      {verificationPanels}
      {completionGatePanel}
    </>
  );

  if (!auth.configured) {
    return (
      <section className="checks-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Verification · optional managed judgement</p>
            <h2>Verify work against your practice</h2>
          </div>
        </div>
        {verificationPanels}
        <div className="checks-empty">
          <h3>Managed verification is not enabled in this build</h3>
          <p>{auth.configurationMessage}</p>
          <p>
            Automatic and human verification can remain local. AI judgement
            needs an explicitly configured managed model connection.
          </p>
        </div>
      </section>
    );
  }

  if (auth.pending) {
    return (
      <section className="checks-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Verification</p>
            <h2>Verify work against your practice</h2>
          </div>
        </div>
        {verificationPanels}
        <p className="checks-loading" role="status">
          Checking managed sign-in…
        </p>
      </section>
    );
  }

  if (!auth.signedIn) {
    return (
      <section className="checks-section checks-section--signin">
        <div className="checks-signin-copy">
          <p className="eyebrow">Verification · optional</p>
          <h2>Verify work against your practice</h2>
          <p className="section-intro">
            Sign in only when you want Rack to make a bounded AI judgement.
            Your Rack source stays local.
          </p>
          <ul>
            <li>Rack sends only cost metadata before you confirm a paid call.</li>
            <li>
              After confirmation, only the selected question and evidence are
              sent — not the working conversation.
            </li>
            <li>
              An uncertain or malformed judgement never becomes an automatic
              pass.
            </li>
          </ul>
        </div>
        <div>
          {verificationPanels}
          <ManagedSignIn />
        </div>
      </section>
    );
  }

  if (judgementSteps.length === 0) {
    return (
      <section className="checks-section">
        <div className="section-heading checks-heading">
          <div>
            <p className="eyebrow">Verification</p>
            <h2>Verify work against your practice</h2>
            <p className="section-intro">
              {selectedProfileTitle} does not currently contain an AI judgement
              verification step.
            </p>
          </div>
          <button
            className="quiet-action"
            type="button"
            onClick={() => void auth.signOut()}
          >
            Sign out
          </button>
        </div>
        {verificationPanels}
        <div className="checks-empty">
          <h3>No semantic verification is configured</h3>
          <p>
            Add a judgement verification step to a practice instruction when a
            question cannot be established reliably by deterministic software.
          </p>
        </div>
      </section>
    );
  }

  const blockers = plan?.response.blockers ?? [];
  const canRun = Boolean(
    plan?.response.eligibleForConfirmation && blockers.length === 0,
  );

  return (
    <section className="checks-section">
      <div className="section-heading checks-heading">
        <div>
          <p className="eyebrow">Verification · bounded AI judgement</p>
          <h2>Verify work against your practice</h2>
          <p className="section-intro">
            This is different from evaluating whether the Rack is good. It asks
            whether supplied work satisfies one active practice question.
          </p>
        </div>
        <button
          className="quiet-action"
          type="button"
          onClick={() => void auth.signOut()}
        >
          Sign out
        </button>
      </div>

      {verificationPanels}

      <div className="check-form-grid">
        <div className="check-panel">
          <label className="check-field">
            <span>Set-up</span>
            <select
              value={selectedProfile}
              onChange={(event) => {
                onProfileChange(event.target.value);
                setSelectedStepId("");
                setEvidence({});
                invalidate();
              }}
            >
              {project.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.title}
                </option>
              ))}
            </select>
          </label>

          <label className="check-field">
            <span>Practice check</span>
            <select
              value={selectedStep?.id ?? ""}
              onChange={(event) => changeStep(event.target.value)}
            >
              {judgementSteps.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.label}
                </option>
              ))}
            </select>
            <small>{selectedStep?.moduleTitle}</small>
          </label>

          {selectedStep ? (
            <div className="check-summary-empty">
              <p className="eyebrow">Verification question</p>
              <h3>{selectedStep.label}</h3>
              <p>{selectedStep.question}</p>
              <small>
                Fail → {selectedStep.onFail?.replace("_", " ") ?? "not set"} ·
                Uncertain →{" "}
                {selectedStep.onUncertain?.replace("_", " ") ?? "not set"}
              </small>
            </div>
          ) : null}

          {selectedStep?.evidence.map((kind) => (
            <label className="check-field" key={kind}>
              <span>{evidenceLabels[kind]}</span>
              <textarea
                rows={kind === "output" || kind === "diff" ? 9 : 6}
                value={evidence[kind] ?? ""}
                placeholder={`Paste the ${evidenceLabels[kind].toLowerCase()} Rack should use for this judgement.`}
                onChange={(event) => {
                  setEvidence((current) => ({
                    ...current,
                    [kind]: event.target.value,
                  }));
                  invalidate();
                }}
              />
            </label>
          ))}

          <div className="check-model-row">
            <div>
              <span className="check-label">Verifier</span>
              <strong>Fresh bounded model call</strong>
            </div>
            <code>{auth.quickModelAlias}</code>
          </div>

          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void checkCost()}
          >
            {busy === "preflight" ? "Checking cost…" : "Check cost"}
          </button>
        </div>

        <aside className="check-panel check-panel--summary">
          {!plan ? (
            <div className="check-summary-empty">
              <p className="eyebrow">Before anything runs</p>
              <h3>Review the boundary and cost</h3>
              <p>
                Preflight sends IDs and conservative token allowances only. The
                selected question and evidence are sent only after your explicit
                confirmation.
              </p>
            </div>
          ) : result ? (
            <>
              <p className="eyebrow">Verification result</p>
              <div className="check-cost">
                <span>Decision</span>
                <strong>{gateLabels[result.gate]}</strong>
              </div>
              <p>{gateExplanation[result.gate]}</p>

              {result.execution.judgement ? (
                <div className="check-summary-empty">
                  <h3>{result.execution.judgement.reason}</h3>
                  {result.execution.judgement.evidence.length > 0 ? (
                    <ul>
                      {result.execution.judgement.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="notice">
                  Rack did not receive a valid structured judgement. No pass has
                  been recorded.
                </div>
              )}

              <dl className="check-metadata">
                <div>
                  <dt>Model result</dt>
                  <dd>
                    {result.execution.judgement?.verdict ?? "incomplete"}
                  </dd>
                </div>
                <div>
                  <dt>Settled cost</dt>
                  <dd>
                    {formatMicrousd(
                      settledCostMicrousd(result.execution.execution),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Context</dt>
                  <dd>Question + selected evidence only</dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <p className="eyebrow">Preflight</p>
              <div className="check-cost">
                <span>Estimated</span>
                <strong>
                  {formatMicrousd(plan.response.costMicrousd.estimated)}
                </strong>
              </div>
              <div className="check-cost check-cost--maximum">
                <span>Maximum retry exposure</span>
                <strong>
                  {formatMicrousd(plan.response.costMicrousd.maximumRetry)}
                </strong>
              </div>
              <dl className="check-metadata">
                <div>
                  <dt>Set-up</dt>
                  <dd>{selectedProfileTitle}</dd>
                </div>
                <div>
                  <dt>Calls</dt>
                  <dd>{plan.response.calls.total}</dd>
                </div>
                <div>
                  <dt>Evidence types</dt>
                  <dd>{selectedStep?.evidence.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Raw evidence sent yet?</dt>
                  <dd>No</dd>
                </div>
              </dl>

              {blockers.length > 0 ? (
                <div className="notice">
                  {blockers.map((blocker) => (
                    <p key={blocker.code}>{blocker.message}</p>
                  ))}
                </div>
              ) : null}

              <button
                className="primary-action"
                type="button"
                disabled={!canRun || Boolean(busy)}
                onClick={() => void runVerification()}
              >
                {busy === "run"
                  ? "Verifying…"
                  : "Confirm paid verification"}
              </button>
              <small>
                This starts one fresh model call using only the verification
                question and evidence shown on this screen.
              </small>
            </>
          )}

          {error ? (
            <div className="notice notice--error" role="alert">
              {error}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
