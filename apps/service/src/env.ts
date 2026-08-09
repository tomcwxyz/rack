export type ServiceEnvironment = {
  databaseUrl: string;
  workflowDatabaseUrl: string;
  retentionDatabaseUrl: string;
  neonAuthJwksUrl: string;
  neonAuthIssuer?: string;
  neonAuthAudience?: string;
  cronSecret: string;
};

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing managed service environment variable: ${name}`);
  return value;
};

export const readServiceEnvironment = (): ServiceEnvironment => ({
  databaseUrl: required("RACK_DATABASE_URL"),
  workflowDatabaseUrl: required("RACK_WORKFLOW_DATABASE_URL"),
  retentionDatabaseUrl: required("RACK_RETENTION_DATABASE_URL"),
  neonAuthJwksUrl: required("NEON_AUTH_JWKS_URL"),
  neonAuthIssuer: process.env.NEON_AUTH_ISSUER?.trim() || undefined,
  neonAuthAudience: process.env.NEON_AUTH_AUDIENCE?.trim() || undefined,
  cronSecret: required("CRON_SECRET"),
});
