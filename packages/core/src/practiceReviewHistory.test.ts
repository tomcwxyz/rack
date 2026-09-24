import { describe, expect, it } from "vitest";
import {
  outstandingPracticeReviews,
  practiceReviewIsSatisfied,
  type PracticeReviewRecord,
} from "./practiceReviewHistory.js";
import type { PracticeReviewReport } from "./practiceReview.js";

const report: PracticeReviewReport = {
  asOf: "2026-09-22",
  upcomingWindowDays: 30,
  dueCount: 2,
  upcomingCount: 1,
  experimentDueCount: 1,
  experimentUpcomingCount: 1,
  items: [
    {
      moduleId: "practice.a",
      title: "A",
      reviewAfter: "2026-09-20",
      status: "due",
      daysUntilReview: -2,
      authorityMode: "adaptable",
      experimentQuestion: null,
    },
    {
      moduleId: "practice.b",
      title: "B",
      reviewAfter: "2026-09-21",
      status: "due",
      daysUntilReview: -1,
      authorityMode: "adaptable",
      experimentQuestion: "Did it help?",
    },
    {
      moduleId: "practice.c",
      title: "C",
      reviewAfter: "2026-10-01",
      status: "upcoming",
      daysUntilReview: 9,
      authorityMode: "binding",
      experimentQuestion: "Still useful?",
    },
  ],
};

const review = (
  moduleId: string,
  reviewAfter: string,
): PracticeReviewRecord => ({
  schemaVersion: "0.1",
  moduleId,
  moduleTitle: moduleId,
  modulePath: `modules/${moduleId}.md`,
  reviewAfter,
  experimentQuestion: null,
  reflection: "Observed in real work.",
  decision: "keep",
  reviewedAt: 1,
});

describe("practice review history", () => {
  it("satisfies only the exact module and review-date snapshot", () => {
    expect(
      practiceReviewIsSatisfied(report.items[0]!, [
        review("practice.a", "2026-09-20"),
      ]),
    ).toBe(true);
    expect(
      practiceReviewIsSatisfied(report.items[0]!, [
        review("practice.a", "2026-10-20"),
      ]),
    ).toBe(false);
  });

  it("removes completed reminders and recalculates counts", () => {
    const outstanding = outstandingPracticeReviews(report, [
      review("practice.b", "2026-09-21"),
    ]);

    expect(outstanding.items.map((item) => item.moduleId)).toEqual([
      "practice.a",
      "practice.c",
    ]);
    expect(outstanding.dueCount).toBe(1);
    expect(outstanding.experimentDueCount).toBe(0);
    expect(outstanding.upcomingCount).toBe(1);
    expect(outstanding.experimentUpcomingCount).toBe(1);
  });
});
