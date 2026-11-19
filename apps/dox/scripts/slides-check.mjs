#!/usr/bin/env node
/**
 * Slide-deck gate: the deck shell, measured on the built site (`context/dox/specs/dox-g12`).
 *
 * Each deck route under `/slides/` is loaded with `?globe=canvas2d` (so CI needs no GPU) at
 * 1280x720, 1920x1080 and 1024x768, and checked:
 *
 * - every slide is reachable from the first by next steps alone, and back by previous steps, and
 *   each step lands on the slide and build the address names;
 * - `#<id>/<n>` opens that slide and build;
 * - no element of the shown slide leaves the stage box, and the page never scrolls sideways;
 * - the stage box does not move or resize while stepping through every build;
 * - with scripts off, every slide heading is in the page, in order;
 * - in print, every slide section breaks after the page and no canvas is displayed;
 * - the space stage, at 1280x720 on the canvas-2D renderer: after each step the flight settles
 *   within 2.5 s, the camera rests within 0.5 degrees of the place the slide names, nothing asks for
 *   a frame for 500 ms at rest, and over the whole tour the median frame is within 17.5 ms and
 *   none takes more than 34 ms;
 * - no layer of the space stage, nor the blank, has a margin;
 * - going back to the wall from the last slide hangs it whole again, each pane drawn under its
 *   caption's figure to a pixel, and a pixel probe at each pane's centre matches that pane's capture.
 *
 * Usage (from apps/dox, after a build):
 *   node scripts/slides-check.mjs [--base http://127.0.0.1:4351/gmt] [--browsers chromium]
 *     [--pages /slides/<slug>/] [--list-pages]
 *
 * Without `--base` it serves `dist` itself on a free port. Exit 0 pass, 1 any finding, 2 usage or a
 * missing build.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { DECKS_DIR, allDeckRoutes } from "./lib/deck-folders.mjs";
import { gateBase, gateBrowsers, gateOptions } from "./lib/gate-cli.mjs";
import { FAMILIES } from "./lib/slides-check/families.mjs";

const GATE = "slides-check";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "..", "dist");
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
];

const routes = allDeckRoutes(DECKS_DIR);

const args = process.argv.slice(2);
const pages =
  (await applyPageContract({ gate: GATE, pages: routes, argv: args })) ??
  routes;
const opt = gateOptions(GATE, args, ["--base", "--browsers", "--pages"]);
const browsers = gateBrowsers(GATE, opt);

const { base, server } = await gateBase(GATE, opt, DIST);

/** The Earth carries one clock pin per zone the matrix runs in, up to twelve. */
const wallPins = Math.min(
  12,
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../src/data/zone-matrix.json", import.meta.url)),
      "utf8",
    ),
  ).matrix.zones.length,
);

let failures = 0;
let measured = 0;
const report = (browserName, width, pagePath, rule, target, message) => {
  failures += 1;
  console.log(
    `FAIL ${browserName} ${width}px ${pagePath}\n       ${rule}: ${message}`,
  );
  recordFinding({
    gate: GATE,
    rule,
    page: pagePath,
    target,
    browser: browserName,
    width,
    message,
  });
};

const runFamilies = async (sizes, env) => {
  for (const family of FAMILIES.filter((f) => f.sizes === sizes))
    measured += await family.run(env);
};

for (const browserName of browsers) {
  const browser = await launchBrowser(browserName);
  for (const pagePath of pages) {
    const env = { browserName, browser, base, pagePath, report, wallPins };
    for (const size of SIZES) await runFamilies("each", { ...env, size });
    await runFamilies("first", { ...env, size: SIZES[0] });
  }
  await browser.close();
}

server?.close();
recordMeasured(GATE, measured);
console.log(`${GATE}: ${measured} cell(s), ${failures} finding(s)`);
process.exit(failures > 0 || measured === 0 ? 1 : 0);
