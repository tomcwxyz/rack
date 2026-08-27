import { describe, expect, it } from "vitest";
import {
  checkCopyCollection,
  checkInterfaceCopy,
} from "../src/index.js";

describe("copy rules", () => {
  it("flags common US spellings", () => {
    expect(
      checkInterfaceCopy("Customize the organization color.").map(
        (issue) => issue.rule,
      ),
    ).toEqual([
      "british-english",
      "british-english",
      "british-english",
    ]);
  });

  it("accepts the British equivalents", () => {
    expect(
      checkInterfaceCopy("Customise the organisation colour."),
    ).toEqual([]);
  });

  it("keeps hidden technical language off ordinary surfaces", () => {
    expect(
      checkInterfaceCopy("Edit the YAML frontmatter and token budget.").filter(
        (issue) => issue.rule === "technical-jargon",
      ),
    ).toHaveLength(3);
  });

  it("allows technical language on advanced surfaces", () => {
    expect(
      checkInterfaceCopy("Edit the YAML frontmatter and token budget.", {
        context: "advanced",
      }).filter((issue) => issue.rule === "technical-jargon"),
    ).toHaveLength(0);
  });

  it("flags hype and dashboard framing", () => {
    const issues = checkCopyCollection([
      "A seamless AI-powered workflow.",
      "Track KPIs on the governance dashboard.",
    ]);
    expect(issues.map((issue) => issue.rule)).toContain("hype-language");
    expect(issues.map((issue) => issue.rule)).toContain("dashboard-language");
  });

  it("can explicitly allow a term in a specific surface", () => {
    expect(
      checkInterfaceCopy("Open the YAML source.", {
        allowedTerms: ["YAML"],
      }).filter((issue) => issue.rule === "technical-jargon"),
    ).toHaveLength(0);
  });

  it("warns on overly long interface sentences", () => {
    const issues = checkInterfaceCopy(
      "This deliberately overlong interface sentence keeps adding more words and more clauses so that the copy rule has enough material to show that a sentence can become difficult to scan quickly in a working interface.",
      { maxSentenceWords: 20 },
    );
    expect(issues.some((issue) => issue.rule === "long-sentence")).toBe(true);
  });
});
