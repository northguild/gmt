import { INDUSTRY_LAYER_IDS } from "./industry-tags";
import {
  docsRelativePath,
  industryPages,
  topLevelPages,
} from "./top-level-pages";

describe("docsRelativePath", () => {
  it.each`
    globKey                                      | expected
    ${"../content/docs/index.mdx"}               | ${"index"}
    ${"../content/docs/why-gmt.md"}              | ${"why-gmt"}
    ${"../content/docs/guides/concepts/dst.mdx"} | ${"guides/concepts/dst"}
  `("$globKey is $expected", ({ globKey, expected }) => {
    expect(docsRelativePath(globKey)).toBe(expected);
  });
});

describe("topLevelPages", () => {
  it("keeps only top-level pages, START_ORDER first, then the rest alphabetically", () => {
    const raw = {
      "../content/docs/zebra.md": "z",
      "../content/docs/install.mdx": "i",
      "../content/docs/guides/intro.mdx": "g",
      "../content/docs/alpha.mdx": "a",
      "../content/docs/upstream.mdx": "u",
      "../content/docs/index.mdx": "x",
      "../content/docs/why-gmt.mdx": "w",
      "../content/docs/core-rules.mdx": "c",
    };
    expect(topLevelPages(raw)).toEqual([
      { slug: "index", source: "x" },
      { slug: "why-gmt", source: "w" },
      { slug: "upstream", source: "u" },
      { slug: "core-rules", source: "c" },
      { slug: "install", source: "i" },
      { slug: "alpha", source: "a" },
      { slug: "zebra", source: "z" },
    ]);
  });

  it("returns nothing for a map with no top-level page", () => {
    expect(topLevelPages({ "../content/docs/guides/a.mdx": "a" })).toEqual([]);
  });
});

describe("industryPages", () => {
  const hub = (id: string) => `../content/docs/industries/${id}.mdx`;

  it("lists the index first, then each industry's hub in declared order, whatever order the glob gave", () => {
    const raw = {
      [hub(INDUSTRY_LAYER_IDS.at(-1)!)]: "last",
      "../content/docs/industries/index.mdx": "index",
      [hub(INDUSTRY_LAYER_IDS[0]!)]: "first",
    };
    expect(industryPages(raw).map((p) => p.slug)).toEqual([
      "industries/index",
      `industries/${INDUSTRY_LAYER_IDS[0]}`,
      `industries/${INDUSTRY_LAYER_IDS.at(-1)}`,
    ]);
  });

  it("leaves out a page of an industry that is not declared, and pages outside industries/", () => {
    expect(
      industryPages({
        "../content/docs/industries/elsewhere.mdx": "x",
        "../content/docs/guides/industries/index.mdx": "g",
        "../content/docs/why-gmt.mdx": "w",
      }),
    ).toEqual([]);
  });
});
