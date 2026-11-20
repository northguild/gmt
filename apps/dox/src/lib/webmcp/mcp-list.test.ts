/**
 * The generated MCP list matches WebMCP's listing by construction. Needs `pnpm generate`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { INDUSTRY_TAG_IDS } from "../industry-tags";
import { MCP_TOOL_LOADERS } from "../../generated/mcp-tool-loaders";
import { toolListing, type PageToolDef } from "./page-tool";

const SRC = path.resolve(import.meta.dirname, "../..");
const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(SRC, "generated", file), "utf8")) as T;

interface Entry extends ReturnType<typeof toolListing> {
  slug: string;
  industries: string[];
  example: unknown;
}
const LIST = readJson<Entry[]>("mcp-tools.json");
const INDUSTRIES = readJson<Record<string, string[]>>("tool-industries.json");

const MODULES = import.meta.glob<{ def: PageToolDef }>("./tools/*.ts", {
  eager: true,
});
const DEFS = new Map(
  Object.entries(MODULES).map(([file, mod]) => [
    path.basename(file, ".ts"),
    mod.def,
  ]),
);

describe("mcp-tools.json", () => {
  it("lists every tool module, and no other", () => {
    const slugs = readdirSync(path.join(SRC, "lib/webmcp/tools"))
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => file.slice(0, -3))
      .sort();
    expect(LIST.map((entry) => entry.slug).sort()).toEqual(slugs);
  });

  it("is sorted by name", () => {
    const names = LIST.map((entry) => entry.name);
    expect(names).toEqual([...names].sort());
  });

  it.each(LIST.map((entry) => [entry.slug, entry] as const))(
    "%s equals its module's listing",
    (slug, entry) => {
      const def = DEFS.get(slug);
      expect(def).toBeDefined();
      if (!def) return;
      const { slug: _slug, industries: _i, example, ...listing } = entry;
      expect(listing).toEqual(toolListing(def));
      expect(example).toEqual(def.example);
    },
  );

  it.each(LIST.map((entry) => [entry.slug, entry] as const))(
    "%s carries its page's industries",
    (slug, entry) => {
      expect(entry.industries).toEqual(INDUSTRIES[slug]);
      expect(entry.industries.length).toBeGreaterThan(0);
      for (const id of entry.industries) expect(INDUSTRY_TAG_IDS).toContain(id);
    },
  );
});

describe("mcp-tool-loaders.ts", () => {
  it("has one loader for each listed name", () => {
    expect(Object.keys(MCP_TOOL_LOADERS).sort()).toEqual(
      LIST.map((entry) => entry.name).sort(),
    );
  });

  it.each(LIST.map((entry) => entry.name))(
    "%s loads its module",
    async (name) => {
      const loader = MCP_TOOL_LOADERS[name];
      expect(loader).toBeDefined();
      const mod = await loader!();
      expect(mod.def.name).toBe(name);
    },
  );
});
