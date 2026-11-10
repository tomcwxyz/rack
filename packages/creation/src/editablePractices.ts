import { slugify, type RackProposal } from "./projectFiles.js";
import type { CreationRouteId } from "./firstRun.js";
import { firstRunApproaches, firstRunProposal, firstRunInstructions, firstRunSnapshot } from "./firstRun.js";
import { parseProjectSnapshot, readSetupDraft, patchSetupSource, readGuardrailModuleDraft, patchGuardrailModuleSource, readTaskModuleDraft, patchTaskModuleSource } from "@rack/core";

export type EditablePractice = { id: string; title: string; description: string; enabled: boolean; path?: string; sourceId?: string };
const frontmatter = (text: string) => text.startsWith("---\n") ? text.indexOf("\n---", 4) : -1;
const yamlValue = (content: string, key: string) => {
  const match = content.match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  const value = match?.[1]?.trim() || "";
  if (value.startsWith('"')) { try { return JSON.parse(value) as string; } catch { return value; } }
  return value.replace(/^['"]|['"]$/g, "");
};
const moduleId = (content: string) => content.match(/^  id:\s*([\w.-]+)/m)?.[1] || "";
const contentBody = (content: string) => {
  const end = frontmatter(content);
  return end >= 0 ? content.slice(end + 4).trim() : content.trim();
};
export function extractPractices(proposal: RackProposal): EditablePractice[] {
  return proposal.files.filter(f => f.path.startsWith("modules/") && f.path.endsWith(".md") && f.path !== "modules/index.md").map(file => ({
    id: crypto.randomUUID(), path: file.path, sourceId: moduleId(file.content),
    title: yamlValue(file.content, "title") || file.path.split("/").pop() || "Practice",
    description: contentBody(file.content) || yamlValue(file.content, "description"),
    enabled: true,
  }));
}
const quote = (value: string) => JSON.stringify(value.trim());
const customFile = (practice: EditablePractice, route: CreationRouteId) => {
  const id = practice.id.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
  return {path: "modules/context/user-" + id + ".md", content: [
    "---", "type: context", "title: " + quote(practice.title),
    "description: \"A practice written by the RACK owner.\"", "tags: [custom]",
    "harness:", "  schema_version: \"0.1\"", "  id: context.user-" + id,
    "  version: 0.1.0", "  context_kind: organisation",
    "  applies_to: [" + (route === "coding" ? "code" : route) + "]", "---", "", practice.description.trim(), ""
  ].join("\n")};
};

const moduleType = (source: string): string => source.match(/^type:\s*([\w-]+)/m)?.[1] || "";
const sourceIdOf = (file: {content: string}) => moduleId(file.content);
const replaceBody = (source: string, practice: EditablePractice): string => {
  const end = frontmatter(source);
  if (end < 0) throw new Error("Cannot edit an invalid instruction source.");
  const originalBody = contentBody(source);
  const changedBody = practice.description.trim() !== originalBody;
  const type = moduleType(source);
  if (type === "guardrail") {
    const draft = readGuardrailModuleDraft(source);
    if (changedBody && draft.rules.length > 1) {
      throw new Error('“' + practice.title + '” has several enforceable rules. Use the Local structured editor to change those rules safely.');
    }
    const rules = changedBody && draft.rules.length === 1
      ? [{...draft.rules[0], statement: practice.description.trim()}] : draft.rules;
    return patchGuardrailModuleSource(source, {...draft, title:practice.title, body:practice.description, rules}).content;
  }
  if (type === "task") {
    const draft = readTaskModuleDraft(source);
    return patchTaskModuleSource(source, {...draft, title:practice.title, body:practice.description}).content;
  }
  if (changedBody && (type === "voice" || type === "method" || type === "craft") && /^\s*(?:lexicon|rules):/m.test(source.slice(0,end))) {
    throw new Error('“' + practice.title + '” has structured rules which this simple editor cannot safely change. Use the Local advanced editor.');
  }
  const header = source.slice(0,end+4).replace(/^title:.*$/m, "title: " + quote(practice.title));
  return header + "\n\n" + practice.description.trim() + "\n";
};

export function applyPractices(base: RackProposal, practices: EditablePractice[], route: CreationRouteId): RackProposal {
  const originalModules=base.files.filter(f => f.path.startsWith("modules/") && f.path.endsWith(".md") && f.path !== "modules/index.md");
  const originalByPath=new Map(originalModules.map(f=>[f.path,f]));
  const knownPaths=new Set(practices.map(p=>p.path).filter((p):p is string=>!!p));
  for(const path of knownPaths) if(!originalByPath.has(path)) throw new Error("This RACK contains an unknown practice source: "+path);
  const removed=new Set(originalModules.filter(f=>knownPaths.has(f.path) && practices.some(p=>p.path===f.path&&!p.enabled)).map(f=>sourceIdOf(f)));
  // An omitted imported rule is treated as removed, but an empty fresh workspace keeps its foundational modules.
  if (knownPaths.size) for (const file of originalModules) if (!knownPaths.has(file.path)) removed.add(sourceIdOf(file));
  removed.delete("");
  const remaining=originalModules.filter(f=>!removed.has(sourceIdOf(f)));
  const references=parseProjectSnapshot(firstRunSnapshot(base)).modules;
  for(const module of references) {
    if(removed.has(module.harness.id)) continue;
    const deps = module.harness.requires || [];
    for(const dep of deps) if(removed.has(dep.id)) {
      throw new Error("Cannot remove " + dep.id + " because “" + module.title + "” depends on it. Disable or change the dependent practice first.");
    }
  }
  const result = base.files.filter(f=>!removed.has(sourceIdOf(f))).map(file=>{
    const p=practices.find(p=>p.path===file.path);
    return p?.enabled ? {...file,content:replaceBody(file.content,p)} : {...file};
  });
  const extra=practices.filter(p=>!p.path&&p.enabled).map(p=>{
    if(!p.title.trim()||!p.description.trim()) throw new Error("Every new practice needs a name and guidance.");
    return customFile(p,route);
  });
  const newIds=extra.map(sourceIdOf);
  const profilePath="profiles/"+route+".yaml";
  let matchedProfile=false;
  const adjusted=result.map(file=>{
    if(!file.path.startsWith("profiles/")||!file.path.endsWith(".yaml")) return file;
    const draft=readSetupDraft(file.content);
    const include=draft.include.filter(id=>!removed.has(id));
    if(file.path===profilePath){
      matchedProfile=true;
      include.push(...newIds.filter(id=>!include.includes(id)));
    }
    const changed=include.length!==draft.include.length || include.some((id,i)=>id!==draft.include[i]);
    return changed ? {...file,content:patchSetupSource(file.content,{...draft,include}).content} : file;
  });
  if(extra.length&&!matchedProfile) throw new Error("This RACK has no matching "+route+" Set-up for new practices.");
  const proposal={...base,files:[...adjusted,...extra]};
  const parsed=parseProjectSnapshot(firstRunSnapshot(proposal));
  const errors=parsed.diagnostics.filter(d=>d.severity==="error");
  if(errors.length) throw new Error(errors.map(e=>e.message).join(" "));
  return proposal;
}

export function compilePractices(base: RackProposal, practices: EditablePractice[], route: CreationRouteId) {
  const proposal=applyPractices(base,practices,route);
  return {proposal,instructions:firstRunInstructions(proposal,route)};
}


export function blankRackProposal(route: CreationRouteId, title = "My new RACK"): RackProposal {
  const rackTitle=title.trim();
  if (!rackTitle) throw new Error("Give your RACK a name.");
  const base=firstRunProposal(route,"", {...firstRunApproaches[route],title:rackTitle});
  const slug=slugify(rackTitle);
  const files=base.files.filter(f=>!f.path.startsWith("modules/") || f.path==="modules/index.md").map(file=>{
    if(file.path==="rack.yaml"){
      return {...file,content:file.content.replace(/^name:.*$/m,"name: "+slug).replace(/^title:.*$/m,"title: "+quote(rackTitle))};
    }
    if(file.path.startsWith("profiles/")){
      return {...file,content:patchSetupSource(file.content,{...readSetupDraft(file.content),include:[]}).content};
    }
    return {...file};
  });
  return {folderName:slug,files};
}
