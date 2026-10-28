import { markdownTwinSlug, markdownTwinSlugs } from "./md-twin";

const DOCS = "/repo/apps/dox/src/content/docs";

describe("markdownTwinSlug", () => {
  it("serves a page with a slug: at its slug, an index page included", () => {
    expect(
      markdownTwinSlug(
        `${DOCS}/reference/workforce/index.mdx`,
        "reference/workforce",
      ),
    ).toBe("reference/workforce");
    expect(markdownTwinSlug(`${DOCS}/reference/index.mdx`, "reference")).toBe(
      "reference",
    );
    expect(
      markdownTwinSlug(
        `${DOCS}/reference/plain/calculate/addDate.mdx`,
        "reference/plain/calculate/addDate",
      ),
    ).toBe("reference/plain/calculate/addDate");
  });

  it("serves any other page at its path, an index page under its folder", () => {
    expect(markdownTwinSlug(`${DOCS}/guides/index.mdx`)).toBe("guides/index");
    expect(markdownTwinSlug(`${DOCS}/install.mdx`)).toBe("install");
    expect(markdownTwinSlug(`${DOCS}/index.mdx`)).toBe("index");
  });
});

describe("markdownTwinSlugs", () => {
  it("reads each page's slug: from its frontmatter, keyed by its path", () => {
    const twins = markdownTwinSlugs({
      "../content/docs/reference/workforce/index.mdx":
        '---\ntitle: "Workforce"\nslug: "reference/workforce"\n---\n\nBody.\n',
      "../content/docs/guides/index.mdx":
        '---\ntitle: "Guides"\n---\n\nBody.\n',
      "../content/docs/index.mdx": "---\ntitle: Home\n---\n",
    });
    expect([...twins]).toEqual([
      ["reference/workforce/index", "reference/workforce"],
      ["guides/index", "guides/index"],
      ["index", "index"],
    ]);
  });
});
