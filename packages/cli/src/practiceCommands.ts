import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import type { Command } from "commander";
import {
  createSharedPracticePublication,
  type Diagnostic,
} from "@rack/core";
import {
  openProject,
  readSharedPracticeFile,
} from "@rack/core/node";

const printDiagnostics = (diagnostics: readonly Diagnostic[]): void => {
  for (const item of diagnostics) {
    const output = `${item.code} ${item.title}\n${item.message}\n\n`;
    if (item.severity === "error") process.stderr.write(output);
    else process.stdout.write(output);
  }
};

const collectModule = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

const isMissing = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as Error & { code?: string }).code === "ENOENT";

export const writePublicationFile = async (
  filePath: string,
  content: string,
  force = false,
): Promise<string> => {
  const destination = path.resolve(filePath);
  const parent = path.dirname(destination);
  await fs.mkdir(parent, { recursive: true });

  let existing = false;
  try {
    const metadata = await fs.lstat(destination);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(
        "Rack will only replace an ordinary shared-practice file.",
      );
    }
    if (!force) {
      throw new Error(
        `${destination} already exists. Use --force only after reviewing the new publication.`,
      );
    }
    existing = true;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const suffix = `${process.pid}-${Date.now()}`;
  const temporary = path.join(
    parent,
    `.${path.basename(destination)}.${suffix}.tmp`,
  );
  const backup = path.join(
    parent,
    `.${path.basename(destination)}.${suffix}.bak`,
  );

  await fs.writeFile(temporary, content, { encoding: "utf8", flag: "wx" });

  try {
    if (existing) {
      await fs.rename(destination, backup);
    }

    try {
      await fs.rename(temporary, destination);
    } catch (error) {
      if (existing) {
        await fs.rename(backup, destination).catch(() => undefined);
      }
      throw error;
    }

    if (existing) {
      await fs.rm(backup, { force: true });
    }

    return destination;
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};

const publicationSummary = (
  modules: readonly {
    harness: {
      id: string;
      criticality: "required" | "recommended" | "optional";
      authority?: {
        mode: "adaptable" | "binding";
        review_after?: string;
      };
      experiment?: { question: string };
    };
    title: string;
    type: string;
  }[],
) => ({
  instructions: modules.length,
  binding: modules.filter(
    (module) => module.harness.authority?.mode === "binding",
  ).length,
  adaptable: modules.filter(
    (module) => module.harness.authority?.mode !== "binding",
  ).length,
  experiments: modules.filter((module) => module.harness.experiment).length,
  reviews: modules.filter((module) => module.harness.authority?.review_after)
    .length,
});

export const registerPracticeCommands = (program: Command): void => {
  const practice = program
    .command("practice")
    .description("Inspect and publish shared working practice.");

  practice
    .command("inspect")
    .description("Validate and inspect a shared-practice file.")
    .argument("<file>", "Shared-practice .rack.yaml file")
    .option("--json", "Print machine-readable JSON")
    .action(async (filePath: string, options: { json?: boolean }) => {
      try {
        const result = await readSharedPracticeFile(filePath, {
          sourceId: "cli-inspect",
          relationship: "other",
          precedence: 10,
          label: "CLI inspection",
        });
        const summary = publicationSummary(result.modules);

        if (options.json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                valid: !result.blocked,
                document: result.document,
                summary,
                modules: result.modules.map((module) => ({
                  id: module.harness.id,
                  title: module.title,
                  type: module.type,
                  criticality: module.harness.criticality,
                  authority: module.harness.authority?.mode ?? "adaptable",
                  reviewAfter:
                    module.harness.authority?.review_after ?? null,
                  experiment:
                    module.harness.experiment?.question ?? null,
                })),
                diagnostics: result.diagnostics,
              },
              null,
              2,
            )}\n`,
          );
        } else if (result.blocked || !result.document) {
          printDiagnostics(result.diagnostics);
        } else {
          const publisher =
            result.document.published_by.organisation ??
            result.document.published_by.name;
          process.stdout.write(
            `${result.document.title} · ${result.document.version}\n`,
          );
          process.stdout.write(`Published by ${publisher}\n`);
          process.stdout.write(
            `${summary.instructions} instructions · ${summary.binding} binding · ${summary.adaptable} adaptable`,
          );
          if (summary.experiments > 0) {
            process.stdout.write(` · ${summary.experiments} experiments`);
          }
          if (summary.reviews > 0) {
            process.stdout.write(` · ${summary.reviews} review dates`);
          }
          process.stdout.write("\n");
          printDiagnostics(result.diagnostics);
        }

        process.exitCode = result.blocked ? 1 : 0;
      } catch (error) {
        process.stderr.write(
          `${error instanceof Error ? error.message : "Unable to inspect shared practice."}\n`,
        );
        process.exitCode = 3;
      }
    });

  practice
    .command("export")
    .description(
      "Publish explicitly selected Rack instructions as one shared-practice file.",
    )
    .argument("[path]", "Rack project folder", ".")
    .requiredOption("--id <id>", "Shared-practice document ID")
    .requiredOption("--version <version>", "Shared-practice document version")
    .requiredOption("--title <title>", "Shared-practice title")
    .requiredOption("--publisher <name>", "Publisher name")
    .option("--organisation <name>", "Publisher organisation")
    .option("--description <text>", "Short publication description")
    .option("--license <license>", "Publication licence")
    .option(
      "--module <id>",
      "Instruction ID to publish; repeat this option for more",
      collectModule,
      [],
    )
    .option("--output <file>", "Write the publication to a file")
    .option(
      "--force",
      "Replace an existing ordinary output file after review",
      false,
    )
    .option("--json", "Print machine-readable JSON")
    .action(
      async (
        projectPath: string,
        options: {
          id: string;
          version: string;
          title: string;
          publisher: string;
          organisation?: string;
          description?: string;
          license?: string;
          module: string[];
          output?: string;
          force?: boolean;
          json?: boolean;
        },
      ) => {
        try {
          if (options.module.length === 0) {
            process.stderr.write(
              "Choose at least one --module. Rack does not publish a whole Set-up by default.\n",
            );
            process.exitCode = 2;
            return;
          }

          const project = await openProject(projectPath);
          const result = createSharedPracticePublication(project, {
            id: options.id,
            version: options.version,
            title: options.title,
            description: options.description,
            publishedBy: {
              name: options.publisher,
              organisation: options.organisation,
            },
            license: options.license ?? null,
            moduleIds: options.module,
          });

          if (result.blocked || !result.document || !result.content) {
            if (options.json) {
              process.stdout.write(
                `${JSON.stringify(
                  {
                    published: false,
                    diagnostics: result.diagnostics,
                  },
                  null,
                  2,
                )}\n`,
              );
            } else {
              printDiagnostics(result.diagnostics);
            }
            process.exitCode = 1;
            return;
          }

          const output = options.output
            ? await writePublicationFile(
                options.output,
                result.content,
                options.force ?? false,
              )
            : null;
          const summary = publicationSummary(result.modules);

          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                {
                  published: true,
                  output,
                  document: result.document,
                  summary,
                  moduleIds: result.modules.map(
                    (module) => module.harness.id,
                  ),
                  content: output ? null : result.content,
                  diagnostics: result.diagnostics,
                },
                null,
                2,
              )}\n`,
            );
          } else if (output) {
            process.stdout.write(
              `Published ${summary.instructions} instructions as ${result.document.title} ${result.document.version} → ${output}\n`,
            );
            printDiagnostics(result.diagnostics);
          } else {
            process.stdout.write(result.content);
          }

          process.exitCode = 0;
        } catch (error) {
          process.stderr.write(
            `${error instanceof Error ? error.message : "Unable to publish shared practice."}\n`,
          );
          process.exitCode = 3;
        }
      },
    );
};
