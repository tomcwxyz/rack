import { start } from "workflow/api";
import { readServiceEnvironment } from "../../src/env.js";
import { createReliableEvaluationStartHandler } from "../../src/reliableEvaluationHandler.js";
import { reliableEvaluationWorkflow } from "../../src/workflows/reliableEvaluation.js";

export default {
  fetch: createReliableEvaluationStartHandler({
    environment: readServiceEnvironment(),
    startWorkflow: async (runId) => {
      const run = await start(reliableEvaluationWorkflow, [runId]);
      return { workflowRunId: run.runId };
    },
  }),
};
