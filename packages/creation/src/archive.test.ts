import {describe,it,expect} from "vitest";
import {firstRunApproaches,firstRunProposal} from "./firstRun.js";
import {blankRackProposal,compilePractices} from "./editablePractices.js";
import {buildRackTar,readRackTar} from "./archive.js";

describe("portable RACK archives",()=>{
  it.each(["writing","research","coding"] as const)("round trips full canonical source for %s",route=>{
    const source=firstRunProposal(route,"A useful job",firstRunApproaches[route]);
    source.files.push({path:"eval/quality.yaml",content:"schema_version: '0.1'\n"});
    const original=buildRackTar(source);
    const imported=readRackTar(original);
    expect(imported.files).toEqual(source.files);
    expect(buildRackTar(imported)).toEqual(original);
  });
  it.each(["writing","research","coding"] as const)("round trips a user-authored blank RACK for %s",route=>{
    const original=blankRackProposal(route,"Personal practice");
    const output=compilePractices(original,[
      {id:"one",title:"First habit",description:"Make the next action clear.",enabled:true},
      {id:"two",title:"Second habit",description:"State any remaining uncertainty.",enabled:true}
    ],route);
    const imported=readRackTar(buildRackTar(output.proposal));
    expect(imported.files).toEqual(output.proposal.files);
    expect(imported.files.some(f=>f.path==="modules/context/user-one.md")).toBe(true);
    expect(imported.files.some(f=>f.path==="modules/context/user-two.md")).toBe(true);
  });
  it("rejects invalid, truncated and tampered archives",()=>{
    const good=buildRackTar(firstRunProposal("writing","",firstRunApproaches.writing));
    expect(()=>readRackTar(new Uint8Array([1,2,3]))).toThrow();
    expect(()=>readRackTar(good.slice(0,good.length-512))).toThrow();
    const tampered=good.slice();
    tampered[108]="1".charCodeAt(0);
    expect(()=>readRackTar(tampered)).toThrow(/checksum/);
  });
  it("rejects unsafe relative paths before writing",()=>{
    const source=firstRunProposal("writing","",firstRunApproaches.writing);
    source.files.push({path:"../secrets.txt",content:"bad"});
    expect(()=>buildRackTar(source)).toThrow(/unsafe/);
  });
});
