# 0008 — practice evaluation privacy

Implements the first persistence consequence of ADR 024.

Managed requests may need an authenticated initiator while they are being created and while transient content is retained. That identity is not the subject of evaluation and must not become a durable individual performance history.

This migration therefore:

- makes `rack_managed_runs.user_id` nullable;
- retains the authenticated write constraint for new work;
- gives the narrow retention role permission to clear only that column;
- allows clearing only after the 24-hour transient window.

The ordinary durable evaluation dimensions remain Rack fingerprint, Set-up/profile, target/host, result and model/accounting metadata.
