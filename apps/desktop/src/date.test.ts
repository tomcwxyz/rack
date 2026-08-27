import { describe, expect, it } from "vitest";
import { localCalendarDate } from "./date.js";

describe("localCalendarDate", () => {
  it("formats the browser-local calendar date without UTC conversion", () => {
    const date = new Date(2026, 7, 27, 23, 45, 0);
    expect(localCalendarDate(date)).toBe("2026-08-27");
  });
});
