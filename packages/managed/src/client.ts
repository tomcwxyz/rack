import {
  managedServiceErrorSchema,
  quickCheckRequestSchema,
  quickCheckResponseSchema,
  type QuickCheckRequest,
  type QuickCheckResponse,
} from "./contracts.js";

export type ManagedServiceClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
};

export type ManagedServiceClient = {
  quickCheck: (request: QuickCheckRequest) => Promise<QuickCheckResponse>;
};

const normaliseBaseUrl = (value: string): string => value.replace(/\/+$/, "");

export const createManagedServiceClient = (
  options: ManagedServiceClientOptions,
): ManagedServiceClient => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("Managed Rack requires a fetch implementation.");
  const baseUrl = normaliseBaseUrl(options.baseUrl);
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error("Managed Rack requires an absolute http(s) service URL.");
  }

  return {
    async quickCheck(input) {
      const request = quickCheckRequestSchema.parse(input);
      const accessToken = await options.getAccessToken();
      if (!accessToken) throw new Error("Sign in before using managed checks.");

      const response = await fetchImpl(`${baseUrl}/api/check`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const parsed = managedServiceErrorSchema.safeParse(payload);
        throw new Error(
          parsed.success ? parsed.data.error.message : "Managed Rack request failed.",
        );
      }
      return quickCheckResponseSchema.parse(payload);
    },
  };
};
