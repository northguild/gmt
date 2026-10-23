import { showHolidayRuleBuilderInput } from "./dox-tools";
import { formatRuleLines } from "./holiday-codec";
import {
  decodeWidgetPermalink,
  encodeWidgetPermalink,
  handoffHref,
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

  it("puts the permalink under the site base", () => {
    expect(encodeWidgetPermalink("dst", {}).startsWith("/gmt/tools/")).toBe(
      true,
    );
    expect(encodeWidgetPermalink("dst", {})).toContain("?w=dst&");
    expect(handoffHref(null)).toBeNull();
  });

  it("targets /tools and /check pages that actually exist", () => {
    /* The same rule as a citation: a link Dox produces must resolve. These are
       not in `route-manifest.ts` — that generator only covers `/reference` — so
       the check is against the real content files, globbed at build time the
       same way `guide-sources.ts` reads the guides. */
    const files = import.meta.glob("../content/docs/{tools,check}/*.mdx", {
      eager: true,
      query: "?raw",
      import: "default",
    });
    const pages = new Set(
      Object.keys(files).map((f) =>
        f.replace("../content/docs", "").replace(/\.mdx$/, "/"),
      ),
    );

    for (const kind of Object.keys(WIDGET_PAGE_PATHS) as WidgetKind[]) {
      // One entry (the Canada checker) is written through `withBase`; compare its route.
      const path = WIDGET_PAGE_PATHS[kind].replace(/^\/gmt(?=\/)/, "");
      expect(/^\/(tools|check)\//.test(path), path).toBe(true);
      expect(pages.has(path), `no content file for ${path}`).toBe(true);
    }
  });

  it("carries the Canada checker's pinned zone through a link and keeps only a short string", () => {
    const url = encodeWidgetPermalink("canadaclock", {
      zone: "America/Winnipeg",
    });
    expect(
      url.startsWith("/gmt/check/canada-2026-clock-change/?w=canadaclock&"),
    ).toBe(true);
    const search = url.slice(url.indexOf("?"));
    expect(seedFromLocation("canadaclock", search)).toEqual({
      zone: "America/Winnipeg",
    });
    const long = encodeWidgetPermalink("canadaclock", { zone: "A".repeat(65) });
    expect(
      seedFromLocation("canadaclock", long.slice(long.indexOf("?"))),
    ).toEqual({});
  });

  it("carries the Morocco checker's zone through a link and keeps only a short string", () => {
    const url = encodeWidgetPermalink("moroccoclock", {
      zone: "Africa/El_Aaiun",
    });
    expect(
      url.startsWith("/gmt/check/morocco-2026-clock-change/?w=moroccoclock&"),
    ).toBe(true);
    const search = url.slice(url.indexOf("?"));
    expect(seedFromLocation("moroccoclock", search)).toEqual({
      zone: "Africa/El_Aaiun",
    });
    const long = encodeWidgetPermalink("moroccoclock", {
      zone: "A".repeat(65),
    });
    expect(
      seedFromLocation("moroccoclock", long.slice(long.indexOf("?"))),
    ).toEqual({});
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

  it("keeps an empty weekend or offsets list and drops any other empty string", () => {
    const url = encodeWidgetPermalink("holidays", {
      weekend: "",
      offsets: "",
      zone: "",
      rules: "",
    });
    expect(seedFromLocation("holidays", url.slice(url.indexOf("?")))).toEqual({
      weekend: "",
      offsets: "",
    });
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

  it("round-trips a multi-line stored-time audit past the 64-character cap", () => {
    const values = Array.from(
      { length: 6 },
      (_, i) => `2016-12-0${i + 1}T09:00:00+02:00[Europe/Istanbul]`,
    ).join("\n");
    const url = encodeWidgetPermalink("storedaudit", { values, line: "5" });
    const seeded = seedFromLocation("storedaudit", url.slice(url.indexOf("?")));
    expect(seeded).toEqual({ values, line: "5" });
  });

  it("registers the three holiday tools at their own pages", () => {
    expect(WIDGET_PAGE_PATHS.holidays).toBe("/tools/holiday-rule-builder/");
    expect(WIDGET_PAGE_PATHS.observance).toBe("/tools/observance-comparator/");
    expect(WIDGET_PAGE_PATHS.feasts).toBe("/tools/moving-feasts/");
  });

  it("keeps a 30-date calendar in `holidays` and a 12-line `rules` past the 64-character cap", () => {
    const holidays = Array.from(
      { length: 30 },
      (_, i) =>
        `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + i).padStart(2, "0")}`,
    ).join(",");
    expect(holidays.length).toBeGreaterThan(64);
    const rules = Array.from(
      { length: 12 },
      (_, i) => `Day ${i + 1};f;01-${String(i + 1).padStart(2, "0")}`,
    ).join("\n");
    expect(rules.length).toBeGreaterThan(64);
    for (const kind of ["freetime", "cutoffstack", "holidays"] as const) {
      const url = encodeWidgetPermalink(kind, { holidays });
      const seeded = seedFromLocation(kind, url.slice(url.indexOf("?")));
      expect(seeded, kind).toEqual({ holidays });
    }
    const url = encodeWidgetPermalink("holidays", { rules });
    expect(seedFromLocation("holidays", url.slice(url.indexOf("?")))).toEqual({
      rules,
    });
  });

  it("keeps the longest rule list the chat schema accepts", () => {
    // Every character a separator, so each is escaped to two.
    const longest = Array.from({ length: 12 }, () => ({
      kind: "dates" as const,
      name: ";".repeat(64),
      dates: Array.from({ length: 60 }, () => ",".repeat(64)),
    }));
    expect(
      showHolidayRuleBuilderInput.safeParse({ rules: longest }).success,
    ).toBe(true);
    const rules = formatRuleLines(longest);
    expect(rules.length).toBe(94_451);
    const url = encodeWidgetPermalink("holidays", { rules });
    expect(seedFromLocation("holidays", url.slice(url.indexOf("?")))).toEqual({
      rules,
    });
  });

  it("still drops a `holidays` value over its own cap", () => {
    const holidays = "2026-01-01,".repeat(100);
    expect(holidays.length).toBeGreaterThan(1000);
    const url = encodeWidgetPermalink("freetime", { holidays });
    expect(seedFromLocation("freetime", url.slice(url.indexOf("?")))).toEqual(
      {},
    );
  });
});
