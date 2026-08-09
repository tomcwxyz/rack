import { createCheckHandler } from "../src/checkHandler.js";
import { readServiceEnvironment } from "../src/env.js";

export default {
  fetch: createCheckHandler({ environment: readServiceEnvironment() }),
};
