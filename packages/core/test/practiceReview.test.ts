import { describe, expect, it } from "vitest";
import type { RackModule } from "@rack/schemas";
import { assessPracticeReviews } from "../src/practiceReview.js";

const moduleFor = (
  id: string,
  reviewAfter?: string,
  mode: "adaptable" | "binding" = "binding",
): RackModule => ({
  type: "context",
  title: id,
  description: null,
  tags: [],
  harness: {
    schema_version: "0.2",
    id,
    version: "0.2.0",
    applies_to: "all",
    requires: [],
    criticality: "recommended",
    authority: {
      mode,
      propagation: "shared",
      ...(mode === "binding" ? { rationale: "Shared boundary." } : {}),
      ...(reviewAfter ? { review_after: reviewAfter } : {}),
    },
    enforcement: ["instruction"],
    capabilities: { required: [] },
    emit: { priority: 50, targets: "all" },
    source: { origin: "local", license: null },
    context_kind: "reference",
  },
  path: `modules/${id}.md`,
  body: id,
});

describe("practice review dates", () => {
  it("marks the review date itself as due", () => {
    const report = assessPracticeReviews(
      [moduleFor("guardrail.evidence", "2026-08-27")],
      "2026-08-27",
    );

    expect(report.dueCount).toBe(1);
    expect(report.items[0]).toMatchObject({
      moduleId: "guardrail.evidence",
      status: "due",
      daysUntilReview: 0,
    });
  });

  it("distinguishes upcoming and later scheduled reviews", () => {
    const report = assessPracticeReviews(
      [
        moduleFor("guardrail.upcoming", "2026-09-10"),
        moduleFor("guardrail.later", "2026-12-01"),
      ],
      "2026-08-27",
      30,
    );

    expect(report.items.map((item) => [item.moduleId, item.status])).toEqual([
      ["guardrail.upcoming", "upcoming"],
      ["guardrail.later", "scheduled"],
    ]);
    expect(report.upcomingCount).toBe(1);
  });

  it("reports past dates as due without changing the module", () => {
    const module = moduleFor("guardrail.old", "2026-01-01");
    const before = structuredClone(module);
    const report = assessPracticeReviews([module], "2026-08-27");

    expect(report.items[0]?.status).toBe("due");
    expect(report.items[0]?.daysUntilReview).toBeLessThan(0);
    expect(module).toEqual(before);
    expect(module.harness.authority?.mode).toBe("binding");
  });

  it("ignores instructions without review dates", () => {
    expect(
      assessPracticeReviews(
        [moduleFor("guardrail.none")],
        "2026-08-27",
      ).items,
    ).toEqual([]);
  });

  it("orders due reviews before upcoming and scheduled reviews", () => {
    const report = assessPracticeReviews(
      [
        moduleFor("review.future", "2027-01-01"),
        moduleFor("review.due-b", "2026-08-20"),
        moduleFor("review.upcoming", "2026-09-01"),
        moduleFor("review.due-a", "2026-08-20"),
      ],
      "2026-08-27",
    );

    expect(report.items.map((item) => item.moduleId)).toEqual([
      "review.due-a",
      "review.due-b",
      "review.upcoming",
      "review.future",
    ]);
  });

  it("requires a real explicit as-of date", () => {
    expect(() =>
      assessPracticeReviews(
        [moduleFor("guardrail.evidence", "2026-09-01")],
        "today",
      ),
    ).toThrow();

    expect(() =>
      assessPracticeReviews([], "2026-08-27", -1),
    ).toThrow("upcomingWindowDays");
  });
});
