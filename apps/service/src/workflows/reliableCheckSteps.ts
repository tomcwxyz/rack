import { createNeonReliableWorkflowStore } from "@rack/database";
import type { DurableEvaluationSummary } from "@rack/managed";
import { readServiceEnvironment } from "../env.js";
import { executeReliableCheck } from "../reliableExecution.js";

export async function evaluateReliableCheckStep(
  runId: string,
): Promise<DurableEvaluationSummary> {
  "use step";
  const environment = readServiceEnvironment();
  const store = createNeonReliableWorkflowStore({
    databaseUrl: environment.workflowDatabaseUrl,
    runId,
  });
  return executeReliableCheck(store, new Date());
}

export async function markReliableCheckFailedStep(runId: string): Promise<void> {
  "use step";
  const environment = readServiceEnvironment();
  const store = createNeonReliableWorkflowStore({
    databaseUrl: environment.workflowDatabaseUrl,
    runId,
  });
  await store.markFailed();
}
