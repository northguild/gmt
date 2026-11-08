#!/usr/bin/env tsx
/**
 * Write the upload-ready share images to `apps/dox/assets/share/`:
 *
 * - `github-social-preview.png`, 1280 by 640: the repository's social preview. GitHub asks for that
 *   size and the site card is 1200 by 630, so the card is drawn by the same code as the site's
 *   (`src/lib/og-art.ts`) and scaled to cover the larger canvas, cropped from the bottom so the
 *   cyan edge stays whole.
 * - `og-default-1200x630.png`: the site card, the same bytes as `/og/site.png`.
 * - `earth-1200x630.png`: the artwork alone, with no text.
 *
 * Run by hand, not in `generate`: `pnpm --filter dox run social-preview`. The owner uploads the
 * files where they are wanted; GitHub has no API for its preview. `assets/` sits outside `src/` and
 * `public/`, so the build never serves it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderArtwork, renderCard } from "../src/lib/og-art";
import { SITE_CARD_LINE } from "../src/lib/og-cards";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folder = resolve(appRoot, "assets", "share");

const card = await renderCard({ kind: "site", line: SITE_CARD_LINE });
const preview = await sharp(card)
  .resize(1280, 640, { fit: "cover", position: "bottom" })
  .png({ palette: true, quality: 100, compressionLevel: 9 })
  .toBuffer();
const artwork = await renderArtwork();

mkdirSync(folder, { recursive: true });
for (const [name, bytes] of [
  ["github-social-preview.png", preview],
  ["og-default-1200x630.png", card],
  ["earth-1200x630.png", artwork],
] as const) {
  writeFileSync(resolve(folder, name), bytes);
  console.log(`wrote ${resolve(folder, name)} (${bytes.length} bytes)`);
}
