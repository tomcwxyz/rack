import { useMemo, useState } from "react";
import {
  firstRunApproaches, firstRunInstructions, firstRunProposal,
  type FirstRunApproach,
} from "../../desktop/src/firstRun.js";
import type { CreationRouteId } from "../../desktop/src/components/RouteChooser.js";
import { downloadRack } from "./lib/archive.js";
import { loadPractices, persistPractices, type SavedPractice, type PracticeReview, type ReviewDecision } from "./lib/storage.js";
import { ManagedTrial } from "./components/ManagedTrial.js";

type Step = "choose" | "adjust" | "use" | "review";
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
  const [route, setRoute] = useState<CreationRouteId>("writing");
  const [task, setTask] = useState("");
  const [approach, setApproach] = useState<FirstRunApproach>({...firstRunApproaches.writing});
  const [saved, setSaved] = useState<SavedPractice[]>(() => loadPractices());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PracticeReview[]>([]);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("keep");
  const [reviewNote, setReviewNote] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const preview = useMemo(() => {
    try {
      const proposal = firstRunProposal(route, task, approach);
      const instructions = firstRunInstructions(proposal, route);
      return { proposal, instructions, error: "" };
    } catch (reason) { return { proposal: null, instructions: "", error: errorText(reason) }; }
  }, [route, task, approach]);

  const navigate = (next: Step) => { setNotice(""); setError(""); setStep(next); window.scrollTo({top:0, behavior:"smooth"}); };
  const choose = (next: CreationRouteId) => {
    setRoute(next); setApproach({...firstRunApproaches[next]}); setSelectedId(null); setReviews([]);
    navigate("adjust");
  };
  const load = (item: SavedPractice) => {
    setRoute(item.route); setTask(item.task); setApproach({...item.approach}); setReviews(item.reviews);
    setSelectedId(item.id); navigate("use");
  };
  const save = (nextReviews = reviews) => {
    if (!preview.proposal) { setError(preview.error); return; }
    const item: SavedPractice = {
      id: selectedId || crypto.randomUUID(), route, task, approach, reviews: nextReviews,
      updatedAt: new Date().toISOString(),
    };
    const next = [item, ...saved.filter(entry => entry.id !== item.id)].slice(0, 30);
    try { persistPractices(next); setSaved(next); setSelectedId(item.id); setNotice("Saved in this browser. Export a copy to keep it elsewhere."); }
    catch { setError("Your browser could not save this approach. Please export a copy."); }
  };
  const recordReview = () => {
    const next = [...reviews, { id: crypto.randomUUID(), decision: reviewDecision, note: reviewNote.trim(), recordedAt: new Date().toISOString() }];
    setReviews(next); setReviewNote(""); save(next);
    if (reviewDecision === "change") navigate("adjust"); else navigate("use");
  };
  const exportPilotNotes = () => {
    const notes = saved.map(item => ({
      route: item.route, approachTitle: item.approach.title,
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
        <h1>{step === "choose" ? <>Make AI work <em>your way.</em></> : step === "adjust" ? <>Start with a <em>good approach.</em></> : step === "review" ? <>Make your approach <em>better.</em></> : <>Your approach is <em>ready.</em></>}</h1>
        <p className="page-lede">{step === "choose" ? "You don't need to know how to write a perfect prompt. Tell rack what you want to do, start with a thoughtful approach, and shape it as you learn." : step === "adjust" ? "Start with this suggested way of working. Change anything you want, and decide which boundaries matter." : step === "review" ? "What happened when you used it? Keep what helped, change what didn't, or mark an instruction for removal." : "Take these instructions into your AI tool, or try them with our optional managed service. Come back and improve them whenever you're ready."}</p>
      </div>
      <nav className="progress" aria-label="Progress"><span className={step==="choose"?"active":""}>01 Choose work</span><span className={step==="adjust"?"active":""}>02 Shape approach</span><span className={step==="use"?"active":""}>03 Use it</span><span className={step==="review"?"active":""}>04 Improve</span></nav>
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
        {saved.length > 0 ? <section className="saved-section"><div className="section-top"><h2>Saved in this browser</h2><div className="button-row"><button type="button" className="secondary-btn" onClick={exportPilotNotes}>Download pilot notes</button><button type="button" className="text-btn" onClick={clearSaved}>Clear browser library</button></div></div><p className="muted small">Notes are never sent automatically. Download and share the feedback file only if you choose to.</p>
          <div className="saved-grid">{saved.map(item=><div className="saved-item" key={item.id}><div><span className="eyebrow">{item.route}</span><h3>{item.approach.title}</h3><p className="muted small">{item.task || "General approach"} · {item.reviews.length} reviews</p></div>
            <button type="button" className="secondary-btn" onClick={()=>load(item)}>Open</button></div>)}</div>
        </section> : null}
      </> : null}
      {step === "adjust" ? <section className="panel editor-panel">
        <div className="section-top"><span className="eyebrow">Suggested approach · {route}</span><button type="button" className="text-btn" onClick={()=>navigate("choose")}>Change work type</button></div>
        <div className="field"><label htmlFor="approach-title">Name your approach</label><input id="approach-title" maxLength={100} value={approach.title} onChange={e=>setApproach({...approach,title:e.target.value})}/></div>
        <div className="field"><label htmlFor="approach-guidance">How should AI work?</label><p className="field-description">A few useful guiding principles, rather than a long technical specification.</p>
          <textarea id="approach-guidance" rows={5} value={approach.guidance} onChange={e=>setApproach({...approach,guidance:e.target.value})}/></div>
        <div className="field"><label htmlFor="approach-boundaries">What should it avoid or check?</label><p className="field-description">Make important boundaries explicit.</p>
          <textarea id="approach-boundaries" rows={4} value={approach.boundary} onChange={e=>setApproach({...approach,boundary:e.target.value})}/></div>
        <div className="button-row"><button type="button" className="primary-btn" disabled={!preview.proposal} onClick={()=>navigate("use")}>Use this approach <span aria-hidden>→</span></button><button type="button" className="secondary-btn" onClick={()=>{setApproach({...firstRunApproaches[route]});setNotice("Suggested approach restored.");}}>Restore suggestion</button></div>
        {preview.error ? <p role="alert" className="error">{preview.error}</p> : null}
      </section> : null}
      {step === "use" && preview.proposal ? <>
        <section className="panel ready-panel"><div className="section-top"><span className="eyebrow">{route} practice</span><span className="privacy-pill">Portable · reviewable</span></div>
          <h2>{approach.title}</h2><p className="muted">These are real instructions generated by RACK's existing practice compiler — not a separate demo prompt.</p>
          <div className="button-row"><button className="primary-btn" type="button" onClick={()=>void copy()}>Copy instructions</button><button className="secondary-btn" type="button" onClick={()=>downloadText("my-ai-approach.md",preview.instructions)}>Download Markdown</button><button className="secondary-btn" type="button" onClick={()=>downloadRack(preview.proposal!)}>Export full RACK</button></div>
          <details className="output-details"><summary>Read the exact generated instructions</summary><textarea aria-label="Compiled AI instructions" readOnly rows={16} value={preview.instructions} onFocus={e=>e.currentTarget.select()}/></details>
          <div className="divider-line"/>
          <div className="section-top"><div><h3>Keep this approach</h3><p className="muted small">Save on this device to return to it. It will not sync to another browser.</p></div><button className="secondary-btn" type="button" onClick={()=>save()}>{selectedId ? "Save changes" : "Save in browser"}</button></div>
        </section>
        <ManagedTrial key={route+preview.instructions} instructions={preview.instructions} route={route} initialTask={task} onReviewed={note=>{setReviewNote(note);navigate("review");}} />
        <section className="panel after-use"><span className="eyebrow">The most important step</span><h2>What would you change?</h2><p className="muted">An approach improves through real use, not just more instructions. Make a conscious decision about what to keep, change or remove.</p>
          <div className="button-row"><button className="primary-btn" type="button" onClick={()=>navigate("review")}>Review this approach <span aria-hidden>→</span></button><button className="secondary-btn" type="button" onClick={()=>navigate("adjust")}>Edit instructions</button></div>
          {reviews.length ? <div className="review-history"><h3>Review history · only in this browser</h3>{reviews.slice().reverse().map(item=><p key={item.id}><strong>{item.decision.toUpperCase()}</strong> · {item.note||"No note"} <span className="muted small">({new Date(item.recordedAt).toLocaleDateString("en-GB")})</span></p>)}</div> : null}
        </section>
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
