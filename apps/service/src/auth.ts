import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { VerifiedAuthClaims } from "@rack/database";
import type { ServiceEnvironment } from "./env.js";

export class ManagedAuthenticationError extends Error {}

const tokenFromRequest = (request: Request): string => {
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match?.[1]) throw new ManagedAuthenticationError("A valid sign-in is required.");
  return match[1];
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const jwksFor = (url: string) => {
  const cached = jwksCache.get(url);
  if (cached) return cached;
  const created = createRemoteJWKSet(new URL(url));
  jwksCache.set(url, created);
  return created;
};

export const verifyManagedRequest = async (
  request: Request,
  environment: ServiceEnvironment,
): Promise<VerifiedAuthClaims> => {
  const token = tokenFromRequest(request);
  try {
    const { payload } = await jwtVerify(token, jwksFor(environment.neonAuthJwksUrl), {
      issuer: environment.neonAuthIssuer,
      audience: environment.neonAuthAudience,
      requiredClaims: ["sub"],
    });
    if (!payload.sub) throw new ManagedAuthenticationError("The sign-in has no subject.");
    return payload as JWTPayload & VerifiedAuthClaims;
  } catch (error) {
    if (error instanceof ManagedAuthenticationError) throw error;
    throw new ManagedAuthenticationError("The sign-in could not be verified.");
  }
};
