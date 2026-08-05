#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { buildPrompt } from "@rack/core";
import { openProject } from "@rack/core/node";

const program = new Command()
  .name("rack")
  .description("Build and check portable AI working practices.")
  .version("0.0.0");

const printDiagnostics = (
  diagnostics: {
    code: string;
    title: string;
    message: string;
    severity: string;
  }[],
) => {
  for (const item of diagnostics) {
    const output = `${item.code} ${item.title}\n${item.message}\n\n`;
    if (item.severity === "error") process.stderr.write(output);
    else process.stdout.write(output);
  }
};

program
  .command("validate")
  .argument("[path]", "Rack project folder", ".")
  .option("--json", "Print machine-readable JSON")
  .action(async (projectPath: string, options: { json?: boolean }) => {
    try {
      const project = await openProject(projectPath);
      const hasErrors = project.diagnostics.some(
        (item) => item.severity === "error",
      );

      if (options.json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              valid: !hasErrors,
              project: project.manifest?.name ?? null,
              modules: project.modules.length,
              profiles: project.profiles.length,
              diagnostics: project.diagnostics,
            },
            null,
            2,
          )}\n`,
        );
      } else if (hasErrors) {
        printDiagnostics(project.diagnostics);
      } else {
        process.stdout.write(
          `Rack is valid: ${project.manifest?.title ?? project.root}\n`,
        );
        process.stdout.write(
          `${project.modules.length} instructions · ${project.profiles.length} set-ups\n`,
        );
      }

      process.exitCode = hasErrors ? 1 : 0;
    } catch (error) {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Unable to open Rack."}\n`,
      );
      process.exitCode = 3;
    }
  });

program
  .command("build")
  .description("Build a Set-up for a destination.")
  .argument("[path]", "Rack project folder", ".")
  .requiredOption("--profile <id>", "Set-up ID to build")
  .option("--target <id>", "Destination to build", "prompt")
  .option("--output <path>", "Write the generated file to this path")
  .option("--json", "Print machine-readable JSON")
  .action(
    async (
      projectPath: string,
      options: {
        profile: string;
        target: string;
        output?: string;
        json?: boolean;
      },
    ) => {
      try {
        if (options.target !== "prompt") {
          process.stderr.write(
            `RACK-TARGET-001 Destination is not available yet\n${options.target} is not implemented in this iteration. Use --target prompt.\n`,
          );
          process.exitCode = 2;
          return;
        }

        const project = await openProject(projectPath);
        const build = buildPrompt(project, options.profile);
        const hasErrors = build.diagnostics.some(
          (item) => item.severity === "error",
        );

        if (hasErrors || !build.artifact) {
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                {
                  built: false,
                  profile: options.profile,
                  target: options.target,
                  diagnostics: build.diagnostics,
                },
                null,
                2,
              )}\n`,
            );
          } else {
            printDiagnostics(build.diagnostics);
          }
          process.exitCode = 2;
          return;
        }

        if (options.output) {
          const destination = path.resolve(options.output);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, build.artifact.content, "utf8");
        }

        if (options.json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                built: true,
                profile: options.profile,
                target: build.artifact.target,
                output: options.output ? path.resolve(options.output) : null,
                artifact: options.output
                  ? {
                      path: build.artifact.path,
                      mediaType: build.artifact.mediaType,
                      moduleIds: build.artifact.moduleIds,
                    }
                  : build.artifact,
                diagnostics: build.diagnostics,
              },
              null,
              2,
            )}\n`,
          );
        } else if (options.output) {
          process.stdout.write(
            `Built ${options.profile} for prompt → ${path.resolve(options.output)}\n`,
          );
          if (build.diagnostics.length > 0) {
            printDiagnostics(build.diagnostics);
          }
        } else {
          process.stdout.write(build.artifact.content);
        }

        process.exitCode = 0;
      } catch (error) {
        process.stderr.write(
          `${error instanceof Error ? error.message : "Unable to build Rack."}\n`,
        );
        process.exitCode = 3;
      }
    },
  );

await program.parseAsync(process.argv);
