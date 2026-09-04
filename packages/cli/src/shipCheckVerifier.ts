import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

export const shipCheckGateIds = [
  "ship-check",
  "ship-check-secure-build",
  "ship-check-production-ready",
  "ship-check-cost-aware",
] as const;

export type ShipCheckGateId = (typeof shipCheckGateIds)[number];
export type ShipCheckOutcome = "pass" | "fail" | "uncertain" | "incomplete";

export type ShipCheckRackResult = {
  schemaVersion: "0.1";
  stepId: string;
  check: ShipCheckGateId;
  outcome: ShipCheckOutcome;
  providerResult: {
    schemaVersion: "0.1";
    provider: "ship-check";
    gateId: ShipCheckGateId;
    outcome: ShipCheckOutcome;
    threshold: string;
    generatedAt: string;
    findings: Array<{
      id: string;
      checkId: string;
      pack: string;
      severity: string;
      title: string;
    }>;
    checkErrors: Array<{ checkId: string; message: string }>;
    warnings: string[];
  };
};

export type ShipCheckVerifierRun = {
  command: string;
  version: string;
  workRoot: string;
  gateId: ShipCheckGateId;
  stepId: string;
  result: ShipCheckRackResult;
  evidence: string;
};

const timeoutMs = 120_000;
const outputLimitBytes = 2 * 1024 * 1024;
const stepIdPattern = /^[A-Za-z0-9._:-]+$/;

const packByGate: Partial<Record<ShipCheckGateId, string>> = {
  "ship-check-secure-build": "secure-build",
  "ship-check-production-ready": "production-ready",
  "ship-check-cost-aware": "cost-aware",
};

export const isShipCheckGate = (value: string | null | undefined): value is ShipCheckGateId =>
  Boolean(value && (shipCheckGateIds as readonly string[]).includes(value));

export const validateShipCheckStepId = (stepId: string): string => {
  if (!stepId || stepId.length > 200 || !stepIdPattern.test(stepId)) {
    throw new Error(
      "Ship Check step IDs must contain only letters, numbers, dots, underscores, colons and hyphens.",
    );
  }
  return stepId;
};

export const buildShipCheckArgs = (
  workRoot: string,
  gateId: ShipCheckGateId,
  stepId: string,
): string[] => {
  validateShipCheckStepId(stepId);
  const args = [
    "scan",
    workRoot,
    "--format",
    "rack",
    "--gate",
    gateId,
    "--step-id",
    stepId,
    "--fail-on",
    "high",
  ];
  const pack = packByGate[gateId];
  if (pack) args.push("--pack", pack);
  return args;
};

type ProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const runProcess = (
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let finished = false;

    const finishWithError = (error: Error) => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(error);
    };

    const timer = setTimeout(() => {
      finishWithError(new Error("Ship Check exceeded Rack's two-minute verifier limit."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > outputLimitBytes) {
        finishWithError(new Error("Ship Check returned more than 2 MB of verification output."));
        return;
      }
      stdout.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > outputLimitBytes) {
        finishWithError(new Error("Ship Check returned more than 2 MB of error output."));
        return;
      }
      stderr.push(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      finishWithError(
        new Error(`Could not start Ship Check '${command}': ${error.message}`),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (finished) return;
      finished = true;
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const parseShipCheckRackResult = (
  value: unknown,
  expectedGateId: ShipCheckGateId,
  expectedStepId: string,
): ShipCheckRackResult => {
  const result = asRecord(value);
  const provider = asRecord(result?.providerResult);
  const outcome = result?.outcome;
  const providerOutcome = provider?.outcome;
  const validOutcome = (candidate: unknown): candidate is ShipCheckOutcome =>
    candidate === "pass" ||
    candidate === "fail" ||
    candidate === "uncertain" ||
    candidate === "incomplete";

  if (
    result?.schemaVersion !== "0.1" ||
    result.stepId !== expectedStepId ||
    result.check !== expectedGateId ||
    !validOutcome(outcome) ||
    provider?.schemaVersion !== "0.1" ||
    provider.provider !== "ship-check" ||
    provider.gateId !== expectedGateId ||
    !validOutcome(providerOutcome) ||
    providerOutcome !== outcome ||
    !Array.isArray(provider.findings) ||
    !Array.isArray(provider.checkErrors) ||
    !Array.isArray(provider.warnings)
  ) {
    throw new Error(
      "Ship Check returned a result that does not match the reviewed Rack verification step.",
    );
  }

  return value as ShipCheckRackResult;
};

const evidenceSummary = (result: ShipCheckRackResult): string => {
  const lines = [`Ship Check outcome: ${result.outcome}`];
  for (const finding of result.providerResult.findings.slice(0, 50)) {
    lines.push(`- [${finding.severity}] ${finding.title}`);
  }
  if (result.providerResult.findings.length > 50) {
    lines.push(
      `- …and ${result.providerResult.findings.length - 50} additional Ship Check findings`,
    );
  }
  for (const checkError of result.providerResult.checkErrors.slice(0, 20)) {
    lines.push(`- [check error] ${checkError.checkId}: ${checkError.message}`);
  }
  return lines.join("\n");
};

const expectedExitCode = (outcome: ShipCheckOutcome): number => {
  if (outcome === "fail") return 2;
  if (outcome === "incomplete") return 3;
  return 0;
};

export const resolveShipCheckCommand = (explicit?: string): string => {
  const command =
    explicit?.trim() ||
    process.env.RACK_SHIP_CHECK_ENGINE_PATH?.trim() ||
    process.env.SHIP_CHECK_ENGINE_PATH?.trim() ||
    "ship-check";
  if (!command) throw new Error("Ship Check executable is not configured.");
  return command;
};

export const runShipCheckVerifier = async (options: {
  workRoot: string;
  gateId: ShipCheckGateId;
  stepId: string;
  command?: string;
}): Promise<ShipCheckVerifierRun> => {
  const workRoot = path.resolve(options.workRoot);
  const stat = await fs
    .stat(workRoot)
    .catch((error: unknown) => {
      throw new Error(
        `Could not open the Ship Check work project: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  if (!stat.isDirectory()) {
    throw new Error("Ship Check can only verify a work project folder.");
  }

  const stepId = validateShipCheckStepId(options.stepId);
  const command = resolveShipCheckCommand(options.command);
  const versionResult = await runProcess(command, ["--version"], workRoot);
  if (versionResult.code !== 0) {
    throw new Error(
      versionResult.stderr.trim() ||
        `Ship Check version check exited with code ${String(versionResult.code)}.`,
    );
  }
  const version = versionResult.stdout.trim();
  if (!version.startsWith("ship-check ")) {
    throw new Error("The configured executable did not identify itself as Ship Check.");
  }

  const processResult = await runProcess(
    command,
    buildShipCheckArgs(workRoot, options.gateId, stepId),
    workRoot,
  );
  if (![0, 2, 3].includes(processResult.code ?? -1)) {
    throw new Error(
      processResult.stderr.trim() ||
        `Ship Check exited unexpectedly with code ${String(processResult.code)}.`,
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(processResult.stdout);
  } catch (error) {
    throw new Error(
      `Ship Check returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const result = parseShipCheckRackResult(decoded, options.gateId, stepId);
  if (processResult.code !== expectedExitCode(result.outcome)) {
    throw new Error(
      "Ship Check's exit code did not match its structured verification outcome.",
    );
  }

  return {
    command,
    version,
    workRoot,
    gateId: options.gateId,
    stepId,
    result,
    evidence: evidenceSummary(result),
  };
};
