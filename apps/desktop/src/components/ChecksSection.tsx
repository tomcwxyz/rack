import { useEffect, useMemo, useState } from "react";
import { prepareTargetBuild, type RackProject } from "@rack/core";
import {
  createManagedServiceClient,
  createReliableEvaluationClient,
  type EvaluationConfirmResponse,
  type EvaluationPreflightRequest,
  type EvaluationPreflightResponse,
  type ReliableEvaluationStartResponse,
  type ReliableEvaluationStatusResponse,
} from "@rack/managed";
import { ManagedSignIn, useManagedAuth } from "../managedAuth.js";
import {
  buildQuickPreflightRequest,
  buildReliablePreflightRequest,
  formatMicrousd,
  settledCostMicrousd,
} from "../managedChecks.js";
import "../checks.css";
import "../reliable-checks.css";

type ChecksSectionProps = {
  project: RackProject;
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
};

type CheckMode = "quick" | "reliable";

type CheckPlan = {
  request: EvaluationPreflightRequest;
  response: EvaluationPreflightResponse;
  instructions: string;
};

const quickResultLabel = (result: EvaluationConfirmResponse): string => {
  if (result.status === "incomplete") return "Incomplete";
  if (result.behaviouralVerdict === true) return "Pass";
  if (result.behaviouralVerdict === false) return "Fail";
  return "Completed";
};

const reliableResultLabel = (result: ReliableEvaluationStatusResponse): string => {
  if (result.status === "incomplete") return "Incomplete";
  if (result.summary?.behaviouralVerdict === true) return "Pass";
  if (result.summary?.behaviouralVerdict === false) return "Fail";
  return result.status === "completed" ? "Completed" : "Running";
};

export function ChecksSection({
  project,
  selectedProfile,
  onProfileChange,
}: ChecksSectionProps) {
  const auth = useManagedAuth();
  const [mode, setMode] = useState<CheckMode>("quick");
  const [casePrompt, setCasePrompt] = useState("");
  const [rubric, setRubric] = useState("");
  const [plan, setPlan] = useState<CheckPlan | null>(null);
  const [quickResult, setQuickResult] = useState<EvaluationConfirmResponse | null>(null);
  const [reliableStart, setReliableStart] = useState<ReliableEvaluationStartResponse | null>(null);
  const [reliableResult, setReliableResult] = useState<ReliableEvaluationStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preflight" | "run" | null>(null);

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

  const reliableClient = useMemo(
    () =>
      auth.serviceUrl
        ? createReliableEvaluationClient({
            baseUrl: auth.serviceUrl,
            getAccessToken: auth.getAccessToken,
          })
        : null,
    [auth.getAccessToken, auth.serviceUrl],
  );

  useEffect(() => {
    if (!reliableClient || !reliableStart) return;
    if (reliableResult?.status === "completed" || reliableResult?.status === "incomplete") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const status = await reliableClient.status(reliableStart.runId);
        if (cancelled) return;
        setReliableResult(status);
        if (status.status === "queued" || status.status === "running") {
          timer = setTimeout(() => void poll(), 1_500);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Rack could not read the Reliable check status.",
          );
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reliableClient, reliableResult?.status, reliableStart]);

  const invalidatePlan = () => {
    setPlan(null);
    setQuickResult(null);
    setReliableStart(null);
    setReliableResult(null);
    setError(null);
  };

  const changeMode = (nextMode: CheckMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    invalidatePlan();
  };

  const prepareCheckSource = async () => {
    const prepared = await prepareTargetBuild(project, selectedProfile, "prompt");
    const errors = prepared.diagnostics.filter((item) => item.severity === "error");
    if (errors.length > 0) {
      throw new Error(errors[0]?.message ?? "This Set-up cannot be built for a managed check.");
    }
    const instructions = prepared.targetBuild.artifacts[0]?.content;
    const rackFingerprint = prepared.manifest?.source.digest;
    if (!instructions || !rackFingerprint) {
      throw new Error("Rack could not prepare the selected Set-up for a managed check.");
    }
    return { instructions, rackFingerprint };
  };

  const checkCost = async () => {
    if (!client) return;
    if (!casePrompt.trim() || !rubric.trim()) {
      setError("Add a test case and a rubric before checking the cost.");
      return;
    }
    setBusy("preflight");
    setError(null);
    setQuickResult(null);
    setReliableStart(null);
    setReliableResult(null);
    try {
      const source = await prepareCheckSource();
      const request =
        mode === "quick"
          ? buildQuickPreflightRequest({
              rackFingerprint: source.rackFingerprint,
              profileId: selectedProfile,
              generatorAlias: auth.quickModelAlias,
              instructions: source.instructions,
              casePrompt: casePrompt.trim(),
              rubric: rubric.trim(),
            })
          : buildReliablePreflightRequest({
              rackFingerprint: source.rackFingerprint,
              profileId: selectedProfile,
              generatorAlias: auth.quickModelAlias,
              judgeAlias: auth.reliableJudgeAlias,
              instructions: source.instructions,
              casePrompt: casePrompt.trim(),
              rubric: rubric.trim(),
            });
      const response = await client.evaluationPreflight(request);
      setPlan({ request, response, instructions: source.instructions });
    } catch (caught) {
      setPlan(null);
      setError(caught instanceof Error ? caught.message : "Rack could not check the evaluation cost.");
    } finally {
      setBusy(null);
    }
  };

  const runQuickCheck = async () => {
    if (!client || !plan || !plan.response.eligibleForConfirmation) return;
    setBusy("run");
    setError(null);
    try {
      const response = await client.confirmEvaluation({
        schemaVersion: "0.1",
        preflight: plan.request,
        acceptedGenerator: plan.response.generator,
        acceptedJudge: plan.response.judge,
        acceptedMaximumRetryCostMicrousd: plan.response.costMicrousd.maximumRetry,
        idempotencyKey: globalThis.crypto.randomUUID(),
        instructions: plan.instructions,
        casePrompt: casePrompt.trim(),
        rubric: rubric.trim(),
      });
      setQuickResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Quick check could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  const runReliableCheck = async () => {
    if (
      !reliableClient ||
      !plan ||
      !plan.response.eligibleForConfirmation ||
      plan.response.judgeIndependent !== true
    ) {
      return;
    }
    setBusy("run");
    setError(null);
    setReliableResult(null);
    try {
      const response = await reliableClient.start({
        schemaVersion: "0.1",
        preflight: plan.request,
        acceptedGenerator: plan.response.generator,
        acceptedJudge: plan.response.judge,
        acceptedMaximumRetryCostMicrousd: plan.response.costMicrousd.maximumRetry,
        idempotencyKey: globalThis.crypto.randomUUID(),
        instructions: plan.instructions,
        casePrompt: casePrompt.trim(),
        rubric: rubric.trim(),
      });
      setReliableStart(response);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The Reliable check could not be started.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (!auth.configured) {
    return (
      <section className="checks-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Managed · optional</p>
            <h2>Checks</h2>
          </div>
        </div>
        <div className="checks-empty">
          <h3>Managed checks are not enabled in this build</h3>
          <p>{auth.configurationMessage}</p>
          <p>Your Rack remains fully usable locally without an account or service connection.</p>
        </div>
      </section>
    );
  }

  if (auth.pending) {
    return <p className="checks-loading" role="status">Checking managed sign-in…</p>;
  }

  if (!auth.signedIn) {
    return (
      <section className="checks-section checks-section--signin">
        <div className="checks-signin-copy">
          <p className="eyebrow">Managed · optional</p>
          <h2>Check how your Rack behaves</h2>
          <p className="section-intro">
            Sign in only when you want Rack to run a managed model check. Your project files stay local.
          </p>
          <ul>
            <li>See the maximum cost before any paid model call starts.</li>
            <li>Use Quick for one indicative run or Reliable for repeated comparison.</li>
            <li>Managed prompt, output and judgement detail expire within 24 hours.</li>
          </ul>
        </div>
        <ManagedSignIn />
      </section>
    );
  }

  const selected = project.profiles.find((profile) => profile.id === selectedProfile);
  const blockers = plan?.response.blockers ?? [];
  const reliableJudgeBlocked = mode === "reliable" && plan?.response.judgeIndependent !== true;
  const canConfirm = Boolean(
    plan?.response.eligibleForConfirmation && blockers.length === 0 && !reliableJudgeBlocked,
  );
  const reliablePending = Boolean(
    reliableStart &&
      (!reliableResult || reliableResult.status === "queued" || reliableResult.status === "running"),
  );

  return (
    <section className="checks-section">
      <div className="section-heading checks-heading">
        <div>
          <p className="eyebrow">Managed · {mode === "quick" ? "Quick" : "Reliable"}</p>
          <h2>Check how this Set-up behaves</h2>
          <p className="section-intro">
            {mode === "quick"
              ? "Quick is a one-case, one-run indication. The same selected model judges its own response, so treat the result as a useful signal rather than proof."
              : "Reliable repeats the same case five times, compares it with five no-Rack baseline runs, uses an independent judge and checks against the last passing Reliable score for this Set-up."}
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={() => void auth.signOut()}>
          Sign out
        </button>
      </div>

      <div className="check-mode-grid" aria-label="Check mode">
        <button
          className={`check-mode-card check-mode-choice ${mode === "quick" ? "check-mode-card--active" : ""}`}
          type="button"
          aria-pressed={mode === "quick"}
          onClick={() => changeMode("quick")}
        >
          <span className="check-mode-badge">Available</span>
          <h3>Quick</h3>
          <p>One candidate, one rubric judgement, indicative result.</p>
        </button>
        <button
          className={`check-mode-card check-mode-choice ${mode === "reliable" ? "check-mode-card--active" : ""}`}
          type="button"
          aria-pressed={mode === "reliable"}
          onClick={() => changeMode("reliable")}
        >
          <span className="check-mode-badge">Available</span>
          <h3>Reliable</h3>
          <p>Five candidates, five baselines, independent judging and regression gating.</p>
        </button>
      </div>

      <div className="check-form-grid">
        <div className="check-panel">
          <label className="check-field">
            <span>Set-up</span>
            <select
              value={selectedProfile}
              onChange={(event) => {
                onProfileChange(event.target.value);
                invalidatePlan();
              }}
            >
              {project.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.title}</option>
              ))}
            </select>
            <small>Rack evaluates the portable generic-prompt build of this Set-up.</small>
          </label>

          <label className="check-field">
            <span>Test case</span>
            <textarea
              rows={6}
              value={casePrompt}
              placeholder="For example: Draft a short update explaining that the launch has moved by two weeks…"
              onChange={(event) => {
                setCasePrompt(event.target.value);
                invalidatePlan();
              }}
            />
            <small>Give the model one concrete task you care about.</small>
          </label>

          <label className="check-field">
            <span>What good looks like</span>
            <textarea
              rows={6}
              value={rubric}
              placeholder="Pass when the update is clear, uses only supplied facts, states the delay plainly and does not invent a reason."
              onChange={(event) => {
                setRubric(event.target.value);
                invalidatePlan();
              }}
            />
            <small>Write a plain-language rubric. Rack records structured pass/fail judgements and scores.</small>
          </label>

          <div className="check-model-row">
            <div>
              <span className="check-label">Generator</span>
              <strong>Managed standard</strong>
            </div>
            <code>{auth.quickModelAlias}</code>
          </div>
          {mode === "reliable" ? (
            <div className="check-model-row">
              <div>
                <span className="check-label">Independent judge</span>
                <strong>Managed judge</strong>
              </div>
              <code>{auth.reliableJudgeAlias}</code>
            </div>
          ) : null}

          <button
            className="secondary-action"
            type="button"
            disabled={Boolean(busy) || reliablePending}
            onClick={() => void checkCost()}
          >
            {busy === "preflight" ? "Checking cost…" : "Check cost"}
          </button>
        </div>

        <aside className="check-panel check-panel--summary">
          {!plan ? (
            <div className="check-summary-empty">
              <p className="eyebrow">Before anything runs</p>
              <h3>Cost and limits appear here</h3>
              <p>Rack sends only IDs, counts and conservative token allowances for preflight. Your instructions, case and rubric are sent only after explicit confirmation.</p>
            </div>
          ) : (
            <>
              <p className="eyebrow">Preflight</p>
              <div className="check-cost">
                <span>Estimated</span>
                <strong>{formatMicrousd(plan.response.costMicrousd.estimated)}</strong>
              </div>
              <div className="check-cost check-cost--maximum">
                <span>Maximum retry exposure</span>
                <strong>{formatMicrousd(plan.response.costMicrousd.maximumRetry)}</strong>
              </div>
              <dl className="check-metadata">
                <div><dt>Set-up</dt><dd>{selected?.title ?? selectedProfile}</dd></div>
                <div><dt>Calls</dt><dd>{plan.response.calls.total}</dd></div>
                <div><dt>Repetitions</dt><dd>{plan.response.repetitions}</dd></div>
                <div>
                  <dt>Judge</dt>
                  <dd>
                    {mode === "quick"
                      ? "Same model · indicative"
                      : plan.response.judgeIndependent
                        ? "Independent"
                        : "Not independent"}
                  </dd>
                </div>
              </dl>

              {plan.response.warnings.map((warning) => (
                <div className="check-warning" key={warning.code}>{warning.message}</div>
              ))}
              {blockers.map((blocker) => (
                <div className="notice notice--error" key={blocker.code}>{blocker.message}</div>
              ))}
              {reliableJudgeBlocked ? (
                <div className="notice notice--error">
                  Reliable requires the judge alias to resolve to a different provider/model from the generator.
                </div>
              ) : null}

              <button
                className="primary-action check-confirm"
                type="button"
                disabled={!canConfirm || Boolean(busy) || Boolean(quickResult) || Boolean(reliableStart)}
                onClick={() => void (mode === "quick" ? runQuickCheck() : runReliableCheck())}
              >
                {busy === "run"
                  ? `Starting ${mode === "quick" ? "Quick" : "Reliable"} check…`
                  : `Run ${mode === "quick" ? "Quick" : "Reliable"} check — up to ${formatMicrousd(plan.response.costMicrousd.maximumRetry)}`}
              </button>
              <p className="check-confirm-note">
                This button is the paid-work confirmation. Rack rechecks the models, price and workspace limits before the first provider call.
              </p>
              {mode === "reliable" ? (
                <p className="check-confirm-note">
                  Reliable makes {plan.response.calls.total} paid model calls in this v0.1 plan. It will not automatically repeat a call left in an ambiguous paid state.
                </p>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {error ? <div className="notice notice--error" role="alert">{error}</div> : null}

      {quickResult ? (
        <article className={`check-result check-result--${quickResult.status === "incomplete" ? "incomplete" : quickResult.behaviouralVerdict ? "pass" : "fail"}`}>
          <div className="check-result-heading">
            <div>
              <p className="eyebrow">Quick result · indicative</p>
              <h3>{quickResultLabel(quickResult)}</h3>
            </div>
            <div className="check-result-score">
              {quickResult.behaviouralScore === null ? "—" : `${quickResult.behaviouralScore}/100`}
            </div>
          </div>

          {quickResult.judgement ? (
            <div className="check-judgement">
              <p>{quickResult.judgement.reason}</p>
              {quickResult.judgement.evidence.length ? (
                <ul>{quickResult.judgement.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : null}
            </div>
          ) : (
            <p>Rack could not obtain a trustworthy behavioural verdict from this run. It has not been counted as a pass or fail.</p>
          )}

          <div className="check-result-meta">
            <span>Settled cost {formatMicrousd(settledCostMicrousd(quickResult))}</span>
            <span>Transient detail expires {new Date(quickResult.transientContentExpiresAt).toLocaleString("en-GB")}</span>
          </div>

          {quickResult.output ? (
            <details className="check-output">
              <summary>Candidate response</summary>
              <pre>{quickResult.output}</pre>
            </details>
          ) : null}
        </article>
      ) : null}

      {reliablePending ? (
        <article className="check-result check-result--running" aria-live="polite">
          <div className="check-result-heading">
            <div>
              <p className="eyebrow">Reliable · in progress</p>
              <h3>{reliableResult?.status === "running" ? "Running" : "Queued"}</h3>
            </div>
            <div className="check-result-score">5 + 5</div>
          </div>
          <p>Rack is running five candidate responses and five no-Rack baselines, then judging all ten outputs. You can leave this section open while the workflow progresses.</p>
        </article>
      ) : null}

      {reliableResult && (reliableResult.status === "completed" || reliableResult.status === "incomplete") ? (
        <article className={`check-result check-result--${reliableResult.status === "incomplete" ? "incomplete" : reliableResult.summary?.behaviouralVerdict ? "pass" : "fail"}`}>
          <div className="check-result-heading">
            <div>
              <p className="eyebrow">Reliable result</p>
              <h3>{reliableResultLabel(reliableResult)}</h3>
            </div>
            <div className="check-result-score">
              {reliableResult.summary?.candidateScore == null
                ? "—"
                : `${reliableResult.summary.candidateScore}/100`}
            </div>
          </div>

          {reliableResult.summary ? (
            <div className="reliable-result-grid">
              <div><span>Candidate score</span><strong>{reliableResult.summary.candidateScore ?? "—"}</strong></div>
              <div><span>Baseline score</span><strong>{reliableResult.summary.baselineScore ?? "—"}</strong></div>
              <div><span>Candidate pass rate</span><strong>{reliableResult.summary.candidatePassRate == null ? "—" : `${reliableResult.summary.candidatePassRate}%`}</strong></div>
              <div><span>Baseline pass rate</span><strong>{reliableResult.summary.baselinePassRate == null ? "—" : `${reliableResult.summary.baselinePassRate}%`}</strong></div>
              <div><span>Previous passing score</span><strong>{reliableResult.summary.previousAcceptedScore ?? "None"}</strong></div>
              <div>
                <span>Regression gate</span>
                <strong>
                  {reliableResult.summary.regressionPassed === null
                    ? "First accepted run"
                    : reliableResult.summary.regressionPassed
                      ? "Passed"
                      : "Regressed"}
                </strong>
              </div>
            </div>
          ) : (
            <p>Rack could not complete every paid call and obtain all required structured judgements. This run is Incomplete rather than being counted as a pass or fail.</p>
          )}

          <div className="check-result-meta">
            {reliableResult.summary ? (
              <span>Settled cost {formatMicrousd(reliableResult.summary.settledCostMicrousd)}</span>
            ) : null}
            <span>Transient detail expires {new Date(reliableResult.transientContentExpiresAt).toLocaleString("en-GB")}</span>
          </div>
        </article>
      ) : null}
    </section>
  );
}
