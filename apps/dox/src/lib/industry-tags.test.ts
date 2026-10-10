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
  INDUSTRY_LAYER_IDS,
  INDUSTRY_TAG_IDS,
  industrySidebarCss,
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

describe("the sidebar icon of an industry group", () => {
  it("lists the industry layers without core", () => {
    expect(INDUSTRY_LAYER_IDS).toEqual(gmtStats.industries);
    expect(INDUSTRY_LAYER_IDS).not.toContain(CORE_INDUSTRY);
  });

  it("sets one icon per layer on the group that holds its marked Overview link, and none for core", () => {
    const css = industrySidebarCss().split("\n");
    expect(css).toHaveLength(INDUSTRY_LAYER_IDS.length);
    for (const id of INDUSTRY_LAYER_IDS) {
      const rule = css.find((line) =>
        line.includes(`a[data-gmt-industry="${id}"]`),
      );
      expect(rule, id).toMatch(
        /^details:has\(> ul > li > a\[data-gmt-industry="\w+"\]\) > summary\{--gmt-industry-icon:url\("data:image\/svg\+xml,/,
      );
    }
    expect(industrySidebarCss()).not.toContain('"core"');
  });

  it("draws the same glyph the tag shows, in no colour of its own", () => {
    const css = industrySidebarCss();
    for (const id of INDUSTRY_LAYER_IDS) {
      const glyph = INDUSTRY_ICON_PATHS[industryTag(id)!.icon]!;
      expect(css).toContain(encodeURIComponent(glyph));
    }
    expect(decodeURIComponent(css)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
});

describe("the sidebar divider", () => {
  const read = (file: string) =>
    readFileSync(
      path.resolve(import.meta.dirname, "..", "components", file),
      "utf8",
    );

  it("is text that names the list after it, not a link, a group or a stop", () => {
    const sublist = read("SidebarSublist.astro");
    const divider = sublist.slice(sublist.indexOf("divider && ("));
    const row = divider.slice(0, divider.indexOf(")\n\t}"));
    expect(row).toMatch(/<span id=\{dividerId\} class="gmt-sidebar-divider">/);
    expect(row).toMatch(/labelledby=\{dividerId\}/);
    expect(row).not.toMatch(/<a\b|<details|<summary|tabindex|<button/);
    expect(sublist).toMatch(/aria-labelledby=\{labelledby\}/);
  });

  it("is registered as the one Sidebar override", () => {
    const config = readFileSync(
      path.resolve(import.meta.dirname, "..", "..", "astro.config.mjs"),
      "utf8",
    );
    expect(config).toMatch(/Sidebar: "\.\/src\/components\/Sidebar\.astro"/);
  });
});
