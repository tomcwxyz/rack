import { proxyManaged } from "../_proxy.js";
export default { fetch: (request: Request) => proxyManaged(request, "preflight") };
