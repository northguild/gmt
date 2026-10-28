/**
 * The look of a share image, in one place for the `/og/…` route and for the GitHub social-preview
 * script (`scripts/build-social-preview.ts`). Colours are the site's void, ice and cyan tokens as
 * RGB triples, because the canvas takes numbers and not CSS variables.
 *
 * Paths are relative to `apps/dox`, where the build and the script both run.
 */
import type { OGImageOptions } from "astro-og-canvas";

/** `--gmt-void`, the page background. */
const VOID: [number, number, number] = [3, 8, 12];
/** The cyan of the bottom edge. */
const CYAN: [number, number, number] = [34, 211, 238];
/** `--gmt-ice`, the title. */
const ICE: [number, number, number] = [207, 234, 242];
/** `--gmt-ice-dim`, the description. */
const ICE_DIM: [number, number, number] = [152, 178, 190];

/** The width of the cyan edge in pixels. */
export const OG_EDGE = 8;
export { VOID as OG_BACKGROUND, CYAN as OG_EDGE_COLOR };

/** The longest description a card shows, in characters. */
const DESCRIPTION_MAX = 180;

/**
 * A description cut to at most `max` characters at a word boundary, with `…` where it was cut.
 * A text that fits is returned as it is.
 */
export function cutDescription(text: string, max = DESCRIPTION_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const room = flat.slice(0, max - 1);
  const space = room.lastIndexOf(" ");
  const kept = space > 0 ? room.slice(0, space) : room;
  return `${kept.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

export function ogImageOptions(page: {
  title: string;
  description: string;
}): OGImageOptions {
  return {
    title: page.title,
    description: cutDescription(page.description),
    bgGradient: [VOID],
    // The bottom edge only; a card never gets an accent on its left.
    border: { color: CYAN, width: OG_EDGE, side: "block-end" },
    padding: 72,
    logo: { path: "./public/apple-touch-icon.png", size: [88] },
    fonts: [
      "./src/assets/og-fonts/Michroma-Regular.ttf",
      "./src/assets/og-fonts/JetBrainsMono-Regular.ttf",
    ],
    font: {
      title: { families: ["Michroma"], size: 52, color: ICE },
      description: {
        families: ["JetBrains Mono"],
        size: 30,
        color: ICE_DIM,
        lineHeight: 1.4,
      },
    },
    cacheDir: "./node_modules/.astro-og-canvas",
  };
}
