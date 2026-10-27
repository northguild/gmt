#!/usr/bin/env tsx
/**
 * Write the repository's GitHub social preview: `<repo>/.github/social-preview.png`, 1280 by 640.
 *
 * GitHub asks for 1280 by 640 and the site's share card is 1200 by 630, so the card is drawn by the
 * same code as the site's (`src/lib/og-art.ts`), pasted onto a canvas of the page colour at
 * x 40, y 10, and its cyan bottom edge is carried across the full width.
 *
 * Run by hand, not in `generate`: `pnpm --filter dox run social-preview`. The owner uploads the
 * file in the repository settings; GitHub has no API for it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateOpenGraphImage } from "astro-og-canvas";
import { PNG } from "pngjs";
import {
  OG_BACKGROUND,
  OG_EDGE,
  OG_EDGE_COLOR,
  ogImageOptions,
} from "../src/lib/og-art";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(appRoot, "..", "..", ".github", "social-preview.png");

const WIDTH = 1280;
const HEIGHT = 640;
const OFFSET_X = 40;
const OFFSET_Y = 10;

const card = PNG.sync.read(
  Buffer.from(
    // A PNG renders to bytes; the declared type is the wider `BodyInit`.
    (await generateOpenGraphImage(
      ogImageOptions({
        title: "GMT",
        description:
          "Date and time library for JavaScript and TypeScript, built on TC39 Temporal: time zones, DST, business days, ISO 8601 strings in and out. Never throws.",
      }),
    )) as Uint8Array,
  ),
);

const canvas = new PNG({ width: WIDTH, height: HEIGHT });
const [vr, vg, vb] = OG_BACKGROUND;
for (let i = 0; i < WIDTH * HEIGHT; i++) {
  canvas.data[i * 4] = vr;
  canvas.data[i * 4 + 1] = vg;
  canvas.data[i * 4 + 2] = vb;
  canvas.data[i * 4 + 3] = 255;
}

for (let y = 0; y < card.height; y++) {
  for (let x = 0; x < card.width; x++) {
    const from = (y * card.width + x) * 4;
    const to = ((y + OFFSET_Y) * WIDTH + (x + OFFSET_X)) * 4;
    for (let c = 0; c < 4; c++) canvas.data[to + c] = card.data[from + c];
  }
}

// The card's bottom edge ends at y 640; carry its cyan across the margins on either side.
const [er, eg, eb] = OG_EDGE_COLOR;
for (let y = HEIGHT - OG_EDGE; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const at = (y * WIDTH + x) * 4;
    canvas.data[at] = er;
    canvas.data[at + 1] = eg;
    canvas.data[at + 2] = eb;
    canvas.data[at + 3] = 255;
  }
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, PNG.sync.write(canvas));
console.log(`wrote ${output} (${WIDTH}x${HEIGHT})`);
