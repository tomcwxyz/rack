export type CopyContext = "ordinary" | "advanced";
export type CopySeverity = "error" | "warning";

export type CopyRuleId =
  | "british-english"
  | "technical-jargon"
  | "hype-language"
  | "dashboard-language"
  | "long-sentence";

export type CopyIssue = {
  rule: CopyRuleId;
  severity: CopySeverity;
  message: string;
  term?: string;
};

export type CopyCheckOptions = {
  context?: CopyContext;
  maxSentenceWords?: number;
  allowedTerms?: readonly string[];
};

type TermRule = {
  pattern: RegExp;
  preferred?: string;
  label: string;
};

const britishEnglishRules: readonly TermRule[] = [
  { pattern: /\borganization(s)?\b/gi, preferred: "organisation", label: "organization" },
  { pattern: /\borganizational\b/gi, preferred: "organisational", label: "organizational" },
  { pattern: /\bcustomiz(e|ed|es|ing|ation)\b/gi, preferred: "customise", label: "customize" },
  { pattern: /\bcolor(s|ed|ing)?\b/gi, preferred: "colour", label: "color" },
  { pattern: /\bcenter(ed|ing|s)?\b/gi, preferred: "centre", label: "center" },
  { pattern: /\bprioritiz(e|ed|es|ing|ation)\b/gi, preferred: "prioritise", label: "prioritize" },
];

const ordinaryTechnicalTerms: readonly TermRule[] = [
  { pattern: /\bfrontmatter\b/gi, label: "frontmatter" },
  { pattern: /\bdependency graph(s)?\b/gi, label: "dependency graph" },
  { pattern: /\bschema version(s)?\b/gi, label: "schema version" },
  { pattern: /\bsemantic version(s|ing)?\b/gi, label: "semantic version" },
  { pattern: /\btoken budget(s)?\b/gi, label: "token budget" },
  { pattern: /\btokenisation\b/gi, label: "tokenisation" },
  { pattern: /\bYAML\b/g, label: "YAML" },
  { pattern: /\bJSON\b/g, label: "JSON" },
  { pattern: /\bGit\b/g, label: "Git" },
];

const hypeTerms: readonly TermRule[] = [
  { pattern: /\bseamless(?:ly)?\b/gi, label: "seamless" },
  { pattern: /\bsupercharg(?:e|ed|es|ing)\b/gi, label: "supercharge" },
  { pattern: /\brevolutionary\b/gi, label: "revolutionary" },
  { pattern: /\bAI-powered\b/gi, label: "AI-powered" },
  { pattern: /\bunlock(?:s|ed|ing)? potential\b/gi, label: "unlock potential" },
];

const dashboardTerms: readonly TermRule[] = [
  { pattern: /\bdashboard(s)?\b/gi, label: "dashboard" },
  { pattern: /\bKPI(?:s)?\b/g, label: "KPI" },
  { pattern: /\bcompliance score(s)?\b/gi, label: "compliance score" },
  { pattern: /\bcompletion rate(s)?\b/gi, label: "completion rate" },
];

const normalise = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const allowed = (
  value: string,
  allowedTerms: ReadonlySet<string>,
): boolean => allowedTerms.has(value.toLocaleLowerCase("en-GB"));

const termIssues = (
  text: string,
  rules: readonly TermRule[],
  rule: CopyRuleId,
  severity: CopySeverity,
  message: (matched: string, definition: TermRule) => string,
  allowedTerms: ReadonlySet<string>,
): CopyIssue[] => {
  const issues: CopyIssue[] = [];

  for (const definition of rules) {
    definition.pattern.lastIndex = 0;
    for (const match of text.matchAll(definition.pattern)) {
      const matched = match[0];
      if (allowed(matched, allowedTerms) || allowed(definition.label, allowedTerms)) {
        continue;
      }
      issues.push({
        rule,
        severity,
        term: matched,
        message: message(matched, definition),
      });
    }
  }

  return issues;
};

const sentenceIssues = (
  text: string,
  maxSentenceWords: number,
): CopyIssue[] => {
  const sentences = text
    .split(/[.!?]+(?:\s|$)/)
    .map(normalise)
    .filter(Boolean);
  const issues: CopyIssue[] = [];

  for (const sentence of sentences) {
    const words = sentence.match(/[\p{L}\p{N}’'-]+/gu) ?? [];
    if (words.length <= maxSentenceWords) continue;
    issues.push({
      rule: "long-sentence",
      severity: "warning",
      message: `This sentence has ${words.length} words. Aim for ${maxSentenceWords} or fewer on ordinary interface surfaces.`,
    });
  }

  return issues;
};

export const checkInterfaceCopy = (
  value: string,
  options: CopyCheckOptions = {},
): CopyIssue[] => {
  const text = normalise(value);
  if (!text) return [];

  const context = options.context ?? "ordinary";
  const maxSentenceWords = options.maxSentenceWords ?? 32;
  const allowedTerms = new Set(
    (options.allowedTerms ?? []).map((term) =>
      term.toLocaleLowerCase("en-GB"),
    ),
  );

  const issues: CopyIssue[] = [
    ...termIssues(
      text,
      britishEnglishRules,
      "british-english",
      "error",
      (matched, definition) =>
        `Use British English in interface copy: replace “${matched}” with “${definition.preferred}”.`,
      allowedTerms,
    ),
    ...termIssues(
      text,
      hypeTerms,
      "hype-language",
      "warning",
      (matched) =>
        `Replace “${matched}” with a concrete description of what Rack does.`,
      allowedTerms,
    ),
    ...termIssues(
      text,
      dashboardTerms,
      "dashboard-language",
      "warning",
      (matched) =>
        `Check whether “${matched}” is necessary. Prefer language about the work or decision rather than management-dashboard framing.`,
      allowedTerms,
    ),
    ...sentenceIssues(text, maxSentenceWords),
  ];

  if (context === "ordinary") {
    issues.push(
      ...termIssues(
        text,
        ordinaryTechnicalTerms,
        "technical-jargon",
        "error",
        (matched) =>
          `“${matched}” belongs in advanced/source UI unless it is explained in plain language.`,
        allowedTerms,
      ),
    );
  }

  return issues;
};

export const checkCopyCollection = (
  values: readonly string[],
  options: CopyCheckOptions = {},
): CopyIssue[] => values.flatMap((value) => checkInterfaceCopy(value, options));
