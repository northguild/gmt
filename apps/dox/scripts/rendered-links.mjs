#!/usr/bin/env node
/**
 * Rendered-links gate: every link a built page holds once its widgets have mounted ends in the page
 * slash. `test:dist` reads the built HTML; a widget adds links at run time, and a search engine
 * that renders the page follows them. A link without the slash costs a redirect and is crawled
 * under two URLs.
 *
 * The page list is every built page with a `data-widget` element (`listWidgetPages`). On each page,
 * at 1440 x 900, the gate reads the `href` attribute of every `a[href]` and `area[href]` as written
 * (a relative value is resolved against the page, never read as `.href`) and files a finding for
 * each one `isPageLinkWithoutSlash` fails. Links that appear only after a click are out of scope:
 * each tool's own tests drive its states.
 *
 * Usage (a built site served, as `pnpm --filter dox gates --only rendered-links` does):
 *   node scripts/rendered-links.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium]
 *     [--pages /a/,/b/] [--list-pages]
 *
 * The runner's contract is `lib/a11y-sweep.mjs`'s: `--list-pages` prints the pages and exits (2 when
 * `dist` is missing); with `GATE_REPORT` set every bad link is a finding. Exit 0 pass, 1 any
 * finding or nothing measured, 2 usage.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { distPages, parseSweep, settle, sweep } from "./lib/a11y-sweep.mjs";
import { isPageLinkWithoutSlash, resolveHref } from "./lib/page-links.mjs";
import { listWidgetPages } from "./lib/widget-pages.mjs";

const GATE = "rendered-links";
const DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
);

// `distPages` stops with exit 2 when `dist` is not built; the list itself is the widget pages.
distPages(GATE);
const run = await parseSweep({
  gate: GATE,
  pages: listWidgetPages(DIST),
  defaults: { widths: "1440" },
});

/** Every link of the page: its `href` as written, and the name of the widget that holds it. */
function readLinks(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("a[href], area[href]")].map((el) => ({
      href: el.getAttribute("href") ?? "",
      widget:
        el.closest("[data-widget]")?.getAttribute("data-widget") ?? "page",
    })),
  );
}

await sweep({
  gate: GATE,
  run,
  check: async ({ page }) => {
    await page.waitForSelector("[data-widget]", { state: "attached" });
    await settle(page);
    const pageUrl = page.url();
    return (await readLinks(page))
      .filter(({ href }) => isPageLinkWithoutSlash(resolveHref(href, pageUrl)))
      .map(({ href, widget }) => ({
        rule: "page-link-without-slash",
        target: "page",
        selector: widget,
        message: `${href} (in ${widget}) is a page link without its trailing slash`,
      }));
  },
});
