/// <reference types="vitest/globals" />

/**
 * The industry tags on the tool, scenario, guide and mistake pages: every layer has a
 * tag, every page has a tag, and a page's tags agree with the functions it uses.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { gmtStats } from "../data/gmt-stats";
import {
  CORE_INDUSTRY,
  INDUSTRY_ICON_PATHS,
  INDUSTRY_TAG_IDS,
  industryTag,
} from "./industry-tags";

const DOCS_DIR = path.resolve(import.meta.dirname, "..", "content", "docs");

/** The sections whose pages carry a tag. An index page lists other pages and
 *  carries none. */
const TAGGED_SECTIONS = ["tools", "scenarios", "guides", "mistakes"];

const pages = TAGGED_SECTIONS.flatMap((section) =>
  (readdirSync(path.join(DOCS_DIR, section), { recursive: true }) as string[])
    .filter((file) => /\.mdx?$/.test(file) && !/(^|\/)index\.mdx?$/.test(file))
    .sort()
    .map((file) => {
      const source = readFileSync(path.join(DOCS_DIR, section, file), "utf8");
      const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const declared = (
        frontmatter.match(/^industries:\s*\[(.*)\]$/m)?.[1] ?? ""
      )
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      // The industry layers the page uses: the ones whose reference pages it links to, and the
      // ones its code imports from.
      const used = gmtStats.industries.filter(
        (layer) =>
          source.includes(`/reference/${layer}/`) ||
          source.includes(`@northguild/gmt/${layer}"`),
      );
      return { page: `${section}/${file}`, declared, used };
    }),
);

describe("industry tags", () => {
  it("has a tag for core and for every industry layer the library ships", () => {
    expect(INDUSTRY_TAG_IDS).toEqual([CORE_INDUSTRY, ...gmtStats.industries]);
    for (const id of INDUSTRY_TAG_IDS) {
      expect({ id, tag: industryTag(id) }).toEqual({
        id,
        tag: expect.objectContaining({ id }),
      });
    }
  });

  it("gives every tag a label, a definition and an icon that exists", () => {
    for (const id of INDUSTRY_TAG_IDS) {
      const tag = industryTag(id)!;
      expect(tag.label.length).toBeGreaterThan(0);
      expect(tag.definition.length).toBeGreaterThan(0);
      expect(Object.keys(INDUSTRY_ICON_PATHS)).toContain(tag.icon);
    }
  });

  it("knows no industry outside the list", () => {
    expect(industryTag("logistics")).toBeUndefined();
    expect(industryTag("toString")).toBeUndefined();
  });

  it("finds pages in every tagged section", () => {
    for (const section of TAGGED_SECTIONS) {
      expect(
        pages.filter(({ page }) => page.startsWith(`${section}/`)).length,
      ).toBeGreaterThan(0);
    }
  });

  it.each(pages)("$page declares known industries", ({ declared }) => {
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((id) => industryTag(id) === undefined)).toEqual([]);
  });

  /*
   * A page's tag is the layer its functions come from. A page that uses no industry layer is a
   * core page; one that does is tagged with a layer it uses, never `core`. A page may touch a
   * second layer in passing (the Free Time Ledger points at `dwellTime` for the day count it
   * shares) without taking that layer's tag, so the declared tags are a subset of the layers
   * used and not the whole set.
   */
  it.each(pages)(
    "$page is tagged with a layer it uses",
    ({ declared, used }) => {
      if (used.length === 0) {
        expect(declared).toEqual([CORE_INDUSTRY]);
      } else {
        expect(declared.filter((id) => !used.includes(id))).toEqual([]);
      }
    },
  );
});

describe("IndustryTags.astro", () => {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "..", "components", "IndustryTags.astro"),
    "utf8",
  );

  it("puts a tag's definition where a keyboard or touch reader can reach it, not in a title on a span", () => {
    // A `title` on a non-focusable span shows only on a mouse hover.
    expect(source).not.toMatch(/title=\{/);
    expect(source).toMatch(/<button[\s\S]*?aria-describedby=/);
  });
});
