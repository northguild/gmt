/**
 * The check families of the slide-deck gate, in the order they run on a page. Each is a small object:
 * `id`, `sizes` (`"each"` runs at every size, `"first"` once at the first size) and `run(env)`, which
 * resolves to the cells it measured. `env` is `{ browserName, browser, base, pagePath, size, report,
 * wallPins }`. A new family is a module and a row here.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DECKS_DIR } from "../deck-folders.mjs";
import { checkArticle } from "./article-check.mjs";
import { checkSpace } from "./space-check.mjs";
import { checkStage } from "./stage-check.mjs";

/**
 * A deck's own browser check, `src/slides/<slug>/deck-check.mjs`, when it has one: what only that
 * deck promises (its demos, its tools). The file exports `checkDeckContent({ browserName, browser,
 * base, pagePath, size, report })`, which resolves to the cells it measured.
 */
async function checkDeck(env) {
  const slug = env.pagePath.split("/").filter(Boolean).at(-1);
  const file = path.join(DECKS_DIR, slug, "deck-check.mjs");
  if (!existsSync(file)) return 0;
  const { checkDeckContent } = await import(pathToFileURL(file).href);
  const { browserName, browser, base, pagePath, size, report } = env;
  return checkDeckContent({
    browserName,
    browser,
    base,
    pagePath,
    size,
    report,
  });
}

export const FAMILIES = [
  { id: "stage", sizes: "each", run: checkStage },
  { id: "article", sizes: "each", run: checkArticle },
  { id: "space", sizes: "first", run: checkSpace },
  { id: "deck", sizes: "first", run: checkDeck },
];
