/**
 * The Dox globe's look, read from the site's own tokens: the theme, the label font, and the
 * `?globe=` renderer pin. Shared by the time-zone globe and the slide stage, so neither reads
 * a token the other does not.
 */

import { LABEL_ALPHA, MINOR_MARKER_ALPHA } from "../globe-inks";
import type { GlobeTheme, RendererChoice, Rgba } from "./types";

/**
 * `?globe=webgpu` or `?globe=canvas2d` pins the backend.
 *
 * Only for verification — `scripts/globe-smoke.mjs` uses it to render the same
 * frame through both and compare. Anything else, including no parameter at all,
 * leaves the engine to choose.
 */
export function rendererOverride(): RendererChoice {
  try {
    const value = new URLSearchParams(globalThis.location?.search ?? "").get(
      "globe",
    );
    if (value === "webgpu" || value === "canvas2d") return value;
  } catch {
    // No location (a test environment, a worker): take the default.
  }
  return "auto";
}

/**
 * The label font, taken from the site's own mono token.
 *
 * 12px, not the 10px the canvas-2D globe hard-coded: that was below the site's
 * own 12px floor, and `font-floor.test.ts` missed it only because its patterns
 * never looked at a canvas `font` assignment. Both are fixed.
 */
export function labelFont(host: HTMLElement): string {
  const style = getComputedStyle(host);
  const family =
    style.getPropertyValue("--gmt-font-mono").trim() ||
    'ui-monospace, "JetBrains Mono", "SFMono-Regular", monospace';
  return `600 12px ${family}`;
}

/** The Dox globe's colours, read from the site's CSS custom properties. */
export interface DoxTheme extends GlobeTheme {
  markerPrimary: Rgba;
  markerOther: Rgba;
  markerNightPrimary: Rgba;
  markerNightOther: Rgba;
  markerSelected: Rgba;
  regionFill: Rgba;
  regionStroke: Rgba;
}

/**
 * Build the theme from `--gmt-*` tokens.
 *
 * Re-read rather than cached, because `data-theme` flips them, and
 * `gmt-a11y.css` zeroes the atmosphere and haze alphas under reduced
 * transparency and raised contrast, and the imagery under raised contrast and
 * forced colours.
 */
export function readTheme(host: HTMLElement): DoxTheme {
  const style = getComputedStyle(host);
  const token = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  const number = (name: string, fallback: number): number => {
    const parsed = Number.parseFloat(token(name, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const colour = (name: string, fallback: string, alpha: number): Rgba => {
    const [r, g, b, a] = parseColour(token(name, fallback)) ?? [1, 1, 1, 1];
    return [r, g, b, a * alpha];
  };

  const cyan = "--gmt-cyan";
  /* The overlay inks are the same in both themes: every marker, ring, label
     and outline sits on the dark casing (globe/casing.ts), so it is the casing
     they contrast with, not the page. */
  const ink = "--gmt-globe-ink";
  const selected = "--gmt-globe-selected";
  return {
    ocean: colour(
      "--gmt-teal",
      "#0e7490",
      number("--gmt-globe-ocean-alpha", 0.05),
    ),
    limb: colour(cyan, "#22d3ee", 0.4),
    grid: colour(cyan, "#22d3ee", number("--gmt-globe-grid-alpha", 0.18)),
    land: colour(cyan, "#22d3ee", number("--gmt-globe-land-alpha", 0.12)),
    landStroke: colour(cyan, "#22d3ee", 0.45),
    day: colour(cyan, "#22d3ee", number("--gmt-globe-day-alpha", 0.26)),
    night: colour(
      "--gmt-globe-night",
      "#03080c",
      number("--gmt-globe-night-alpha", 0.5),
    ),
    atmosphere: colour(
      cyan,
      "#22d3ee",
      number("--gmt-globe-atmosphere-alpha", 0.42),
    ),
    haze: colour(cyan, "#22d3ee", number("--gmt-globe-haze-alpha", 0.2)),
    label: colour(ink, "#cfeaf2", LABEL_ALPHA),
    casing: colour(
      "--gmt-globe-casing",
      "#03080c",
      number("--gmt-globe-casing-alpha", 0.9),
    ),
    imagery: Math.min(Math.max(number("--gmt-globe-imagery-alpha", 1), 0), 1),
    vectorOverlay: Math.min(
      Math.max(number("--gmt-globe-vector-overlay", 0), 0),
      1,
    ),
    imageryDuotone: Math.min(
      Math.max(number("--gmt-globe-imagery-duotone", 0), 0),
      1,
    ),
    markerPrimary: colour("--gmt-globe-marker", "#22d3ee", 1),
    markerOther: colour(ink, "#cfeaf2", MINOR_MARKER_ALPHA),
    markerNightPrimary: colour("--gmt-globe-gold", "#fde047", 1),
    markerNightOther: colour("--gmt-globe-gold", "#fde047", MINOR_MARKER_ALPHA),
    markerSelected: colour(selected, "#4ade80", 1),
    regionFill: colour(selected, "#4ade80", 0.12),
    regionStroke: colour(selected, "#4ade80", 1),
  };
}

/**
 * Any CSS colour to `[r, g, b, a]` with channels in 0..1.
 *
 * Hex is handled directly, since every `--gmt-*` colour token is hex today. A
 * 2D canvas parses anything else: assigning to `fillStyle` and reading it back
 * gives a normalised value, which means a token written as `rgb()`, `hsl()` or
 * `oklch()` keeps working. The canvas-2D globe parsed hex only and silently
 * passed anything else through to a draw call, so a token in another notation
 * would have worked there and broken here.
 */
export function parseColour(value: string): Rgba | null {
  const hex = parseHex(value);
  if (hex) return hex;

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  /* An unparsable value leaves `fillStyle` at its default, so seeding it with a
     colour nothing resolves to makes "did not parse" detectable. */
  probe.fillStyle = "#010203";
  probe.fillStyle = value;
  const normalised = probe.fillStyle;
  if (typeof normalised !== "string" || normalised === "#010203") return null;
  return parseHex(normalised) ?? parseRgbFunction(normalised);
}

function parseHex(value: string): Rgba | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1];
  const expand = (part: string): number => Number.parseInt(part, 16) / 255;
  if (digits.length === 3 || digits.length === 4) {
    const parts = digits.split("").map((c) => expand(c + c));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  if (digits.length === 6 || digits.length === 8) {
    const parts: number[] = [];
    for (let i = 0; i < digits.length; i += 2) {
      parts.push(expand(digits.slice(i, i + 2)));
    }
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  return null;
}

function parseRgbFunction(value: string): Rgba | null {
  const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());
  if (!match) return null;
  /* A canvas normalises to `rgba(r, g, b, a)` with 0-255 channels and a 0-1
     alpha, so there are no percentages to handle here. */
  const parts = match[1]
    .split(/[\s,/]+/)
    .filter((part) => part.length > 0)
    .map((part) => Number.parseFloat(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part)))
    return null;
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] ?? 1];
}
