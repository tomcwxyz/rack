import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { checkInterfaceCopy, type CopyContext } from "../src/index.js";

type Surface = {
  path: string;
  context: CopyContext;
};

const surfaces: readonly Surface[] = [
  { path: "RouteChooser.tsx", context: "ordinary" },
  { path: "PracticeProposition.tsx", context: "ordinary" },
  { path: "WritingRoute.tsx", context: "ordinary" },
  { path: "ResearchRoute.tsx", context: "ordinary" },
  { path: "CodingRoute.tsx", context: "ordinary" },
  { path: "ProjectWorkspace.tsx", context: "ordinary" },
  { path: "RackSection.tsx", context: "ordinary" },
  { path: "SharedPracticeSection.tsx", context: "ordinary" },
  { path: "SharedPracticePublisher.tsx", context: "ordinary" },
  { path: "SetupsSection.tsx", context: "advanced" },
  { path: "PreviewSection.tsx", context: "advanced" },
  { path: "ChecksSection.tsx", context: "advanced" },
];

const copyPropertyNames = new Set([
  "title",
  "intro",
  "description",
  "status",
  "label",
  "placeholder",
  "summary",
  "detail",
]);

const copyAttributeNames = new Set([
  "aria-label",
  "placeholder",
  "title",
]);

const stringValue = (node: ts.Node): string | null => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
};

const propertyName = (name: ts.PropertyName): string | null => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
};

const collectCopy = (sourceText: string, fileName: string): string[] => {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const output: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, " ").trim();
      if (value) output.push(value);
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (
        copyAttributeNames.has(name) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        output.push(node.initializer.text);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      const value = stringValue(node.initializer);
      if (name && copyPropertyNames.has(name) && value) output.push(value);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["onStatus", "setError", "setActionStatus"].includes(node.expression.text)
    ) {
      const value = node.arguments[0] ? stringValue(node.arguments[0]) : null;
      if (value) output.push(value);
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return output;
};

describe("desktop interface copy", () => {
  for (const surface of surfaces) {
    it(`${surface.path} stays within the interface copy rules`, () => {
      const url = new URL(
        `../../../apps/desktop/src/components/${surface.path}`,
        import.meta.url,
      );
      const sourceText = readFileSync(url, "utf8");
      const copy = collectCopy(sourceText, surface.path);
      const issues = copy.flatMap((value) =>
        checkInterfaceCopy(value, {
          context: surface.context,
          maxSentenceWords: 40,
          allowedTerms:
            surface.context === "advanced"
              ? ["YAML", "JSON", "Git"]
              : [],
        }).map((issue) => ({ value, ...issue })),
      );

      expect(issues).toEqual([]);
    });
  }
});
