import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInternalNeonAuth } from "@neondatabase/auth";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { createManagedServiceClient } from "@rack/managed/client";
import type { EvaluationPreflightRequest, EvaluationPreflightResponse, EvaluationConfirmResponse } from "@rack/managed";

type Props = { instructions: string; route: "writing" | "research" | "coding"; initialTask: string; onReviewed: (note: string) => void };
const authUrl = import.meta.env.VITE_NEON_AUTH_URL?.trim() || "";
const enabled = import.meta.env.VITE_RACK_MANAGED_ENABLED === "true";
const auth = enabled && authUrl ? createInternalNeonAuth(authUrl) : null;
const modelAlias = import.meta.env.VITE_RACK_QUICK_MODEL_ALIAS?.trim() || "generator";

function TrialBody({ instructions, route, initialTask, onReviewed }: Props) {
  const [signedIn, setSignedIn] = useState(false);
  const [task, setTask] = useState(initialTask || "Try this approach on a short example of my work.");
  const [preview, setPreview] = useState<{ request: EvaluationPreflightRequest; result: EvaluationPreflightResponse } | null>(null);
  const [result, setResult] = useState<EvaluationConfirmResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retryId = useRef<string | null>(null);
  const getAccessToken = useCallback(async () => {
    if (!auth) return null;
    try { return await auth.getJWTToken(); } catch { return null; }
  }, []);
  const refresh = useCallback(async () => setSignedIn(Boolean(await getAccessToken())), [getAccessToken]);
  useEffect(() => { void refresh(); }, [refresh]);
  const client = useMemo(() => createManagedServiceClient({ baseUrl: window.location.origin, getAccessToken }), [getAccessToken]);

  const runSafely = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The AI trial did not complete."); }
    finally { setBusy(false); }
  };
  const preflight = () => void runSafely(async () => {
    const encoder = new TextEncoder();
    const raw = await crypto.subtle.digest("SHA-256", encoder.encode(instructions));
    const fingerprint = "sha256:" + [...new Uint8Array(raw)].map(b => b.toString(16).padStart(2, "0")).join("");
    const request: EvaluationPreflightRequest = {
      schemaVersion: "0.1", mode: "quick", rackFingerprint: fingerprint,
      profileId: route, target: "prompt", generatorAlias: modelAlias,
      caseCount: 1, judgeCallsPerOutput: 0,
      candidateInputTokensPerCase: encoder.encode(instructions + "\n\n" + task).byteLength,
      generatorOutputTokensPerCall: 1000, judgePromptTokensPerCase: 0, judgeOutputTokensPerCall: 0,
    };
    const plan = await client.evaluationPreflight(request);
    setPreview({ request, result: plan });
    setResult(null);
    retryId.current = null;
  });
  const confirm = () => void runSafely(async () => {
    if (!preview || !preview.result.eligibleForConfirmation) return;
    if (!retryId.current) retryId.current = crypto.randomUUID();
    const outcome = await client.confirmEvaluation({
      schemaVersion: "0.1", preflight: preview.request,
      acceptedGenerator: preview.result.generator,
      acceptedMaximumRetryCostMicrousd: preview.result.costMicrousd.maximumRetry,
      idempotencyKey: retryId.current, instructions, casePrompt: task,
    });
    setResult(outcome);
    setPreview(null);
    retryId.current = null;
  });

  return <section className="panel trial-panel" aria-labelledby="trial-heading">
    <div className="section-top"><span className="eyebrow">Optional · managed service</span><span className="privacy-pill">Signed-in trials only</span></div>
    <h2 id="trial-heading">Try this approach with AI</h2>
    <p className="muted">Test a piece of real work against your instructions. Only an explicitly approved trial sends your instructions and task to the managed model service.</p>
    {!signedIn ? <div className="trial-signin"><p>Sign in to unlock one-off managed trials. Creating, copying and exporting practices stays free and local.</p><AuthView path="sign-in" /></div> : <>
      <div className="field"><label htmlFor="trial-task">What should the AI try?</label><textarea id="trial-task" rows={4} maxLength={12000} value={task} onChange={e => { setTask(e.target.value);setPreview(null);setResult(null);retryId.current=null; }} /></div>
      <button className="secondary-btn" type="button" disabled={busy || !task.trim()} onClick={preflight}>Check trial cost</button>
      {preview ? <div className="cost-review" role="status">
        <strong>Confirm this single AI trial</strong>
        <p>Model: {preview.result.generator.providerId} / {preview.result.generator.modelId}</p>
        <p>Estimated cost: US&#36;{(preview.result.costMicrousd.estimated / 1_000_000).toFixed(4)} · maximum reserved: US&#36;{(preview.result.costMicrousd.maximumRetry / 1_000_000).toFixed(4)}</p>
        {preview.result.blockers.map((blocker, i) => <p key={i} className="error">{blocker.message}</p>)}
        <button className="primary-btn" type="button" disabled={busy || !preview.result.eligibleForConfirmation} onClick={confirm}>Approve and run this trial</button>
      </div> : null}
      {result ? <div className="trial-result"><div className="section-top"><strong>AI trial result</strong><span className="privacy-pill">{result.status}</span></div>
        {result.output ? <pre>{result.output}</pre> : <p>No usable output was returned. This was not a behavioural pass or fail.</p>}
        <p className="muted">This is one trial, not evidence that an AI tool always follows the practice. Model outputs are transient in the managed service.</p>
        <button className="secondary-btn" type="button" onClick={() => onReviewed("I tried this approach with AI and want to review what happened.")}>Review my practice</button>
      </div> : null}
      <button className="text-btn signout" type="button" onClick={() => {void auth?.adapter.signOut().then(refresh);}}>Sign out</button>
    </>}
    {busy ? <p role="status">Working on your request…</p> : null}
    {error ? <p role="alert" className="error">{error}</p> : null}
  </section>;
}

export function ManagedTrial(props: Props) {
  if (!enabled || !auth) return <section className="panel trial-panel"><span className="eyebrow">Optional · managed service</span><h2>AI trials are not connected yet</h2><p className="muted">You can create, use, copy and export the complete practice without signing in. Managed model trials will appear here once the pilot service is configured.</p></section>;
  return <NeonAuthUIProvider authClient={auth.adapter} emailOTP defaultTheme="light" onSessionChange={() => window.dispatchEvent(new Event("rack-auth-changed"))}>
    <TrialBody {...props} />
  </NeonAuthUIProvider>;
}
