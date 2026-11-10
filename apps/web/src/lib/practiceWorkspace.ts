import type { RackProposal } from "@rack/creation";
export { extractPractices, applyPractices, compilePractices } from "@rack/creation";
export type { EditablePractice } from "@rack/creation";
const decoder = new TextDecoder();

export function readRackTar(bytes: Uint8Array): RackProposal {
  if (bytes.length > 12_000_000) throw new Error("This RACK exceeds the 12 MB import limit.");
  const files: RackProposal["files"] = [];
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const read = (start: number, length: number) => decoder.decode(header.subarray(start, start + length)).replace(/\0.*$/, "").trim();
    if (read(257, 5) !== "ustar") throw new Error("Please choose a RACK tar archive.");
    const path = [read(345, 155), read(0, 100)].filter(Boolean).join("/");
    const length = Number.parseInt(read(124, 12), 8);
    const kind = read(156, 1);
    if (!path || path.startsWith("/") || path.split("/").some(p => !p || p === "." || p === "..") || !Number.isSafeInteger(length) || length < 0 || offset + 512 + length > bytes.length || files.length > 500) throw new Error("This archive contains an invalid file.");
    if (kind === "0" || kind === "") {
      if (!/^(rack\.yaml|modules\/.*\.md|profiles\/.*\.yaml|eval\/.*\.yaml)$/.test(path)) throw new Error("This archive contains an unexpected file.");
      if (files.some(f => f.path === path)) throw new Error("This archive contains duplicate files.");
      files.push({path, content: decoder.decode(bytes.subarray(offset + 512, offset + 512 + length))});
    }
    offset += 512 + Math.ceil(length / 512) * 512;
  }
  if (!files.some(file => file.path === "rack.yaml") || !files.some(file => file.path.startsWith("profiles/"))) throw new Error("No valid RACK manifest or profile was found.");
  return {folderName: "imported-rack", files};
}

