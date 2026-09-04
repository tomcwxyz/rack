#!/usr/bin/env node

import process from "node:process";
import { Command } from "commander";
import { buildVerificationPlan } from "@rack/core";
import { openProject } from "@rack/core/node";
import {
  isShipCheckGate,
  runShipCheckVerifier,
  shipCheckGateIds,
  type ShipCheckGateId,
  type ShipCheckVerifierRun,
} from "./shipCheckVerifier.js";

const program = new Command()
  .name("rack-ship-check")
  .description(
    "Run trusted local Ship Check gates declared by a Rack Verification Plan.",
  )
  .argument("[rack-path]", "Rack project folder", ".")
  .requiredOption("--profile <id>", "Rack Set-up ID whose Verification Plan should be used")
  .requiredOption("--work-root <path>", "Work project folder Ship Check should inspect")
  .option(
    "--gate <id>",
    `Run only one Ship Check gate (${shipCheckGateIds.join(", ")})`,
  )
  .option(
    "--ship-check-command <path>",
    "Trusted Ship Check executable. Defaults to RACK_SHIP_CHECK_ENGINE_PATH, SHIP_CHECK_ENGINE_PATH, then ship-check on PATH.",
  )
  .option("--json", "Print machine-readable results")
  .action(
    async (
      rackPath: string,
      options: {
        profile: string;
        workRoot: string;
        gate?: string;
        shipCheckCommand?: string;
        json?: boolean;
      },
    ) => {
      try {
        if (options.gate && !isShipCheckGate(options.gate)) {
          throw new Error(
            `Unknown Ship Check gate '${options.gate}'. Use one of: ${shipCheckGateIds.join(", ")}.`,
          );
        }

        const project = await openProject(rackPath);
        const plan = buildVerificationPlan(project, options.profile);
        if (plan.blocked) {
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                {
                  verified: false,
                  profile: options.profile,
                  blocked: true,
                  diagnostics: plan.diagnostics,
                  results: [],
                },
                null,
                2,
              )}\n`,
            );
          } else {
            process.stderr.write(
              `Rack cannot run verification because the ${options.profile} Verification Plan is blocked.\n`,
            );
            for (const diagnostic of plan.diagnostics) {
              if (diagnostic.severity === "error") {
                process.stderr.write(`${diagnostic.code} ${diagnostic.title}\n${diagnostic.message}\n\n`);
              }
            }
          }
          process.exitCode = 3;
          return;
        }

        const requestedGate = options.gate as ShipCheckGateId | undefined;
        const steps = plan.steps.filter(
          (step) =>
            step.kind === "automatic" &&
            isShipCheckGate(step.check) &&
            (!requestedGate || step.check === requestedGate),
        );

        if (steps.length === 0) {
          const message = requestedGate
            ? `The ${options.profile} Verification Plan does not declare ${requestedGate}.`
            : `The ${options.profile} Verification Plan does not declare a Ship Check automatic verifier.`;
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify(
                {
                  verified: false,
                  profile: options.profile,
                  blocked: false,
                  message,
                  results: [],
                },
                null,
                2,
              )}\n`,
            );
          } else {
            process.stderr.write(`${message}\n`);
          }
          process.exitCode = 3;
          return;
        }

        const runs: ShipCheckVerifierRun[] = [];
        for (const step of steps) {
          runs.push(
            await runShipCheckVerifier({
              workRoot: options.workRoot,
              gateId: step.check as ShipCheckGateId,
              stepId: step.id,
              command: options.shipCheckCommand,
            }),
          );
        }

        const hasFailure = runs.some((run) => run.result.outcome === "fail");
        const needsReview = runs.some(
          (run) =>
            run.result.outcome === "incomplete" || run.result.outcome === "uncertain",
        );
        const exitCode = hasFailure ? 2 : needsReview ? 3 : 0;

        if (options.json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                verified: exitCode === 0,
                profile: options.profile,
                workRoot: runs[0]?.workRoot ?? options.workRoot,
                results: runs.map((run) => ({
                  gateId: run.gateId,
                  stepId: run.stepId,
                  outcome: run.result.outcome,
                  engineVersion: run.version,
                  providerResult: run.result.providerResult,
                })),
              },
              null,
              2,
            )}\n`,
          );
        } else {
          for (const run of runs) {
            process.stdout.write(
              `${run.gateId} · ${run.result.outcome} · ${run.version}\n${run.evidence}\n`,
            );
          }
        }

        process.exitCode = exitCode;
      } catch (error) {
        process.stderr.write(
          `${error instanceof Error ? error.message : "Rack could not run Ship Check."}\n`,
        );
        process.exitCode = 3;
      }
    },
  );

await program.parseAsync(process.argv);
