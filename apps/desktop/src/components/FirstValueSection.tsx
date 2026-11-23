import { useEffect, useMemo, useState } from "react";
import {
  getHostIntegration,
  type HostIntegrationId,
} from "@rack/core";
import { discoverAiHosts, type HostDiscovery } from "../hostDiscovery.js";

type FirstValueSectionProps = {
  workRoot: string | null;
  onChooseWorkRoot: () => void;
  onUseWithAi: () => void;
  onUseWithHost: (hostId: HostIntegrationId) => void;
  onImprovePractice: () => void;
  onExploreStartingPoints: () => void;
  onCheckWork: () => void;
};

export function FirstValueSection({
  workRoot,
  onChooseWorkRoot,
  onUseWithAi,
  onUseWithHost,
  onImprovePractice,
  onExploreStartingPoints,
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
  const readyHosts = useMemo(
    () =>
      detectedHosts
        .map((host) => ({ host, integration: getHostIntegration(host.id) }))
        .filter(
          (item) =>
            item.integration?.status === "supported" &&
            Boolean(item.integration.destinationId),
        )
        .slice(0, 3),
    [detectedHosts],
  );

  return (
    <section className="first-value" aria-labelledby="first-value-title">
      <div className="first-value__hero">
        <div>
          <p className="eyebrow">Start here</p>
          <h2 id="first-value-title">Your practice is ready.</h2>
          <p className="section-intro">
            Rack has given you a useful way to start. Use it with real work first;
            you can change the practice once you have something concrete to react to.
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

      <div className="calm-next">
        <div className="calm-next__intro">
          <p className="eyebrow">Next step</p>
          <h3>{workRoot ? "Your project is ready" : "Choose where you're working"}</h3>
          <p>{workRoot ? "Your practice is ready to use with an AI tool." : "Choose the folder or repository where you want to use this practice. You can change it later."}</p>
          {workRoot ? <code className="first-value__path" title={workRoot}>{workRoot}</code> : null}
          <button className={workRoot ? "quiet-action" : "primary-action"} type="button" onClick={onChooseWorkRoot}>{workRoot ? "Change project" : "Choose a project"}</button>
        </div>
        <div className="calm-next__action">
          <p className="eyebrow">Use your practice</p>
          <h3>Work with AI</h3>
          <p>{readyHosts.length ? "Choose a tool already on your computer." : "Copy or export your practice to use with an AI tool."}</p>
          <div className="first-value__host-actions">
            {readyHosts.map(({ host }) => <button className="primary-action" type="button" key={host.id} onClick={() => onUseWithHost(host.id)}>Use with {host.displayName}</button>)}
            <button className={readyHosts.length ? "quiet-action" : "primary-action"} type="button" onClick={onUseWithAi}>{readyHosts.length ? "Other ways to use it" : "Use with AI"}</button>
          </div>
        </div>
      </div>
      <div className="calm-secondary">
        <button type="button" onClick={onImprovePractice}><strong>Improve your practice</strong><span>Change what AI should do</span></button>
        <button type="button" onClick={onCheckWork}><strong>Review results</strong><span>Check how the work went</span></button>
      </div>
      <details className="calm-extras">
        <summary>More options</summary>
        <button type="button" className="quiet-action" onClick={onExploreStartingPoints}>Browse other starting points</button>
      </details>
    </section>
  );
}
