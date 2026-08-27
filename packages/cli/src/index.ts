#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import {
  parseTargetId,
  type DestinationId,
} from "@rack/core";
import {
  inspectTargetBuild,
  prepareTargetBuild,
} from "@rack/core/build";
import {
  installTargetBuild,
  openProject,
  readInstalledTargetBuild,
} from "@rack/core/node";
import { registerLibraryCommands } from "./libraryCommands.js";
import { registerPracticeCommands } from "./practiceCommands.js";

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
  .option("--output <path>", "Write a one-file destination to this path")
  .option("--install", "Install a managed build into the Rack generated folder")
  .option("--json", "Print machine-readable JSON")
  .action(
    async (
      projectPath: string,
      options: {
        profile: string;
        target: string;
        output?: string;
        install?: boolean;
        json?: boolean;
      },
    ) => {
      try {
        if (options.output && options.install) {
          process.stderr.write(
            "Choose either --output for one file or --install for a managed Rack build, not both.\n",
          );
          process.exitCode = 2;
          return;
        }

        const target: DestinationId = parseTargetId(options.target);
        const project = await openProject(projectPath);
        const build = await prepareTargetBuild(project, options.profile, target);
        const hasErrors = build.diagnostics.some(
          (item) => item.severity === "error",
        );
        if (hasErrors || !build.manifest || build.targetBuild.artifacts.length === 0) {
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                {
                  built: false,
                  profile: options.profile,
                  target,
                  estimatedTokens: build.estimatedTokens,
                  degradations: build.degradations,
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

        if (options.output && build.targetBuild.artifacts.length !== 1) {
          process.stderr.write(
            "--output can only be used with a destination that produces one file. Use --install for packages.\n",
          );
          process.exitCode = 2;
          return;
        }

        let installed: Awaited<ReturnType<typeof installTargetBuild>> | null = null;
        const primaryArtifact = build.targetBuild.artifacts[0];
        if (!primaryArtifact) throw new Error("The destination produced no files.");

        if (options.install) {
          installed = await installTargetBuild(projectPath, build);
        } else if (options.output) {
          const destination = path.resolve(options.output);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, primaryArtifact.content, "utf8");
        }

        if (options.json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                built: true,
                profile: options.profile,
                target,
                estimatedTokens: build.estimatedTokens,
                degradations: build.degradations,
                installed,
                output: options.output ? path.resolve(options.output) : null,
                manifest: build.manifest,
                artifacts:
                  options.output || options.install
                    ? build.targetBuild.artifacts.map((artifact) => ({
                        path: artifact.path,
                        mediaType: artifact.mediaType,
                        moduleIds: artifact.moduleIds,
                      }))
                    : build.targetBuild.artifacts,
                diagnostics: build.diagnostics,
              },
              null,
              2,
            )}\n`,
          );
        } else if (installed) {
          process.stdout.write(
            `Built ${options.profile} for ${target} → ${installed.directory}\n`,
          );
          if (installed.backupDirectory) {
            process.stdout.write(
              `Previous generated output retained at ${installed.backupDirectory}\n`,
            );
          }
          printDiagnostics(build.diagnostics);
        } else if (options.output) {
          process.stdout.write(
            `Built ${options.profile} for ${target} → ${path.resolve(options.output)}\n`,
          );
          printDiagnostics(build.diagnostics);
        } else if (build.targetBuild.artifacts.length === 1) {
          process.stdout.write(primaryArtifact.content);
        } else {
          process.stderr.write(
            "This destination produces multiple files. Use --install or --json.\n",
          );
          process.exitCode = 2;
          return;
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

program
  .command("check")
  .description("Check whether a managed generated build is current.")
  .argument("[path]", "Rack project folder", ".")
  .option("--profile <id>", "Set-up ID to inspect")
  .option("--target <id>", "Destination to inspect", "prompt")
  .option("--json", "Print machine-readable JSON")
  .action(
    async (
      projectPath: string,
      options: { profile?: string; target: string; json?: boolean },
    ) => {
      try {
        const target: DestinationId = parseTargetId(options.target);
        const project = await openProject(projectPath);
        const profileId =
          options.profile ?? project.manifest?.default_profile ?? "";
        if (!profileId) {
          process.stderr.write("No Set-up was supplied and the Rack has no default Set-up.\n");
          process.exitCode = 2;
          return;
        }

        const inspection = await inspectTargetBuild(
          project,
          profileId,
          target,
          await readInstalledTargetBuild(projectPath, target, profileId),
        );
        if (options.json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                profile: profileId,
                target,
                status: inspection.status,
                sourceChanged: inspection.sourceChanged,
                rendererChanged: inspection.rendererChanged,
                outputModified: inspection.outputModified,
                diagnostics: inspection.diagnostics,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          const messages: Record<typeof inspection.status, string> = {
            missing: `No managed ${target} build exists yet.`,
            current: `The generated ${target} package is current.`,
            stale: `The Rack source or ${target} adapter changed after the package was built.`,
            modified: `The generated ${target} package was edited outside Rack.`,
            "stale-and-modified":
              `The Rack changed and the generated ${target} package was also edited outside Rack.`,
            invalid: `The generated ${target} build cannot be verified.`,
          };
          process.stdout.write(`${messages[inspection.status]}\n`);
          printDiagnostics(inspection.diagnostics);
        }
        process.exitCode = inspection.status === "current" ? 0 : 7;
      } catch (error) {
        process.stderr.write(
          `${error instanceof Error ? error.message : "Unable to check Rack."}\n`,
        );
        process.exitCode = 3;
      }
    },
  );

registerLibraryCommands(program);
registerPracticeCommands(program);

await program.parseAsync(process.argv);
