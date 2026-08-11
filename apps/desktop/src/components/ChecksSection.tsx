import { useMemo, useState } from "react";
import { prepareTargetBuild, type RackProject } from "@rack/core";
import {
  createManagedServiceClient,
  type EvaluationConfirmResponse,
  type EvaluationPreflightRequest,
  type EvaluationPreflightResponse,
} from "@rack/managed";
import { ManagedSignIn, useManagedAuth } from "../managedAuth.js";
import {
  buildQuickPreflightRequest,
  formatMicrousd,
  settledCostMicrousd,
} from "../managedChecks.js";
import "../checks.css";

type ChecksSectionProps = {
  project: RackProject;
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
};

type QuickPlan = {
  request: EvaluationPreflightRequest;
  response: EvaluationPreflightResponse;
  instructions: string;
};

const resultLabel = (result: EvaluationConfirmResponse): string => {
  if (result.status === "incomplete") return "Incomplete";
  if (result.behaviouralVerdict === true) return "Pass";
  if (result.behaviouralVerdict === false) return "Fail";
  return "Completed";
};

export function ChecksSection({
  project,
  selectedProfile,
  onProfileChange,
}: ChecksSectionProps) {
  const auth = useManagedAuth();
  const [casePrompt, setCasePrompt] = useState("");
  const [rubric, setRubric] = useState("");
  const [plan, setPlan] = useState<QuickPlan | null>(null);
  const [result, setResult] = useState<EvaluationConfirmResponse | null>(null);
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

  const invalidatePlan = () => {
    setPlan(null);
    setResult(null);
    setError(null);
  };

  const prepareQuickSource = async () => {
    const prepared = await prepareTargetBuild(project, selectedProfile, "prompt");
    const errors = prepared.diagnostics.filter((item) => item.severity === "error");
    if (errors.length > 0) {
      throw new Error(errors[0]?.message ?? "This Set-up cannot be built for a Quick check.");
    }
    const instructions = prepared.targetBuild.artifacts[0]?.content;
    const rackFingerprint = prepared.manifest?.source.digest;
    if (!instructions || !rackFingerprint) {
      throw new Error("Rack could not prepare the selected Set-up for a Quick check.");
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
    setResult(null);
    try {
      const source = await prepareQuickSource();
      const request = buildQuickPreflightRequest({
        rackFingerprint: source.rackFingerprint,
        profileId: selectedProfile,
        generatorAlias: auth.quickModelAlias,
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
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Quick check could not be completed.");
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
            <li>Run one indicative Quick case against a rubric.</li>
            <li>Managed prompt, output and judgement detail expire within 24 hours.</li>
          </ul>
        </div>
        <ManagedSignIn />
      </section>
    );
  }

  const selected = project.profiles.find((profile) => profile.id === selectedProfile);
  const blockers = plan?.response.blockers ?? [];
  const canConfirm = Boolean(plan?.response.eligibleForConfirmation && blockers.length === 0);

  return (
    <section className="checks-section">
      <div className="section-heading checks-heading">
        <div>
          <p className="eyebrow">Managed · Quick</p>
          <h2>Check how this Set-up behaves</h2>
          <p className="section-intro">
            Quick is a one-case, one-run indication. The same selected model judges its own response, so treat the result as a useful signal rather than proof.
          </p>
        </div>
        <button className="quiet-action" type="button" onClick={() => void auth.signOut()}>
          Sign out
        </button>
      </div>

      <div className="check-mode-grid" aria-label="Check mode">
        <article className="check-mode-card check-mode-card--active">
          <span className="check-mode-badge">Available</span>
          <h3>Quick</h3>
          <p>One candidate, one rubric judgement, indicative result.</p>
        </article>
        <article className="check-mode-card check-mode-card--disabled" aria-disabled="true">
          <span className="check-mode-badge">Next</span>
          <h3>Reliable</h3>
          <p>Repeated candidate and baseline runs with independent judging and regression gating.</p>
        </article>
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
            <small>Write a plain-language rubric. Quick returns pass/fail, score, reason and evidence.</small>
          </label>

          <div className="check-model-row">
            <div>
              <span className="check-label">Model</span>
              <strong>Managed standard</strong>
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
                <div><dt>Judge</dt><dd>Same model · indicative</dd></div>
              </dl>

              {plan.response.warnings.map((warning) => (
                <div className="check-warning" key={warning.code}>{warning.message}</div>
              ))}
              {blockers.map((blocker) => (
                <div className="notice notice--error" key={blocker.code}>{blocker.message}</div>
              ))}

              <button
                className="primary-action check-confirm"
                type="button"
                disabled={!canConfirm || Boolean(busy) || Boolean(result)}
                onClick={() => void runQuickCheck()}
              >
                {busy === "run"
                  ? "Running Quick check…"
                  : `Run Quick check — up to ${formatMicrousd(plan.response.costMicrousd.maximumRetry)}`}
              </button>
              <p className="check-confirm-note">This button is the paid-work confirmation. Rack rechecks the model, price and workspace limits before the first provider call.</p>
            </>
          )}
        </aside>
      </div>

      {error ? <div className="notice notice--error" role="alert">{error}</div> : null}

      {result ? (
        <article className={`check-result check-result--${result.status === "incomplete" ? "incomplete" : result.behaviouralVerdict ? "pass" : "fail"}`}>
          <div className="check-result-heading">
            <div>
              <p className="eyebrow">Quick result · indicative</p>
              <h3>{resultLabel(result)}</h3>
            </div>
            <div className="check-result-score">
              {result.behaviouralScore === null ? "—" : `${result.behaviouralScore}/100`}
            </div>
          </div>

          {result.judgement ? (
            <div className="check-judgement">
              <p>{result.judgement.reason}</p>
              {result.judgement.evidence.length ? (
                <ul>{result.judgement.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : null}
            </div>
          ) : (
            <p>Rack could not obtain a trustworthy behavioural verdict from this run. It has not been counted as a pass or fail.</p>
          )}

          <div className="check-result-meta">
            <span>Settled cost {formatMicrousd(settledCostMicrousd(result))}</span>
            <span>Transient detail expires {new Date(result.transientContentExpiresAt).toLocaleString("en-GB")}</span>
          </div>

          {result.output ? (
            <details className="check-output">
              <summary>Candidate response</summary>
              <pre>{result.output}</pre>
            </details>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
