/**
 * Every tool page has one WebMCP tool, built from the schema the chat tool already uses.
 *
 * Counts are derived from the folder of pages, never typed. A page without a module fails here.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import * as schemas from "../dox-tool-schemas";
import { DOX_TOOL_DOCS } from "../dox-tool-schemas";
import {
  describeTool,
  toModelContextTool,
  type PageToolDef,
} from "./page-tool";

const SRC = path.resolve(import.meta.dirname, "../..");
const TOOLS_DIR = path.join(SRC, "content/docs/tools");

const PAGES = readdirSync(TOOLS_DIR)
  .filter((file) => file.endsWith(".mdx"))
  .map((file) => file.slice(0, -".mdx".length))
  .filter((slug) => slug !== "index")
  .sort();

const MODULES = import.meta.glob<{ def: PageToolDef }>("./tools/*.ts", {
  eager: true,
});
const DEFS = Object.entries(MODULES).map(([file, mod]) => ({
  slug: path.basename(file, ".ts"),
  def: mod.def,
}));

const NAME =
  /^(compute|convert|decode|read|check|compare|list|find|schedule|resolve|build|measure)_[a-z0-9_]+$/;
const FORBIDDEN = /\b(drag|click|slider|drawn|widget|shown|page)s?\b/i;

/** Every refinement (`.refine` or `.superRefine`) in a schema, at any depth. */
function countRefinements(schema: unknown, seen = new Set<unknown>()): number {
  if (typeof schema !== "object" || schema === null || seen.has(schema))
    return 0;
  seen.add(schema);
  const internals = (schema as { _zod?: { def?: Record<string, unknown> } })
    ._zod;
  if (!internals?.def) {
    return Object.values(schema).reduce<number>(
      (sum, value) => sum + countRefinements(value, seen),
      0,
    );
  }
  const def = internals.def;
  const checks = Array.isArray(def.checks) ? def.checks : [];
  let total = checks.filter(
    (check) =>
      (check as { _zod?: { def?: { check?: string } } })._zod?.def?.check ===
      "custom",
  ).length;
  for (const [key, value] of Object.entries(def)) {
    if (key !== "checks") total += countRefinements(value, seen);
  }
  return total;
}

describe("the tool pages", () => {
  it("are found in the folder", () => {
    expect(PAGES.length).toBeGreaterThan(0);
  });

  it("each have a module, and every module has a page", () => {
    const withModule = new Set(DEFS.map((d) => d.slug));
    expect(PAGES.filter((s) => !withModule.has(s))).toEqual([]);
    expect(DEFS.filter((d) => !PAGES.includes(d.slug))).toEqual([]);
  });

  it.each(PAGES)(
    "%s imports one widget component, which offers the tool",
    (slug) => {
      const source = readFileSync(path.join(TOOLS_DIR, `${slug}.mdx`), "utf8");
      const imports = [
        ...source.matchAll(/^import\s+(\w+)\s+from\s+"([^"]+)"/gm),
      ].filter((match) => match[1] !== "ToolLayout");
      expect(imports.map((match) => match[1])).toHaveLength(1);
      const component = readFileSync(
        path.resolve(TOOLS_DIR, imports[0]![2]!),
        "utf8",
      );
      expect(component).toMatch(
        new RegExp(`offerPageTool\\(\\s*"${slug}"\\s*,`),
      );
    },
  );
});

describe("the tool modules", () => {
  it("are unique by name", () => {
    const names = DEFS.map((d) => d.def.name);
    expect(new Set(names).size).toBe(names.length);
  });

  describe.each(DEFS)("$slug", ({ slug, def }) => {
    const input = (schemas as unknown as Record<string, unknown>)[
      `${def.doxTool}Input`
    ];

    it("names its own page", () => {
      expect(def.page).toBe(slug);
    });

    it("reuses the chat tool's schema", () => {
      expect(input).toBeDefined();
      expect(def.input).toBe(input);
    });

    it("has a name of the form verb_object", () => {
      expect(def.name).toMatch(NAME);
      expect(def.name.length).toBeLessThanOrEqual(48);
    });

    it("accepts its own example", () => {
      expect(def.input.safeParse(def.example).success).toBe(true);
    });

    it("describes an object input", () => {
      const tool = toModelContextTool(def);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
      expect(tool.annotations).toEqual({ readOnlyHint: true });
    });

    it("has a plain description of at most 1,000 characters", () => {
      const text = describeTool(def);
      expect(text.length).toBeLessThanOrEqual(1000);
      expect(text).not.toMatch(FORBIDDEN);
      expect(text).not.toMatch(/[`*#]/);
    });

    it("swaps only when the chat args hold a banned word or the description would be too long, and every swap applies", () => {
      const chat = DOX_TOOL_DOCS.find((doc) => doc.name === def.doxTool)!.args;
      // describeTool throws when a `from` is missing from the chat text.
      expect(() => describeTool(def)).not.toThrow();
      const unswapped = describeTool({ ...def, argsSwaps: undefined });
      expect(Boolean(def.argsSwaps?.length)).toBe(
        FORBIDDEN.test(chat) || unswapped.length > 1000,
      );
    });

    it("states a rule for every refinement in its schema", () => {
      expect(def.rules?.length ?? 0).toBeGreaterThanOrEqual(
        countRefinements(def.input),
      );
    });
  });

  it("counts a refinement on a field as well as on the object", () => {
    const field = z.string().refine((v) => v !== "");
    const nested = z.object({ a: z.array(field.optional()) });
    const top = z.object({ a: z.string() }).superRefine(() => {});
    expect(countRefinements(nested)).toBe(1);
    expect(countRefinements(top)).toBe(1);
    expect(countRefinements(z.object({ a: z.string().min(1) }))).toBe(0);
    expect(countRefinements(z.union([top, nested]))).toBe(2);
  });
});

describe("the zoned-earth hop", () => {
  // The landing page's Globe script reaches the tool through `zoned-earth-hop.ts`, one extra chunk, so
  // its own preload table stays small (first-input budget). Only this page does; every other page's
  // component names its tool module directly.
  const hop = readFileSync(
    path.join(SRC, "lib/webmcp/zoned-earth-hop.ts"),
    "utf8",
  );
  const globe = readFileSync(path.join(SRC, "components/Globe.astro"), "utf8");

  it("loads the tool module and nothing else, with no static import", () => {
    const code = hop.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).toMatch(/import\("\.\/tools\/zoned-earth"\)/);
    expect(code).not.toMatch(/^import\s/m);
    expect(code).not.toMatch(/\bawait\b/);
  });

  it("is what Globe.astro offers, in place of the tool module", () => {
    expect(globe).toMatch(/import\("\.\.\/lib\/webmcp\/zoned-earth-hop"\)/);
    expect(globe).not.toMatch(/webmcp\/tools\/zoned-earth/);
  });
});
