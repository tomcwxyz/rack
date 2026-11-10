import { useState } from "react";
import type { EditablePractice } from "../lib/practiceWorkspace.js";

type Props = { practices: EditablePractice[]; onChange: (items: EditablePractice[]) => void; title: string; onTitleChange: (title: string) => void };
export function PracticeEditor({practices, onChange, title, onTitleChange}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [guided, setGuided] = useState(false);
  const change = (id: string, values: Partial<EditablePractice>) => onChange(practices.map(item => item.id===id ? {...item,...values}:item));
  const move = (index: number, delta: number) => {
    const next = [...practices], target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]]=[next[target],next[index]];
    onChange(next);
  };
  return <div className="practice-workspace">
    <div className="field"><label htmlFor="rack-name">Name your RACK</label><input id="rack-name" maxLength={100} value={title} onChange={e=>onTitleChange(e.target.value)} /></div>
    <div className="section-top"><div><h3>Your practices</h3><p className="muted small">Choose what AI should do. Edit, reorder or leave out anything that doesn't fit.</p></div>
      <button type="button" className="text-btn" aria-pressed={guided} onClick={()=>setGuided(!guided)}>{guided?"Close guided review":"Review one by one"}</button>
    </div>
    {practices.length===0 ? <p className="empty-practices">Start with your first practice. What matters most when AI works with you?</p>:null}
    <div className="practice-items">{practices.map((practice,index)=><article key={practice.id} className={"practice-item "+(!practice.enabled?"practice-disabled":"")}>
      {editing===practice.id ? <>
        <div className="field"><label htmlFor={"title-"+practice.id}>Practice name</label><input id={"title-"+practice.id} maxLength={120} value={practice.title} onChange={e=>change(practice.id,{title:e.target.value})}/></div>
        <div className="field"><label htmlFor={"body-"+practice.id}>What should AI do?</label><textarea id={"body-"+practice.id} rows={5} value={practice.description} onChange={e=>change(practice.id,{description:e.target.value})}/></div>
        <div className="button-row"><button type="button" className="primary-btn" onClick={()=>setEditing(null)} disabled={!practice.title.trim()||!practice.description.trim()}>Done</button>
          <button type="button" className="text-btn" onClick={()=>{onChange(practice.path ? practices.map(p=>p.id===practice.id?{...p,enabled:false}:p) : practices.filter(p=>p.id!==practice.id));setEditing(null)}}>Remove practice</button></div>
      </>:<>
        <div className="practice-item-top"><div><strong>{practice.title}</strong><p>{practice.description}</p></div><label className="practice-checkbox"><input type="checkbox" checked={practice.enabled} onChange={e=>change(practice.id,{enabled:e.target.checked})}/><span>Include</span></label></div>
        {guided ? <div className="practice-actions">
          <button type="button" className="secondary-btn" onClick={()=>change(practice.id,{enabled:true})}>That's right</button>
          <button type="button" className="secondary-btn" onClick={()=>setEditing(practice.id)}>Not quite</button>
          <button type="button" className="secondary-btn" onClick={()=>change(practice.id,{enabled:false})}>Not for me</button>
        </div> : <div className="practice-actions">
          <button type="button" className="text-btn" onClick={()=>setEditing(practice.id)}>Edit</button>
          <button type="button" className="text-btn" disabled={index===0} onClick={()=>move(index,-1)}>Move up</button>
          <button type="button" className="text-btn" disabled={index===practices.length-1} onClick={()=>move(index,1)}>Move down</button>
          <button type="button" className="text-btn" onClick={()=>{if(window.confirm("Leave this practice out of your RACK?"))onChange(practice.path ? practices.map(p=>p.id===practice.id?{...p,enabled:false}:p) : practices.filter(p=>p.id!==practice.id))}}>{practice.path?"Leave out":"Remove"}</button>
        </div>}
      </>}
    </article>)}</div>
    <button type="button" className="secondary-btn add-practice" onClick={()=>{const id=crypto.randomUUID();onChange([...practices,{id,title:"New practice",description:"Describe how AI should work here.",enabled:true}]);setEditing(id)}}>+ Add a practice</button>
  </div>;
}
