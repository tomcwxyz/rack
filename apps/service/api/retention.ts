import { readServiceEnvironment } from "../src/env.js";
import { createRetentionHandler } from "../src/retentionHandler.js";

export default {
  fetch: createRetentionHandler({ environment: readServiceEnvironment() }),
};
