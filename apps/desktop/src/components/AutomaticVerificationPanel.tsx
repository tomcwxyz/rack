import { useEffect, useMemo, useState } from "react";
import {
  buildVerificationPlan,
  executeAutomaticVerification,
  getAutomaticVerifier,
  resolveAutomaticVerificationGate,
  type AutomaticVerificationResult,
  type RackProject,
  type VerificationGateDecision,
  type VerificationPlanStep,
} from "@rack/core";

type AutomaticVerificationPanelProps = {
  project: RackProject;
  selectedProfile: string;
  onProfileChange: (profileId: string) => void;
};

type AutomaticStep = VerificationPlanStep & {
  kind: "automatic";
  check: string;
  requirement: string;
};

type EvidenceKind = AutomaticStep["evidence"][number];

type LocalResult = {
  result: AutomaticVerificationResult;
  gate: VerificationGateDecision;
};

const evidenceLabels: Record<EvidenceKind, string> = {
  output: "Output to inspect",
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

const automaticStepsFrom = (
  project: RackProject,
  profileId: string,
): AutomaticStep[] =>
  buildVerificationPlan(project, profileId).steps.filter(
    (step): step is AutomaticStep =>
      step.kind === "automatic" &&
      typeof step.check === "string" &&
      typeof step.requirement === "string",
  );

export function AutomaticVerificationPanel({
  project,
  selectedProfile,
  onProfileChange,
}: AutomaticVerificationPanelProps) {
  const steps = useMemo(
    () => automaticStepsFrom(project, selectedProfile),
    [project, selectedProfile],
  );
  const [selectedStepId, setSelectedStepId] = useState(steps[0]?.id ?? "");
  const [evidence, setEvidence] = useState<Partial<Record<EvidenceKind, string>>>(
    {},
  );
  const [localResult, setLocalResult] = useState<LocalResult | null>(null);

  const selectedStep =
    steps.find((step) => step.id === selectedStepId) ?? steps[0] ?? null;
  const verifier = selectedStep
    ? getAutomaticVerifier(selectedStep.check)
    : null;

  useEffect(() => {
    if (selectedStep && selectedStep.id !== selectedStepId) {
      setSelectedStepId(selectedStep.id);
      setEvidence({});
      setLocalResult(null);
    }
  }, [selectedStep, selectedStepId]);

  if (steps.length === 0) return null;

  const run = () => {
    if (!selectedStep) return;
    const result = executeAutomaticVerification(
      selectedStep,
      selectedStep.evidence.map((kind) => ({
        kind,
        content: evidence[kind] ?? "",
      })),
    );
    setLocalResult({
      result,
      gate: resolveAutomaticVerificationGate(selectedStep, result),
    });
  };

  return (
    <section className="check-panel" aria-labelledby="automatic-verification-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Automatic · local</p>
          <h3 id="automatic-verification-heading">Run deterministic checks</h3>
          <p className="muted-copy">
            These checks run in Rack itself. They do not call a model or send
            evidence to the managed service.
          </p>
        </div>
      </div>

      <label className="check-field">
        <span>Set-up</span>
        <select
          value={selectedProfile}
          onChange={(event) => {
            onProfileChange(event.target.value);
            setSelectedStepId("");
            setEvidence({});
            setLocalResult(null);
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
        <span>Local check</span>
        <select
          value={selectedStep?.id ?? ""}
          onChange={(event) => {
            setSelectedStepId(event.target.value);
            setEvidence({});
            setLocalResult(null);
          }}
        >
          {steps.map((step) => (
            <option key={step.id} value={step.id}>
              {step.label}
            </option>
          ))}
        </select>
        <small>{selectedStep?.moduleTitle}</small>
      </label>

      {selectedStep ? (
        <div className="check-summary-empty">
          <p className="eyebrow">Requirement</p>
          <h3>{selectedStep.label}</h3>
          <p>{selectedStep.requirement}</p>
          {verifier ? (
            <small>
              Rack-owned verifier: {verifier.label}. {verifier.description}
            </small>
          ) : (
            <small>
              No trusted Rack-owned executor is registered for{" "}
              <code>{selectedStep.check}</code>. Running this step will remain
              incomplete.
            </small>
          )}
        </div>
      ) : null}

      {selectedStep?.evidence.map((kind) => (
        <label className="check-field" key={kind}>
          <span>{evidenceLabels[kind]}</span>
          <textarea
            rows={kind === "diff" || kind === "output" ? 8 : 5}
            value={evidence[kind] ?? ""}
            placeholder={`Paste the ${evidenceLabels[kind].toLowerCase()} for this local check.`}
            onChange={(event) => {
              setEvidence((current) => ({
                ...current,
                [kind]: event.target.value,
              }));
              setLocalResult(null);
            }}
          />
        </label>
      ))}

      <button className="secondary-action" type="button" onClick={run}>
        Run local check
      </button>

      {localResult ? (
        <div className="check-summary-empty" role="status">
          <p className="eyebrow">Local result</p>
          <h3>{gateLabels[localResult.gate]}</h3>
          <p>{localResult.result.reason}</p>
          {localResult.result.findings.length > 0 ? (
            <ul>
              {localResult.result.findings.map((finding) => (
                <li key={finding.code}>{finding.title}</li>
              ))}
            </ul>
          ) : null}
          <small>
            Evidence checked:{" "}
            {localResult.result.checkedEvidence.join(", ") || "none"}
          </small>
        </div>
      ) : null}
    </section>
  );
}
