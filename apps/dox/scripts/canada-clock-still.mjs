#!/usr/bin/env node
/**
 * Canada 2026 clock-change checker stability gate (CORE-88).
 *
 * The five clocks tick once a minute and one of them changes offset at its next clock change. A
 * tick must not move or resize any clock card or readout, and the page must not scroll sideways.
 * jsdom has no layout, so this runs in a browser against the built site.
 *
 * It loads `/check/canada-2026-clock-change/` at 1280 and 375 px with:
 *   - the Worker answer stubbed (a fixed fixture, no network) and
 *   - a fake clock (`page.clock`) set 90 s before America/Toronto leaves daylight time, so one
 *     advance crosses a minute and the next crosses Toronto's `next.instant` (-04:00 to -05:00).
 * It records every `.gmt-check-clock` card's and `[data-role="clock-time"]` readout's rect, then
 * advances 60 s twice and asserts the rects are unchanged, the readouts did change, and Toronto's
 * readout moved from -04:00 to -05:00. At 375 px it also asserts no horizontal page scroll.
 *
 * It then pins each of the 23 zones in turn (a fixture row for every zone, the longest texts in
 * the mix) and asserts the pin panel's, the map's and the stored-times form's rects do not change,
 * and that no value cell in the panel is under 4ch wide. At 375 px it asserts the panel sits under
 * the pressed button instead (the map is not drawn there).
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory /tmp/dist-x
 *
 * Usage:
 *   node scripts/canada-clock-still.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit]
 */

import { readFileSync } from "node:fs";
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

/* 2026-11-01T05:58:30Z in epoch milliseconds: 1793620800000 (2026-11-02T12:00:00Z) less 30 h
   01 min 30 s. Toronto leaves daylight time at 06:00:00Z. */
const FAKE_NOW_MS = 1793512710000;
const NOW = "2026-11-01T05:58:30Z";

const ZONE_OFFSETS = {
  "America/Vancouver": "-07:00",
  "America/Edmonton": "-06:00",
  "America/Inuvik": "-06:00",
  "America/Winnipeg": "-05:00",
};
const FIXTURE = {
  now: NOW,
  probe: Object.entries(ZONE_OFFSETS).map(([zone, offset]) => ({
    zone,
    offset,
  })),
  transitions: [],
  zones: [
    ...Object.entries(ZONE_OFFSETS).map(([zone, offset]) => ({
      zone,
      offset,
      last: null,
      next: null,
      kind: "stopped-2026",
    })),
    {
      zone: "America/Toronto",
      offset: "-04:00",
      last: null,
      next: {
        instant: "2026-11-01T06:00:00Z",
        offsetBefore: "-04:00",
        offsetAfter: "-05:00",
      },
      kind: "changes-2027",
    },
  ],
};

const ALL_ZONES = JSON.parse(
  readFileSync(
    new URL("../src/lib/canada-zones.json", import.meta.url),
    "utf8",
  ),
).zones;
const KINDS = ["stopped-2026", "changes-2027", "none-2026-2027", "none"];
/* A row for every zone. Odd rows carry both a last and a next change, the widest texts. */
const FULL_FIXTURE = {
  now: NOW,
  probe: FIXTURE.probe,
  transitions: [],
  zones: ALL_ZONES.map((zone, i) => ({
    zone,
    offset: "-05:00",
    last:
      i % 2 === 0
        ? null
        : {
            instant: "2026-03-08T07:00:00Z",
            offsetBefore: "-05:00",
            offsetAfter: "-04:00",
          },
    next:
      i % 3 === 0
        ? null
        : {
            instant: "2027-11-07T06:00:00Z",
            offsetBefore: "-04:00",
            offsetAfter: "-05:00",
          },
    kind: KINDS[i % KINDS.length],
  })),
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
  if (before.length !== 5 || after.length !== 5) {
    fail(
      `${label}: expected 5 clock cards, saw ${before.length} then ${after.length}`,
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

/** Page-absolute rects of what must not move when a zone is pinned. */
async function pinRects(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [r.x + scrollX, r.y + scrollY, r.width, r.height].map(
        (n) => Math.round(n * 100) / 100,
      );
    };
    const panel = document.querySelector(".gmt-canada-pin");
    const cells = [...panel.querySelectorAll("dd[data-role]")].map((cell) => {
      const probe = document.createElement("span");
      probe.style.cssText =
        "display:block;width:4ch;height:0;visibility:hidden";
      cell.append(probe);
      const four = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        role: cell.dataset.role,
        width: cell.getBoundingClientRect().width,
        four,
      };
    });
    return {
      panel: box(".gmt-canada-pin"),
      map: box(".gmt-canada-map"),
      form: box(".gmt-check-stored-form"),
      cells,
      underButton:
        panel.previousElementSibling?.matches("button[data-tz-id]") ?? false,
      mapShown:
        getComputedStyle(document.querySelector(".gmt-canada-map")).display !==
        "none",
    };
  });
}

async function checkPinPanel(page, label, width) {
  await page.waitForSelector("button[data-tz-id]");
  await page.waitForFunction(
    () => document.querySelectorAll("button[data-tz-id]").length >= 23,
  );
  // The list is server-rendered and its handlers bind when the map module loads, so a click that
  // lands first does nothing: click again until the panel names the zone.
  const pinned = async (id) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.locator(`button[data-tz-id="${id}"]`).click();
      const ok = await page
        .waitForFunction(
          (zone) =>
            document
              .querySelector('[data-role="pin-zone"]')
              ?.textContent?.trim() === zone,
          id,
          { timeout: 1500 },
        )
        .then(
          () => true,
          () => false,
        );
      if (ok) return;
    }
    throw new Error(`pinning ${id} never showed in the panel`);
  };
  if (width === 375) {
    await pinned(ALL_ZONES[0]);
    const r = await pinRects(page);
    if (r.mapShown) fail(`${label}: the map is drawn at 375px`);
    if (!r.underButton)
      fail(`${label}: the pin panel is not under the pressed button`);
    return;
  }
  // The page finishes mounting its widgets after the list appears; the baseline is the layout once
  // two reads 400 ms apart agree, so only a pin can be blamed for a later change.
  let before = await pinRects(page);
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(400);
    const next = await pinRects(page);
    const same = ["panel", "map", "form"].every(
      (k) => JSON.stringify(next[k]) === JSON.stringify(before[k]),
    );
    before = next;
    if (same) break;
  }
  for (const id of ALL_ZONES) {
    await pinned(id);
    const r = await pinRects(page);
    for (const key of ["panel", "map", "form"]) {
      if (before[key] === null || r[key] === null) {
        fail(`${label}: no ${key} on the page`);
        break;
      }
      if (JSON.stringify(before[key]) !== JSON.stringify(r[key])) {
        fail(
          `${label}: pinning ${id} moved the ${key} ${before[key]} -> ${r[key]}`,
        );
      }
    }
    for (const cell of r.cells) {
      if (cell.width < cell.four) {
        fail(
          `${label}: pinning ${id}: ${cell.role} is ${cell.width}px wide, under 4ch (${cell.four}px)`,
        );
      }
    }
  }
  console.log(
    `${label}: pinned ${ALL_ZONES.length} zones, panel, map and form held still`,
  );
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
        for (let i = 0; i < 40; i++) {
          const rows = await snapshot(page);
          if (
            rows.length === 5 &&
            rows.every((r) => /\d\d:\d\d [+-]\d\d:\d\d/.test(r.text))
          )
            break;
          await page.clock.runFor(100);
          await page.waitForTimeout(50);
        }
        const start = await snapshot(page);
        const toronto = (rows) =>
          rows.find((r) => r.zone === "America/Toronto")?.text ?? "";
        if (!toronto(start).endsWith("-04:00")) {
          fail(
            `${label}: Toronto should start at -04:00, read "${toronto(start)}"`,
          );
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
        await page.waitForTimeout(100);
        const crossed = await snapshot(page);
        sameRects(`${label} across Toronto's change`, start, crossed);
        if (!toronto(crossed).endsWith("-05:00")) {
          fail(
            `${label}: Toronto should read -05:00 after its change, read "${toronto(crossed)}"`,
          );
        }

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
        console.log(`${label}: ${start.length} clocks measured`);
      } catch (error) {
        fail(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await context.close();
      }

      // The pin panel, against a fixture with a row for every zone and the real clock.
      const pinContext = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await blockOffSite(pinContext, BASE);
      const pinPage = await pinContext.newPage();
      await pinPage.route("**/api/canada-clock-change", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "cache-control": "no-store" },
          body: JSON.stringify(FULL_FIXTURE),
        }),
      );
      try {
        await pinPage.goto(`${BASE}${PATH}`, { waitUntil: "load" });
        await checkPinPanel(pinPage, `${label} pin panel`, width);
      } catch (error) {
        fail(
          `${label} pin panel: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await pinContext.close();
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
console.log("canada-clock-still: every clock card and readout held still");
