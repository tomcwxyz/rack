import { readServiceEnvironment } from "../../src/env.js";
import { createReliableCheckStatusHandler } from "../../src/reliableCheckHandler.js";

export default {
  fetch: createReliableCheckStatusHandler({ environment: readServiceEnvironment() }),
};
