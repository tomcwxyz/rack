import type { RackProposal } from "../../../desktop/src/projectFiles.js";

// Uncompressed USTAR archives contain the canonical source files unchanged.
// No remote service or third-party archive library is involved.
const BLOCK = 512;
const encoder = new TextEncoder();
const textField = (header: Uint8Array, offset: number, length: number, value: string) => {
  const bytes = encoder.encode(value);
  if (bytes.length > length) throw new Error("Rack path is too long to export.");
  header.set(bytes, offset);
};
const octalField = (header: Uint8Array, offset: number, length: number, n: number) => {
  textField(header, offset, length, n.toString(8).padStart(length - 1, "0") + "\0");
};
export function buildRackTar(proposal: RackProposal): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 1024;
  for (const file of proposal.files) {
    if (!file.path || file.path.startsWith("/") || file.path.split("/").some(p => !p || p === "." || p === "..")) {
      throw new Error("A Rack source file has an unsafe path.");
    }
    const bytes = encoder.encode(file.content);
    const header = new Uint8Array(BLOCK);
    textField(header, 0, 100, file.path);
    octalField(header, 100, 8, 0o644);
    octalField(header, 108, 8, 0);
    octalField(header, 116, 8, 0);
    octalField(header, 124, 12, bytes.length);
    octalField(header, 136, 12, 0);
    header.fill(32, 148, 156);
    header[156] = 48; // regular file
    textField(header, 257, 6, "ustar\0");
    textField(header, 263, 2, "00");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    octalField(header, 148, 8, checksum);
    const padded = new Uint8Array(Math.ceil(bytes.length / BLOCK) * BLOCK);
    padded.set(bytes);
    parts.push(header, padded);
    total += BLOCK + padded.length;
  }
  const archive = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { archive.set(part, offset); offset += part.length; }
  return archive;
}

export function downloadRack(proposal: RackProposal): void {
  const archive = buildRackTar(proposal);
  const blob = new Blob([archive.buffer as ArrayBuffer], { type: "application/x-tar" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (proposal.folderName || "my-rack") + ".tar";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
