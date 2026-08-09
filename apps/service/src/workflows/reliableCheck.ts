import type { DurableEvaluationSummary } from "@rack/managed";
import {
  evaluateReliableCheckStep,
  markReliableCheckFailedStep,
} from "./reliableCheckSteps.js";

export async function reliableCheckWorkflow(
  runId: string,
): Promise<DurableEvaluationSummary> {
  "use workflow";
  try {
    return await evaluateReliableCheckStep(runId);
  } catch (error) {
    await markReliableCheckFailedStep(runId);
    throw error;
  }
}
