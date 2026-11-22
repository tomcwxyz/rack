import type { FirstRunApproach } from "@rack/creation";
import type { CreationRouteId, RackProposal } from "@rack/creation";
import type { EditablePractice } from "./practiceWorkspace.js";

export type ReviewDecision = "keep" | "change" | "remove";
export type PracticeReview = {
  id: string;
  decision: ReviewDecision;
  note: string;
  recordedAt: string;
};
export type SavedPractice = {
  id: string;
  route: CreationRouteId;
  task: string;
  approach: FirstRunApproach;
  starterPackId?: string | null;
  reviews: PracticeReview[];
  practices?: EditablePractice[];
  importedRack?: RackProposal | null;
  blank?: boolean;
  updatedAt: string;
};
const KEY = "rack:web-pilot:practices:v1";

export function loadPractices(storage: Pick<Storage, "getItem"> = localStorage): SavedPractice[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedPractice =>
      item !== null && typeof item === "object" &&
      typeof item.id === "string" &&
      ["writing", "research", "coding"].includes(item.route) &&
      typeof item.task === "string" &&
      typeof item.approach?.title === "string" &&
      typeof item.approach?.guidance === "string" &&
      typeof item.approach?.boundary === "string" &&
      (item.starterPackId == null || typeof item.starterPackId === "string") &&
      Array.isArray(item.reviews) &&
      (item.practices === undefined || (Array.isArray(item.practices) && item.practices.every((p: EditablePractice) => typeof p.id === "string" && typeof p.title === "string" && typeof p.description === "string" && typeof p.enabled === "boolean"))) &&
      (item.blank === undefined || typeof item.blank === "boolean") &&
      (item.importedRack == null || (Array.isArray(item.importedRack.files) && item.importedRack.files.every((f: {path: string; content: string}) => typeof f.path === "string" && typeof f.content === "string"))) &&
      typeof item.updatedAt === "string"
    ).slice(0, 30);
  } catch { return []; }
}

export function persistPractices(practices: SavedPractice[], storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(practices.slice(0, 30)));
}
