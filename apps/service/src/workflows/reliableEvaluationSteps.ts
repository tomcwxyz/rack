import { createNeonReliableEvaluationWorkflowStore } from "@rack/database";
import {
  readEvaluationModelRegistry,
  readEvaluationModelRunner,
} from "../evaluationConfig.js";
import { executeReliableModelEvaluation } from "../reliableModelEvaluation.js";

const workflowDatabaseUrl = (): string => {
  const value = process.env.RACK_WORKFLOW_DATABASE_URL?.trim();
  if (!value) throw new Error("RACK_WORKFLOW_DATABASE_URL is required for Reliable evaluation workflows.");
  return value;
};

export const executeReliableEvaluationStep = async (runId: string) => {
  "use step";
  const store = createNeonReliableEvaluationWorkflowStore({
    databaseUrl: workflowDatabaseUrl(),
    runId,
  });
  try {
    return await executeReliableModelEvaluation({
      store,
      registry: readEvaluationModelRegistry(),
      runner: readEvaluationModelRunner(),
    });
  } catch (error) {
    try {
      return await store.incomplete();
    } catch {
      throw error;
    }
  }
};
