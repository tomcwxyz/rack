#!/usr/bin/env node

import process from "node:process";
import { Command } from "commander";
import { openProject } from "@rack/core/node";

const program = new Command()
  .name("rack")
  .description("Build and check portable AI working practices.")
  .version("0.0.0");

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
        for (const item of project.diagnostics) {
          process.stderr.write(
            `${item.code} ${item.title}\n${item.message}\n\n`,
          );
        }
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

await program.parseAsync(process.argv);
