#!/usr/bin/env node
/**
 * Canada 2026 clock-change checker layout gate (CORE-88).
 *
 * jsdom has no layout, so this runs in a browser against the built site. At each width it reads
 * the rect of every card and checks that
 *   - no two cards overlap,
 *   - the three cards of row 2 (map, zone card, clocks) share one top within 1 px wherever they
 *     sit side by side, and stack in that order below it,
 *   - no card reaches past the stack's edge, and the page does not scroll sideways.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory /tmp/dist-x
 *
 * Usage:
 *   node scripts/canada-layout-check.mjs --base http://127.0.0.1:4351/gmt [--widths 1440,1024]
 *     [--path <page>]   the checker page; Canada by default, or /check/morocco-2026-clock-change/
 *     [--fixture <file>]  a Worker answer (.json) served for the page's GET, so results arrive
 *     [--shots <dir>]   also writes a dark and a light screenshot of the stack per width
 */

import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { blockOffSite } from "./gate-checks.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = arg("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const WIDTHS = arg("widths", "1440,1024").split(",").map(Number);
const SHOTS = arg("shots", "");
const PATH = arg("path", "/check/canada-2026-clock-change/");
/* `canada` or `morocco`: the page's class and ids are named after its checker. */
const WORD = PATH.includes("morocco") ? "morocco" : "canada";
/* Optional: a Worker answer saved to a file, served for the page's GET so results arrive. */
const FIXTURE_FILE = arg("fixture", "");
const FIXTURE = FIXTURE_FILE ? readFileSync(FIXTURE_FILE, "utf8") : null;

const CARDS = {
  keypoints: ".gmt-keypoints",
  browser: ".gmt-clockcheck-browser",
  map: ".gmt-zonemap-stage",
  pick: `.gmt-${WORD}-pickcard`,
  clocks: `.gmt-${WORD}-nowsec`,
  servers: ".gmt-clockcheck-servers",
  minimums: ".gmt-clockcheck-minimums",
  changes: `section[aria-labelledby=${WORD}-changes-title]`,
  help: ".gmt-clockcheck-help",
  stored: ".gmt-clockcheck-stored",
};

const failures = [];
const fail = (message) => failures.push(message);

const browser = await chromium.launch();
for (const theme of SHOTS ? ["dark", "light"] : ["dark"]) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    await blockOffSite(page, BASE);
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("starlight-theme", t);
      } catch {}
    }, theme);
    if (FIXTURE !== null) {
      await page.route(`**/api/${WORD}-clock-change`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: FIXTURE,
        }),
      );
    }
    await page.goto(`${BASE}${PATH}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const data = await page.evaluate(
      ({ cards, word }) => {
        const rect = (selector) => {
          const el = document.querySelector(selector);
          if (!el || el.offsetParent === null) return null;
          const b = el.getBoundingClientRect();
          return {
            left: b.left,
            right: b.right,
            top: b.top + scrollY,
            bottom: b.bottom + scrollY,
          };
        };
        const stack = rect(`.gmt-${word}-stack`);
        return {
          stack,
          hscroll: document.documentElement.scrollWidth > innerWidth,
          rects: Object.fromEntries(
            Object.entries(cards).map(([k, s]) => [k, rect(s)]),
          ),
        };
      },
      { cards: CARDS, word: WORD },
    );
    const tag = `${width}px ${theme}`;
    if (data.hscroll) fail(`${tag}: the page scrolls sideways`);
    const present = Object.entries(data.rects).filter(([, r]) => r);
    for (const [name, r] of present) {
      if (r.left < data.stack.left - 1 || r.right > data.stack.right + 1) {
        fail(
          `${tag}: ${name} reaches past the stack (${r.left}..${r.right} in ${data.stack.left}..${data.stack.right})`,
        );
      }
    }
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        const [an, a] = present[i];
        const [bn, b] = present[j];
        const across = a.left < b.right - 1 && b.left < a.right - 1;
        const down = a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (across && down) fail(`${tag}: ${an} overlaps ${bn}`);
      }
    }
    const { map, pick, clocks } = data.rects;
    if (map && pick && clocks) {
      const pairUp = clocks.top < pick.bottom - 1;
      if (pairUp && Math.abs(pick.top - clocks.top) > 1)
        fail(`${tag}: the zone card and the clocks do not share a top`);
      const threeUp = Math.abs(map.top - pick.top) <= 1;
      if (!threeUp && !(map.bottom <= pick.top + 1))
        fail(`${tag}: the map is not above the zone card`);
    }
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page
        .locator(`.gmt-${WORD}-stack`)
        .screenshot({ path: `${SHOTS}/${theme}-${width}.png` });
    }
    console.log(`${tag}: ${present.length} cards checked`);
    await context.close();
  }
}
await browser.close();

if (failures.length > 0) {
  console.error(failures.map((line) => `FAIL ${line}`).join("\n"));
  process.exit(1);
}
console.log("canada layout: ok");
