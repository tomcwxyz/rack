import { describe, expect, it } from "vitest";
import { moduleFrontmatterSchema } from "../src/index.js";
import {
  practiceAuthoritySchema,
  practiceDateSchema,
  practiceSourceSchema,
  sharedPracticeFileSchema,
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

  it("rejects impossible calendar dates as well as malformed review dates", () => {
    expect(practiceDateSchema.safeParse("2027-02-29").success).toBe(false);
    expect(practiceDateSchema.safeParse("2028-02-29").success).toBe(true);


    expect(
      practiceAuthoritySchema.safeParse({
        review_after: "1 February 2027",
      }).success,
    ).toBe(false);
  });

  it("accepts authority on a v0.2 module", () => {
    const result = moduleFrontmatterSchema.safeParse({
      type: "context",
      title: "Evidence context",
      harness: {
        schema_version: "0.2",
        id: "context.evidence",
        version: "0.2.0",
        authority: {
          mode: "binding",
          propagation: "shared",
          rationale: "Evidence boundaries are shared practice.",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.harness.authority?.mode).toBe("binding");
    }
  });

  it("rejects authority on a v0.1 module", () => {
    expect(
      moduleFrontmatterSchema.safeParse({
        type: "context",
        title: "Evidence context",
        harness: {
          schema_version: "0.1",
          id: "context.evidence",
          version: "0.1.0",
          authority: {
            mode: "binding",
            propagation: "shared",
          },
        },
      }).success,
    ).toBe(false);
  });

  it("accepts an inspectable shared practice file envelope", () => {
    const result = sharedPracticeFileSchema.safeParse({
      format: "rack.shared-practice",
      schema_version: "0.1",
      id: "good-ship",
      version: "0.1.0",
      title: "The Good Ship practice",
      published_by: { name: "The Good Ship" },
      instructions: [
        {
          type: "context",
          title: "Example",
          harness: {
            schema_version: "0.2",
            id: "context.example",
            version: "0.2.0",
          },
          body: "Example context.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("keeps source file path and content version in receiver metadata", () => {
    expect(
      practiceSourceSchema.safeParse({
        id: "good-ship-org",
        label: "The Good Ship",
        kind: "shared-file",
        precedence: 10,
        path: "/shared/good-ship.rack.yaml",
        version: "0.1.0",
      }).success,
    ).toBe(true);
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
