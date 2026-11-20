/**
 * `POST /gmt/api/mcp` and `/gmt/api/mcp/<industry>` (DOX-G14): the page tools as a remote MCP
 * server. Stateless and without sign-in. A 2026-07-28 exchange is answered as JSON; the SDK answers a
 * 2025-era request as one SSE `message` event, which Streamable HTTP clients must accept. The limiter is per Worker instance, like the
 * chat's, and loose on purpose: hosted chat apps call from shared IP addresses.
 */
import { createMcpHandler } from "@modelcontextprotocol/server";
import { getUnixNow } from "@northguild/gmt/unix/get";
import { createDoxMcpServer } from "../src/lib/mcp/server";
import { checkRateLimit, clientIdFromRequest } from "./rate-limit";

export const MCP_RATE_LIMIT = { max: 300, windowSeconds: 60 };
const MAX_BODY_BYTES = 65_536;

type McpHandler = ReturnType<typeof createMcpHandler>;
const handlers = new Map<string, McpHandler>();

/** One handler for each scope, made on first use. It builds a fresh `Server` for each request. */
function handlerFor(scope: string): McpHandler {
  let handler = handlers.get(scope);
  if (!handler) {
    handler = createMcpHandler(() => createDoxMcpServer(scope), {
      responseMode: "json",
      // Never set `legacy: "reject"`: most chat apps still send 2025-era requests.
      // The SDK's own bound also covers a body sent without `content-length`.
      maxRequestBodySize: MAX_BODY_BYTES,
      // A 2025-era reply is one SSE event that closes at once, so it needs no keepalive timer.
      keepAliveMs: 0,
    });
    handlers.set(scope, handler);
  }
  return handler;
}

export async function handleMcp(
  request: Request,
  scope: string,
): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return Response.json(
      { error: "payload-too-large", retryable: false },
      { status: 413 },
    );
  }

  const limit = checkRateLimit(
    `mcp:${clientIdFromRequest(request)}`,
    getUnixNow(),
    MCP_RATE_LIMIT,
  );
  if (!limit.allowed) {
    return Response.json(
      { error: "rate-limited", retryable: true },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfterSeconds ?? 60) },
      },
    );
  }

  return handlerFor(scope).fetch(request);
}
