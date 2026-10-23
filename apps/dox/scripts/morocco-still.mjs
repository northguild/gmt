#!/usr/bin/env node
/**
 * Morocco 2026 clock-change checker stability gate (CORE-89).
 *
 * The two clocks tick once a minute and both change offset at their next clock change. A tick
 * must not move or resize any clock card or readout, and the page must not scroll sideways.
 * jsdom has no layout, so this runs in a browser against the built site.
 *
 * It loads `/check/morocco-2026-clock-change/` at 1280 and 375 px with:
 *   - the Worker answer stubbed from a tzdb 2026c fixture (no network, so it does not depend on
 *     the tz data the local Worker runs) and
 *   - a fake clock (`page.clock`) set 90 s before Casablanca and El Aaiun leave +01:00, so one
 *     advance crosses a minute and the next crosses their `next.instant` (+01:00 to +00:00).
 * It records every `.gmt-check-clock` card's and `[data-role="clock-time"]` readout's rect, then
 * advances 60 s twice and asserts the rects are unchanged, the readouts did change, and both
 * readouts moved from +01:00 to +00:00. It then loads the page again with the clock running,
 * submits the stored-times preset against a short answer, serves a second answer with the longest
 * result texts, and asserts the key points, the browser card, the transitions table, the clock
 * cards and the form's buttons do not move or resize (document coordinates) when either answer
 * replaces the last. At 375 px it also asserts no horizontal page scroll. (How much the page
 * grows when the answer arrives is `grow-measure.mjs`'s job.)
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir <real path>/gmt
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory <real path>
 *
 * Usage:
 *   node scripts/morocco-still.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit]
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
const PATH = "/check/morocco-2026-clock-change/";
const ZONES = ["Africa/Casablanca", "Africa/El_Aaiun"];

/* 2026-09-20T00:58:30Z, and the same instant in epoch milliseconds. The zones leave +01:00 at
   01:00:00Z, 90 s later. */
const NOW = "2026-09-20T00:58:30Z";
const FAKE_NOW_MS = 1789865910000;

const CHANGE = {
  instant: "2026-09-20T01:00:00Z",
  offsetBefore: "+01:00",
  offsetAfter: "+00:00",
};
const FIXTURE = {
  now: NOW,
  probe: ZONES.map((zone) => ({ zone, offset: "+00:00" })),
  transitions: ZONES.map((zone) => ({
    zone,
    year: 2026,
    ...CHANGE,
    wallBefore: "2026-09-20T02:00:00",
  })),
  zones: ZONES.map((zone) => ({
    zone,
    offset: "+01:00",
    last: null,
    next: CHANGE,
  })),
};

const ROW = (line, input, result) => ({ line, input, value: input, result });
const LONG_ZONE = "Africa/El_Aaiun";
const LONG_STAMP = "2027-06-01T09:00:00.123456789";
const LONG_INPUT = (offset) => `${LONG_STAMP}${offset}[${LONG_ZONE}]`;
/* The stored-times answer for the preset: one row of each kind the page words differently. */
const PRESET_ANSWER = {
  zone: ZONES[0],
  truncated: false,
  rows: [
    ROW(1, "2027-06-01T09:00:00+01:00[Africa/Casablanca]", {
      kind: "offsetMismatch",
      storedOffset: "+01:00",
      zoneOffset: "+00:00",
      atStoredOffset: "2027-06-01T08:00:00Z",
      atZoneOffset: "2027-06-01T09:00:00Z",
    }),
    ROW(2, "2027-06-01T09:00:00+00:00[Africa/Casablanca]", {
      kind: "valid",
      instant: "2027-06-01T09:00:00Z",
      atStoredOffset: "2027-06-01T09:00:00Z",
    }),
    { line: 3, input: "2027-03-14T02:30:00+00:00", value: null, result: null },
  ],
};
/* The longest texts the page draws: 12 long lines of every kind, a null row, and the truncated note. */
const LONG_ANSWER = {
  zone: LONG_ZONE,
  truncated: true,
  rows: [
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      ROW(i + 1, LONG_INPUT(i % 2 === 0 ? "+01:00" : "-12:45"), {
        kind: "offsetMismatch",
        storedOffset: i % 2 === 0 ? "+01:00" : "-12:45",
        zoneOffset: "+00:00",
        atStoredOffset: "2027-06-01T21:45:00.123456789Z",
        atZoneOffset: "2027-06-01T09:00:00.123456789Z",
      }),
    ),
    ROW(9, LONG_INPUT("+00:30"), {
      kind: "ambiguous",
      earlier: "2027-06-01T08:30:00.123456789Z",
      later: "2027-06-01T09:30:00.123456789Z",
      atStoredOffset: "2027-06-01T08:30:00.123456789Z",
    }),
    ROW(10, LONG_INPUT("+00:00"), {
      kind: "nonexistent",
      earlier: "2027-06-01T08:30:00.123456789Z",
      later: "2027-06-01T09:30:00.123456789Z",
      atStoredOffset: "2027-06-01T09:30:00.123456789Z",
    }),
    ROW(11, LONG_INPUT("+00:00"), {
      kind: "validInOverlap",
      instant: "2027-06-01T09:00:00.123456789Z",
      earlier: "2027-06-01T09:00:00.123456789Z",
      later: "2027-06-01T10:00:00.123456789Z",
      atStoredOffset: "2027-06-01T09:00:00.123456789Z",
    }),
    {
      line: 12,
      input: "not a stored time, and a long line that no form completes".repeat(
        2,
      ),
      value: null,
      result: null,
    },
  ],
};

const failures = [];
const fail = (message) => failures.push(message);

async function snapshot(page) {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map(
        (n) => Math.round(n * 100) / 100,
      );
    };
    return [...document.querySelectorAll(".gmt-check-clock")].map((card) => ({
      zone: card.dataset.zone,
      card: box(card),
      readout: box(card.querySelector('[data-role="clock-time"]')),
      text: card.querySelector('[data-role="clock-time"]').textContent.trim(),
    }));
  });
}

function sameRects(label, before, after) {
  if (before.length !== 2 || after.length !== 2) {
    fail(
      `${label}: expected 2 clock cards, saw ${before.length} then ${after.length}`,
    );
    return;
  }
  before.forEach((b, i) => {
    const a = after[i];
    if (JSON.stringify(b.card) !== JSON.stringify(a.card)) {
      fail(`${label}: ${b.zone} card moved ${b.card} -> ${a.card}`);
    }
    if (JSON.stringify(b.readout) !== JSON.stringify(a.readout)) {
      fail(`${label}: ${b.zone} readout moved ${b.readout} -> ${a.readout}`);
    }
  });
}

/* Everything a stored-times answer must leave alone, in document coordinates: the harness scrolls
   (a pressed control is brought into view), and that is not the layout moving. */
async function stillSnapshot(page) {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return [r.x + scrollX, r.y + scrollY, r.width, r.height].map(
        (n) => Math.round(n * 100) / 100,
      );
    };
    const root = document.querySelector(".gmt-morocco");
    const one = (selector) => {
      const el =
        root?.querySelector(selector) ?? document.querySelector(selector);
      return el ? box(el) : null;
    };
    const out = {
      keypoints: one(".gmt-keypoints"),
      browser: one(".gmt-check-browser"),
      transitions: one('[data-role="transitions"]'),
      form: one('[data-role="stored-form"]'),
      textarea: one("textarea"),
      check: one('[data-role="stored-check"]'),
      example: one('[data-role="stored-example"]'),
    };
    root?.querySelectorAll(".gmt-check-clock").forEach((card, i) => {
      out[`clock ${i}`] = box(card);
    });
    return out;
  });
}

function sameStill(label, before, after) {
  for (const key of Object.keys(before)) {
    if (before[key] === null) {
      fail(`${label}: ${key} is not on the page`);
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fail(`${label}: ${key} moved ${before[key]} -> ${after[key]}`);
    }
  }
}

/* Submit the preset, then serve the long answer: no card, table or button may move. */
async function checkStoredStill(context, label) {
  let answer = PRESET_ANSWER;
  const page = await context.newPage();
  await page.route("**/api/morocco-clock-change", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(
        route.request().method() === "POST" ? answer : FIXTURE,
      ),
    }),
  );
  await page.goto(`${BASE}${PATH}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".gmt-morocco .gmt-check-stored");
  // The preset is in the textarea from the start and the page checks it on load; nothing in the
  // markup says "ready", so press Check until the first answer's rows are drawn.
  const rows = page.locator(".gmt-morocco .gmt-check-stored-table tbody tr");
  for (
    let attempt = 0;
    attempt < 40 && (await rows.count()) === 0;
    attempt += 1
  ) {
    await page.click('.gmt-morocco [data-role="stored-check"]');
    await page.waitForTimeout(250);
  }
  await rows.first().waitFor();
  const before = await stillSnapshot(page);
  const preset = await rows.count();
  if (preset !== PRESET_ANSWER.rows.length) {
    fail(
      `${label}: expected ${PRESET_ANSWER.rows.length} preset rows, saw ${preset}`,
    );
  }

  answer = LONG_ANSWER;
  await page.click('.gmt-morocco [data-role="stored-check"]');
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll(".gmt-morocco .gmt-check-stored-table tbody tr")
        .length === n,
    LONG_ANSWER.rows.length,
  );
  const long = await rows.count();
  sameStill(
    `${label} after the long answer`,
    before,
    await stillSnapshot(page),
  );
  return long;
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
      await page.route("**/api/morocco-clock-change", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(FIXTURE),
        }),
      );
      await page.clock.install({ time: FAKE_NOW_MS });
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
        await page.waitForSelector(".gmt-check-clock");
        // Let the library load and the stubbed fetch resolve on the fake clock.
        for (let i = 0; i < 400; i++) {
          const rows = await snapshot(page);
          if (
            rows.length === 2 &&
            rows.every((r) => /\d\d:\d\d [+-]\d\d:\d\d/.test(r.text))
          )
            break;
          await page.clock.runFor(100);
          await page.waitForTimeout(50);
        }
        const start = await snapshot(page);
        for (const row of start) {
          if (!row.text.endsWith("+01:00")) {
            fail(
              `${label}: ${row.zone} should start at +01:00, read "${row.text}"`,
            );
          }
        }

        await page.clock.runFor(60_000);
        await page.waitForTimeout(100);
        const minute = await snapshot(page);
        sameRects(`${label} after one minute`, start, minute);
        if (
          JSON.stringify(minute.map((r) => r.text)) ===
          JSON.stringify(start.map((r) => r.text))
        ) {
          fail(
            `${label}: no readout changed after a minute (the clocks did not tick)`,
          );
        }

        await page.clock.runFor(60_000);
        // The change redraws once the library answers; give it real time before reading.
        for (let i = 0; i < 50; i++) {
          const rows = await snapshot(page);
          if (rows.length === 2 && rows.every((r) => r.text.endsWith("+00:00")))
            break;
          await page.waitForTimeout(100);
        }
        const crossed = await snapshot(page);
        sameRects(`${label} across the change`, start, crossed);
        for (const row of crossed) {
          if (!row.text.endsWith("+00:00")) {
            fail(
              `${label}: ${row.zone} should read +00:00 after its change, read "${row.text}"`,
            );
          }
        }

        const longRows = await checkStoredStill(context, label);

        if (width === 375) {
          const scroll = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
          }));
          if (scroll.scroll > scroll.client) {
            fail(
              `${label}: horizontal page scroll (${scroll.scroll} > ${scroll.client})`,
            );
          }
        }
        console.log(
          `${label}: ${start.length} clocks measured, stored answers held still (${longRows} long rows)`,
        );
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
console.log("morocco-still: every clock card and readout held still");
