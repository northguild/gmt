// @vitest-environment node
/**
 * The chat-apps guide names the live address, real industry scopes and real tools. The page is
 * prose, so this reads the MDX and checks every URL, scope id and tool name it uses.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDUSTRY_TAG_IDS } from "../industry-tags";
import { SITE_URL } from "../site";
import tools from "~/generated/mcp-tools.json";

const MDX = readFileSync(
  new URL(
    "../../content/docs/guides/integration/chat-apps.mdx",
    import.meta.url,
  ),
  "utf8",
);
const ENDPOINT = `${SITE_URL}/api/mcp`;

describe("chat-apps guide", () => {
  it("writes every MCP address from SITE_URL, with no trailing slash", () => {
    const urls = MDX.match(/https:\/\/[^\s"`)|]*\/gmt\/api\/mcp[^\s"`)|]*/g);
    expect(urls?.length).toBeGreaterThan(0);
    for (const url of urls ?? []) {
      expect(url.startsWith(ENDPOINT)).toBe(true);
      expect(url.endsWith("/")).toBe(false);
    }
  });

  it("names only industry scopes the server serves", () => {
    const ids = [...MDX.matchAll(/\/api\/mcp\/([a-z0-9-]+)/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(INDUSTRY_TAG_IDS).toContain(id);
  });

  it("names only tools that exist", () => {
    const names = new Set(tools.map((tool) => tool.name));
    const used =
      MDX.match(
        /\b(?:check|compute|convert|decode|read|compare|list|find|schedule|resolve|build|measure)_[a-z0-9_]+/g,
      ) ?? [];
    for (const name of used) expect(names.has(name)).toBe(true);
  });
});
