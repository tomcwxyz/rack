import type { RackModule } from "@rack/schemas";
import { practiceDateSchema } from "@rack/schemas";

export type PracticeReviewStatus = "due" | "upcoming" | "scheduled";

export type PracticeReviewItem = {
  moduleId: string;
  title: string;
  reviewAfter: string;
  status: PracticeReviewStatus;
  daysUntilReview: number;
  authorityMode: "adaptable" | "binding";
};

export type PracticeReviewReport = {
  asOf: string;
  upcomingWindowDays: number;
  dueCount: number;
  upcomingCount: number;
  items: PracticeReviewItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const dayNumber = (value: string): number => {
  const date = practiceDateSchema.parse(value);
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
};

const statusRank: Record<PracticeReviewStatus, number> = {
  due: 0,
  upcoming: 1,
  scheduled: 2,
};

export const assessPracticeReviews = (
  modules: readonly RackModule[],
  asOf: string,
  upcomingWindowDays = 30,
): PracticeReviewReport => {
  if (!Number.isInteger(upcomingWindowDays) || upcomingWindowDays < 0) {
    throw new Error("upcomingWindowDays must be a non-negative integer.");
  }

  const today = dayNumber(asOf);
  const items: PracticeReviewItem[] = [];

  for (const module of modules) {
    const reviewAfter = module.harness.authority?.review_after;
    if (!reviewAfter) continue;

    const daysUntilReview = dayNumber(reviewAfter) - today;
    const status: PracticeReviewStatus =
      daysUntilReview <= 0
        ? "due"
        : daysUntilReview <= upcomingWindowDays
          ? "upcoming"
          : "scheduled";

    items.push({
      moduleId: module.harness.id,
      title: module.title,
      reviewAfter,
      status,
      daysUntilReview,
      authorityMode: module.harness.authority?.mode ?? "adaptable",
    });
  }

  items.sort(
    (left, right) =>
      statusRank[left.status] - statusRank[right.status] ||
      left.reviewAfter.localeCompare(right.reviewAfter) ||
      left.moduleId.localeCompare(right.moduleId),
  );

  return {
    asOf,
    upcomingWindowDays,
    dueCount: items.filter((item) => item.status === "due").length,
    upcomingCount: items.filter((item) => item.status === "upcoming").length,
    items,
  };
};
