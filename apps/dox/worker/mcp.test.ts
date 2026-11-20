// @vitest-environment node
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { gmtVersion } from "~/generated/versions";
import tools from "~/generated/mcp-tools.json";
import worker from "./index";
import { MCP_RATE_LIMIT } from "./mcp";
import { resetRateLimitState } from "./rate-limit";

const env = { ASSETS: { fetch: async () => new Response("asset") } } as never;
const URL_ALL = "https://northguild.dev/gmt/api/mcp";

function rpc(
  body: unknown,
  {
    url = URL_ALL,
    ip = "1.2.3.4",
    version,
  }: { url?: string; ip?: string; version?: string } = {},
) {
  return worker.fetch(
    new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "cf-connecting-ip": ip,
        ...(version ? { "mcp-protocol-version": version } : {}),
      },
      body: JSON.stringify(body),
    }),
    env,
  );
}

const initialize = (protocolVersion: string) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: "t", version: "0" },
  },
});

/** The 2025-era stateless path answers as one SSE `message` event; the modern path answers JSON. */
async function readRpc(response: Response): Promise<unknown> {
  const text = await response.text();
  const data = text.startsWith("event:")
    ? (text.split("\n").find((line) => line.startsWith("data:")) ?? "").slice(5)
    : text;
  return JSON.parse(data);
}

afterEach(() => resetRateLimitState());

describe("the MCP endpoint", () => {
  it("answers a 2025-era initialize with the library version", async () => {
    const response = await rpc(initialize("2025-06-18"));
    expect(response.status).toBe(200);
    const body = (await readRpc(response)) as {
      result: { serverInfo: { version: string } };
    };
    expect(body.result.serverInfo.version).toBe(gmtVersion);
  });

  it("answers the SDK's latest protocol version too", async () => {
    const response = await rpc(initialize(LATEST_PROTOCOL_VERSION));
    expect(response.status).toBe(200);
  });

  it.each(["GET", "DELETE"])("answers %s with 405", async (method) => {
    const response = await worker.fetch(
      new Request(URL_ALL, {
        method,
        headers: { "cf-connecting-ip": "1.1.1.1" },
      }),
      env,
    );
    expect(response.status).toBe(405);
  });

  it("answers an oversized body with 413", async () => {
    const response = await worker.fetch(
      new Request(URL_ALL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "70000",
        },
        body: "x".repeat(70_000),
      }),
      env,
    );
    expect(response.status).toBe(413);
  });

  it("answers an oversized body sent without content-length with 413", async () => {
    const chunk = new TextEncoder().encode(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        pad: "x".repeat(70_000),
      }),
    );
    const response = await worker.fetch(
      new Request(URL_ALL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-06-18",
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(chunk);
            controller.close();
          },
        }),
        duplex: "half",
      } as RequestInit),
      env,
    );
    expect(response.status).toBe(413);
  });

  it("limits one IP address and leaves another alone", async () => {
    const ping = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
    for (let i = 0; i < MCP_RATE_LIMIT.max; i += 1) {
      await rpc(ping, { version: "2025-06-18" });
    }
    const limited = await rpc(ping, { version: "2025-06-18" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
    expect(await limited.json()).toEqual({
      error: "rate-limited",
      retryable: true,
    });
    const other = await rpc(ping, { ip: "9.9.9.9", version: "2025-06-18" });
    expect(other.status).toBe(200);
  });

  it("lists only the scope's tools and refuses an unknown scope", async () => {
    const response = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
      { url: `${URL_ALL}/transport`, version: "2025-06-18" },
    );
    const body = (await readRpc(response)) as {
      result: { tools: { name: string }[] };
    };
    const expected = (tools as { name: string; industries: string[] }[])
      .filter((t) => t.industries.includes("transport"))
      .map((t) => t.name)
      .sort();
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(expected);

    const nope = await rpc({}, { url: `${URL_ALL}/nope` });
    expect(nope.status).toBe(404);
    expect(await nope.json()).toMatchObject({
      error: "unknown-scope",
      scopes: expect.any(Array),
    });
  });
});
