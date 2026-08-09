export default {
  fetch(request: Request) {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { allow: "GET" } });
    }
    return Response.json(
      { ok: true, service: "rack-managed", schemaVersion: "0.1" },
      { headers: { "cache-control": "no-store" } },
    );
  },
};
