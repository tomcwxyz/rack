import { describe, expect, it } from "vitest";
import { firstRunApproaches } from "@rack/creation";
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
    const dropped=applyPractices(base,edited.map((p,i)=>i===0?{...p,enabled:false}:p),"coding");
    expect(dropped.files.find(f=>f.path===practices[0].path)).toBeUndefined();
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
