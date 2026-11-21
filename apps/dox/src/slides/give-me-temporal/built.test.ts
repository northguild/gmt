import { describe, expect, it } from "vitest";
import { builtSlide, builtSlides } from "../../../scripts/built-deck";
import { distDirOrSkip } from "../../../scripts/dist-dir";
import { libraryTotals } from "~/data/zone-probe";
import { CLOSING, QUOTES, downloadBars } from "./moment";
import { STAND_INS } from "./stand-ins";
import { WALL_PAGES } from "./wall";

/**
 * Deck 0 as built: its outline and the slides whose content the talk depends on. The rules every
 * deck keeps are in `scripts/slides-built.test.ts`. Needs a build; returns early without one and
 * throws under `DOX_DIST_REQUIRED`.
 */

/**
 * Slide ids in the outline's order (`context/dox/specs/dox-g12/index.md`). The order also holds
 * that `qa` comes right before `thanks`, which is the last slide of the talk, and the spares after.
 */
const OUTLINE = [
  "title",
  "agent-answer",
  "agents",
  "moment",
  "date",
  "kinds",
  "experiments",
  "experiment-gaps",
  "experiment-overlaps",
  "experiment-host",
  "experiment-odd",
  "one-clock",
  "temporal",
  "stand-ins",
  "abort",
  "years",
  "day-off",
  "manila",
  "engines",
  "scoreboard",
  "why-not-temporal",
  "gmt",
  "familiar",
  "guards",
  "ask-dox",
  "page-tools",
  "qa",
  "thanks",
];

/** The spare, after `thanks`: no minutes, reached only by a jump. */
const SPARES = ["spare-size"];

/** Bug slides, each ending on a GMT step in its last build. */
const BUG_SLIDES = ["abort", "years", "day-off", "manila", "engines"];

/** Deck 0's slides, or `null` without a build. */
function deck() {
  const dist = distDirOrSkip();
  return dist === null ? null : builtSlides(dist, "give-me-temporal");
}

describe("Deck 0 in the built site", () => {
  it("has every slide of the outline once, in its order, then the spares", () => {
    const slides = deck();
    if (slides === null) return;
    expect(slides.map((s) => s.id)).toEqual([...OUTLINE, ...SPARES]);
    expect(slides.filter((s) => s.spare).map((s) => s.id)).toEqual(SPARES);
  });

  it("has a captioned figure for each wall page, each with its measured count", () => {
    const slides = deck();
    if (slides === null) return;
    const figures = [
      ...builtSlide(slides, "one-clock").html.matchAll(
        /<figure\b[\s\S]*?<\/figure>/g,
      ),
    ].filter((m) => /gmt-wall-figure"/.test(m[0]));
    expect(figures).toHaveLength(WALL_PAGES.length);
    const totals = new Map(libraryTotals().map((t) => [t.id, t]));
    WALL_PAGES.forEach((page, i) => {
      const { wrong, total } = totals.get(page.id)!;
      expect(figures[i]![0]).toMatch(/<figcaption/);
      expect(
        figures[i]![0].replace(/<[^>]*>/g, " ").replace(/\s+/g, " "),
      ).toContain(
        `${wrong.toLocaleString("en")} wrong of ${total.toLocaleString("en")}`,
      );
    });
  });

  it("puts the zone experiments before the wall, on the venue's zone", () => {
    const slides = deck();
    if (slides === null) return;
    const ids = slides.map((s) => s.id);
    expect(ids.indexOf("experiment-odd")).toBeLessThan(
      ids.indexOf("one-clock"),
    );
    expect(builtSlide(slides, "experiment-gaps").place).toBe("Europe/Helsinki");
  });

  it("shows the maintainers' quotes, a bar per recorded year and the closing line", () => {
    const slides = deck();
    if (slides === null) return;
    const text = builtSlide(slides, "moment")
      .html.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ");
    for (const quote of QUOTES) {
      expect(text).toContain(quote.by);
      for (const said of quote.quoted) expect(text).toContain(said);
    }
    for (const bar of downloadBars()) expect(text).toContain(bar.value);
    expect(text).toContain(CLOSING);
  });

  it("shows the three stand-ins with their derived counts", () => {
    const slides = deck();
    if (slides === null) return;
    const text = builtSlide(slides, "stand-ins")
      .html.replace(/<[^>]*>/g, "")
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ");
    for (const { name, lines } of STAND_INS.columns) {
      expect(text).toContain(name);
      for (const line of lines)
        expect(text).toContain(line.map((p) => p.text).join(""));
    }
    expect(text).toContain(STAND_INS.closing);
  });

  it("opens the date slide's table on the agents' question, with no wall figures before the wall", () => {
    const slides = deck();
    if (slides === null) return;
    const { html } = builtSlide(slides, "date");
    expect(html).not.toMatch(/gmt-wall-figure"/);
    const firstRow =
      html.match(/<tbody[^>]*>\s*<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(firstRow).toContain("2027-03-28T03:30");
  });

  it("ends each bug slide on a GMT step in its last build", () => {
    const slides = deck();
    if (slides === null) return;
    for (const id of BUG_SLIDES) {
      const { html } = builtSlide(slides, id);
      const builds = [
        ...html.matchAll(/<div class="gmt-build" data-build="(\d+)"/g),
      ].map((m) => Number(m[1]));
      const at = html.indexOf(`data-build="${Math.max(...builds)}"`);
      expect(at, id).toBeGreaterThan(-1);
      expect(html.slice(at), id).toMatch(/gmt-step/);
    }
  });

  it("has two named QR codes on the thanks slide", () => {
    const slides = deck();
    if (slides === null) return;
    const codes = [
      ...builtSlide(slides, "thanks").html.matchAll(
        /<svg\b[^>]*role="img"[^>]*aria-label="([^"]*)"/g,
      ),
    ].map((m) => m[1]);
    expect(codes).toEqual(["LinkedIn", "NorthGuild"]);
  });

  it("has every quoted agent answer filled", () => {
    const slides = deck();
    if (slides === null) return;
    const pending = slides.filter((s) => /data-quote="pending"/.test(s.html));
    // Fill `src/slides/give-me-temporal/quotes/agent-answer.json`, then record the run with
    // `cd scripts/zone-matrix && fnm exec --using=26 -- node agent-answer.mjs`.
    expect(pending.map((s) => s.id)).toEqual([]);
  });

  it("has a build on day-off that carries the Moon place", () => {
    const slides = deck();
    if (slides === null) return;
    expect(builtSlide(slides, "day-off").html).toMatch(
      /<[^>]*\bdata-build\b[^>]*\bdata-place="moon"|<[^>]*\bdata-place="moon"[^>]*\bdata-build\b/,
    );
  });
});
