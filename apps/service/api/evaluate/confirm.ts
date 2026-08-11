import { readServiceEnvironment } from "../../src/env.js";
import { createEvaluationConfirmHandler } from "../../src/evaluationConfirmHandler.js";

export default {
  fetch: createEvaluationConfirmHandler({ environment: readServiceEnvironment() }),
};
