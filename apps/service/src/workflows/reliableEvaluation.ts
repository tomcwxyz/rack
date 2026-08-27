import { executeReliableEvaluationStep } from "./reliableEvaluationSteps.js";

export async function reliableEvaluationWorkflow(runId: string) {
  "use workflow";
  return executeReliableEvaluationStep(runId);
}
