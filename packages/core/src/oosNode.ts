import { execFile } from "node:child_process";
import type {
  OosContextRequest,
  OosContextTransport,
} from "./contextSources.js";

export type CommandExecutionOptions = {
  timeout: number;
  maxBuffer: number;
  env: NodeJS.ProcessEnv;
  windowsHide: boolean;
};

export type CommandExecutor = (
  command: string,
  args: string[],
  options: CommandExecutionOptions,
) => Promise<{ stdout: string; stderr: string }>;

const executeFile: CommandExecutor = (
  command,
  args,
  options,
) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: "utf8",
        timeout: options.timeout,
        maxBuffer: options.maxBuffer,
        env: options.env,
        windowsHide: options.windowsHide,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });

export type TopoCliContextTransportOptions = {
  command?: string;
  storePath?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  env?: NodeJS.ProcessEnv;
  execute?: CommandExecutor;
};

/**
 * Temporary local interoperability transport for the Organisational OS proof.
 *
 * This invokes TOPO's machine-readable oos context CLI command directly,
 * without a shell. It is intentionally transport-only: RACK remains coupled
 * to the OOS Context Packet contract rather than TOPO's storage model.
 *
 * A future local Bridge, MCP or native transport can replace this factory
 * without changing ContextSource.
 */
export const createTopoCliContextTransport = ({
  command = "topo",
  storePath,
  timeoutMs = 10_000,
  maxBufferBytes = 2 * 1024 * 1024,
  env = process.env,
  execute = executeFile,
}: TopoCliContextTransportOptions = {}): OosContextTransport => ({
  async requestContext(request: OosContextRequest): Promise<unknown> {
    if (request.wanted?.query) {
      throw new Error(
        "The TOPO CLI context transport does not support free-text context queries yet.",
      );
    }

    const args = [
      ...(storePath === undefined ? [] : ["--store", storePath]),
      "oos",
      "context",
      "--subject",
      request.subject,
      "--purpose",
      request.purpose,
      "--requester",
      request.requestedBy,
      ...(request.wanted?.maxItems === undefined
        ? []
        : ["--max-items", String(request.wanted.maxItems)]),
    ];

    const { stdout } = await execute(command, args, {
      timeout: timeoutMs,
      maxBuffer: maxBufferBytes,
      env,
      windowsHide: true,
    });

    try {
      return JSON.parse(stdout) as unknown;
    } catch {
      throw new Error(
        "The TOPO CLI context transport did not return a valid JSON Context Packet.",
      );
    }
  },
});
