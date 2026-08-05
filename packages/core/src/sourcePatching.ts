import { isMap, isScalar, parseDocument } from "yaml";
import type { RackModule } from "@rack/schemas";

export type ContextKind = Extract<
  RackModule,
  { type: "context" }
>["harness"]["context_kind"];

export type ContextModuleDraft = {
  title: string;
  description: string;
  contextKind: ContextKind;
  body: string;
};

export type VoiceAvoidEntry = {
  term: string;
  reason: string;
};

export type VoiceModuleDraft = {
  title: string;
  description: string;
  body: string;
  rules: string[];
  avoid: VoiceAvoidEntry[];
};

export type SourceDiffLine = {
  kind: "same" | "add" | "remove";
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

export type SourcePatchResult = {
  content: string;
  diff: SourceDiffLine[];
};

export class SourcePatchError extends Error {
  constructor(
    public readonly code:
      | "RACK-PATCH-FORMAT"
      | "RACK-PATCH-YAML"
      | "RACK-PATCH-TYPE"
      | "RACK-PATCH-VALUE",
    message: string,
  ) {
    super(message);
    this.name = "SourcePatchError";
  }
}

type MarkdownSourceParts = {
  bom: string;
  newline: "\n" | "\r\n";
  frontmatter: string;
  body: string;
  trailingNewline: boolean;
};

type FrontmatterDocument = ReturnType<typeof parseDocument>;

const contextKinds: ContextKind[] = [
  "organisation",
  "audience",
  "domain",
  "project",
  "reference",
];

const splitMarkdownSource = (source: string): MarkdownSourceParts => {
  const bom = source.startsWith("\uFEFF") ? "\uFEFF" : "";
  const withoutBom = bom ? source.slice(1) : source;
  const newline = withoutBom.includes("\r\n") ? "\r\n" : "\n";
  const normalised = withoutBom.replace(/\r\n?/g, "\n");
  const lines = normalised.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new SourcePatchError(
      "RACK-PATCH-FORMAT",
      "Guided editing needs a Markdown instruction that begins with YAML frontmatter marked by ---. Use the advanced source editor for this file.",
    );
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex < 0) {
    throw new SourcePatchError(
      "RACK-PATCH-FORMAT",
      "The instruction frontmatter has no closing --- marker. Use the advanced source editor to repair it first.",
    );
  }

  return {
    bom,
    newline,
    frontmatter: lines.slice(1, closingIndex).join("\n"),
    body: lines.slice(closingIndex + 1).join("\n"),
    trailingNewline: normalised.endsWith("\n"),
  };
};

const parseFrontmatterDocument = (frontmatter: string): FrontmatterDocument => {
  const document = parseDocument(frontmatter, {
    keepSourceTokens: true,
    prettyErrors: true,
  });

  if (document.errors.length > 0 || !isMap(document.contents)) {
    const detail = document.errors.map((error) => error.message).join("; ");
    throw new SourcePatchError(
      "RACK-PATCH-YAML",
      detail ||
        "The instruction frontmatter is not a YAML mapping. Use the advanced source editor for this file.",
    );
  }

  return document;
};

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

const recordValue = (
  value: unknown,
  explanation: string,
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SourcePatchError("RACK-PATCH-VALUE", explanation);
  }
  return value as Record<string, unknown>;
};

const setScalarValue = (
  document: FrontmatterDocument,
  path: [string] | [string, string],
  value: unknown,
): void => {
  const existing =
    path.length === 1
      ? document.get(path[0], true)
      : document.getIn(path, true);
  if (isScalar(existing)) {
    existing.value = value;
  } else if (path.length === 1) {
    document.set(path[0], value);
  } else {
    document.setIn(path, value);
  }
};

const serialisePatchedSource = (
  source: string,
  parts: MarkdownSourceParts,
  document: FrontmatterDocument,
  body: string,
): SourcePatchResult => {
  const yaml = document.toString({ lineWidth: 0 }).trimEnd();
  const normalised = [
    "---",
    yaml,
    "---",
    body.trimEnd(),
    ...(parts.trailingNewline ? [""] : []),
  ].join("\n");
  const content = `${parts.bom}${normalised.replace(/\n/g, parts.newline)}`;
  return { content, diff: diffSourceLines(source, content) };
};

export const readContextModuleDraft = (source: string): ContextModuleDraft => {
  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);

  if (document.get("type") !== "context") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports context instructions. Use the advanced source editor for this file.",
    );
  }

  const contextKind = document.getIn(["harness", "context_kind"]);
  if (
    typeof contextKind !== "string" ||
    !contextKinds.includes(contextKind as ContextKind)
  ) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "This context instruction has an unsupported context kind. Use the advanced source editor for this file.",
    );
  }

  return {
    title: stringValue(document.get("title")),
    description: stringValue(document.get("description")),
    contextKind: contextKind as ContextKind,
    body: parts.body.replace(/\n$/, ""),
  };
};

const assertContextDraft = (draft: ContextModuleDraft): void => {
  if (!draft.title.trim()) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The instruction title cannot be empty.",
    );
  }
  if (!contextKinds.includes(draft.contextKind)) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Choose a supported context kind.",
    );
  }
  if (!draft.body.trim()) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The context itself cannot be empty.",
    );
  }
};

export const readVoiceModuleDraft = (source: string): VoiceModuleDraft => {
  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);
  const data = recordValue(
    document.toJS(),
    "The voice instruction frontmatter could not be read as structured data.",
  );

  if (data.type !== "voice") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports voice instructions. Use the advanced source editor for this file.",
    );
  }

  const harness = recordValue(
    data.harness,
    "The voice instruction has no readable harness settings.",
  );
  const lexicon = recordValue(
    harness.lexicon ?? {},
    "The voice instruction lexicon is not a mapping. Use the advanced source editor for this file.",
  );
  const rawRules = lexicon.rules ?? [];
  if (!Array.isArray(rawRules) || rawRules.some((rule) => typeof rule !== "string")) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Voice rules must be a list of text values. Use the advanced source editor for this file.",
    );
  }

  const rawAvoid = lexicon.avoid ?? [];
  if (!Array.isArray(rawAvoid)) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Avoided language must be a list. Use the advanced source editor for this file.",
    );
  }

  const avoid = rawAvoid.map((entry) => {
    const item = recordValue(
      entry,
      "An avoided-language entry is not structured correctly. Use the advanced source editor for this file.",
    );
    if (typeof item.term !== "string") {
      throw new SourcePatchError(
        "RACK-PATCH-VALUE",
        "Every avoided-language entry needs a text term.",
      );
    }
    return {
      term: item.term,
      reason: typeof item.reason === "string" ? item.reason : "",
    };
  });

  return {
    title: stringValue(data.title),
    description: stringValue(data.description),
    body: parts.body.replace(/\n$/, ""),
    rules: rawRules as string[],
    avoid,
  };
};

const assertVoiceDraft = (draft: VoiceModuleDraft): void => {
  if (!draft.title.trim()) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The instruction title cannot be empty.",
    );
  }
  if (!draft.body.trim()) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The voice guidance cannot be empty.",
    );
  }
  if (draft.avoid.some((entry) => !entry.term.trim())) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Every avoided-language row needs a term, or the empty row should be removed.",
    );
  }
};

export const diffSourceLines = (
  before: string,
  after: string,
): SourceDiffLine[] => {
  const oldLines = before.replace(/\r\n?/g, "\n").split("\n");
  const newLines = after.replace(/\r\n?/g, "\n").split("\n");
  const lengths = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0),
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex]![newIndex] =
        oldLines[oldIndex] === newLines[newIndex]
          ? lengths[oldIndex + 1]![newIndex + 1]! + 1
          : Math.max(
              lengths[oldIndex + 1]![newIndex]!,
              lengths[oldIndex]![newIndex + 1]!,
            );
    }
  }

  const output: SourceDiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      output.push({
        kind: "same",
        text: oldLines[oldIndex]!,
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      lengths[oldIndex + 1]![newIndex]! >=
      lengths[oldIndex]![newIndex + 1]!
    ) {
      output.push({
        kind: "remove",
        text: oldLines[oldIndex]!,
        oldLine: oldIndex + 1,
        newLine: null,
      });
      oldIndex += 1;
    } else {
      output.push({
        kind: "add",
        text: newLines[newIndex]!,
        oldLine: null,
        newLine: newIndex + 1,
      });
      newIndex += 1;
    }
  }

  while (oldIndex < oldLines.length) {
    output.push({
      kind: "remove",
      text: oldLines[oldIndex]!,
      oldLine: oldIndex + 1,
      newLine: null,
    });
    oldIndex += 1;
  }
  while (newIndex < newLines.length) {
    output.push({
      kind: "add",
      text: newLines[newIndex]!,
      oldLine: null,
      newLine: newIndex + 1,
    });
    newIndex += 1;
  }

  return output;
};

export const patchContextModuleSource = (
  source: string,
  draft: ContextModuleDraft,
): SourcePatchResult => {
  assertContextDraft(draft);
  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);

  if (document.get("type") !== "context") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports context instructions. Use the advanced source editor for this file.",
    );
  }

  setScalarValue(document, ["title"], draft.title.trim());
  setScalarValue(
    document,
    ["description"],
    draft.description.trim() ? draft.description.trim() : null,
  );
  setScalarValue(document, ["harness", "context_kind"], draft.contextKind);

  return serialisePatchedSource(source, parts, document, draft.body);
};

export const patchVoiceModuleSource = (
  source: string,
  draft: VoiceModuleDraft,
): SourcePatchResult => {
  assertVoiceDraft(draft);
  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);

  if (document.get("type") !== "voice") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports voice instructions. Use the advanced source editor for this file.",
    );
  }

  setScalarValue(document, ["title"], draft.title.trim());
  setScalarValue(
    document,
    ["description"],
    draft.description.trim() ? draft.description.trim() : null,
  );
  document.setIn(
    ["harness", "lexicon", "rules"],
    draft.rules.map((rule) => rule.trim()).filter(Boolean),
  );
  document.setIn(
    ["harness", "lexicon", "avoid"],
    draft.avoid.map((entry) => ({
      term: entry.term.trim(),
      ...(entry.reason.trim() ? { reason: entry.reason.trim() } : {}),
    })),
  );

  return serialisePatchedSource(source, parts, document, draft.body);
};
