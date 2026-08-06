import { isMap, isScalar, parseDocument } from "yaml";
import type { RackModule } from "@rack/schemas";
import {
  diffSourceLines,
  SourcePatchError,
  type SourcePatchResult,
} from "./sourcePatching.js";

export type GuardrailRuleDraft = {
  id: string;
  statement: string;
  refusal: string;
};

export type GuardrailModuleDraft = {
  title: string;
  description: string;
  body: string;
  rules: GuardrailRuleDraft[];
};

export type TaskInputDraft = {
  name: string;
  label: string;
  type: "string" | "markdown" | "number" | "boolean";
  required: boolean;
};

export type TaskStageDraft = {
  id: string;
  label: string;
};

export type TaskModuleDraft = {
  title: string;
  description: string;
  body: string;
  command: string;
  label: string;
  inputs: TaskInputDraft[];
  stages: TaskStageDraft[];
};

type MarkdownSourceParts = {
  bom: string;
  newline: "\n" | "\r\n";
  frontmatter: string;
  body: string;
  trailingNewline: boolean;
};

type FrontmatterDocument = ReturnType<typeof parseDocument>;

const slugPattern = /^[a-z][a-z0-9-]*$/;

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

const setScalarValue = (
  document: FrontmatterDocument,
  path: [string] | [string, string] | [string, string, string],
  value: unknown,
): void => {
  const existing = document.getIn(path, true);
  if (isScalar(existing)) existing.value = value;
  else document.setIn(path, value);
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

const assertTitleAndBody = (title: string, body: string, bodyLabel: string): void => {
  if (!title.trim()) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The instruction title cannot be empty.",
    );
  }
  if (!body.trim()) {
    throw new SourcePatchError("RACK-PATCH-VALUE", `${bodyLabel} cannot be empty.`);
  }
};

const assertUniqueSlugs = (values: string[], label: string): void => {
  const cleaned = values.map((value) => value.trim());
  if (cleaned.some((value) => !slugPattern.test(value))) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      `${label} must use lowercase letters, numbers and hyphens, and begin with a letter.`,
    );
  }
  if (new Set(cleaned).size !== cleaned.length) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      `${label} must be unique within this instruction.`,
    );
  }
};

export const readGuardrailModuleDraft = (
  source: string,
): GuardrailModuleDraft => {
  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);
  const data = recordValue(
    document.toJS(),
    "The boundary instruction frontmatter could not be read as structured data.",
  );

  if (data.type !== "guardrail") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports boundary instructions. Use the advanced source editor for this file.",
    );
  }

  const harness = recordValue(
    data.harness,
    "The boundary instruction has no readable harness settings.",
  );
  const rawRules = harness.rules ?? [];
  if (!Array.isArray(rawRules)) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Boundary rules must be a list. Use the advanced source editor for this file.",
    );
  }

  const rules = rawRules.map((entry) => {
    const item = recordValue(
      entry,
      "A boundary rule is not structured correctly. Use the advanced source editor for this file.",
    );
    return {
      id: stringValue(item.id),
      statement: stringValue(item.statement),
      refusal: stringValue(item.refusal),
    };
  });

  return {
    title: stringValue(data.title),
    description: stringValue(data.description),
    body: parts.body.replace(/\n$/, ""),
    rules,
  };
};

export const patchGuardrailModuleSource = (
  source: string,
  draft: GuardrailModuleDraft,
): SourcePatchResult => {
  assertTitleAndBody(draft.title, draft.body, "The boundary guidance");
  if (draft.rules.some((rule) => !rule.statement.trim())) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Every boundary rule needs a statement, or the empty rule should be removed.",
    );
  }
  assertUniqueSlugs(
    draft.rules.map((rule) => rule.id),
    "Boundary rule IDs",
  );

  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);
  if (document.get("type") !== "guardrail") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports boundary instructions. Use the advanced source editor for this file.",
    );
  }

  setScalarValue(document, ["title"], draft.title.trim());
  setScalarValue(
    document,
    ["description"],
    draft.description.trim() ? draft.description.trim() : null,
  );
  document.setIn(
    ["harness", "rules"],
    draft.rules.map((rule) => ({
      id: rule.id.trim(),
      statement: rule.statement.trim(),
      ...(rule.refusal.trim() ? { refusal: rule.refusal.trim() } : {}),
    })),
  );

  return serialisePatchedSource(source, parts, document, draft.body);
};

export const readTaskModuleDraft = (source: string): TaskModuleDraft => {
  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);
  const data = recordValue(
    document.toJS(),
    "The task instruction frontmatter could not be read as structured data.",
  );

  if (data.type !== "task") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports repeatable tasks. Use the advanced source editor for this file.",
    );
  }

  const harness = recordValue(
    data.harness,
    "The task instruction has no readable harness settings.",
  );
  const trigger = recordValue(
    harness.trigger,
    "The task trigger is not structured correctly. Use the advanced source editor for this file.",
  );
  const rawInputs = harness.inputs ?? [];
  const rawStages = harness.stages ?? [];
  if (!Array.isArray(rawInputs) || !Array.isArray(rawStages)) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Task inputs and stages must be lists. Use the advanced source editor for this file.",
    );
  }

  const inputs = rawInputs.map((entry) => {
    const item = recordValue(
      entry,
      "A task input is not structured correctly. Use the advanced source editor for this file.",
    );
    const type = item.type;
    if (
      type !== "string" &&
      type !== "markdown" &&
      type !== "number" &&
      type !== "boolean"
    ) {
      throw new SourcePatchError(
        "RACK-PATCH-VALUE",
        "A task input uses an unsupported type. Use the advanced source editor for this file.",
      );
    }
    return {
      name: stringValue(item.name),
      label: stringValue(item.label),
      type,
      required: item.required === true,
    };
  });

  const stages = rawStages.map((entry) => {
    const item = recordValue(
      entry,
      "A task stage is not structured correctly. Use the advanced source editor for this file.",
    );
    return { id: stringValue(item.id), label: stringValue(item.label) };
  });

  return {
    title: stringValue(data.title),
    description: stringValue(data.description),
    body: parts.body.replace(/\n$/, ""),
    command: stringValue(trigger.command),
    label: stringValue(trigger.label),
    inputs,
    stages,
  };
};

export const patchTaskModuleSource = (
  source: string,
  draft: TaskModuleDraft,
): SourcePatchResult => {
  assertTitleAndBody(draft.title, draft.body, "The task instructions");
  if (!draft.label.trim()) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The task needs a visible label.",
    );
  }
  if (draft.command.trim() && !slugPattern.test(draft.command.trim())) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "The command must use lowercase letters, numbers and hyphens, and begin with a letter.",
    );
  }
  if (draft.inputs.some((input) => !input.label.trim())) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Every task input needs a label, or the empty input should be removed.",
    );
  }
  if (draft.stages.some((stage) => !stage.label.trim())) {
    throw new SourcePatchError(
      "RACK-PATCH-VALUE",
      "Every task stage needs a label, or the empty stage should be removed.",
    );
  }
  assertUniqueSlugs(
    draft.inputs.map((input) => input.name),
    "Task input names",
  );
  assertUniqueSlugs(
    draft.stages.map((stage) => stage.id),
    "Task stage IDs",
  );

  const parts = splitMarkdownSource(source);
  const document = parseFrontmatterDocument(parts.frontmatter);
  if (document.get("type") !== "task") {
    throw new SourcePatchError(
      "RACK-PATCH-TYPE",
      "This guided editor only supports repeatable tasks. Use the advanced source editor for this file.",
    );
  }

  setScalarValue(document, ["title"], draft.title.trim());
  setScalarValue(
    document,
    ["description"],
    draft.description.trim() ? draft.description.trim() : null,
  );
  setScalarValue(document, ["harness", "trigger", "label"], draft.label.trim());
  if (draft.command.trim()) {
    setScalarValue(
      document,
      ["harness", "trigger", "command"],
      draft.command.trim(),
    );
  } else {
    document.deleteIn(["harness", "trigger", "command"]);
  }
  document.setIn(
    ["harness", "inputs"],
    draft.inputs.map((input) => ({
      name: input.name.trim(),
      label: input.label.trim(),
      type: input.type,
      required: input.required,
    })),
  );
  document.setIn(
    ["harness", "stages"],
    draft.stages.map((stage) => ({
      id: stage.id.trim(),
      label: stage.label.trim(),
    })),
  );

  return serialisePatchedSource(source, parts, document, draft.body);
};

export type GuidedStructuredModule = Extract<
  RackModule,
  { type: "guardrail" | "task" }
>;
