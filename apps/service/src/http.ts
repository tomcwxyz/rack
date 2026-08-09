import type { ManagedServiceError } from "@rack/managed";

export const json = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });

export const serviceError = (
  code: ManagedServiceError["error"]["code"],
  message: string,
  status: number,
): Response => json({ error: { code, message } }, status);
