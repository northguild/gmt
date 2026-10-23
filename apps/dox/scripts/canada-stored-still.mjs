#!/usr/bin/env node
/**
 * "Did your saved events move?" stability gate (CORE-88).
 *
 * The form must not move or resize when an answer arrives, and the page must not scroll sideways
 * at 375 px. jsdom has no layout, so this runs in a browser against the built site.
 *
 * It loads `/check/canada-2026-clock-change/` at 1280 and 375 px with the Worker's two answers stubbed
 * (the GET probe and a POST that returns one row of every kind and a null), records the rect of
 * the section's heading, steps, textarea, Check and Reset example buttons and the summary bar before
 * and after pressing Check from the keyboard, and again after "Only moved" is on. Every rect, in
 * document coordinates, must be unchanged (a scroll the harness causes is not a layout shift).
 * WebKit presses Option+Tab: Safari on macOS leaves buttons out of the plain Tab order. It also checks the result rows are in the page and "Only moved" hides the rest.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory /tmp/dist-x
 *
 * Usage:
 *   node scripts/canada-stored-still.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit]
 */

import { chromium, webkit } from "@playwright/test";
import { blockOffSite } from "./gate-checks.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = arg("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const BROWSERS = arg("browsers", "chromium").split(",");
const WIDTHS = [1280, 375];
const PATH = "/check/canada-2026-clock-change/";

const GET_FIXTURE = {
  now: "2026-10-22T12:00:00Z",
  probe: [],
  transitions: [],
  zones: [],
};
const ROW = (line, input, result) => ({ line, input, value: input, result });
const POST_FIXTURE = {
  zone: "America/Vancouver",
  truncated: true,
  rows: [
    ROW(1, "2026-07-01T12:00:00-04:00[America/Toronto]", {
      kind: "valid",
      instant: "2026-07-01T16:00:00Z",
      atStoredOffset: "2026-07-01T16:00:00Z",
    }),
    ROW(2, "2026-11-01T01:30:00-04:00[America/Toronto]", {
      kind: "validInOverlap",
      instant: "2026-11-01T05:30:00Z",
      earlier: "2026-11-01T05:30:00Z",
      later: "2026-11-01T06:30:00Z",
      atStoredOffset: "2026-11-01T05:30:00Z",
    }),
    ROW(3, "2026-07-01T12:00:00-05:00[America/Toronto]", {
      kind: "offsetMismatch",
      storedOffset: "-05:00",
      zoneOffset: "-04:00",
      atStoredOffset: "2026-07-01T17:00:00Z",
      atZoneOffset: "2026-07-01T16:00:00Z",
    }),
    ROW(4, "2026-11-01T01:30:00-06:00[America/Toronto]", {
      kind: "ambiguous",
      earlier: "2026-11-01T05:30:00Z",
      later: "2026-11-01T06:30:00Z",
      atStoredOffset: "2026-11-01T07:30:00Z",
    }),
    ROW(5, "2027-03-14T02:30:00-05:00[America/Toronto]", {
      kind: "nonexistent",
      earlier: "2027-03-14T06:30:00Z",
      later: "2027-03-14T07:30:00Z",
      atStoredOffset: "2027-03-14T07:30:00Z",
    }),
    { line: 6, input: "not a stored time", value: null, result: null },
  ],
};

const failures = [];
const fail = (message) => failures.push(message);

async function snapshot(page) {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      // In document coordinates: the harness scrolls (a pressed control is brought into view), and
      // that is not the form moving. A real shift of the layout still changes these.
      return [r.x + scrollX, r.y + scrollY, r.width, r.height].map(
        (n) => Math.round(n * 100) / 100,
      );
    };
    const section = document.querySelector(".gmt-check-stored");
    const pick = (selector) => box(section.querySelector(selector));
    return {
      heading: pick("h4"),
      textarea: pick("textarea"),
      steps: pick(".gmt-check-steps"),
      check: pick('[data-role="stored-check"]'),
      example: pick('[data-role="stored-example"]'),
      head: pick(".gmt-check-stored-head"),
      toggle: pick(".gmt-check-seg"),
    };
  });
}

function same(label, before, after) {
  for (const key of Object.keys(before)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fail(`${label}: ${key} moved ${before[key]} -> ${after[key]}`);
    }
  }
}

for (const name of BROWSERS) {
  const launcher = name === "webkit" ? webkit : chromium;
  const browser = await launcher.launch();
  try {
    for (const width of WIDTHS) {
      const label = `${name} ${width}px`;
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await blockOffSite(context, BASE);
      const page = await context.newPage();
      await page.route("**/api/canada-clock-change", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(
            route.request().method() === "POST" ? POST_FIXTURE : GET_FIXTURE,
          ),
        }),
      );
      try {
        const response = await page.goto(`${BASE}${PATH}`, {
          waitUntil: "domcontentloaded",
        });
        if (!response || response.status() !== 200) {
          fail(
            `${label}: the page answered HTTP ${response?.status()}, not 200 (wrong --base?)`,
          );
          continue;
        }
        await page.waitForSelector(".gmt-check-stored");
        // The section's handlers attach when the page's script runs, after the server-sent markup is
        // already on screen; a press before that is a native form submit (a reload). The Example
        // button is the probe: it only fills the textarea once its handler is bound, so press it
        // until it does. Nothing in the markup says "ready", and the status line is empty from the start.
        let bound = false;
        for (let attempt = 0; attempt < 40 && !bound; attempt += 1) {
          await page.click('[data-role="stored-example"]');
          bound = await page.evaluate(
            () =>
              document.querySelector('[data-role="stored-lines"]')?.value !==
              "",
          );
          if (!bound) await page.waitForTimeout(250);
        }
        if (!bound)
          throw new Error(
            "the stored-times handlers never attached (Example filled nothing)",
          );
        const before = await snapshot(page);

        // Keyboard only: Tab from the textarea (past the formats disclosure) to Check, then Enter.
        await page.focus('[data-role="stored-lines"]');
        for (let i = 0; i < 2; i += 1) {
          await page.keyboard.press(name === "webkit" ? "Alt+Tab" : "Tab");
        }
        await page.keyboard.press("Enter");
        await page.waitForSelector(".gmt-check-stored-table tbody tr");
        const rows = await page
          .locator(".gmt-check-stored-table tbody tr")
          .count();
        if (rows !== 6) fail(`${label}: expected 6 result rows, saw ${rows}`);
        same(`${label} after the answer`, before, await snapshot(page));

        await page.click('[data-role="stored-show-moved"]');
        const shown = await page
          .locator(".gmt-check-stored-table tbody tr:visible")
          .count();
        if (shown !== 3)
          fail(`${label}: "Only moved" should leave 3 rows, saw ${shown}`);
        same(`${label} after the toggle`, before, await snapshot(page));

        const scroll = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        if (scroll.scroll > scroll.client) {
          fail(
            `${label}: horizontal page scroll (${scroll.scroll} > ${scroll.client})`,
          );
        }
        console.log(`${label}: form held still, ${rows} rows`);
      } catch (error) {
        fail(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (failures.length > 0) {
  console.error(failures.map((f) => `FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log("canada-stored-still: the stored-times form held still");
