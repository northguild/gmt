#!/usr/bin/env node
/**
 * "Did your saved events move?" stability gate (CORE-88).
 *
 * The form must not move or resize when an answer arrives, and the page must not scroll sideways
 * at 375 px. jsdom has no layout, so this runs in a browser against the built site.
 *
 * It loads `/check/canada-2026-clock-change/` at 1440, 1024 and 375 px with the Worker's two answers stubbed
 * (the GET probe and a POST that returns one row of every kind and a null), records the rect of
 * the section's heading, steps, textarea, Check and Reset example buttons and the summary bar before
 * and after pressing Check from the keyboard, and again after "Only moved" is on. Every rect, in
 * document coordinates, must be unchanged (a scroll the harness causes is not a layout shift).
 * WebKit presses Option+Tab: Safari on macOS leaves buttons out of the plain Tab order. It also checks the result rows are in the page and "Only moved" hides the rest.
 *
 * The page says when it is ready (`data-state="ready"` on its root; `error` where it shows its
 * error state), and the script waits for that in real time, 60 s, instead of guessing.
 *
 * The error-answer row loads the page with the GET held, records the rect of every card, lets
 * the answer through as 200, 503 and 429 in turn, and asserts no card, above or below, moved or
 * resized, and the page height held. A 429 and a 503 must end in `data-state="error"`.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage:
 *   node scripts/canada-stored-still.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit]
 */

import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "@playwright/test";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordLabelled, recordMeasured } from "./gates/findings.mjs";
import { control, gate, resolveMisses } from "./lib/locate.mjs";

const GATE = "canada-stored-still";
import {
  ROOT_SELECTOR,
  canadaGetFixture,
  regionOf,
  routeWorker,
  waitForState,
} from "./lib/clock-check-harness.mjs";

// The runner's page contract (`scripts/gates/`): the one page this gate checks is its `--path`.
const CHECKER_PATH = "/check/canada-2026-clock-change/";
const PAGES_ARG = applyPageContract({ gate: GATE, pages: [CHECKER_PATH] });

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = arg("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const BROWSERS = arg("browsers", "chromium").split(",");
const LAUNCHERS = { chromium, firefox, webkit };
for (const name of BROWSERS) {
  if (!LAUNCHERS[name]) {
    console.error(`canada-stored-still: unknown browser "${name}"`);
    process.exit(2);
  }
}
let measured = 0;
const WIDTHS = [1440, 1024, 375];
const PATH = PAGES_ARG ? PAGES_ARG[0] : arg("path", CHECKER_PATH);
/* The page's Worker route, zone and saved-times answer come from its path; an unknown path throws. */
const REGION = regionOf(PATH);

/* Another checker's page needs its own GET answer: a Worker answer saved to a file (`--fixture`). */
const FIXTURE_FILE = arg("fixture", "");
if (REGION.name !== "canada" && FIXTURE_FILE === "") {
  console.error(
    "canada-stored-still: --path other than Canada needs --fixture <Worker answer .json>",
  );
  process.exit(2);
}
const GET_FIXTURE = FIXTURE_FILE
  ? JSON.parse(readFileSync(FIXTURE_FILE, "utf8"))
  : canadaGetFixture("2026-10-22T12:00:00Z");

const failures = [];
const fail = (message) => {
  failures.push(message);
  recordLabelled({ gate: GATE, page: PATH, message });
};

/** The stored-times section, and its controls by role and exact accessible name. */
const STORED = gate("stored");
const CONTROLS = {
  lines: { role: "textbox", name: "Saved events, one per line" },
  check: { role: "button", name: "Check" },
  example: { role: "button", name: "Reset example" },
  moved: { role: "button", name: "Only moved" },
};
const rows = (page) => page.locator(`${gate("stored-table")} tbody tr`);
/** The cards of the page: its sections, the key-point cards, the pin panel, the map block, the clocks. */
const CARD_PARTS = gate(
  "browser",
  "pickcard",
  "clocks",
  "stored",
  "keypoints-card",
  "changes",
  "transitions",
  "map-pin",
  "map-block",
  "clock",
);

async function snapshot(page) {
  // The two buttons are found by role and name, then measured in the page.
  const check = await control(page, STORED, CONTROLS.check).elementHandle();
  const example = await control(page, STORED, CONTROLS.example).elementHandle();
  return page.evaluate(
    (sel) => {
      const box = (el) => {
        const r = el.getBoundingClientRect();
        // In document coordinates: the harness scrolls (a pressed control is brought into view), and
        // that is not the form moving. A real shift of the layout still changes these.
        return [r.x + scrollX, r.y + scrollY, r.width, r.height].map(
          (n) => Math.round(n * 100) / 100,
        );
      };
      const section = document.querySelector(sel.stored);
      const pick = (selector) => box(section.querySelector(selector));
      return {
        heading: pick("h4"),
        textarea: pick("textarea"),
        steps: pick(sel.steps),
        check: box(sel.check),
        example: box(sel.example),
        head: pick(sel.head),
        toggle: pick(sel.toggle),
      };
    },
    {
      stored: STORED,
      steps: gate("stored-steps"),
      head: gate("stored-head"),
      toggle: gate("stored-toggle"),
      check,
      example,
    },
  );
}

function same(label, before, after) {
  for (const key of Object.keys(before)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      fail(`${label}: ${key} moved ${before[key]} -> ${after[key]}`);
    }
  }
}

/** Page-absolute rects of every card on the page, in order, and the page's own height. */
async function cardRects(page) {
  return page.evaluate(
    ({ rootSelector, parts }) => {
      const root = document.querySelector(rootSelector);
      const cards = [...root.querySelectorAll(parts)];
      return {
        height: document.documentElement.scrollHeight,
        cards: cards.map((card, index) => {
          const r = card.getBoundingClientRect();
          const name =
            card.querySelector("h2, h3, h4")?.textContent?.trim() ||
            card.dataset.zone ||
            card.dataset.gate;
          return {
            key: `${index} ${name}`,
            rect: [r.x + scrollX, r.y + scrollY, r.width, r.height].map(
              (n) => Math.round(n * 100) / 100,
            ),
          };
        }),
      };
    },
    { rootSelector: ROOT_SELECTOR, parts: CARD_PARTS },
  );
}

/** The GET held until a snapshot is taken, then answered with `status`: nothing may move. */
async function errorAnswerStill(browser, name, width, status) {
  const label = `${name} ${width}px, GET ${status}`;
  const failuresBefore = failures.length;
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  await blockOffSite(context, BASE);
  const page = await context.newPage();
  try {
    const held = await routeWorker(page, REGION, {
      getFixture: GET_FIXTURE,
      getStatus: status,
      hold: true,
      post: "echo",
    });
    const response = await page.goto(`${BASE}${PATH}`, {
      waitUntil: "domcontentloaded",
    });
    if (!response || response.status() !== 200) {
      fail(`${label}: the page answered HTTP ${response?.status()}, not 200`);
      return;
    }
    await page.waitForSelector(ROOT_SELECTOR);
    // The library and the module chunks load while the GET is held; wait for the page to be idle
    // first so the "before" is the finished layout, not one that is still filling in.
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);
    const before = await cardRects(page);
    held.release();
    const state = await waitForState(page, ["ready", "error"]);
    const wanted = status === 200 ? "ready" : "error";
    if (state !== wanted) {
      fail(`${label}: data-state is "${state}", not "${wanted}"`);
    }
    await page.waitForTimeout(500);
    const after = await cardRects(page);
    if (before.cards.length === 0) fail(`${label}: no cards on the page`);
    if (after.height !== before.height) {
      fail(
        `${label}: the page height changed ${before.height} -> ${after.height}`,
      );
    }
    if (after.cards.length !== before.cards.length) {
      fail(
        `${label}: ${before.cards.length} cards before, ${after.cards.length} after`,
      );
      return;
    }
    before.cards.forEach((card, i) => {
      if (JSON.stringify(card.rect) !== JSON.stringify(after.cards[i].rect)) {
        fail(
          `${label}: ${card.key} moved ${card.rect} -> ${after.cards[i].rect}`,
        );
      }
    });
    if (failures.length === failuresBefore) {
      console.log(
        `${label}: ${before.cards.length} cards and the page height held still`,
      );
    }
  } catch (error) {
    fail(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
}

/* `--resolve-only`: load the page once and check that every hook this gate measures by is on it. */
if (args.includes("--resolve-only")) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await blockOffSite(context, BASE);
  const page = await context.newPage();
  await routeWorker(page, REGION, { getFixture: GET_FIXTURE });
  const response = await page.goto(`${BASE}${PATH}`, { waitUntil: "load" });
  const miss = [];
  if (!response || response.status() !== 200)
    miss.push(`the page answered HTTP ${response?.status() ?? "none"}`);
  else {
    await waitForState(page, ["ready"]);
    miss.push(
      ...(await resolveMisses(page, [
        { name: "stored section", sel: STORED, min: 1, max: 1 },
        { name: "steps", sel: gate("stored-steps"), min: 1, max: 1 },
        { name: "head", sel: gate("stored-head"), min: 1, max: 1 },
        { name: "toggle", sel: gate("stored-toggle"), min: 1, max: 1 },
        { name: "table", sel: gate("stored-table"), min: 1, max: 1 },
        ...Object.entries(CONTROLS).map(([key, spec]) => ({
          name: `control ${key}`,
          loc: control(page, STORED, spec),
          min: 1,
          max: 1,
        })),
      ])),
    );
  }
  console.log(`${miss.length ? "FAIL" : "ok  "} resolve ${PATH}`);
  for (const m of miss) console.log(`       ${m}`);
  await browser.close();
  process.exit(miss.length ? 1 : 0);
}

for (const name of BROWSERS) {
  const launcher = LAUNCHERS[name];
  const browser = await launcher.launch();
  try {
    for (const width of WIDTHS) {
      const label = `${name} ${width}px`;
      measured += 1;
      const failuresBefore = failures.length;
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      await blockOffSite(context, BASE);
      const page = await context.newPage();
      await routeWorker(page, REGION, { getFixture: GET_FIXTURE });
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
        // The section's handlers attach when the page's script runs, after the server-sent markup
        // is already on screen; a press before that is a native form submit (a reload). The mount
        // binds them before it asks the Worker, so `data-state="ready"` means they are bound.
        await waitForState(page, ["ready"]);
        await control(page, STORED, CONTROLS.example).click();
        if ((await control(page, STORED, CONTROLS.lines).inputValue()) === "") {
          throw new Error(
            "the page is ready but the stored-times handlers are not bound (Example filled nothing)",
          );
        }
        const before = await snapshot(page);

        // Keyboard only: Tab from the textarea (past the formats disclosure) to Check, then Enter.
        await control(page, STORED, CONTROLS.lines).focus();
        for (let i = 0; i < 2; i += 1) {
          await page.keyboard.press(name === "webkit" ? "Alt+Tab" : "Tab");
        }
        await page.keyboard.press("Enter");
        await rows(page).first().waitFor();
        const count = await rows(page).count();
        if (count !== 6) fail(`${label}: expected 6 result rows, saw ${count}`);
        same(`${label} after the answer`, before, await snapshot(page));

        await control(page, STORED, CONTROLS.moved).click();
        const shown = await rows(page).filter({ visible: true }).count();
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
        if (failures.length === failuresBefore) {
          console.log(`${label}: form held still, ${count} rows`);
        }
      } catch (error) {
        fail(
          `${label}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await context.close();
      }
      for (const status of [200, 503, 429]) {
        await errorAnswerStill(browser, name, width, status);
      }
    }
  } finally {
    await browser.close();
  }
}

recordMeasured(GATE, measured);
if (failures.length > 0) {
  console.error(failures.map((f) => `FAIL ${f}`).join("\n"));
  process.exit(1);
}
console.log("canada-stored-still: the stored-times form held still");
