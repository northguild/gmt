/// <reference types="vitest/globals" />
import { loadGuideSources } from "./guide-sources";

describe("loadGuideSources", () => {
  it("finds every guide file and strips frontmatter", () => {
    const sources = loadGuideSources();
    expect(sources.length).toBeGreaterThan(20); // 24 at last count (2026-09-09)
    for (const s of sources) {
      expect(s.body).not.toMatch(/^---/);
    }
  });

  it("derives a route without the index segment for an index.mdx", () => {
    const sources = loadGuideSources();
    const guidesIndex = sources.find((s) => s.route === "/guides/");
    expect(guidesIndex).toBeDefined();
  });

  it("derives a nested route matching Starlight's content-collection routing", () => {
    const sources = loadGuideSources();
    const formatting = sources.find(
      (s) => s.route === "/guides/core-date-operations/formatting/",
    );
    expect(formatting).toBeDefined();
    expect(formatting!.title).toBe("Formatting");
  });

  it("strips import statements out of every source body before it reaches the retrieval corpus", () => {
    // toGuideSource runs stripMdx on the body, so a leaked `import … from
    // "...";` (or its multi-line, continuation-line form) never ships in a
    // retrieval chunk's text — see page-markdown.test coverage in
    // scripts/llms.test.ts for the mechanism itself.
    //
    // Fenced code is exempt: a guide that shows `import { addDate } from
    // "@northguild/gmt";` means the reader to see that line, and stripMdx
    // deliberately leaves code samples alone.
    const proseOnly = (body: string): string =>
      body.replace(/^```[\s\S]*?^```/gm, "");

    const sources = loadGuideSources();
    for (const s of sources) {
      const prose = proseOnly(s.body);
      expect(prose, `${s.route} still has an import line`).not.toMatch(
        /^\s*import\s/m,
      );
      expect(
        prose,
        `${s.route} has a leftover multi-line import remnant`,
      ).not.toMatch(/^\}[ \t]*from[ \t]*["']/m);
    }
  });
});
