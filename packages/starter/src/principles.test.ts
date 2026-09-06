import { describe, expect, it } from "vitest";
import { honeyStarterCatalogue } from "./honey.js";
import {
  PRACTICE_PRINCIPLES,
  getStarterPracticePrinciples,
} from "./principles.js";

describe("practice principle mapping", () => {
  it("maps every Honey Starter entry to at least one stable practice principle", () => {
    for (const entry of honeyStarterCatalogue) {
      expect(getStarterPracticePrinciples(entry.id).length, entry.id).toBeGreaterThan(0);
    }
  });

  it("uses the same preserve-safety ID that Ship Check can return as evidence", () => {
    expect(getStarterPracticePrinciples("@rack-starter/honey.guardrail.no-false-economy")).toContain(
      PRACTICE_PRINCIPLES.preserveSafety,
    );
  });
});
