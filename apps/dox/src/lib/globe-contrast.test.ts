/// <reference types="vitest/globals" />

/**
 * The globe's labels and markers hold the site's contrast floors on every
 * globe: flat or with imagery, in either renderer and either theme (#293).
 *
 * Behind every label and marker sits its casing, a dark halo that is always
 * drawn, over whatever the globe shows there: night-side black, the lit limb's
 * cyan haze, the photograph's Antarctic white, or any mix of them partway
 * through the zoom fade. So each ink is measured against its own casing
 * composited over a sweep of backdrops from black to white, and the worst one
 * has to clear the floor — 7:1 for text, as for all body text on the site, and
 * 3:1 for the markers and the zone outline, which are graphics (WCAG 2.2
 * SC 1.4.11).
 *
 * The inks and the casing are the same in both themes: the overlay always sits
 * on a dark casing, so it takes the dark palette. The second block pins that,
 * so the one measurement covers both themes. The values come from
 * `gmt-tokens.css` and the alphas from `globe-inks.ts`, the same places
 * `globe.ts` reads them, so retuning any of them re-runs the measurement.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LABEL_ALPHA, MINOR_MARKER_ALPHA } from "./globe-inks";

const TOKENS = readFileSync(
  path.resolve(import.meta.dirname, "../styles/gmt-tokens.css"),
  "utf8",
);

/** Custom properties declared in the first block whose selectors include `selector`. */
function block(selector: string): Map<string, string> {
  const css = TOKENS.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(",").map((part) => part.trim());
    if (!selectors.includes(selector)) continue;
    const values = new Map<string, string>();
    for (const declaration of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      values.set(declaration[1], declaration[2].trim());
    }
    return values;
  }
  throw new Error(`no ${selector} block in gmt-tokens.css`);
}

const DARK = block(":root");
const LIGHT = block('[data-theme="light"]');

function token(name: string): string {
  const value = DARK.get(name);
  if (value === undefined) throw new Error(`${name} is not declared`);
  return value;
}

/** Every token the overlay is drawn with. */
const OVERLAY_TOKENS = [
  "--gmt-globe-ink",
  "--gmt-globe-marker",
  "--gmt-globe-selected",
  "--gmt-globe-gold",
  "--gmt-globe-casing",
  "--gmt-globe-casing-alpha",
];

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`expected a 6-digit hex colour, got ${value}`);
  const digits = match[1];
  return [0, 2, 4].map(
    (at) => Number.parseInt(digits.slice(at, at + 2), 16) / 255,
  ) as Rgb;
}

/** Source-over in encoded sRGB, as the globe's shaders and a 2D canvas blend. */
function over(backdrop: Rgb, colour: Rgb, alpha: number): Rgb {
  return backdrop.map(
    (channel, i) => colour[i] * alpha + channel * (1 - alpha),
  ) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Night-side black to ice-cap white, plus the saturated extremes between. */
const BACKDROPS: Rgb[] = [
  ...Array.from({ length: 18 }, (_, i) => [i / 17, i / 17, i / 17] as Rgb),
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [0, 1, 1],
  [1, 0, 1],
];

/** The lowest contrast an ink reaches against its casing over any backdrop. */
/** The lowest contrast an ink reaches against its casing over any backdrop. */
function worstContrast(ink: string, inkAlpha: number): number {
  const casing = hex(token("--gmt-globe-casing"));
  const casingAlpha = Number.parseFloat(token("--gmt-globe-casing-alpha"));
  let worst = Number.POSITIVE_INFINITY;
  for (const backdrop of BACKDROPS) {
    const behind = over(backdrop, casing, casingAlpha);
    worst = Math.min(worst, contrast(over(behind, hex(ink), inkAlpha), behind));
  }
  return worst;
}

const TEXT_FLOOR = 7;
const GRAPHIC_FLOOR = 3;

describe("on any globe", () => {
  it("keeps labels at the 7:1 text floor", () => {
    expect(
      worstContrast(token("--gmt-globe-ink"), LABEL_ALPHA),
    ).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("keeps every marker and the zone outline at the 3:1 graphics floor", () => {
    const inks: [string, string, number][] = [
      ["primary marker", token("--gmt-globe-marker"), 1],
      ["minor marker", token("--gmt-globe-ink"), MINOR_MARKER_ALPHA],
      ["night marker", token("--gmt-globe-gold"), 1],
      ["minor night marker", token("--gmt-globe-gold"), MINOR_MARKER_ALPHA],
      ["selected marker and zone outline", token("--gmt-globe-selected"), 1],
    ];
    for (const [name, ink, alpha] of inks) {
      expect(
        worstContrast(ink, alpha),
        `${name} (${ink} at ${alpha})`,
      ).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    }
  });
});

describe("in either theme", () => {
  it("draws the overlay with the same inks and casing", () => {
    /* A light-theme value for any of these would put light-theme ink on the
       dark casing — near-black text on near-black — and nothing above measures
       the light block. */
    expect(OVERLAY_TOKENS.filter((name) => LIGHT.has(name))).toEqual([]);
  });
});
