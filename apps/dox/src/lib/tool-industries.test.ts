/// <reference types="vitest/globals" />

/**
 * The industry tags on the tool pages: every layer has a tag, every tool has a
 * tag, and a tool's tags agree with the functions its page links to.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { gmtStats } from "../data/gmt-stats";
import {
  CORE_INDUSTRY,
  INDUSTRY_ICON_PATHS,
  TOOL_INDUSTRY_IDS,
  toolIndustry,
} from "./tool-industries";

const TOOLS_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "content",
  "docs",
  "tools",
);

const pages = readdirSync(TOOLS_DIR)
  .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
  .sort()
  .map((file) => {
    const source = readFileSync(path.join(TOOLS_DIR, file), "utf8");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const declared = (frontmatter.match(/^industries:\s*\[(.*)\]$/m)?.[1] ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    // The industry layers whose reference pages the tool's text links to.
    const linked = [
      ...new Set(
        [...source.matchAll(/\/reference\/([a-z]+)\//g)]
          .map((match) => match[1]!)
          .filter((namespace) => gmtStats.industries.includes(namespace)),
      ),
    ];
    return { file, declared, linked };
  });

describe("tool industries", () => {
  it("has a tag for core and for every industry layer the library ships", () => {
    expect(TOOL_INDUSTRY_IDS).toEqual([CORE_INDUSTRY, ...gmtStats.industries]);
    for (const id of TOOL_INDUSTRY_IDS) {
      expect({ id, tag: toolIndustry(id) }).toEqual({
        id,
        tag: expect.objectContaining({ id }),
      });
    }
  });

  it("gives every tag a label that is its id, a definition and an icon that exists", () => {
    for (const id of TOOL_INDUSTRY_IDS) {
      const tag = toolIndustry(id)!;
      // The index heading's anchor is the label lower-cased, and a tag links to `#<id>`.
      expect(tag.label.toLowerCase()).toBe(id);
      expect(tag.definition.length).toBeGreaterThan(0);
      expect(Object.keys(INDUSTRY_ICON_PATHS)).toContain(tag.icon);
    }
  });

  it("knows no industry outside the list", () => {
    expect(toolIndustry("logistics")).toBeUndefined();
    expect(toolIndustry("toString")).toBeUndefined();
  });

  it("finds the tool pages", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("$file declares known industries", ({ declared }) => {
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((id) => toolIndustry(id) === undefined)).toEqual([]);
  });

  /*
   * A tool's tag is the layer its functions come from. A page that links to no industry layer's
   * reference is a core tool; one that does is tagged with a layer it links to, never `core`. A
   * page may link to a second layer in passing (the Free Time Ledger points at `dwellTime` for
   * the day count it shares) without taking that layer's tag, so the declared tags are a subset
   * of the linked layers and not the whole set.
   */
  it.each(pages)("$file is tagged with a layer it links to", ({ declared, linked }) => {
    if (linked.length === 0) {
      expect(declared).toEqual([CORE_INDUSTRY]);
    } else {
      expect(declared.filter((id) => !linked.includes(id))).toEqual([]);
    }
  });
});
