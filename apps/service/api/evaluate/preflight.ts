import { readServiceEnvironment } from "../../src/env.js";
import { createEvaluationPreflightHandler } from "../../src/evaluationPreflightHandler.js";

export default {
  fetch: createEvaluationPreflightHandler({ environment: readServiceEnvironment() }),
};
