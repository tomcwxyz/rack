import { useState } from "react";
import { getStarterEntry, starterTemplates } from "@rack/starter";
import type { CreationRouteId } from "./RouteChooser.js";

type Props = {
  route: CreationRouteId;
  onSelect: (id: string | null, route: CreationRouteId) => void;
};
export function FirstRunStarterPacks({ route, onSelect }: Props) {
  const [category, setCategory] = useState<CreationRouteId>(route);
  const packs = starterTemplates.filter(pack => pack.route === category);
  return <section className="first-run-packs" aria-label="Choose a starter pack">
    <p className="first-run-note">Choose a way to work. Each pack contains real practices you can inspect, use and change later.</p>
    <div className="first-run-pack-tabs" aria-label="Work type">
      {(["writing", "research", "coding"] as const).map(value =>
        <button key={value} type="button" aria-pressed={category === value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value[0].toUpperCase() + value.slice(1)}</button>
      )}
    </div>
    <div className="first-run-pack-grid">
      {packs.map(pack => <article className="first-run-pack" key={pack.id}>
        <small>{pack.moduleIds.length} practices</small>
        <h2>{pack.title}</h2>
        <p>{pack.promise || pack.description}</p>
        {pack.bestFor?.length ? <p className="first-run-pack-best">Good for: {pack.bestFor.join(" · ")}</p> : null}
        <details><summary>What’s included?</summary>
          <ul>{pack.moduleIds.map(id => { const item = getStarterEntry(id); return <li key={id}><strong>{item?.title || id}</strong>{item?.description ? <span>{item.description}</span> : null}</li>; })}</ul>
        </details>
        <button className="primary-action" type="button" onClick={() => onSelect(pack.id, pack.route)}>Use this approach</button>
      </article>)}
    </div>
    <div className="first-run-pack-basic">
      <span>Prefer a simpler starting point?</span>
      <button className="quiet-action" type="button" onClick={() => onSelect(null, category)}>Use a basic approach</button>
    </div>
  </section>;
}
