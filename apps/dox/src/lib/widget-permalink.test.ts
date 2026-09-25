/// <reference types="vitest/globals" />
import {
  decodeWidgetPermalink,
  encodeWidgetPermalink,
  seedFromLocation,
  WIDGET_PAGE_PATHS,
  type WidgetKind,
} from "./widget-permalink";

describe("widget permalinks", () => {
  it("round-trips arguments", () => {
    const args = { zone: "Asia/Tokyo" };
    const url = encodeWidgetPermalink("globe", args);
    const decoded = decodeWidgetPermalink(url.slice(url.indexOf("?")));
    expect(decoded).toEqual({ kind: "globe", args });
  });

  it("points at the widget's own page, never at /dox", () => {
    for (const kind of Object.keys(WIDGET_PAGE_PATHS) as WidgetKind[]) {
      const url = encodeWidgetPermalink(kind, {});
      expect(url.startsWith("/")).toBe(true);
      expect(url).not.toContain("/dox");
    }
  });

  it("targets /tools pages that actually exist", () => {
    /* The same rule as a citation: a link Dox produces must resolve. These are
       not in `route-manifest.ts` — that generator only covers `/reference` — so
       the check is against the real content files, globbed at build time the
       same way `guide-sources.ts` reads the guides. */
    const files = import.meta.glob("../content/docs/tools/*.mdx", {
      eager: true,
      query: "?raw",
      import: "default",
    });
    const slugs = new Set(
      Object.keys(files).map((f) =>
        f
          .split("/")
          .pop()
          ?.replace(/\.mdx$/, ""),
      ),
    );

    for (const kind of Object.keys(WIDGET_PAGE_PATHS) as WidgetKind[]) {
      const path = WIDGET_PAGE_PATHS[kind];
      expect(path.startsWith("/tools/"), path).toBe(true);
      const slug = path.replace("/tools/", "").replace(/\/$/, "");
      expect(slugs.has(slug), `no content file for ${path}`).toBe(true);
    }
  });

  it("needs no anchor, because the widget is the whole page", () => {
    // The reference-page targets these replaced each needed a heading anchor to
    // land anywhere useful.
    for (const kind of Object.keys(WIDGET_PAGE_PATHS) as WidgetKind[]) {
      expect(encodeWidgetPermalink(kind, {})).not.toContain("#");
    }
  });

  it("namespaces its params so two widgets on one page cannot collide", () => {
    // Every reference page imports all three widget components, so the
    // discriminant is what makes the link unambiguous.
    const url = encodeWidgetPermalink("dst", { zone: "America/New_York" });
    expect(url).toContain("w=dst");
    expect(url).toContain("wa=");
  });

  it("ignores the scrubber's legacy unnamespaced params", () => {
    expect(
      decodeWidgetPermalink("?tz=Asia/Tokyo&t=2026-01-01T00:00:00Z"),
    ).toBeNull();
  });

  it("treats a mangled or truncated link as absent, not as an error", () => {
    expect(decodeWidgetPermalink("?w=globe&wa=%7Bnot-json")).toBeNull();
    expect(decodeWidgetPermalink("?w=globe")).toBeNull();
    expect(decodeWidgetPermalink("")).toBeNull();
  });

  it("rejects an unknown widget kind", () => {
    expect(decodeWidgetPermalink('?w=evil&wa={"a":1}')).toBeNull();
  });

  it("keeps every key of every permalink written into a guide, scenario, mistake or tool page", () => {
    /* R1: `seedFromLocation` drops numbers outside 1900-2100 and empty
       strings, so a widget arg sent as a number in a hand-written link is
       silently lost. Every `?w=<kind>&wa=<...>` link under content/docs
       (outside the generated reference pages) is checked here, so a link
       written with the wrong type — a number where the widget wants a
       string, as `freeDays` on `scenarios/demurrage-across-a-weekend.mdx`
       and `scenarios/free-time-start-day.mdx` used to be — fails the suite
       instead of silently falling back to a preset. */
    const files = import.meta.glob("../content/docs/**/*.mdx", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;

    const linkPattern = /\?w=([a-z]+)&wa=([^)"'\s]+)/g;
    let checked = 0;
    for (const [path, source] of Object.entries(files)) {
      if (path.includes("/content/docs/reference/")) continue;
      for (const [, kind, encoded] of source.matchAll(linkPattern)) {
        const search = `?w=${kind}&wa=${encoded}`;
        const decoded = decodeWidgetPermalink(search);
        expect(decoded, `${path}: ${search}`).not.toBeNull();
        const args = decoded!.args as Record<string, unknown>;
        const seeded = seedFromLocation(decoded!.kind, search);
        for (const key of Object.keys(args)) {
          expect(seeded, `${path}: ${search} lost "${key}"`).toHaveProperty(
            key,
          );
        }
        checked++;
      }
    }
    // The walk itself must be real: fail loudly if nothing was found rather
    // than passing on an empty glob.
    expect(checked).toBeGreaterThan(0);
  });
});
