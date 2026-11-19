import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePlace } from "../src/lib/slides/places";
import { DECKS } from "../src/slides/decks";
import { distDirOrSkip } from "./dist-dir";

/**
 * Deck 0 as built: the repo renders no `.astro` in Vitest, so the built HTML is the test surface.
 * Needs a build; returns early without one and throws under `DOX_DIST_REQUIRED`.
 */

/** Slide ids in the outline's order (`context/dox/specs/dox-g12/index.md`). */
const OUTLINE = [
  "title",
  "one-clock",
  "date",
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
  "familiar",
  "why-not-temporal",
  "gmt",
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

interface Slide {
  id: string;
  /** `null` on a spare, which has no `data-minutes`. */
  minutes: number | null;
  spare: boolean;
  place: string | null;
  html: string;
}

/** The deck page's slides, read from its HTML. */
function slides(): Slide[] | null {
  const dist = distDirOrSkip();
  if (dist === null) return null;
  const page = readFileSync(
    join(dist, "gmt", "slides", "give-me-temporal", "index.html"),
    "utf8",
  );
  const found: Slide[] = [];
  // A slide holds `<section>` panels of its own, so a slide runs from its opening tag to the next
  // slide's (the last one to the end of the deck's slides).
  const starts = [...page.matchAll(/<section\b([^>]*\bdata-slide\b[^>]*)>/g)];
  for (const [i, match] of starts.entries()) {
    const attrs = match[1] ?? "";
    const end = starts[i + 1]?.index ?? page.length;
    const id = /\bid="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const minutes = /data-minutes="([^"]*)"/.exec(attrs)?.[1];
    found.push({
      id,
      minutes: minutes === undefined ? null : Number(minutes),
      spare: /\bdata-spare\b/.test(attrs),
      place: /data-place="([^"]*)"/.exec(attrs)?.[1] ?? null,
      html: page.slice((match.index ?? 0) + match[0].length, end),
    });
  }
  return found;
}

describe("Deck 0 in the built site", () => {
  it("has the 23 slides, once each, in the outline's order, then the spare", () => {
    const deck = slides();
    if (deck === null) return;
    expect(deck.map((s) => s.id)).toEqual([...OUTLINE, ...SPARES]);
    expect(deck.filter((s) => s.spare).map((s) => s.id)).toEqual(SPARES);
  });

  it("gives the spares no minutes and every other slide some", () => {
    const deck = slides();
    if (deck === null) return;
    for (const slide of deck)
      expect(slide.minutes === null, slide.id).toBe(slide.spare);
  });

  it("runs as long as the registry says", () => {
    const deck = slides();
    if (deck === null) return;
    const entry = DECKS.find((d) => d.slug === "give-me-temporal");
    expect(entry).toBeDefined();
    const sum = deck.reduce((total, s) => total + (s.minutes ?? 0), 0);
    expect(sum).toBe((entry?.minutes ?? 0) + (entry?.qa ?? 0));
  });

  it("gives every slide and build a place the stage can resolve", () => {
    const deck = slides();
    if (deck === null) return;
    for (const slide of deck) {
      const places = [
        slide.place,
        ...[
          ...slide.html.matchAll(/data-build="\d+"[^>]*data-place="([^"]*)"/g),
        ].map((m) => m[1]),
      ];
      for (const place of places) {
        if (place)
          expect(
            () => resolvePlace(place),
            `${slide.id}: ${place}`,
          ).not.toThrow();
      }
    }
  });

  it("has speaker notes on every slide", () => {
    const deck = slides();
    if (deck === null) return;
    for (const slide of deck) {
      expect(slide.html, slide.id).toMatch(/<aside[^>]*data-notes/);
    }
  });

  it("has six captioned figures on slide 2", () => {
    const deck = slides();
    if (deck === null) return;
    const slide = deck.find((s) => s.id === "one-clock");
    expect(slide).toBeDefined();
    const figures = [
      ...(slide?.html.matchAll(/<figure\b[\s\S]*?<\/figure>/g) ?? []),
    ].filter((m) => /gmt-wall-figure"/.test(m[0]));
    expect(figures).toHaveLength(6);
    for (const figure of figures) expect(figure[0]).toMatch(/<figcaption/);
  });

  it("has no wall figures on the date slide, where the wall has already broken", () => {
    const deck = slides();
    if (deck === null) return;
    const slide = deck.find((s) => s.id === "date");
    expect(slide).toBeDefined();
    expect(slide?.html).not.toMatch(/gmt-wall-figure"/);
  });

  it("ends each bug slide on a GMT step in its last build", () => {
    const deck = slides();
    if (deck === null) return;
    for (const id of BUG_SLIDES) {
      const slide = deck.find((s) => s.id === id);
      expect(slide, id).toBeDefined();
      const builds = [
        ...(slide?.html.matchAll(
          /<div class="gmt-build" data-build="(\d+)"/g,
        ) ?? []),
      ].map((m) => Number(m[1]));
      const last = Math.max(...builds);
      const at = slide?.html.indexOf(`data-build="${last}"`) ?? -1;
      expect(at, id).toBeGreaterThan(-1);
      expect(slide?.html.slice(at), id).toMatch(/gmt-step/);
    }
  });

  it("has two named QR codes on the thanks slide", () => {
    const deck = slides();
    if (deck === null) return;
    const slide = deck.find((s) => s.id === "thanks");
    const codes = [
      ...(slide?.html.matchAll(
        /<svg\b[^>]*role="img"[^>]*aria-label="([^"]*)"/g,
      ) ?? []),
    ].map((m) => m[1]);
    expect(codes).toEqual(["LinkedIn", "NorthGuild"]);
  });
});
