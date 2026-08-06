import { isMap, isScalar, parseDocument } from "yaml";
import {
  diffSourceLines,
  SourcePatchError,
  type SourcePatchResult,
} from "./sourcePatching.js";

export type SetupBudgetDraft = {
  target: string;
  recommendedTokens: number;
  maximumTokens: number;
};

export type SetupDraft = {
  title: string;
  description: string;
  domains: string[];
  include: string[];
  exclude: string[];
  budgets: SetupBudgetDraft[];
};

type FrontmatterDocument = ReturnType<typeof parseDocument>;

const slugPattern = /^[a-z][a-z0-9-]*$/;
const moduleIdPattern = /^(?:@[a-z][a-z0-9-]*\/)?[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

const recordValue = (
  value: unknown,
  explanation: string,
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SourcePatchError("RACK-PATCH-VALUE", explanation);
  }
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

const stringList = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      `${label} must be a list of text values. Use the advanced source editor for this Set-up.`,
    );
  }
  return value as string[];
};

const parseSetupDocument = (source: string): FrontmatterDocument => {
  const document = parseDocument(source.replace(/^\uFEFF/, ""), {
    keepSourceTokens: true,
    prettyErrors: true,
  });
  if (document.errors.length > 0 || !isMap(document.contents)) {
    const detail = document.errors.map((error) => error.message).join("; ");
    throw new SourcePatchError(
      "RACK-PATCH-YAML",
      detail ||
        "The Set-up is not a YAML mapping. Use the advanced source editor to repair it first.",
    );
  }
  return document;
};

const setScalarValue = (
  document: FrontmatterDocument,
  path: [string],
  value: unknown,
): void => {
  const existing = document.getIn(path, true);
  if (isScalar(existing)) existing.value = value;
  else document.setIn(path, value);
};

const unique = (values: string[]): boolean => new Set(values).size === values.length;

const assertSetupDraft = (draft: SetupDraft): void => {
  if (!draft.title.trim()) {
    throw new SourcePatchError("RACK-PATCH-VALUE", "The Set-up title cannot be empty.");
  }

  const domains = draft.domains.map((value) => value.trim()).filter(Boolean);
  if (domains.length === 0) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "A Set-up needs at least one work domain.",
    );
  }
  if (domains.some((value) => !slugPattern.test(value)) || !unique(domains)) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Work domains must be unique lowercase slugs using letters, numbers and hyphens.",
    );
  }

  const include = draft.include.map((value) => value.trim());
  const exclude = draft.exclude.map((value) => value.trim());
  if (
    include.some((value) => !moduleIdPattern.test(value)) ||
    exclude.some((value) => !moduleIdPattern.test(value)) ||
    !unique(include) ||
    !unique(exclude)
  ) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Included and excluded instruction IDs must be valid and unique.",
    );
  }
  const excluded = new Set(exclude);
  if (include.some((value) => excluded.has(value))) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "An instruction cannot be both included and excluded.",
    );
  }

  const targets = draft.budgets.map((budget) => budget.target.trim());
  if (targets.some((value) => !slugPattern.test(value)) || !unique(targets)) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Budget destinations must be unique lowercase slugs.",
    );
  }
  if (
    draft.budgets.some(
      (budget) =>
        !Number.isInteger(budget.recommendedTokens) ||
        !Number.isInteger(budget.maximumTokens) ||
        budget.recommendedTokens <= 0 ||
        budget.maximumTokens < budget.recommendedTokens,
    )
  ) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Every budget needs positive whole numbers, with the maximum at least as large as the recommendation.",
    );
  }
};

export const readSetupDraft = (source: string): SetupDraft => {
  const document = parseSetupDocument(source);
  const data = recordValue(
    document.toJS(),
    "The Set-up could not be read as structured data.",
  );
  const rawBudgets = recordValue(
    data.budgets ?? {},
    "Set-up budgets must be a mapping. Use the advanced source editor for this Set-up.",
  );

  const budgets = Object.entries(rawBudgets).map(([target, value]) => {
    const budget = recordValue(
      value,
      `The ${target} budget is not structured correctly.`,
    );
    const recommendedTokens = Number(budget.recommended_tokens);
    const maximumTokens = Number(budget.maximum_tokens);
    if (!Number.isFinite(recommendedTokens) || !Number.isFinite(maximumTokens)) {
      throw new SourcePatchError(
        "RACK-PATCH-VALUE",
        `The ${target} budget must contain numeric token values.`,
      );
    }
    return { target, recommendedTokens, maximumTokens };
  });

  return {
    title: stringValue(data.title),
    description: stringValue(data.description),
    domains: stringList(data.domains, "Work domains"),
    include: stringList(data.include ?? [], "Included instructions"),
    exclude: stringList(data.exclude ?? [], "Excluded instructions"),
    budgets,
  };
};

export const patchSetupSource = (
  source: string,
  draft: SetupDraft,
): SourcePatchResult => {
  assertSetupDraft(draft);
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const withoutBom = bom ? source.slice(1) : source;
  const newline = withoutBom.includes("\r\n") ? "\r\n" : "\n";
  const trailingNewline = /(?:\r?\n)$/.test(withoutBom);
  const document = parseSetupDocument(source);

  setScalarValue(document, ["title"], draft.title.trim());
  setScalarValue(document, ["description"], draft.description.trim());
  document.set("domains", draft.domains.map((value) => value.trim()).filter(Boolean));
  document.set("include", draft.include.map((value) => value.trim()));
  document.set("exclude", draft.exclude.map((value) => value.trim()));
  document.set(
    "budgets",
    Object.fromEntries(
      draft.budgets.map((budget) => [
        budget.target.trim(),
        {
          recommended_tokens: budget.recommendedTokens,
          maximum_tokens: budget.maximumTokens,
        },
      ]),
    ),
  );

  const normalised = document.toString({ lineWidth: 0 }).trimEnd();
  const content = `${bom}${normalised.replace(/\n/g, newline)}${trailingNewline ? newline : ""}`;
  return { content, diff: diffSourceLines(source, content) };
};
