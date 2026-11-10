import type {RackProposal} from "@rack/creation";
import {buildRackTar} from "@rack/creation";
export {buildRackTar} from "@rack/creation";

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
