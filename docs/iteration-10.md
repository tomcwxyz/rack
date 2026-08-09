# Iteration 10 — Reliable managed checks with Vercel Workflows

## Outcome

Rack now has two explicit managed-check modes:

- quick checks remain synchronous and return their result in the request;
- reliable checks return `202 Accepted` and run durably through Vercel Workflow SDK.

This iteration proves durable execution, retries, status polling and privacy boundaries with the existing deterministic evaluator. It deliberately does not introduce a model provider yet, so orchestration reliability can be reviewed independently from model quality, cost and provider data handling.

## Public contract

`@rack/managed` adds a reliable-check start response and status union while keeping the check input identical to the existing quick-check input.

Starting a reliable check returns:

- Rack managed run UUID;
- Vercel Workflow run ID for operational correlation;
- `queued` status;
- the original transient-content expiry timestamp.

Status is one of `queued`, `running`, `completed` or `failed`. Only `completed` carries a `DurableEvaluationSummary`; every other status has `summary: null`.

`@rack/managed/client` exposes `startReliableCheck()` and `getReliableCheckStatus()` alongside the existing `quickCheck()` method.

## Workflow boundary

The start endpoint stores the full request in the existing transient payload table before Workflow SDK is invoked. `start(reliableCheckWorkflow, [runId])` passes only the random Rack run UUID.

No authenticated user ID, instruction text, sample output or Rack project content is a workflow input.

`reliableCheckWorkflow` contains one evaluation step and a failure-recording step. Step functions, not the workflow orchestrator, open database connections. This keeps Node-only database/environment access out of the workflow sandbox.

The evaluation step:

1. opens the dedicated workflow database connection;
2. sets `rack.workflow_run_id` transaction-locally;
3. checks whether the run is already complete;
4. marks it running;
5. loads the unexpired transient request under RLS;
6. runs the deterministic evaluator;
7. inserts the durable summary idempotently and marks the Rack run complete.

If the evaluation step exhausts its automatic retries, the workflow calls a separate step that marks the Rack run failed without recording an error message or source excerpt.

## Run-scoped database role

Migration `0002_reliable_checks` creates `rack_workflow` as a NOLOGIN role. The deployed `RACK_WORKFLOW_DATABASE_URL` must use a login role granted membership in `rack_workflow` and nothing broader.

RLS combines the transaction-local run UUID with `kind = 'reliable-check'`. Grants are intentionally narrow:

- selected run columns: SELECT plus UPDATE of status/completion time;
- transient payload: SELECT only;
- evaluation summary: SELECT and INSERT.

The workflow role cannot read workspaces or memberships, cannot write/delete payloads, and cannot change their expiry.

The same migration tightens the authenticated membership policy: a user can only see/create their own owner membership inside a workspace they actually own.

## Retry and idempotency behaviour

Workflow steps are retryable. Rack therefore treats retries as normal rather than exceptional:

- a completed run returns its already-stored durable summary before transient content is touched;
- summary rows are keyed by Rack run ID and use `ON CONFLICT DO NOTHING`;
- completion status and summary insertion share a database transaction;
- the original transient payload row is never recreated or updated by workflow execution;
- a failure update refuses to overwrite a completed run.

A retry may repeat the deterministic evaluation if a previous attempt failed before the completion transaction committed. It cannot duplicate the managed run or durable summary. Model-backed evaluation should add an explicit external-call idempotency strategy before it is introduced.

## Workflow SDK version and residency

Iteration 10 declares `workflow` as `^4.6.2`; pnpm currently resolves and locks that range to 4.8.1. Vercel's Workflow backend is zero-configuration on deployment and provides durable queues, retries and observability.

The stable 4.x Vercel World stores workflow data in `iad1`. Rack's workflow data is therefore deliberately limited to the random run UUID and content-free evaluation summaries; raw managed content remains in Neon and retains its 24-hour expiry. Workflow SDK 5.x adds regional execution but remains on a beta release line, so adopting it is deferred until the pilot deployment review.

## Deliberately deferred

- model-backed rubric/adversarial evaluation;
- managed drafting;
- native desktop sign-in and managed-check UI;
- billing/pilot entitlements;
- team workspaces;
- Workflow SDK 5.x migration/regional placement;
- external model-call idempotency and cost controls.
