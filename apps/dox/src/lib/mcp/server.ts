/**
 * The MCP server for the page tools (DOX-G14). `createDoxMcpServer` returns a low-level `Server`
 * so `createMcpHandler` on the Worker (and, later, a stdio entry) can serve it.
 *
 * `tools/list` reads the generated JSON and never evaluates a tool module. `tools/call` loads
 * only the module it calls, through the generated loaders, then runs it with the same
 * `executePageTool` the WebMCP surface uses, so a chat app and the page answer alike.
 */
import {
  ProtocolError,
  ProtocolErrorCode,
  Server,
} from "@modelcontextprotocol/server";
import { executePageTool } from "../webmcp/page-tool";
import tools from "~/generated/mcp-tools.json";
import { MCP_TOOL_LOADERS } from "~/generated/mcp-tool-loaders";
import { gmtVersion } from "~/generated/versions";
import { SITE_URL } from "../site";

interface ListedTool {
  name: string;
  industries: readonly string[];
}

/** The tools a scope offers: all of them, or those whose page carries the industry tag. */
function scopedTools(scope: string) {
  return (tools as readonly ListedTool[]).filter(
    (tool) => scope === "all" || tool.industries.includes(scope),
  );
}

export function createDoxMcpServer(scope: string): Server {
  const server = new Server(
    { name: "gmt-dox-tools", title: "GMT tools", version: gmtVersion },
    { capabilities: { tools: {} } },
  );
  const inScope = scopedTools(scope);
  const names = new Set(inScope.map((tool) => tool.name));

  server.setRequestHandler("tools/list", () => ({
    tools: inScope.map((tool) => {
      const {
        slug: _slug,
        industries: _industries,
        example: _example,
        ...listing
      } = tool as ListedTool & {
        slug?: unknown;
        example?: unknown;
        [key: string]: unknown;
      };
      return listing as never;
    }),
  }));

  server.setRequestHandler("tools/call", async (request, ctx) => {
    const name = request.params.name;
    if (!names.has(name) || !(name in MCP_TOOL_LOADERS)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        `Unknown tool: ${name}`,
      );
    }
    const { def } = await MCP_TOOL_LOADERS[name]();
    const answer = await executePageTool(def, request.params.arguments ?? {}, {
      signal: ctx.mcpReq.signal,
      base: SITE_URL,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(answer) }],
      structuredContent: answer as never,
      isError: !answer.ok,
    };
  });

  return server;
}
