import type { PracticeReviewItem, PracticeReviewReport } from "./practiceReview.js";

export type PracticeReviewDecision = "keep" | "change" | "remove";

export type PracticeReviewRecord = {
  schemaVersion: "0.1";
  requestId?: string;
  moduleId: string;
  moduleTitle: string;
  modulePath: string;
  reviewAfter: string;
  experimentQuestion: string | null;
  reflection: string;
  decision: PracticeReviewDecision;
  reviewedAt: number;
};

export const practiceReviewIsSatisfied = (
  item: PracticeReviewItem,
  reviews: readonly PracticeReviewRecord[],
): boolean =>
  reviews.some(
    (review) =>
      review.moduleId === item.moduleId &&
      review.reviewAfter === item.reviewAfter,
  );

export const outstandingPracticeReviews = (
  report: PracticeReviewReport,
  reviews: readonly PracticeReviewRecord[],
): PracticeReviewReport => {
  const items = report.items.filter(
    (item) => !practiceReviewIsSatisfied(item, reviews),
  );

  return {
    ...report,
    dueCount: items.filter((item) => item.status === "due").length,
    upcomingCount: items.filter((item) => item.status === "upcoming").length,
    experimentDueCount: items.filter(
      (item) => item.status === "due" && item.experimentQuestion !== null,
    ).length,
    experimentUpcomingCount: items.filter(
      (item) => item.status === "upcoming" && item.experimentQuestion !== null,
    ).length,
    items,
  };
};
