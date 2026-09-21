import type {
  HostCapabilityOutcome,
  HostCapabilityPlan,
  HostCapabilityResolution,
} from "@rack/core";

type HostCapabilitySummaryProps = {
  plan: HostCapabilityPlan;
};

const resolutionCopy: Record<
  HostCapabilityResolution,
  { label: string; mark: string }
> = {
  native: { label: "Built in", mark: "✓" },
  "rack-provided": { label: "RACK handles this", mark: "R" },
  human: { label: "Human review", mark: "H" },
  degraded: { label: "Changes form", mark: "↔" },
  unavailable: { label: "Not available yet", mark: "!" },
};

const outcomeClass = (outcome: HostCapabilityOutcome): string =>
  [
    "host-capability__item",
    outcome.resolution === "degraded"
      ? "host-capability__item--warning"
      : "",
    outcome.resolution === "unavailable"
      ? "host-capability__item--unavailable"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

export function HostCapabilitySummary({
  plan,
}: HostCapabilitySummaryProps) {
  return (
    <section className="host-capability" aria-labelledby="host-capability-title">
      <div className="host-capability__heading">
        <div>
          <p className="eyebrow">How this practice carries across</p>
          <h3 id="host-capability-title">
            What {plan.displayName} gets — and what stays with RACK
          </h3>
        </div>
        <span
          className={
            plan.hasUnavailable || plan.hasDegradation
              ? "status-pill status-pill--attention"
              : "status-pill"
          }
        >
          {plan.hasUnavailable
            ? "Review differences"
            : plan.hasDegradation
              ? "One difference"
              : "No silent loss"}
        </span>
      </div>

      <div className="host-capability__grid">
        {plan.outcomes.map((outcome) => {
          const resolution = resolutionCopy[outcome.resolution];
          return (
            <article className={outcomeClass(outcome)} key={outcome.id}>
              <div className="host-capability__mark" aria-hidden="true">
                {resolution.mark}
              </div>
              <div className="host-capability__copy">
                <div className="host-capability__title-row">
                  <strong>{outcome.title}</strong>
                  <span>{resolution.label}</span>
                </div>
                <p>{outcome.summary}</p>
                {outcome.detail ? <small>{outcome.detail}</small> : null}
                <details>
                  <summary>What this means</summary>
                  <p>{outcome.consequence}</p>
                </details>
              </div>
            </article>
          );
        })}
      </div>

      <p className="host-capability__assurance">{plan.assurance}</p>
    </section>
  );
}
