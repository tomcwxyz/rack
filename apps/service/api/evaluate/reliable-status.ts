import { readServiceEnvironment } from "../../src/env.js";
import { createReliableEvaluationStatusHandler } from "../../src/reliableEvaluationHandler.js";

export default {
  fetch: createReliableEvaluationStatusHandler({
    environment: readServiceEnvironment(),
  }),
};
