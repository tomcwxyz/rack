import { start } from "workflow/api";
import { createReliableCheckStartHandler } from "../../src/reliableCheckHandler.js";
import { readServiceEnvironment } from "../../src/env.js";
import { reliableCheckWorkflow } from "../../src/workflows/reliableCheck.js";

export default {
  fetch: createReliableCheckStartHandler({
    environment: readServiceEnvironment(),
    startWorkflow: async (runId) => {
      const run = await start(reliableCheckWorkflow, [runId]);
      return { workflowRunId: run.runId };
    },
  }),
};
