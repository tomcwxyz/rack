import { useMemo, useState } from "react";
import {
  firstRunApproaches,
  blankRackProposal,
  type FirstRunApproach,
} from "@rack/creation";
import type { CreationRouteId } from "@rack/creation";
import { downloadRack } from "./lib/archive.js";
import { PracticeEditor } from "./components/PracticeEditor.js";
import { compilePractices, extractPractices, readRackTar, type EditablePractice } from "./lib/practiceWorkspace.js";
import type { RackProposal } from "@rack/creation";
import { loadPractices, persistPractices, type SavedPractice, type PracticeReview, type ReviewDecision } from "./lib/storage.js";
import { ManagedTrial } from "./components/ManagedTrial.js";
import { StarterPackPicker } from "./components/StarterPackPicker.js";
import { buildStarterPractice, getStarterPackSummary, starterTemplates } from "./lib/starterPacks.js";

type Step = "choose" | "packs" | "adjust" | "use" | "review";
const CHOICES: {id: CreationRouteId; title: string; description: string; icon: string}[] = [
  { id: "writing", title: "Write something", description: "Reports, messages and clearer explanations", icon: "✎" },
  { id: "research", title: "Research something", description: "Questions, evidence and decisions", icon: "⌕" },
  { id: "coding", title: "Build something", description: "Useful, careful changes to software", icon: "⌘" },
];
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: name.endsWith(".json") ? "application/json;charset=utf-8" : "text/markdown;charset=utf-8" }));
  const link = document.createElement("a"); link.href=url; link.download=name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function App() {
  const [step, setStep] = useState<Step>("choose");
  const [editingApproach, setEditingApproach] = useState(false);
  const [route, setRoute] = useState<CreationRouteId>("writing");
  const [task, setTask] = useState("");
  const [starterPackId, setStarterPackId] = useState<string | null>(null);
  const [approach, setApproach] = useState<FirstRunApproach>({...firstRunApproaches.writing});
  const [saved, setSaved] = useState<SavedPractice[]>(() => loadPractices());
  const [practices, setPractices] = useState<EditablePractice[]>([]);
  const [importedRack, setImportedRack] = useState<RackProposal | null>(null);
  const [blank, setBlank] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PracticeReview[]>([]);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("keep");
  const [reviewNote, setReviewNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selectedPack = useMemo(() => getStarterPackSummary(starterPackId), [starterPackId]);
  const preview = useMemo(() => {
    try {
      const base = blank ? blankRackProposal(route,approach.title) : (importedRack || buildStarterPractice(route, task, approach, starterPackId).proposal);
      const { proposal, instructions } = compilePractices(base, practices, route);
      return { proposal, instructions, error: "" };
    } catch (reason) { return { proposal: null, instructions: "", error: errorText(reason) }; }
  }, [route, task, approach, starterPackId, practices, importedRack, blank]);

  const navigate = (next: Step) => { setNotice(""); setError(""); setStep(next); window.scrollTo({top:0, behavior:"smooth"}); };
  const choose = (next: CreationRouteId) => {
    setRoute(next); setApproach({...firstRunApproaches[next]}); setStarterPackId(null); setSelectedId(null); setReviews([]);
    setEditingApproach(false); setPractices([]); setImportedRack(null); setBlank(false);
    navigate("packs");
  };
  const selectPack = (id: string | null, nextRoute: CreationRouteId) => {
    setRoute(nextRoute);
    setStarterPackId(id);
    setApproach({ ...firstRunApproaches[nextRoute], ...(id ? { title: starterTemplates.find(pack=>pack.id===id)?.title || firstRunApproaches[nextRoute].title } : {}) });
    setSelectedId(null); setReviews([]); setEditingApproach(false); setImportedRack(null); setBlank(false);
    try {
      const nextApproach = { ...firstRunApproaches[nextRoute], ...(id ? { title: starterTemplates.find(pack=>pack.id===id)?.title || firstRunApproaches[nextRoute].title } : {}) };
      setPractices(id ? extractPractices(buildStarterPractice(nextRoute, task, nextApproach, id).proposal) : []);
    } catch (reason) { setError(errorText(reason)); setPractices([]); }
    navigate("adjust");
  };
  const load = (item: SavedPractice) => {
    setRoute(item.route); setTask(item.task); setApproach({...item.approach}); setReviews(item.reviews); setStarterPackId(item.starterPackId ?? null);
    setPractices(item.practices || []); setImportedRack(item.importedRack || null); setBlank(item.blank ?? false);
    setSelectedId(item.id); navigate("adjust");
  };
  const save = (nextReviews = reviews, duplicate = false) => {
    if (!preview.proposal) { setError(preview.error); return; }
    const item: SavedPractice = {
      id: duplicate ? crypto.randomUUID() : (selectedId || crypto.randomUUID()), route, task, approach, starterPackId, reviews: nextReviews, practices, importedRack, blank,
      updatedAt: new Date().toISOString(),
    };
    const next = [item, ...saved.filter(entry => entry.id !== item.id)].slice(0, 30);
    try { persistPractices(next); setSaved(next); setSelectedId(item.id); setNotice("Saved in this browser. Export a copy to keep it elsewhere."); }
    catch { setError("Your browser could not save this approach. Please export a copy."); }
  };
  const createBlank = (nextRoute: CreationRouteId) => {
    setRoute(nextRoute); setApproach({...firstRunApproaches[nextRoute], title:"My new RACK", guidance:"Follow the practices I have chosen.", boundary:"Ask when information is missing."});
    setStarterPackId(null); setImportedRack(null); setBlank(true); setPractices([]); setSelectedId(null); setReviews([]); setEditingApproach(false); navigate("adjust");
  };
  const importRack = async (file: File) => {
    try {
      const archive = readRackTar(new Uint8Array(await file.arrayBuffer()));
      const detected = (["writing","research","coding"] as const).find(value=>archive.files.some(f=>f.path==="profiles/"+value+".yaml"));
      if (!detected) throw new Error("This RACK has no supported writing, research or coding profile.");
      if (detected !== route) throw new Error("This RACK is for "+detected+". Go back and choose that type of work first.");
      // Validate before replacing the open workspace.
      const items = extractPractices(archive);
      compilePractices(archive, items, detected);
      const manifest = archive.files.find(f=>f.path==="rack.yaml")?.content || "";
      const title = manifest.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^"|"$/g,"") || "Imported RACK";
      setApproach({...firstRunApproaches[detected],title}); setImportedRack(archive);
      setPractices(items); setStarterPackId(null); setBlank(false); setSelectedId(null); setReviews([]); setEditingApproach(false); navigate("adjust");
      setNotice("Imported locally. Review the practices, then save a copy in this browser.");
    } catch(reason) { setError("Could not import RACK: "+errorText(reason)); }
  };
  const recordReview = () => {
    const next = [...reviews, { id: crypto.randomUUID(), decision: reviewDecision, note: reviewNote.trim(), recordedAt: new Date().toISOString() }];
    setReviews(next); setReviewNote(""); save(next);
    if (reviewDecision === "change") { setEditingApproach(true); navigate("adjust"); } else navigate("use");
  };
  const exportPilotNotes = () => {
    const notes = saved.map(item => ({
      route: item.route, approachTitle: item.approach.title, starterPackId: item.starterPackId ?? null,
      reviews: item.reviews.map(review => ({
        decision: review.decision, note: review.note, recordedAt: review.recordedAt,
      })),
    }));
    downloadText("rack-pilot-notes.json", JSON.stringify({ version: 1, notes }, null, 2));
    setNotice("Downloaded a feedback file. Nothing was uploaded to RACK.");
  };
  const clearSaved = () => {
    if (!window.confirm("Delete all saved approaches and review notes from this browser? Export anything you want to keep first.")) return;
    try { persistPractices([]); setSaved([]); setSelectedId(null); setReviews([]); setNotice("Browser-local library cleared."); }
    catch { setError("Your browser could not clear the saved approaches."); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(preview.instructions); setNotice("Instructions copied. Paste them into your AI tool and add the task materials."); }
    catch { setError("Clipboard access was blocked. Select and copy the instructions below, or download them."); }
  };

  return <div className="rack-web">
    <header className="topbar"><div className="topbar-inner">
      <button type="button" className="brand" onClick={() => navigate("choose")}>rack<span className="brand-dot">.</span></button>
      <span className="brand-descriptor">Build your AI working practices</span>
      <div className="topbar-right"><span className="pilot-label">Web pilot</span><button type="button" className="text-btn" onClick={() => navigate("choose")}>Start again</button></div>
    </div></header>
    <main className="site-main">
      <div className="page-heading"><span className="eyebrow">A better way to work with AI</span>
        <h1>{step === "choose" ? <>Make AI work <em>your way.</em></> : step === "packs" ? <>Choose your <em>starting point.</em></> : step === "adjust" ? <>Here’s a <em>starting point.</em></> : step === "review" ? <>Make your approach <em>better.</em></> : <>Your approach is <em>ready.</em></>}</h1>
        <p className="page-lede">{step === "choose" ? "You don't need to know how to write a perfect prompt. Tell rack what you want to do, start with a thoughtful approach, and shape it as you learn." : step === "packs" ? "Start with a pack, load a RACK you already have, or make your own from scratch." : step === "adjust" ? "Make this RACK yours. Change, add or remove any practice." : step === "review" ? "What happened when you used it? Keep what helped, change what didn't, or mark an instruction for removal." : "Take these instructions into your AI tool, or try them with our optional managed service. Come back and improve them whenever you're ready."}</p>
      </div>
      <nav className="progress" aria-label="Progress"><span className={step==="choose"||step==="packs"?"active":""}>1 · Create</span><span className={step==="adjust"||step==="use"?"active":""}>2 · Use</span><span className={step==="review"?"active":""}>3 · Improve</span></nav>
      {notice ? <div className="notice" role="status">{notice}</div> : null}
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {step === "choose" ? <>
        <section className="choose-panel">
          <div className="field"><label htmlFor="task">What are you working on? <span className="optional">Optional</span></label>
            <textarea id="task" rows={3} maxLength={4000} placeholder="For example, write a clear report for our trustees…" value={task} onChange={e=>setTask(e.target.value)} /></div>
          <h2>Choose where you'd like to start</h2>
          <div className="choice-grid">{CHOICES.map(item=><button key={item.id} className="choice-card" type="button" onClick={()=>choose(item.id)}>
            <span className="choice-icon">{item.icon}</span><strong>{item.title}</strong><span>{item.description}</span><span className="choice-arrow">→</span>
          </button>)}</div>
        </section>
      </> : null}
      {step === "packs" ? <StarterPackPicker key={route} route={route} selectedId={starterPackId} onSelect={selectPack} onBack={()=>navigate("choose")} onBlank={()=>createBlank(route)} onImport={importRack} saved={saved.filter(item=>item.route===route)} onLoad={load} /> : null}
      {step === "adjust" ? <section className="panel editor-panel">
        <div className="section-top"><span className="eyebrow">{starterPackId ? "Starter pack" : "Basic suggestion"} · {route}</span><button type="button" className="text-btn" onClick={()=>navigate("packs")}>Other starting points</button></div>
        <h2 className="approach-name">{approach.title}</h2>
        <PracticeEditor practices={practices} onChange={setPractices} title={approach.title} onTitleChange={title=>setApproach({...approach,title})}/>
        {selectedPack && !importedRack ? <>
          <p className="pack-selected-note">{selectedPack.promise}</p>
          <p className="pack-applied-count">Your edited practice list above determines what is included in the generated RACK. The original pack contained {selectedPack.practices.length} practices.</p>
          <details className="pack-extra-guidance"><summary>See original pack contents</summary><div className="pack-applied-practices">
            {selectedPack.practices.map(practice => <div key={practice.id} className="pack-applied-item">
              <strong>{practice.title}</strong><span>{practice.description}</span>
            </div>)}
          </div></details>
          <details className="pack-extra-guidance">
            <summary>Your additional guidance and boundaries</summary>
            <p className="muted small">These basic instructions are added alongside the selected pack; they do not replace its practices.</p>
            <div className="approach-summary">
              <div><strong>Additional guidance</strong><p>{approach.guidance}</p></div>
              <div><strong>Additional boundaries</strong><p>{approach.boundary}</p></div>
            </div>
          </details>
        </> : <div className="approach-summary">
          <div><strong>How AI should help</strong><p>{approach.guidance}</p></div>
          <div><strong>What to watch out for</strong><p>{approach.boundary}</p></div>
        </div>}
        <div className="button-row"><button type="button" className="primary-btn" disabled={!preview.proposal} onClick={()=>navigate("use")}>Use this approach <span aria-hidden>→</span></button><button type="button" className="secondary-btn" aria-expanded={editingApproach} onClick={()=>setEditingApproach(!editingApproach)}>{editingApproach ? "Finish changes" : "Change a few things"}</button></div>
        {editingApproach ? <div className="approach-edit-fields">
          <div className="field"><label htmlFor="approach-title">Name</label><input id="approach-title" maxLength={100} value={approach.title} onChange={e=>setApproach({...approach,title:e.target.value})}/></div>
          <div className="field"><label htmlFor="approach-guidance">How should AI work?</label><textarea id="approach-guidance" rows={5} value={approach.guidance} onChange={e=>setApproach({...approach,guidance:e.target.value})}/></div>
          <div className="field"><label htmlFor="approach-boundaries">What should it avoid or check?</label><textarea id="approach-boundaries" rows={4} value={approach.boundary} onChange={e=>setApproach({...approach,boundary:e.target.value})}/></div>
          <button type="button" className="text-btn" onClick={()=>{setApproach({...firstRunApproaches[route],...(starterPackId?{title:starterTemplates.find(pack=>pack.id===starterPackId)?.title || firstRunApproaches[route].title}:{})});setNotice("Suggested approach restored.");}}>Restore suggestion</button>
        </div> : null}
        {preview.error ? <p role="alert" className="error">{preview.error}</p> : null}
      </section> : null}
      {step === "use" && preview.proposal ? <>
        <section className="panel ready-panel"><span className="eyebrow">Ready to work · {route}</span>
          <h2>{approach.title}</h2>{selectedPack ? <p className="muted">{practices.filter(item=>item.enabled).length} selected practices · {selectedPack.promise}</p> : null}<p className="muted">Copy your approach into an AI tool, then add the work you want it to help with.</p>
          <div className="button-row"><button className="primary-btn" type="button" onClick={()=>void copy()}>Copy for AI</button><button className="secondary-btn" type="button" onClick={()=>save()}>{selectedId ? "Save changes" : "Save for next time"}</button><button className="secondary-btn" type="button" onClick={()=>save(reviews,true)}>Save a copy</button></div>
          <div className="next-step-note"><strong>Then try it on real work.</strong><span>Once you’ve used it, come back to decide what to keep or change.</span></div>
          <div className="button-row"><button className="secondary-btn" type="button" onClick={()=>navigate("review")}>Improve this approach</button><button className="text-btn" type="button" onClick={()=>{setEditingApproach(true);navigate("adjust");}}>Edit approach</button></div>
          <details className="calm-technical"><summary>Downloads and technical details</summary>
            <div className="button-row"><button className="secondary-btn" type="button" onClick={()=>downloadText("my-ai-approach.md",preview.instructions)}>Download instructions</button><button className="secondary-btn" type="button" onClick={()=>downloadRack(preview.proposal!)}>Export full RACK</button></div>
            <details className="output-details"><summary>Read the exact generated instructions</summary><textarea aria-label="Compiled AI instructions" readOnly rows={16} value={preview.instructions} onFocus={e=>e.currentTarget.select()}/></details>
          </details>
          {reviews.length ? <details className="calm-technical"><summary>Past reviews ({reviews.length})</summary><div className="review-history">{reviews.slice().reverse().map(item=><p key={item.id}><strong>{item.decision.toUpperCase()}</strong> · {item.note||"No note"} <span className="muted small">({new Date(item.recordedAt).toLocaleDateString("en-GB")})</span></p>)}</div></details> : null}
        </section>
        {import.meta.env.VITE_RACK_MANAGED_ENABLED === "true" ? <ManagedTrial key={route+preview.instructions} instructions={preview.instructions} route={route} initialTask={task} onReviewed={note=>{setReviewNote(note);navigate("review");}} /> : null}
      </> : null}
      {step === "review" ? <section className="panel review-panel"><span className="eyebrow">Practice review</span><h2>What happened when you used it?</h2>
        <div className="review-grid">{(["keep","change","remove"] as const).map(decision=><button key={decision} type="button" aria-pressed={reviewDecision===decision} className={"review-option "+(reviewDecision===decision?"selected":"")} onClick={()=>setReviewDecision(decision)}><strong>{decision[0].toUpperCase()+decision.slice(1)}</strong><span>{decision==="keep"?"This helped, and I'd use it again.":decision==="change"?"Something could work better.":"This isn't useful for my work."}</span></button>)}</div>
        <div className="field"><label htmlFor="review-note">What did you notice? <span className="optional">Optional</span></label><textarea id="review-note" rows={4} maxLength={1000} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="A short note for your future self…" /></div>
        <p className="muted small">Reviews are local notes. Choosing Change takes you to the editor; choosing Remove records your decision but doesn't silently delete instructions.</p>
        <div className="button-row"><button type="button" className="primary-btn" onClick={recordReview}>Record review</button><button type="button" className="text-btn" onClick={()=>navigate("use")}>Cancel</button></div>
      </section> : null}
      <footer className="site-footer"><strong>rack.</strong><span>Make AI work your way — and keep improving how it works.</span><span>Browser-local by default · No account required</span></footer>
    </main>
  </div>;
}
