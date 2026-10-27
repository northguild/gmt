#!/usr/bin/env node
/**
 * Canada 2026 clock-change checker layout gate (CORE-88).
 *
 * jsdom has no layout, so this runs in a browser against the built site. At each width it reads
 * the rect of every card and checks that
 *   - no two cards overlap,
 *   - the three cards of row 2 (map, zone card, clocks) sit in one row, left to right, sharing a
 *     top and a bottom within 1 px and no taller than ROW_MAX, or stacked in that order,
 *   - no card reaches past the stack's edge, and the page does not scroll sideways,
 *   - the map's frame has the drawing's own aspect (800 by the viewBox's height) within 2%, at
 *     every width it is drawn (the box is reserved before the drawing arrives, and the sea
 *     never letterboxes),
 *   - no card of the map row (map, zone card, clocks) has more than 48 px between its last text
 *     or drawing and its bottom edge, and
 *   - every probe table fits the card that holds it, with no sideways scroll, and no cell of it
 *     is wider than its own box (a word never breaks out of a stacked row; run it at 300 too),
 *   - no two place labels overlap, none crosses the frame, and a label's real box is no wider than
 *     the box the code reserved for it.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage:
 *   node scripts/canada-layout-check.mjs --base http://127.0.0.1:4351/gmt [--widths 1440,1024]
 *     [--path <page>]   the checker page; Canada by default, or /check/morocco-2026-clock-change/
 *     [--fixture <file>]  a Worker answer (.json) served for the page's GET, so results arrive
 *     [--shots <dir>]   also writes a dark and a light screenshot of the stack per width
 *     [--engine webkit]  run in WebKit instead of Chromium (its 20px scrollbar narrows the page)
 */

import { chromium, firefox, webkit } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordLabelled, recordMeasured } from "./gates/findings.mjs";

const GATE = "canada-layout-check";

// The runner's page contract (`scripts/gates/`): the one page this gate checks is its `--path`.
const CHECKER_PATH = "/check/canada-2026-clock-change/";
const PAGES_ARG = applyPageContract({ gate: GATE, pages: [CHECKER_PATH] });

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = arg("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const WIDTHS = arg("widths", "1440,1024,300").split(",").map(Number);
const LAUNCHERS = { chromium, firefox, webkit };
/* `--browsers a,b` runs every engine; `--engine x` is the older single form and still works. */
const ENGINES = (arg("browsers", "") || arg("engine", "chromium")).split(",");
for (const name of ENGINES) {
  if (!LAUNCHERS[name]) {
    console.error(`canada-layout-check: unknown browser "${name}"`);
    process.exit(2);
  }
}
let measured = 0;
const SHOTS = arg("shots", "");
const PATH = PAGES_ARG ? PAGES_ARG[0] : arg("path", CHECKER_PATH);
/* `canada` or `morocco`: the page's class and ids are named after its checker. */
const WORD = PATH.includes("morocco") ? "morocco" : "canada";
/* Optional: a Worker answer saved to a file, served for the page's GET so results arrive. */
const FIXTURE_FILE = arg("fixture", "");
const FIXTURE = FIXTURE_FILE ? readFileSync(FIXTURE_FILE, "utf8") : null;

/* The row's tallest card: the map's 28rem frame plus its heading, legend and padding. */
const ROW_MAX = 640;

const CARDS = {
  keypoints: ".gmt-keypoints",
  browser: ".gmt-clockcheck-browser",
  map: ".gmt-zonemap-stage",
  pick: `.gmt-clockcheck-pickcard`,
  clocks: `.gmt-clockcheck-nowsec`,
  servers: ".gmt-clockcheck-servers",
  minimums: ".gmt-clockcheck-minimums",
  changes: `section[aria-labelledby=${WORD}-changes-title]`,
  help: ".gmt-clockcheck-help",
  stored: ".gmt-clockcheck-stored",
};

/* The most empty space a card of the map row may leave under its content, in px. */
const EMPTY_MAX = 48;
const ASPECT_TOLERANCE = 0.02;

const failures = [];
const fail = (message) => {
  failures.push(message);
  recordLabelled({ gate: GATE, page: PATH, message });
};

for (const engineName of ENGINES) {
  const browser = await LAUNCHERS[engineName].launch();
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
      /* The map draws when it scrolls into view; the check needs its frame, labels and card heights. */
      await page.locator(".gmt-zonemap-mapsec").scrollIntoViewIfNeeded();
      await page
        .waitForSelector(".gmt-zonemap-svg", { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(500);
      const data = await page.evaluate(
        ({ cards }) => {
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
          const stack = rect(".gmt-clockcheck-stack");
          /* Where a card's content ends: the lowest text or drawing that its overflow boxes do not clip. */
          const contentBottom = (card) => {
            let lowest = -Infinity;
            const clipBottom = (el) => {
              let bottom = Infinity;
              for (
                let p = el.parentElement;
                p && p !== card;
                p = p.parentElement
              ) {
                const cs = getComputedStyle(p);
                if (cs.overflowY !== "visible")
                  bottom = Math.min(bottom, p.getBoundingClientRect().bottom);
              }
              return bottom;
            };
            const consider = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === "none" || cs.visibility === "hidden") return;
              const b = el.getBoundingClientRect();
              if (b.width <= 0 || b.height <= 0) return;
              lowest = Math.max(lowest, Math.min(b.bottom, clipBottom(el)));
            };
            const walker = document.createTreeWalker(
              card,
              NodeFilter.SHOW_TEXT,
            );
            for (let n; (n = walker.nextNode());) {
              if (!n.textContent.trim() || !n.parentElement) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              const rects = [...range.getClientRects()].filter(
                (r) => r.height > 0,
              );
              const el = n.parentElement;
              const cs = getComputedStyle(el);
              if (cs.display === "none" || cs.visibility === "hidden") continue;
              if (rects.length === 0) continue;
              const bottom = Math.max(...rects.map((r) => r.bottom));
              lowest = Math.max(lowest, Math.min(bottom, clipBottom(el)));
            }
            /* The drawing, and the pin panel: a bordered box that holds its size for every zone, so
             what it reserves inside is not empty card space. */
            for (const el of card.querySelectorAll(
              "svg.gmt-zonemap-svg, .gmt-zonemap-pin",
            ))
              consider(el);
            return lowest;
          };
          const emptyUnder = (selector) => {
            const el = document.querySelector(selector);
            if (!el || el.offsetParent === null) return null;
            const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
            return el.getBoundingClientRect().bottom - pad - contentBottom(el);
          };
          const mapFrame = document.querySelector(".gmt-zonemap-map");
          const svg = mapFrame?.querySelector("svg.gmt-zonemap-svg");
          const frame =
            mapFrame && mapFrame.offsetParent !== null
              ? mapFrame.getBoundingClientRect()
              : null;
          const view = svg?.getAttribute("viewBox")?.split(" ").map(Number);
          const labels = [...document.querySelectorAll(".gmt-zonemap-label")]
            .filter((l) => !l.hidden && l.offsetParent !== null)
            .map((l) => {
              const b = l.getBoundingClientRect();
              const lines = [...l.children].map((c) => {
                const r = document.createRange();
                r.selectNodeContents(c);
                return r.getBoundingClientRect().width;
              });
              return {
                id: l.dataset.labelFor,
                left: b.left,
                right: b.right,
                top: b.top,
                bottom: b.bottom,
                text: Math.max(0, ...lines),
                reserved: parseFloat(l.style.getPropertyValue("--lw")),
              };
            });
          /* Each probe table against the card that holds it: it must fit, with nothing clipped. */
          const tables = [...document.querySelectorAll(".gmt-clockcheck-table")]
            .filter((t) => t.offsetParent !== null)
            .map((t) => {
              const card = t.closest(".gmt-widget-section") ?? t.parentElement;
              const c = card.getBoundingClientRect();
              const cs = getComputedStyle(card);
              const b = t.getBoundingClientRect();
              /* The card's content box: inside its border and padding. */
              const inset = (border, pad) =>
                parseFloat(cs[border]) + parseFloat(cs[pad]);
              return {
                card: card.className,
                left:
                  b.left - (c.left + inset("borderLeftWidth", "paddingLeft")),
                right:
                  c.right - inset("borderRightWidth", "paddingRight") - b.right,
                scroll: t.scrollWidth - t.clientWidth,
                /* A cell whose content is wider than its box: a word that did not wrap. */
                wide: [...t.querySelectorAll("th, td")].filter(
                  (cell) => cell.scrollWidth - cell.clientWidth > 1,
                ).length,
              };
            });
          return {
            tables,
            stack,
            aspect:
              frame && view
                ? {
                    width: frame.width,
                    height: frame.height,
                    viewHeight: view[3],
                  }
                : null,
            frame: frame
              ? {
                  left: frame.left,
                  right: frame.right,
                  top: frame.top,
                  bottom: frame.bottom,
                }
              : null,
            labels,
            empty: Object.fromEntries(
              Object.entries(cards).map(([k, s]) => [k, emptyUnder(s)]),
            ),
            hscroll: document.documentElement.scrollWidth > innerWidth,
            rects: Object.fromEntries(
              Object.entries(cards).map(([k, s]) => [k, rect(s)]),
            ),
          };
        },
        { cards: CARDS },
      );
      const tag = `${engineName} ${width}px ${theme}`;
      measured += 1;
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
      for (const t of data.tables) {
        if (t.wide > 0)
          fail(
            `${tag}: ${t.wide} probe table cell(s) hold more than their box`,
          );
        if (t.left < -1 || t.right < -1 || t.scroll > 1)
          fail(
            `${tag}: a probe table does not fit its card (${t.left.toFixed(1)} px in on the left, ${t.right.toFixed(1)} px on the right, ${t.scroll} px of scroll)`,
          );
      }
      if (data.aspect) {
        const want = 800 / data.aspect.viewHeight;
        const got = data.aspect.width / data.aspect.height;
        if (Math.abs(got / want - 1) > ASPECT_TOLERANCE)
          fail(
            `${tag}: the map frame is ${data.aspect.width.toFixed(1)} by ${data.aspect.height.toFixed(1)} (${got.toFixed(3)}), the drawing 800 by ${data.aspect.viewHeight} (${want.toFixed(3)})`,
          );
      }
      for (const name of ["map", "pick", "clocks"]) {
        const empty = data.empty[name];
        if (empty !== null && empty > EMPTY_MAX)
          fail(
            `${tag}: the ${name} card leaves ${empty.toFixed(0)} px empty under its content (at most ${EMPTY_MAX})`,
          );
      }
      for (let i = 0; i < data.labels.length; i += 1) {
        const a = data.labels[i];
        if (
          data.frame &&
          (a.left < data.frame.left - 1 ||
            a.right > data.frame.right + 1 ||
            a.top < data.frame.top - 1 ||
            a.bottom > data.frame.bottom + 1)
        )
          fail(`${tag}: the ${a.id} label crosses the frame`);
        if (a.text > a.reserved + 0.5)
          fail(
            `${tag}: the ${a.id} label's text is ${a.text.toFixed(1)} px wide, more than the ${a.reserved} px reserved`,
          );
        for (let j = i + 1; j < data.labels.length; j += 1) {
          const b = data.labels[j];
          if (
            a.left < b.right &&
            b.left < a.right &&
            a.top < b.bottom &&
            b.top < a.bottom
          )
            fail(`${tag}: the ${a.id} label overlaps the ${b.id} label`);
        }
      }
      const { map, pick, clocks } = data.rects;
      if (map && pick && clocks) {
        const row = Math.abs(map.top - pick.top) <= 1;
        if (row) {
          /* One row: map, zone card, clocks, left to right, one top, one bottom, no taller than 28rem
           plus the card's heading and legend. */
          if (!(map.right <= pick.left + 1 && pick.right <= clocks.left + 1))
            fail(
              `${tag}: the map, the zone card and the clocks are not in one row, left to right`,
            );
          if (
            Math.abs(pick.top - clocks.top) > 1 ||
            Math.abs(pick.bottom - clocks.bottom) > 1 ||
            Math.abs(map.bottom - pick.bottom) > 1
          )
            fail(
              `${tag}: the three cards of the row do not share a top and a bottom`,
            );
          if (pick.width < 240 - 1 || clocks.width < 240 - 1)
            fail(`${tag}: a card of the row is under 15rem wide`);
          if (map.height > ROW_MAX)
            fail(
              `${tag}: the row is ${map.height.toFixed(0)} px tall, more than ${ROW_MAX}`,
            );
        } else {
          /* Stacked: map, then the zone card, then the clocks, each full width. */
          if (!(map.bottom <= pick.top + 1 && pick.bottom <= clocks.top + 1))
            fail(`${tag}: the cards are not stacked map, zone card, clocks`);
        }
      }
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        await page
          .locator(`.gmt-clockcheck-stack`)
          .screenshot({ path: `${SHOTS}/${theme}-${width}.png` });
      }
      console.log(`${tag}: ${present.length} cards checked`);
      await context.close();
    }
  }
  await browser.close();
}

recordMeasured(GATE, measured);
if (failures.length > 0) {
  console.error(failures.map((line) => `FAIL ${line}`).join("\n"));
  process.exit(1);
}
console.log("canada layout: ok");
