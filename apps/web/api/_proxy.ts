// Server-side same-origin bridge: the model-service URL and all provider keys
// remain server-only. The upstream service validates the bearer token and budget.
export async function proxyManaged(request: Request, path: "preflight" | "confirm"): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 8192) {
    return Response.json({ error: { code: "unauthorised", message: "Sign in to run an AI trial." } }, { status: 401 });
  }
  const target = process.env.RACK_SERVICE_URL?.replace(/\/+$/, "");
  if (!target || !/^https:\/\//i.test(target)) {
    return Response.json({ error: { code: "service-not-configured", message: "Managed AI trials are not available on this pilot yet." } }, { status: 503 });
  }
  const body = await request.text();
  if (body.length > 520_000) return new Response("Request too large", { status: 413 });
  try {
    const response = await fetch(target + "/api/evaluate/" + path, {
      method: "POST", headers: { "content-type": "application/json", authorization }, body,
      signal: AbortSignal.timeout(90_000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: { code: "internal-error", message: "Managed service could not be reached." } }, { status: 502 });
  }
}
