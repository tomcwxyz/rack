import { useEffect, useMemo, useState } from "react";
import { discoverAiHosts, type HostDiscovery } from "../hostDiscovery.js";

type FirstValueSectionProps = {
  workRoot: string | null;
  onChooseWorkRoot: () => void;
  onUseWithAi: () => void;
  onImprovePractice: () => void;
  onCheckWork: () => void;
};

export function FirstValueSection({
  workRoot,
  onChooseWorkRoot,
  onUseWithAi,
  onImprovePractice,
  onCheckWork,
}: FirstValueSectionProps) {
  const [hosts, setHosts] = useState<HostDiscovery[]>([]);
  const [hostDiscoveryFinished, setHostDiscoveryFinished] = useState(false);

  useEffect(() => {
    let active = true;
    void discoverAiHosts()
      .then((items) => {
        if (active) setHosts(items);
      })
      .catch(() => {
        if (active) setHosts([]);
      })
      .finally(() => {
        if (active) setHostDiscoveryFinished(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const detectedHosts = useMemo(
    () => hosts.filter((host) => host.detected).slice(0, 4),
    [hosts],
  );

  return (
    <section className="first-value" aria-labelledby="first-value-title">
      <div className="first-value__hero">
        <div>
          <p className="eyebrow">Start here</p>
          <h2 id="first-value-title">Put this Rack into real work.</h2>
          <p className="section-intro">
            You already have a working practice. Choose where you are working,
            use it with an AI tool, then check the result when it matters.
          </p>
        </div>
        <div className="first-value__host-state" aria-live="polite">
          {!hostDiscoveryFinished ? (
            <span>Looking for AI tools on this computer…</span>
          ) : detectedHosts.length > 0 ? (
            <>
              <span>Found on this computer</span>
              <strong>{detectedHosts.map((host) => host.displayName).join(" · ")}</strong>
            </>
          ) : (
            <>
              <span>No supported local AI tool detected yet.</span>
              <strong>You can still copy or export your practice.</strong>
            </>
          )}
        </div>
      </div>

      <div className="first-value__grid">
        <article className="first-value__step">
          <span className="first-value__number">1</span>
          <div>
            <p className="eyebrow">Where are you working?</p>
            <h3>{workRoot ? "Work project selected" : "Choose a project or folder"}</h3>
            <p>
              {workRoot
                ? "Rack will use this folder for AI-tool hand-off and local checks."
                : "For coding work, choose the repository. For other work, choose the folder this practice belongs with."}
            </p>
            {workRoot ? <code className="first-value__path" title={workRoot}>{workRoot}</code> : null}
            <button className="quiet-action" type="button" onClick={onChooseWorkRoot}>
              {workRoot ? "Change project" : "Choose project"}
            </button>
          </div>
        </article>

        <article className="first-value__step first-value__step--primary">
          <span className="first-value__number">2</span>
          <div>
            <p className="eyebrow">Use it</p>
            <h3>Take your practice into AI</h3>
            <p>
              Rack will show the best available route, what it will change, and
              keep persistent practice separate from temporary task context.
            </p>
            <button className="primary-action" type="button" onClick={onUseWithAi}>
              Use with AI
            </button>
          </div>
        </article>

        <article className="first-value__step">
          <span className="first-value__number">3</span>
          <div>
            <p className="eyebrow">Check it</p>
            <h3>Check important work afterwards</h3>
            <p>
              Run configured checks and review whether the result actually
              followed the practice you chose.
            </p>
            <button className="quiet-action" type="button" onClick={onCheckWork}>
              Check work
            </button>
          </div>
        </article>
      </div>

      <aside className="first-value__improve">
        <div>
          <p className="eyebrow">Make it yours</p>
          <strong>Want AI to behave differently?</strong>
          <span>
            Review the suggested practice, change anything you dislike, or add
            something you always want AI to do.
          </span>
        </div>
        <button className="quiet-action" type="button" onClick={onImprovePractice}>
          Improve your practice
        </button>
      </aside>
    </section>
  );
}
