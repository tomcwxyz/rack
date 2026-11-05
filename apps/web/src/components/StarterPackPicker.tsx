import { useState } from "react";
import { starterTemplates, getStarterEntry } from "@rack/starter";
import type { CreationRouteId } from "@rack/creation";

type Props = {
  route: CreationRouteId;
  selectedId: string | null;
  onSelect: (id: string | null, route: CreationRouteId) => void;
  onBack: () => void;
};
const LABELS: Record<CreationRouteId, string> = { writing: "Writing", research: "Research", coding: "Coding" };
export function StarterPackPicker({ route, selectedId, onSelect, onBack }: Props) {
  const [category, setCategory] = useState<CreationRouteId>(route);
  const templates = starterTemplates.filter(template => template.route === category);
  return <section className="panel pack-picker" aria-labelledby="pack-picker-title">
    <div className="section-top">
      <span className="eyebrow">Create · choose a starting point</span>
      <button className="text-btn" type="button" onClick={onBack}>Back to my work</button>
    </div>
    <h2 id="pack-picker-title">Choose how you'd like AI to work</h2>
    <p className="muted">These are complete starting practices from RACK's real library. You can see what they contain and adjust them later.</p>
    <div className="pack-categories" aria-label="Kinds of work">
      {(["writing","research","coding"] as const).map(value =>
        <button key={value} type="button" className={category===value?"active":""} aria-pressed={category===value} onClick={()=>setCategory(value)}>{LABELS[value]}</button>
      )}
    </div>
    <div className="pack-grid">
      {templates.map(template => <article className="pack-card" key={template.id}>
        <p className="eyebrow">{LABELS[template.route]} · {template.moduleIds.length} practices</p>
        <h3>{template.title}</h3>
        <p>{template.promise || template.description}</p>
        {template.bestFor?.length ? <p className="pack-best"><strong>Good for</strong> {template.bestFor.join(" · ")}</p> : null}
        <details className="pack-contents">
          <summary>What's included?</summary>
          <ul>{template.moduleIds.map(id=>{const entry=getStarterEntry(id);return <li key={id}><strong>{entry?.title || id}</strong>{entry?.description ? <span>{entry.description}</span> : null}</li>;})}</ul>
        </details>
        <button className="primary-btn" type="button" aria-label={"Use "+template.title} onClick={()=>onSelect(template.id,template.route)}>{selectedId===template.id ? "Use this again" : "Use this approach"}</button>
      </article>)}
    </div>
    <div className="pack-basic">
      <div><strong>Want something simpler?</strong><span>Start with RACK's basic suggestion and shape it yourself.</span></div>
      <button className="secondary-btn" type="button" onClick={()=>onSelect(null,category)}>Use a basic approach</button>
    </div>
  </section>;
}
