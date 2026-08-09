# Managed service migration 0001

Apply this migration with the Neon owner/migration connection, then configure two non-owner runtime connections:

- an authenticated application role that participates in Neon RLS and has membership in the existing `authenticated` role;
- a retention login role granted membership in `rack_retention` and nothing broader.

Do not use `neondb_owner` for `RACK_DATABASE_URL`; owner roles bypass row-level security. The service sets verified JWT claims in a transaction before authenticated queries.
