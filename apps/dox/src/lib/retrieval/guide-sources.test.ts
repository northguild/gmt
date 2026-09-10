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
});
