import type { FirstRunApproach } from "../../../desktop/src/firstRun.js";
import type { CreationRouteId } from "../../../desktop/src/components/RouteChooser.js";

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
  reviews: PracticeReview[];
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
      Array.isArray(item.reviews) && typeof item.updatedAt === "string"
    ).slice(0, 30);
  } catch { return []; }
}

export function persistPractices(practices: SavedPractice[], storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(practices.slice(0, 30)));
}
