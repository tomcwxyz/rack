import {
  managedRunIdSchema,
  managedServiceErrorSchema,
  quickCheckRequestSchema,
  quickCheckResponseSchema,
  reliableCheckRequestSchema,
  reliableCheckStartResponseSchema,
  reliableCheckStatusResponseSchema,
  type QuickCheckRequest,
  type QuickCheckResponse,
  type ReliableCheckRequest,
  type ReliableCheckStartResponse,
  type ReliableCheckStatusResponse,
} from "./contracts.js";

export type ManagedServiceClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
};

export type ManagedServiceClient = {
  quickCheck: (request: QuickCheckRequest) => Promise<QuickCheckResponse>;
  startReliableCheck: (
    request: ReliableCheckRequest,
  ) => Promise<ReliableCheckStartResponse>;
  getReliableCheckStatus: (runId: string) => Promise<ReliableCheckStatusResponse>;
};

const normaliseBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const parseError = (payload: unknown): string => {
  const parsed = managedServiceErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : "Managed Rack request failed.";
};

export const createManagedServiceClient = (
  options: ManagedServiceClientOptions,
): ManagedServiceClient => {
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
    async quickCheck(input) {
      const request = quickCheckRequestSchema.parse(input);
      const token = await accessToken();
      const response = await fetchImpl(`${baseUrl}/api/check`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(parseError(payload));
      return quickCheckResponseSchema.parse(payload);
    },

    async startReliableCheck(input) {
      const request = reliableCheckRequestSchema.parse(input);
      const token = await accessToken();
      const response = await fetchImpl(`${baseUrl}/api/check/reliable`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(parseError(payload));
      return reliableCheckStartResponseSchema.parse(payload);
    },

    async getReliableCheckStatus(inputRunId) {
      const runId = managedRunIdSchema.parse(inputRunId);
      const token = await accessToken();
      const response = await fetchImpl(
        `${baseUrl}/api/check/reliable/${encodeURIComponent(runId)}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(parseError(payload));
      return reliableCheckStatusResponseSchema.parse(payload);
    },
  };
};
