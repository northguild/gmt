/// <reference types="vitest/globals" />
import type { GuideSource } from "./guide-sources";
import { buildGuideChunks } from "./guide-chunks";

const SOURCE: GuideSource = {
  route: "/guides/core-date-operations/formatting/",
  title: "Formatting",
  body: `Use these functions to render a date for a user.

## Absolute formatting with locale

Pass a locale string to get a localized result.

## Locale-ordered parts

Returns parts instead of a finished string.
`,
};

describe("buildGuideChunks", () => {
  it("emits an intro chunk at the page's own URL (no fragment)", () => {
    const chunks = buildGuideChunks([SOURCE]);
    const intro = chunks.find((c) => c.url === SOURCE.route);
    expect(intro).toBeDefined();
    expect(intro!.text).toContain("Use these functions");
    expect(intro!.title).toBe("Formatting");
  });

  it("emits one chunk per heading, fragmented to a slugified anchor", () => {
    const chunks = buildGuideChunks([SOURCE]);
    const first = chunks.find((c) =>
      c.url.endsWith("#absolute-formatting-with-locale"),
    );
    expect(first).toBeDefined();
    expect(first!.text).toContain("Pass a locale string");
    expect(first!.title).toBe("Formatting › Absolute formatting with locale");

    const second = chunks.find((c) => c.url.endsWith("#locale-ordered-parts"));
    expect(second).toBeDefined();
    expect(second!.text).toContain("Returns parts instead");
  });

  it("derives namespace from the route's top-level guide directory", () => {
    const [chunk] = buildGuideChunks([SOURCE]);
    expect(chunk.namespace).toBe("core-date-operations");
  });

  it("skips an empty intro when the body starts immediately with a heading", () => {
    const noIntro: GuideSource = {
      route: "/guides/concepts/",
      title: "Concepts",
      body: "## First heading\n\nBody text.\n",
    };
    const chunks = buildGuideChunks([noIntro]);
    expect(chunks.find((c) => c.url === noIntro.route)).toBeUndefined();
    expect(chunks).toHaveLength(1);
  });

  it("disambiguates duplicate heading text across guides with per-guide sluggers", () => {
    const a: GuideSource = {
      route: "/guides/a/",
      title: "A",
      body: "## Example\n\nFrom A.\n",
    };
    const b: GuideSource = {
      route: "/guides/b/",
      title: "B",
      body: "## Example\n\nFrom B.\n",
    };
    const chunks = buildGuideChunks([a, b]);
    // Each guide gets its own slugger instance, so both anchors are plain
    // "#example" — correct, since they're on different pages and never
    // collide within a single page's own anchor namespace.
    expect(chunks.map((c) => c.url)).toEqual([
      "/guides/a/#example",
      "/guides/b/#example",
    ]);
  });
});
