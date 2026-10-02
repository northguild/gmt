/// <reference types="vitest/globals" />

/**
 * The globe's labels and markers hold the site's contrast floors over the
 * Earth imagery (#293).
 *
 * Over the imagery, what sits behind a label or a marker is its casing: a
 * translucent halo over whatever the photograph shows there, which ranges from
 * night-side black to Antarctic white. So each ink is measured against its own
 * casing composited over a sweep of backdrops, and the worst one has to clear
 * the floor — 7:1 for text, as for all body text on the site, and 3:1 for the
 * markers and the zone outline, which are graphics (WCAG 2.2 SC 1.4.11).
 *
 * The imagery shows only where the dark tokens apply — the dark theme, and the
 * landing hero's dark island in the light theme (`globe-stage.test.ts`) — so
 * the dark token block is what is measured. The
 * values come from `gmt-tokens.css` and the alphas from `globe-inks.ts`, the
 * same places `globe.ts` reads them, so retuning a token re-runs the
 * measurement rather than silently breaking it.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LABEL_ALPHA, MINOR_MARKER_ALPHA } from "./globe-inks";

const TOKENS = readFileSync(
  path.resolve(import.meta.dirname, "../styles/gmt-tokens.css"),
  "utf8",
);

/** Custom properties declared in the dark block, the one for `:root`. */
function darkBlock(): Map<string, string> {
  const css = TOKENS.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selectors = match[1].split(",").map((selector) => selector.trim());
    if (!selectors.includes(":root")) continue;
    const values = new Map<string, string>();
    for (const declaration of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      values.set(declaration[1], declaration[2].trim());
    }
    return values;
  }
  throw new Error("no :root block in gmt-tokens.css");
}

const DARK = darkBlock();

function token(name: string): string {
  const value = DARK.get(name);
  if (value === undefined) throw new Error(`${name} is not declared`);
  return value;
}

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

describe("over the imagery", () => {
  it("keeps labels at the 7:1 text floor", () => {
    const ink = token("--gmt-ice");
    expect(worstContrast(ink, LABEL_ALPHA)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it("keeps every marker and the zone outline at the 3:1 graphics floor", () => {
    const inks: [string, string, number][] = [
      ["primary marker", token("--gmt-cyan"), 1],
      ["minor marker", token("--gmt-ice"), MINOR_MARKER_ALPHA],
      ["night marker", token("--gmt-globe-gold"), 1],
      ["minor night marker", token("--gmt-globe-gold"), MINOR_MARKER_ALPHA],
      ["selected marker and zone outline", token("--gmt-spring"), 1],
    ];
    for (const [name, ink, alpha] of inks) {
      expect(
        worstContrast(ink, alpha),
        `${name} (${ink} at ${alpha})`,
      ).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    }
  });
});
