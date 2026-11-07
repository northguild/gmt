import { describe, expect, it } from "vitest";
import { stripFrontmatter } from "./page-markdown";
import { pageEntries, pageIndustries } from "./page-industries";

const RAW = import.meta.glob("../content/docs/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** The pages that resolve to no tag, by path. A splash page is skipped by its `template`. */
function untagged(raw: Record<string, string>): string[] {
  const pages = pageEntries(raw);
  const all = pages.map(({ entry }) => entry);
  return pages
    .filter(({ entry }) => entry.template !== "splash")
    .filter(
      ({ entry }) =>
        pageIndustries(entry.id, entry.industries, all).length === 0,
    )
    .map(({ rel }) => rel)
    .sort();
}

describe("industry tags cover every docs page", () => {
  it("leaves no page that is not splash without a label", () => {
    const hasReference = Object.keys(RAW).some((path) =>
      path.includes("/content/docs/reference/"),
    );
    if (!hasReference) {
      console.warn(
        "skipped the generated reference pages: run `pnpm run generate` first",
      );
    }
    expect(untagged(RAW)).toEqual([]);
  });

  it("names a page that has no tag", () => {
    const page = (front: string) => `---\ntitle: "T"\n${front}---\nBody\n`;
    const fixture = {
      "../content/docs/guides/index.mdx": page(""),
      "../content/docs/guides/tagged.mdx": page("industries: [core]\n"),
      "../content/docs/orphan.mdx": page(""),
      "../content/docs/index.mdx": page("template: splash\n"),
    };
    expect(untagged(fixture)).toEqual(["orphan"]);
  });

  it("reads the splash template from the frontmatter, not from a list of names", () => {
    expect(
      stripFrontmatter(RAW["../content/docs/index.mdx"]!).data.template,
    ).toBe("splash");
  });
});
