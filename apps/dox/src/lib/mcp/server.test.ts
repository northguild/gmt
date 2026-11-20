// @vitest-environment node
/**
 * The MCP server through a real client over the Worker's `fetch`, in process. No network.
 */
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../../worker/index";
import { resetRateLimitState } from "../../../worker/rate-limit";
import { INDUSTRY_TAG_IDS } from "../industry-tags";
import { SITE_URL } from "../site";
import { executePageTool, type PageToolDef } from "../webmcp/page-tool";
import tools from "~/generated/mcp-tools.json";

const MODULES = import.meta.glob<{ def: PageToolDef }>("../webmcp/tools/*.ts", {
  eager: true,
});
const DEFS = Object.values(MODULES).map((mod) => mod.def);
const env = { ASSETS: { fetch: async () => new Response("asset") } } as never;
const ENDPOINT = "https://northguild.dev/gmt/api/mcp";

const opened: { client: Client; transport: StreamableHTTPClientTransport }[] =
  [];
async function connect(path = "") {
  const transport = new StreamableHTTPClientTransport(
    new URL(ENDPOINT + path),
    {
      fetch: (url, init) => worker.fetch(new Request(url, init), env),
    },
  );
  const client = new Client({ name: "dox-test", version: "0.0.0" });
  opened.push({ client, transport });
  await client.connect(transport);
  return client;
}

afterEach(async () => {
  for (const { client, transport } of opened.splice(0)) {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
  resetRateLimitState();
  vi.useRealTimers();
});

/** The clock is faked to the millisecond; the polyfill adds its own sub-millisecond digits. */
const settle = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value).replace(/(2026-11-19T12:00:00)\.\d+Z/g, "$1.000Z"),
  );

type Listed = { name: string; industries: string[] };
const LISTED = tools as unknown as Listed[];

describe("tools/list", () => {
  it("lists every generated tool under the all scope", async () => {
    const client = await connect();
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name).sort()).toEqual(
      LISTED.map((t) => t.name).sort(),
    );
    expect(listed.length).toBeGreaterThan(0);
    for (const tool of listed) {
      expect(tool).not.toHaveProperty("slug");
      expect(tool).not.toHaveProperty("industries");
      expect(tool).not.toHaveProperty("example");
    }
  });

  it.each(INDUSTRY_TAG_IDS)(
    "lists only the %s tools in its scope",
    async (id) => {
      const client = await connect(`/${id}`);
      const { tools: listed } = await client.listTools();
      expect(listed.map((t) => t.name).sort()).toEqual(
        LISTED.filter((t) => t.industries.includes(id))
          .map((t) => t.name)
          .sort(),
      );
    },
  );
});

describe("tools/call", () => {
  it("answers every tool's example as the shared run path does", async () => {
    const now = 1_795_089_600_000; // 2026-11-19T12:00:00Z
    vi.useFakeTimers({ now, toFake: ["Date", "performance", "hrtime"] });
    try {
      const client = await connect();
      for (const def of DEFS) {
        const expected = settle(
          await executePageTool(def, def.example, { base: SITE_URL }),
        );
        const result = await client.callTool({
          name: def.name,
          arguments: def.example as Record<string, unknown>,
        });
        expect(settle(result.structuredContent), def.name).toEqual(expected);
        const content = result.content as { type: string; text: string }[];
        expect(settle(JSON.parse(content[0].text)), def.name).toEqual(expected);
        expect(result.isError, def.name).toBe(false);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns invalid input as a tool result", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: DEFS[0].name,
      arguments: { nonsense: 1, zone: 42 },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: "invalid-input",
      issues: expect.any(Array),
    });
  });

  it("rejects an unknown name with -32602", async () => {
    const client = await connect();
    await expect(
      client.callTool({ name: "no_such_tool", arguments: {} }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it("rejects a name outside the scope with -32602", async () => {
    const outside = LISTED.find((t) => !t.industries.includes("transport"));
    expect(outside).toBeDefined();
    const client = await connect("/transport");
    await expect(
      client.callTool({ name: (outside as Listed).name, arguments: {} }),
    ).rejects.toMatchObject({ code: -32602 });
  });
});
