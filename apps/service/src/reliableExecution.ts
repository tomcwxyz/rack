import type { ReliableWorkflowStore } from "@rack/database";
import { runQuickCheck, type DurableEvaluationSummary } from "@rack/managed";

export const executeReliableCheck = async (
  store: ReliableWorkflowStore,
  now = new Date(),
): Promise<DurableEvaluationSummary> => {
  const current = await store.getStatus();
  if (!current) throw new Error("Reliable check does not exist.");
  if (current.status === "completed") return current.summary;
  if (current.status === "failed") throw new Error("Reliable check has already failed.");

  await store.markRunning();
  const request = await store.loadRequest();
  const summary = runQuickCheck(request, now);
  return store.complete(summary);
};
