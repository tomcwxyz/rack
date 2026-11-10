import { starterTemplates, getStarterEntry } from "@rack/starter";
import type { CreationRouteId } from "@rack/creation";
import type { SavedPractice } from "../lib/storage.js";

type Props = {
  route: CreationRouteId;
  selectedId: string | null;
  onSelect: (id: string | null, route: CreationRouteId) => void;
  onBack: () => void;
  onBlank: () => void;
  onImport: (file: File) => Promise<void>;
  saved: SavedPractice[];
  onLoad: (item: SavedPractice) => void;
};
const LABELS: Record<CreationRouteId, string> = { writing: "Writing", research: "Research", coding: "Coding" };
export function StarterPackPicker({ route, selectedId, onSelect, onBack, onBlank, onImport, saved, onLoad }: Props) {
  const templates = starterTemplates.filter(template => template.route === route);
  return <section className="panel pack-picker" aria-labelledby="pack-picker-title">
    <div className="section-top">
      <span className="eyebrow">Create · {LABELS[route]}</span>
      <button className="text-btn" type="button" onClick={onBack}>Back to my work</button>
    </div>
    <h2 id="pack-picker-title">How would you like to begin?</h2>
    <p className="muted">Choose a starter pack, open a RACK you've saved, or begin with an empty one. You can edit every practice afterwards.</p>
    <div className="starting-options">
      <div className="starting-option"><strong>Choose a pack</strong><p>Start with a collection of practices you can change.</p><span className="muted small">Browse the packs below.</span></div>
      <div className="starting-option"><strong>Load a RACK</strong><p>Open an existing {LABELS[route].toLowerCase()} RACK.</p>
        <label className="secondary-btn upload-label">Import a RACK archive<input type="file" accept=".tar,application/x-tar" onChange={e=>{const file=e.target.files?.[0];if(file)void onImport(file);e.target.value="";}} /></label>
        {saved.length > 0 ? <div className="saved-load-list">{saved.map(item=><button key={item.id} type="button" className="saved-load-item" onClick={()=>onLoad(item)}>{item.approach.title}<span>Open saved RACK</span></button>)}</div> : <span className="muted small">No RACKs saved for this type in this browser yet.</span>}
      </div>
      <div className="starting-option"><strong>Start from scratch</strong><p>Build a new RACK with your own practices.</p><button type="button" className="secondary-btn" onClick={onBlank}>Create empty RACK</button></div>
    </div>
    <h3 className="pack-section-title">Starter packs for {LABELS[route].toLowerCase()}</h3>
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
        <button className="primary-btn" type="button" aria-label={"Use "+template.title} onClick={()=>onSelect(template.id,route)}>{selectedId===template.id ? "Use this again" : "Use this approach"}</button>
      </article>)}
    </div>

  </section>;
}
