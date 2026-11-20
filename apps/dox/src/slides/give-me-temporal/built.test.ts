import { describe, expect, it } from "vitest";
import { builtSlide, builtSlides } from "../../../scripts/built-deck";
import { distDirOrSkip } from "../../../scripts/dist-dir";

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
  "date",
  "kinds",
  "one-clock",
  "temporal",
  "experiments",
  "experiment-gaps",
  "experiment-overlaps",
  "experiment-host",
  "experiment-odd",
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

  it("has six captioned figures on the wall slide", () => {
    const slides = deck();
    if (slides === null) return;
    const figures = [
      ...builtSlide(slides, "one-clock").html.matchAll(
        /<figure\b[\s\S]*?<\/figure>/g,
      ),
    ].filter((m) => /gmt-wall-figure"/.test(m[0]));
    expect(figures).toHaveLength(6);
    for (const figure of figures) expect(figure[0]).toMatch(/<figcaption/);
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
