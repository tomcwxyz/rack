import { describe, expect, it } from "vitest";
import {
  practiceAuthoritySchema,
  practiceSourceSchema,
} from "../src/practice.js";

describe("practice source schemas", () => {
  it("defaults authority to adaptable shared practice", () => {
    expect(practiceAuthoritySchema.parse({})).toEqual({
      mode: "adaptable",
      propagation: "shared",
    });
  });

  it("accepts a binding authority with rationale and review date", () => {
    expect(
      practiceAuthoritySchema.safeParse({
        mode: "binding",
        propagation: "shared",
        rationale: "Public claims must remain traceable.",
        review_after: "2027-02-01",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed review dates", () => {
    expect(
      practiceAuthoritySchema.safeParse({
        review_after: "1 February 2027",
      }).success,
    ).toBe(false);
  });

  it("accepts local, Starter, shared-file and Git source kinds", () => {
    for (const kind of ["local", "starter", "shared-file", "git"] as const) {
      expect(
        practiceSourceSchema.safeParse({
          id: `source-${kind}`,
          label: kind,
          kind,
          precedence: 10,
        }).success,
      ).toBe(true);
    }
  });
});
