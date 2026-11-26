#!/usr/bin/env node
/**
 * Plate-fit gate: no text in a readout plate runs past the plate's inner right edge, at any
 * viewport width.
 *
 * A plate holds a value and its unit on one line, so a track narrower than the widest reading
 * pushes the text out of the plate. Where the tracks are too narrow depends on the stage's width,
 * which does not grow with the viewport (the sidebar and the right-hand contents column come and
 * go), so a failure shows in bands. The check opens every built tool page (`lib/tool-pages.mjs`,
 * read from `dist`, never a fixed count), settles it once, and walks the viewport from `--from`
 * to `--to` in `--step` px (default 320 to 1920 in 20, fine enough to land in a 60 px band),
 * measuring each width (`lib/plate-overflow.mjs`): any visible plate text more than 1.5 px past the
 * plate's inner edge fails (`plate-text-overflows`), and so does any reserved sample, the widest
 * reading a plate can show, that would (`plate-sample-overflows`). The sample rule is what catches
 * a reading the page is not showing now, such as a value at the far end of a slider.
 *
 * The page is resized in place, not reloaded: a layout that reads only CSS follows the resize,
 * which is the layout this gate is for.
 *
 * Usage (from apps/dox, after a build):
 *   node scripts/plate-fit.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium,webkit]
 *     [--theme dark|light] [--from 320] [--to 1920] [--step 20] [--pages /a/,/b/]
 *     [--list-pages] [--shard <i>/<n>]
 *
 * Without `--base` it serves `dist` itself on a free port. The runner's contract: `--list-pages`
 * prints the tool pages and exits; with `GATE_REPORT` set each failing width of each plate is a
 * finding. `--shard <i>/<n>` checks every n-th page of the sorted list, starting at the i-th.
 * Last line `plate-fit: <pages> pages, <widths> widths, <plates> plates measured, <n> overflow`.
 * Exit 0 pass, 1 any finding or nothing measured, 2 usage or a missing build.
 */
import { launchBrowser } from "./lib/browser-launch.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockOffSite } from "./gate-checks.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { settle } from "./lib/a11y-sweep.mjs";
import { measurePlates } from "./lib/plate-overflow.mjs";
import {
  gateBase,
  gateBrowsers,
  gateOptions,
  gatePages,
  usageError,
} from "./lib/gate-cli.mjs";
import { listToolPages } from "./lib/tool-pages.mjs";

const GATE = "plate-fit";
const HEIGHT = 900;
const AT_A_TIME = 4;
/* A readiness condition, not a budget: a CI runner loads a heavy tool page slowly. */
const LOAD_TIMEOUT = 120_000;
const DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
);

const args = process.argv.slice(2);
const opt = gateOptions(GATE, args, [
  "--base",
  "--browsers",
  "--theme",
  "--from",
  "--to",
  "--step",
  "--pages",
  "--list-pages",
  "--shard",
]);

const pages = await gatePages(GATE, args, opt, DIST, listToolPages);
const browsers = gateBrowsers(GATE, opt);
const theme = opt("theme", "dark");
if (theme !== "dark" && theme !== "light")
  usageError(GATE, `--theme takes dark or light`);
const number = (name, fallback, min) => {
  const n = Number(opt(name, String(fallback)));
  if (!Number.isInteger(n) || n < min)
    usageError(GATE, `--${name} takes a whole number of at least ${min}`);
  return n;
};
const from = number("from", 320, 200);
const to = number("to", 1920, from);
const step = number("step", 20, 1);
const widths = [];
for (let w = from; w <= to; w += step) widths.push(w);
if (widths.at(-1) !== to) widths.push(to);

const { base, server } = await gateBase(GATE, opt, DIST);

/**
 * After a resize: two frames, then every eased region at rest (`[data-growing]`), capped at 3 s.
 * `settle` also waits 500 ms of quiet, which across every width of every page would take an hour.
 */
async function afterResize(page) {
  await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    await frame();
    await frame();
    const until = performance.now() + 3000;
    while (
      document.querySelector("[data-growing]") &&
      performance.now() < until
    ) {
      await new Promise((r) => setTimeout(r, 30));
    }
  });
}

let measuredPages = 0;
let measuredPlates = 0;
let findings = 0;

/** Reports one finding line and records it. */
function report(browserName, pagePath, width, f) {
  findings += 1;
  const rule = f.sample ? "plate-sample-overflows" : "plate-text-overflows";
  const what = f.sample ? "its widest reading" : "its text";
  const message = `plate "${f.plate}" (${f.plateWidth}px wide): ${what} "${f.text}" runs ${f.past}px past its right edge`;
  console.log(`FAIL ${browserName} ${width}px ${pagePath}\n       ${message}`);
  recordFinding({
    gate: GATE,
    rule,
    page: pagePath,
    target: `plate "${f.plate}"`,
    selector: f.plateClass ?? null,
    browser: browserName,
    width,
    theme,
    message,
  });
}

for (const browserName of browsers) {
  const browser = await launchBrowser(browserName);
  let next = 0;
  const work = async () => {
    while (next < pages.length) {
      const pagePath = pages[next++];
      const context = await browser.newContext({
        viewport: { width: widths[0], height: HEIGHT },
        colorScheme: theme,
      });
      try {
        await context.addInitScript((t) => {
          try {
            localStorage.setItem("starlight-theme", t);
          } catch {}
        }, theme);
        await blockOffSite(context, base);
        const page = await context.newPage();
        const res = await page.goto(base + pagePath, {
          waitUntil: "load",
          timeout: LOAD_TIMEOUT,
        });
        if (!res || res.status() !== 200) {
          throw new Error(
            `the page answered HTTP ${res ? res.status() : "none"}, not 200`,
          );
        }
        await settle(page);
        let plates = 0;
        let failing = 0;
        for (const width of widths) {
          await page.setViewportSize({ width, height: HEIGHT });
          await afterResize(page);
          const got = await page.evaluate(measurePlates);
          plates = Math.max(plates, got.plates);
          failing += got.found.length;
          for (const f of got.found) report(browserName, pagePath, width, f);
        }
        measuredPlates += plates;
        measuredPages += 1;
        console.log(
          `${failing === 0 ? "ok  " : "FAIL"} ${browserName} ${pagePath} ${plates} plates, ${widths.length} widths`,
        );
      } catch (error) {
        findings += 1;
        const message = `the check crashed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
        console.log(`FAIL ${browserName} ${pagePath}\n       ${message}`);
        recordFinding({
          gate: GATE,
          rule: "check-crashed",
          page: pagePath,
          target: "page",
          browser: browserName,
          theme,
          message,
        });
      } finally {
        await context.close().catch(() => {});
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(AT_A_TIME, pages.length) }, work),
  );
  await browser.close();
}

server?.close();
recordMeasured(GATE, measuredPages * widths.length);
console.log(
  `${GATE}: ${pages.length} pages, ${widths.length} widths, ${measuredPlates} plates measured, ${findings} overflow`,
);
if (measuredPlates === 0) {
  console.log("FAIL no plate measured: no plate class matched on any page");
}
process.exit(findings > 0 || measuredPlates === 0 ? 1 : 0);
