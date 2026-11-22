import {useMemo,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {open} from "@tauri-apps/plugin-dialog";
import type {ProjectSnapshot} from "@rack/core";
import {blankRackProposal,compilePractices,type CreationRouteId,type EditablePractice} from "@rack/creation";
import "../proposition-creation.css";

type Props={route:CreationRouteId;onBack:()=>void;onCreated:(snapshot:ProjectSnapshot)=>void};
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
export function ScratchRackCreator({route,onBack,onCreated}:Props){
  const [title,setTitle]=useState("My "+route+" RACK");
  const [practices,setPractices]=useState<EditablePractice[]>([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const preview=useMemo(()=>{
    try {return {...compilePractices(blankRackProposal(route,title),practices,route),error:""};}
    catch(e){return {proposal:null,instructions:"",error:message(e)};}
  },[route,title,practices]);
  const update=(id:string,values:Partial<EditablePractice>)=>setPractices(items=>items.map(p=>p.id===id?{...p,...values}:p));
  const add=()=>setPractices(items=>[...items,{id:crypto.randomUUID(),title:"",description:"",enabled:true}]);
  const remove=(id:string)=>setPractices(items=>items.filter(p=>p.id!==id));
  const move=(index:number,direction:number)=>setPractices(current=>{
    const target=index+direction;if(target<0||target>=current.length)return current;
    const copy=[...current];[copy[index],copy[target]]=[copy[target],copy[index]];return copy;
  });
  const create=async()=>{
    if(!preview.proposal||saving)return;
    setError("");
    setSaving(true);
    try {
      const selected=await open({directory:true,multiple:false,title:"Choose where to save your RACK"});
      const parentPath=Array.isArray(selected)?selected[0]:selected;
      if(!parentPath)return;
      const snapshot=await invoke<ProjectSnapshot>("create_rack_project",{
        parentPath,folderName:preview.proposal.folderName,files:preview.proposal.files
      });
      onCreated(snapshot);
    }catch(e){setError(message(e))}
    finally{setSaving(false)}
  };
  return <section className="scratch-rack" aria-labelledby="scratch-heading">
    <header className="route-header"><div><p className="eyebrow">{route} · your own practice</p>
      <h1 id="scratch-heading">Make your own RACK</h1>
      <p className="lede">Start empty. Add the practices you want AI to follow, then save the RACK to your computer.</p>
    </div><button type="button" className="quiet-action" onClick={onBack}>Other starting points</button></header>
    <div className="scratch-rack-card">
      <label className="field"><span>Name your RACK</span><input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
      <h2>Your practices</h2>
      {practices.length===0?<p className="scratch-rack-empty">No practices yet. Start by adding how you'd like AI to work.</p>:null}
      {practices.map((p,index)=><article className="scratch-rack-practice" key={p.id}>
        <label className="field"><span>Practice name</span><input maxLength={120} value={p.title} placeholder="For example: Check the evidence" onChange={e=>update(p.id,{title:e.target.value})}/></label>
        <label className="field"><span>What should AI do?</span><textarea rows={4} value={p.description} placeholder="Explain the behaviour you want, in your own words." onChange={e=>update(p.id,{description:e.target.value})}/></label>
        <div className="scratch-rack-actions"><label><input type="checkbox" checked={p.enabled} onChange={e=>update(p.id,{enabled:e.target.checked})}/> Include</label>
          <button type="button" className="quiet-action" disabled={index===0} onClick={()=>move(index,-1)}>Move up</button>
          <button type="button" className="quiet-action" disabled={index===practices.length-1} onClick={()=>move(index,1)}>Move down</button>
          <button type="button" className="quiet-action" onClick={()=>remove(p.id)}>Remove</button></div>
      </article>)}
      <button type="button" className="secondary-action" onClick={add}>Add a practice</button>
      {error?<p role="alert" className="notice notice--error">{error}</p>:null}
      {!preview.proposal && practices.some(p=>p.enabled)&&preview.error?<p role="status" className="notice notice--error">{preview.error}</p>:null}
      <div className="scratch-rack-save"><span>{preview.proposal?"Ready to save as local RACK source files.":"Add a complete practice to continue."}</span>
        <button type="button" className="primary-action" disabled={saving||!preview.proposal||!practices.some(p=>p.enabled)} onClick={()=>void create()}>{saving?"Saving…":"Create RACK"}</button></div>
    </div>
  </section>;
}
