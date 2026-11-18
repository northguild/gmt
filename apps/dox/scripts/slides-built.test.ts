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
  "gmt",
  "guards",
  "ask-dox",
  "page-tools",
  "thanks",
];

interface Slide {
  id: string;
  minutes: number;
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
  for (const match of page.matchAll(
    /<section\b([^>]*\bdata-slide\b[^>]*)>([\s\S]*?)<\/section>/g,
  )) {
    const attrs = match[1] ?? "";
    const id = /\bid="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const minutes = Number(/data-minutes="([^"]*)"/.exec(attrs)?.[1]);
    found.push({
      id,
      minutes,
      place: /data-place="([^"]*)"/.exec(attrs)?.[1] ?? null,
      html: match[2] ?? "",
    });
  }
  return found;
}

describe("Deck 0 in the built site", () => {
  it("has the 20 slides, once each, in the outline's order", () => {
    const deck = slides();
    if (deck === null) return;
    expect(deck.map((s) => s.id)).toEqual(OUTLINE);
  });

  it("runs as long as the registry says", () => {
    const deck = slides();
    if (deck === null) return;
    const entry = DECKS.find((d) => d.slug === "give-me-temporal");
    expect(entry).toBeDefined();
    const sum = deck.reduce((total, s) => total + s.minutes, 0);
    expect(sum).toBe(entry?.minutes);
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
});
