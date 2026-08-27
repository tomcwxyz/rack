import type { ManagedServiceClientOptions } from "./client.js";
import { managedServiceErrorSchema } from "./contracts.js";
import {
  reliableEvaluationConfirmRequestSchema,
  reliableEvaluationStartResponseSchema,
  reliableEvaluationStatusResponseSchema,
  type ReliableEvaluationConfirmRequest,
  type ReliableEvaluationStartResponse,
  type ReliableEvaluationStatusResponse,
} from "./reliableEvaluation.js";

export type ReliableEvaluationClient = {
  start: (request: ReliableEvaluationConfirmRequest) => Promise<ReliableEvaluationStartResponse>;
  status: (runId: string) => Promise<ReliableEvaluationStatusResponse>;
};

const normaliseBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const parseError = (payload: unknown): string => {
  const parsed = managedServiceErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : "Managed Rack request failed.";
};

export const createReliableEvaluationClient = (
  options: ManagedServiceClientOptions,
): ReliableEvaluationClient => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Managed Rack requires a fetch implementation.");
  const baseUrl = normaliseBaseUrl(options.baseUrl);
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error("Managed Rack requires an absolute http(s) service URL.");
  }

  const accessToken = async (): Promise<string> => {
    const token = await options.getAccessToken();
    if (!token) throw new Error("Sign in before using managed checks.");
    return token;
  };

  return {
    async start(input) {
      const request = reliableEvaluationConfirmRequestSchema.parse(input);
      const token = await accessToken();
      const response = await fetchImpl(`${baseUrl}/api/evaluate/reliable`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(parseError(payload));
      return reliableEvaluationStartResponseSchema.parse(payload);
    },

    async status(runId) {
      const token = await accessToken();
      const response = await fetchImpl(
        `${baseUrl}/api/evaluate/reliable-status?runId=${encodeURIComponent(runId)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(parseError(payload));
      return reliableEvaluationStatusResponseSchema.parse(payload);
    },
  };
};
