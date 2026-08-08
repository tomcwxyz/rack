import process from "node:process";
import type { Command } from "commander";
import {
  getStarterEntry,
  getStarterTemplate,
  searchStarterCatalogue,
  starterCatalogue,
  starterTemplates,
  type StarterRoute,
} from "@rack/starter";
import { parseProjectSnapshot } from "@rack/core";
import { readProjectSnapshot } from "@rack/core/node";
import { planStarterImport } from "@rack/core/starter";
import { applyStarterImport } from "@rack/core/starter-node";

const routes = ["writing", "research", "coding"] as const;
const types = ["context", "voice", "method", "craft", "guardrail", "task", "tools"] as const;

const parseRoute = (value?: string) => {
  if (!value) return undefined;
  if (!routes.includes(value as (typeof routes)[number])) {
    throw new Error(`Unknown Starter route: ${value}. Use writing, research or coding.`);
  }
  return value as Exclude<StarterRoute, "shared">;
};

const parseType = (value?: string) => {
  if (!value) return undefined;
  if (!types.includes(value as (typeof types)[number])) {
    throw new Error(`Unknown instruction type: ${value}.`);
  }
  return value as (typeof types)[number];
};

export const registerLibraryCommands = (program: Command): void => {
  const library = program
    .command("library")
    .description("Browse and explicitly import the bundled Starter library.");

  library
    .command("list")
    .description("List bundled Starter instructions or templates.")
    .option("--route <route>", "Filter by writing, research or coding")
    .option("--type <type>", "Filter by instruction type")
    .option("--tag <tag>", "Filter by tag")
    .option("--query <text>", "Search titles, descriptions, IDs and tags")
    .option("--templates", "List the six starting templates instead of instructions")
    .option("--json", "Print machine-readable JSON")
    .action(
      (options: {
        route?: string;
        type?: string;
        tag?: string;
        query?: string;
        templates?: boolean;
        json?: boolean;
      }) => {
        try {
          if (options.templates) {
            const route = parseRoute(options.route);
            const templates = starterTemplates.filter(
              (template) => !route || template.route === route,
            );
            if (options.json) {
              process.stdout.write(`${JSON.stringify(templates, null, 2)}\n`);
            } else {
              for (const template of templates) {
                process.stdout.write(
                  `${template.id}\t${template.route}\t${template.title}\n  ${template.description}\n`,
                );
              }
            }
            return;
          }

          const entries = searchStarterCatalogue({
            route: parseRoute(options.route),
            type: parseType(options.type),
            tag: options.tag,
            query: options.query,
          });
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                entries.map(({ source, ...entry }) => ({ ...entry, sourceLength: source.length })),
                null,
                2,
              )}\n`,
            );
          } else {
            for (const entry of entries) {
              process.stdout.write(
                `${entry.id}\t${entry.type}\t${entry.title}\n  ${entry.description}\n`,
              );
            }
            process.stdout.write(
              `\n${entries.length} of ${starterCatalogue.length} Starter instructions.\n`,
            );
          }
        } catch (error) {
          process.stderr.write(
            `${error instanceof Error ? error.message : "Unable to list Starter content."}\n`,
          );
          process.exitCode = 2;
        }
      },
    );

  library
    .command("show")
    .description("Inspect an exact Starter instruction or template before import.")
    .argument("<id>", "Starter instruction ID or template ID")
    .option("--json", "Print machine-readable JSON")
    .action((id: string, options: { json?: boolean }) => {
      const entry = getStarterEntry(id);
      if (entry) {
        if (options.json) process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
        else {
          process.stdout.write(
            `${entry.title}\n${entry.id}\n${entry.description}\nDigest: ${entry.digest}\nLicence: CC BY 4.0\n`,
          );
          if (entry.attribution) {
            process.stdout.write(
              `Attribution: ${entry.attribution.name}${entry.attribution.url ? ` — ${entry.attribution.url}` : ""}\n`,
            );
          }
          process.stdout.write(`\n${entry.source}`);
        }
        return;
      }

      const template = getStarterTemplate(id);
      if (template) {
        if (options.json) process.stdout.write(`${JSON.stringify(template, null, 2)}\n`);
        else {
          process.stdout.write(`${template.title}\n${template.description}\n\n`);
          for (const moduleId of template.moduleIds) process.stdout.write(`- ${moduleId}\n`);
        }
        return;
      }

      process.stderr.write(`Unknown Starter instruction or template: ${id}\n`);
      process.exitCode = 2;
    });

  library
    .command("add")
    .description("Review a Starter import plan, then apply it only with --apply.")
    .argument("[ids...]", "One or more Starter instruction IDs")
    .option("--template <id>", "Add every instruction from a starting template")
    .option("--path <path>", "Rack project folder", ".")
    .option("--profile <id>", "Also include the selected instructions in this Set-up")
    .option("--apply", "Apply the reviewed plan")
    .option("--json", "Print machine-readable JSON")
    .action(
      async (
        ids: string[],
        options: {
          template?: string;
          path: string;
          profile?: string;
          apply?: boolean;
          json?: boolean;
        },
      ) => {
        try {
          const template = options.template
            ? getStarterTemplate(options.template)
            : undefined;
          if (options.template && !template) {
            throw new Error(`Unknown Starter template: ${options.template}`);
          }
          const selected = [
            ...ids,
            ...(template?.moduleIds ?? []),
          ];
          const snapshot = await readProjectSnapshot(options.path);
          const project = parseProjectSnapshot(snapshot);
          const plan = planStarterImport(project, snapshot, selected, options.profile);

          const jsonResult = {
            applied: false,
            applyRequested: Boolean(options.apply),
            blocked: plan.blocked,
            blockedReasons: plan.blockedReasons,
            profileId: plan.profileId,
            profileChanged: Boolean(plan.profileChange),
            items: plan.items.map((item) => ({
              id: item.entry.id,
              title: item.entry.title,
              status: item.status,
              destinationPath: item.destinationPath,
              existingPath: item.existingPath,
              message: item.message,
              digest: item.entry.digest,
            })),
          };

          if (!options.json) {
            process.stdout.write("Starter import review\n\n");
            for (const item of plan.items) {
              process.stdout.write(
                `${item.status === "ready" ? "+" : item.status === "identical" ? "=" : item.status === "changed" ? "~" : "!"} ${item.entry.title}\n  ${item.message}\n`,
              );
            }
            if (plan.profileChange) {
              process.stdout.write(`\nSet-up ${plan.profileId} will be updated after the new files are copied.\n`);
            }
            for (const reason of plan.blockedReasons) process.stdout.write(`\nBlocked: ${reason}\n`);
            if (!options.apply && !plan.blocked) {
              process.stdout.write("\nNo files changed. Run the same command with --apply after reviewing this plan.\n");
            }
          }

          if (plan.blocked) {
            if (options.json) {
              process.stdout.write(`${JSON.stringify(jsonResult, null, 2)}\n`);
            }
            process.exitCode = 2;
            return;
          }
          if (!options.apply) {
            if (options.json) {
              process.stdout.write(`${JSON.stringify(jsonResult, null, 2)}\n`);
            }
            process.exitCode = 0;
            return;
          }

          await applyStarterImport(options.path, plan);
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify({ ...jsonResult, applied: true }, null, 2)}\n`,
            );
          } else {
            process.stdout.write(
              `\nAdded ${plan.items.filter((item) => item.status === "ready").length} Starter instruction${plan.items.filter((item) => item.status === "ready").length === 1 ? "" : "s"}.\n`,
            );
          }
          process.exitCode = 0;
        } catch (error) {
          process.stderr.write(
            `${error instanceof Error ? error.message : "Unable to add Starter content."}\n`,
          );
          process.exitCode = 3;
        }
      },
    );
};
