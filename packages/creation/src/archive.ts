import type { RackProposal } from "./projectFiles.js";
import { firstRunSnapshot } from "./firstRun.js";
import { parseProjectSnapshot } from "@rack/core";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8",{fatal:true});
const BLOCK = 512;
const MAX_SIZE = 12_000_000;
const MAX_FILES = 500;

const safePath = (value:string) =>
  !!value && !value.startsWith("/") && !value.includes("\\") &&
  !value.split("/").some(part=>!part||part==="."||part==="..") &&
  /^(rack\.yaml|modules\/.*\.md|profiles\/.*\.yaml|eval\/.*\.yaml)$/.test(value);

function field(bytes:Uint8Array,start:number,size:number) {
  return decoder.decode(bytes.subarray(start,start+size)).replace(/\0.*$/,"").trim();
}
export function readRackTar(bytes:Uint8Array):RackProposal {
  if(bytes.length>MAX_SIZE)throw new Error("This RACK archive is larger than 12 MB.");
  if(bytes.length<BLOCK*3 || bytes.length%BLOCK!==0)throw new Error("This is not a complete RACK archive.");
  const files:RackProposal["files"]=[];
  let offset=0,terminated=false;
  while(offset+BLOCK<=bytes.length) {
    const header=bytes.subarray(offset,offset+BLOCK);
    if(header.every(b=>b===0)){
      if(offset+BLOCK*2>bytes.length || !bytes.subarray(offset+BLOCK,offset+BLOCK*2).every(b=>b===0))
        throw new Error("The RACK archive terminator is incomplete.");
      terminated=true;break;
    }
    if(field(header,257,5)!=="ustar")throw new Error("This is not a supported RACK tar archive.");
    const path=[field(header,345,155),field(header,0,100)].filter(Boolean).join("/");
    const kind=header[156];
    if(kind!==0 && kind!==48)throw new Error("RACK archives may only contain ordinary files.");
    if(!safePath(path))throw new Error("The RACK archive contains an unsafe or unexpected path.");
    if(files.some(f=>f.path===path))throw new Error("The RACK archive contains duplicate source files.");
    const octal=field(header,124,12);
    if(!/^[0-7]+$/.test(octal))throw new Error("The RACK archive contains an invalid file length.");
    const size=parseInt(octal,8);
    if(!Number.isSafeInteger(size)||size>MAX_SIZE)throw new Error("The RACK archive contains an oversized file.");
    const expected=parseInt(field(header,148,8),8);
    const checksum=header.reduce((sum,byte,i)=>sum+(i>=148&&i<156?32:byte),0);
    if(expected!==checksum)throw new Error("The RACK archive header checksum does not match.");
    const end=offset+BLOCK+size;
    if(end>bytes.length)throw new Error("A RACK source file is truncated.");
    files.push({path,content:decoder.decode(bytes.subarray(offset+BLOCK,end))});
    if(files.length>MAX_FILES)throw new Error("The RACK archive contains too many files.");
    offset+=BLOCK+Math.ceil(size/BLOCK)*BLOCK;
  }
  if(!terminated || !files.some(f=>f.path==="rack.yaml") || !files.some(f=>f.path.startsWith("profiles/")))
    throw new Error("The archive has no complete RACK manifest or Set-up.");
  const proposal={folderName:"imported-rack",files};
  const project=parseProjectSnapshot(firstRunSnapshot(proposal));
  const blocking=project.diagnostics.filter(d=>d.severity==="error");
  if(blocking.length)throw new Error("The imported RACK is invalid: "+blocking.map(d=>d.message).join(" "));
  return proposal;
}

const write=(header:Uint8Array,offset:number,size:number,value:string)=>{
  const valueBytes=encoder.encode(value);
  if(valueBytes.length>size)throw new Error("The RACK contains a path that is too long for tar.");
  header.set(valueBytes,offset);
};
const octal=(header:Uint8Array,offset:number,size:number,value:number)=>
  write(header,offset,size,value.toString(8).padStart(size-1,"0")+"\0");

export function buildRackTar(proposal:RackProposal):Uint8Array {
  const parts:Uint8Array[]=[];
  let total=BLOCK*2;
  for(const file of proposal.files){
    if(!safePath(file.path)||encoder.encode(file.path).length>100)
      throw new Error("A RACK source file has an unsafe or oversized archive path.");
    const body=encoder.encode(file.content);
    const header=new Uint8Array(BLOCK);
    write(header,0,100,file.path);
    octal(header,100,8,0o644);
    octal(header,108,8,0);
    octal(header,116,8,0);
    octal(header,124,12,body.length);
    octal(header,136,12,0);
    header.fill(32,148,156);
    header[156]=48;
    write(header,257,6,"ustar\0");
    write(header,263,2,"00");
    octal(header,148,8,header.reduce((sum,b)=>sum+b,0));
    const padded=new Uint8Array(Math.ceil(body.length/BLOCK)*BLOCK);
    padded.set(body);
    parts.push(header,padded);
    total+=BLOCK+padded.length;
    if(total>MAX_SIZE)throw new Error("The exported RACK exceeds the 12 MB archive limit.");
  }
  const archive=new Uint8Array(total);
  let offset=0;
  for(const part of parts){archive.set(part,offset);offset+=part.length;}
  return archive;
}
