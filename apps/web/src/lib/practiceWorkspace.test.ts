import { describe, expect, it } from "vitest";
import { firstRunApproaches, blankRackProposal } from "@rack/creation";
import { buildStarterPractice } from "./starterPacks.js";
import { applyPractices, compilePractices, extractPractices, readRackTar } from "./practiceWorkspace.js";
import { buildRackTar } from "./archive.js";

describe("editable web RACK workspace", () => {
  it.each(["writing","research","coding"] as const)("compiles a custom practice in %s", route => {
    const base=buildStarterPractice(route,"A concrete task",firstRunApproaches[route],null).proposal;
    const prior=compilePractices(base,[],route).instructions;
    const added=compilePractices(base,[{id:"my-rule",title:"My specific practice",description:"Always provide a concise final checklist for my organisation.",enabled:true}],route);
    expect(added.instructions).toContain("Always provide a concise final checklist");
    expect(added.instructions).not.toBe(prior);
    expect(added.proposal.files.some(f=>f.path==="modules/context/user-my-rule.md")).toBe(true);
  });
  it("edits and removes source modules from exported files", () => {
    const base=buildStarterPractice("coding","Fix an issue",firstRunApproaches.coding,null).proposal;
    const practices=extractPractices(base);
    const edited=practices.map((p,i)=>i===0?{...p,description:"Inspect repository layout before any modifications."}:p);
    const output=applyPractices(base,edited,"coding");
    expect(output.files.find(f=>f.path===practices[0].path)?.content).toContain("Inspect repository layout");
    expect(() => applyPractices(base,edited.map((p,i)=>i===0?{...p,enabled:false}:p),"coding")).toThrow(/depends on it/);
  });
  it.each(["writing","research","coding"] as const)("starts with no hidden practices in %s",route=>{
    const proposal=blankRackProposal(route,"A new RACK");
    expect(proposal.files.filter(f=>f.path.startsWith("modules/")&&f.path!=="modules/index.md")).toHaveLength(0);
    const compiled=compilePractices(proposal,[{id:"personal-rule",title:"Own practice",description:"Always show a clear list of next steps.",enabled:true}],route);
    expect(compiled.instructions).toContain("Always show a clear list of next steps.");
    expect(compiled.proposal.files.find(f=>f.path==="rack.yaml")?.content).toContain('title: "A new RACK"');
  });
  it("reads a RACK exported by the web pilot", () => {
    const base=buildStarterPractice("writing","A useful report",firstRunApproaches.writing,null).proposal;
    const archive=readRackTar(buildRackTar(base));
    expect(archive.files).toEqual(base.files);
  });
  it("rejects invalid archives", () => {
    expect(()=>readRackTar(new Uint8Array([1,2,3]))).toThrow();
  });
});
