/**
 * The decks the site holds: one folder per deck under `src/slides/<slug>/` (`decks.test.ts` keeps
 * the folders in step with the registry). A gate that visits decks takes its routes from here and
 * names none of them.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deckRoutes } from "./slides-check-helpers.mjs";

/** `apps/dox/src/slides`. */
export const DECKS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "slides",
);

/** Every deck's slug, in folder order. */
function deckSlugs(decksDir = DECKS_DIR) {
  return readdirSync(decksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Every deck's site path, `/slides/<slug>/`. */
export function allDeckRoutes(decksDir = DECKS_DIR) {
  return deckRoutes(deckSlugs(decksDir));
}
