import handler from "vinext/server/fetch-handler";

/**
 * Explicit Cloudflare Worker entrypoint.
 *
 * The root route is kept fail-safe: if the generated App Router build returns
 * a 404 for `/`, render the verified Pump terminal route instead of exposing
 * the framework 404 page at the production root.
 */
export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    const response = await handler.fetch(request, env, ctx);

    if (new URL(request.url).pathname === "/" && response.status === 404) {
      const pumpUrl = new URL("/pump", request.url);
      const pumpRequest = new Request(pumpUrl, request);
      return handler.fetch(pumpRequest, env, ctx);
    }

    return response;
  },
};
