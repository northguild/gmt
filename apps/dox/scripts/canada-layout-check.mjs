#!/usr/bin/env node
/**
 * Canada and Morocco 2026 clock-change checker layout gate (CORE-88).
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
 *   - every probe table fits the card that holds it, with no sideways scroll, no cell of it is
 *     wider than its own box, and no word of a visible cell or head breaks across two lines, as
 *     loaded and with the browser's verdict forced to ok, bad and unreadable (at 300 and 420 px,
 *     which is just above the 21rem stack threshold in WebKit),
 *   - every head of a probe table is at most 3 lines tall; an offset head's label ("Correct",
 *     "Yours") is one line, and its note is one line wherever the table's box is 25rem or wider,
 *   - the "Yours" cells change from `+00:00` to `-03:30` and back without moving the table, a
 *     column or the card by more than half a pixel (a reading that arrives moves nothing),
 *   - no visible element of a card passes the card's left or right edge by more than 1 px
 *     (the stored-times hint of the Morocco page did),
 *   - no two place labels overlap, none crosses the frame, and a label's real box is no wider than
 *     the box the code reserved for it.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Layout varies by engine: WebKit and Firefox do not break at a `<wbr>` inside `white-space:
 * nowrap`, and Chromium does. Run it with `--browsers chromium,webkit,firefox`.
 *
 * Usage:
 *   node scripts/canada-layout-check.mjs --base http://127.0.0.1:4351/gmt [--widths 1910,1440,1280,1024,420,375,300]
 *     [--pages <a,b>]   the checker pages; both by default (/check/canada-2026-clock-change/,
 *                       /check/morocco-2026-clock-change/)
 *     [--fixture <file>]  a Worker answer (.json) served for the page's GET, so results arrive
 *     [--shots <dir>]   also writes a dark and a light screenshot of the stack per width
 *     [--engine webkit]  run in WebKit instead of Chromium (its 20px scrollbar narrows the page)
 */

import { chromium } from "@playwright/test";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordLabelled, recordMeasured } from "./gates/findings.mjs";
import {
  expectedOffsets,
  regionOf,
  waitForState,
} from "./lib/clock-check-harness.mjs";
import { gate, resolveMisses } from "./lib/locate.mjs";

const GATE = "canada-layout-check";

// The runner's page contract (`scripts/gates/`): the two checker pages.
const CHECKER_PAGES = [
  "/check/canada-2026-clock-change/",
  "/check/morocco-2026-clock-change/",
];
const PAGES_ARG = applyPageContract({ gate: GATE, pages: CHECKER_PAGES });
const PAGES = PAGES_ARG ?? CHECKER_PAGES;

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = arg("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const WIDTHS = arg("widths", "1910,1440,1280,1024,420,375,300")
  .split(",")
  .map(Number);
const LAUNCHERS = { chromium: true, firefox: true, webkit: true };
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
/* `canada` or `morocco`: the page's class and ids are named after its checker. */
const wordOf = (path) => regionOf(path).name;
let PATH;
let WORD;
let CARDS;
/* The widths the forced verdict states are measured at: a 300 px card stacks, 420 px does not. */
const STATE_WIDTHS = [300, 420];
const STATES = ["ok", "bad", "unreadable"];
/* Optional: a Worker answer saved to a file, served for the page's GET so results arrive. */
const FIXTURE_FILE = arg("fixture", "");
const FIXTURE = FIXTURE_FILE ? readFileSync(FIXTURE_FILE, "utf8") : null;

/* The row's tallest card: the map's 28rem frame plus its heading, legend and padding. */
const ROW_MAX = 640;

const cardsOf = () => ({
  keypoints: gate("keypoints"),
  browser: gate("browser"),
  map: gate("map-stage"),
  pick: gate("pickcard"),
  clocks: gate("clocks"),
  servers: gate("servers"),
  minimums: gate("minimums"),
  changes: gate("changes"),
  help: gate("help"),
  stored: gate("stored"),
});

const setPage = (path) => {
  PATH = path;
  WORD = wordOf(path);
  CARDS = cardsOf();
};
setPage(PAGES[0]);

/* The most empty space a card of the map row may leave under its content, in px. */
const EMPTY_MAX = 48;
const ASPECT_TOLERANCE = 0.02;

const failures = [];
const fail = (message) => {
  failures.push(`${PATH}: ${message}`);
  recordLabelled({ gate: GATE, page: PATH, message });
};

/* `--resolve-only`: load the page once and check that every hook this gate measures by is on it. */
if (args.includes("--resolve-only")) {
  const browser = await chromium.launch();
  let bad = false;
  for (const path of PAGES) {
    setPage(path);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    try {
      const page = await context.newPage();
      await blockOffSite(page, BASE);
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
      const response = await page.goto(`${BASE}${PATH}`, { waitUntil: "load" });
      const miss = [];
      if (!response || response.status() !== 200)
        miss.push(`the page answered HTTP ${response?.status() ?? "none"}`);
      else {
        await waitForState(page, ["ready", "error"]);
        await page.locator(gate("map-section")).scrollIntoViewIfNeeded();
        await page
          .waitForSelector(gate("map-svg"), { timeout: 15000 })
          .catch(() => {});
        miss.push(
          ...(await resolveMisses(page, [
            { name: "card stack", sel: gate("stack"), min: 1, max: 1 },
            { name: "map frame", sel: gate("map-frame"), min: 1, max: 1 },
            /* The map draws once a Worker answer arrives; with no --fixture it stays undrawn. */
            {
              name: "map drawing",
              sel: gate("map-svg"),
              min: FIXTURE === null ? 0 : 1,
              max: 1,
            },
            { name: "map pin panel", sel: gate("map-pin"), min: 1, max: 1 },
            { name: "probe table", sel: gate("probe-table"), min: 1 },
            ...Object.entries(CARDS).map(([key, sel]) => ({
              name: `card ${key}`,
              sel,
              min: 1,
              max: 1,
            })),
          ])),
        );
      }
      console.log(`${miss.length ? "FAIL" : "ok  "} resolve ${PATH}`);
      for (const m of miss) console.log(`       ${m}`);
      if (miss.length) bad = true;
    } finally {
      await context.close();
    }
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
}

/**
 * Opens a page in its own context. `state` forces the browser's verdict: an init script wraps
 * `Intl.DateTimeFormat` for the probe zones with `timeZoneName: "longOffset"` only, so `ok` answers
 * each zone's expected offset (read from the page's own config), `bad` answers `GMT+14:00` and
 * `unreadable` throws `RangeError`. Nothing else the page formats is touched.
 */
async function openPage(browser, { width, theme, state, offsets }) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
  });
  try {
    const page = await context.newPage();
    await blockOffSite(page, BASE);
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("starlight-theme", t);
      } catch {}
    }, theme);
    if (state !== null) {
      await page.addInitScript(
        ({ forced, byZone }) => {
          const Real = Intl.DateTimeFormat;
          const Wrapped = function (locale, options) {
            if (
              options?.timeZoneName === "longOffset" &&
              options.timeZone in byZone
            ) {
              if (forced === "unreadable") throw new RangeError("longOffset");
              const offset = byZone[options.timeZone];
              const name =
                forced === "bad"
                  ? "GMT+14:00"
                  : offset === "+00:00"
                    ? "GMT"
                    : `GMT${offset}`;
              return {
                formatToParts: () => [{ type: "timeZoneName", value: name }],
              };
            }
            return new Real(locale, options);
          };
          Wrapped.prototype = Real.prototype;
          Wrapped.supportedLocalesOf = Real.supportedLocalesOf.bind(Real);
          Intl.DateTimeFormat = Wrapped;
        },
        { forced: state, byZone: offsets },
      );
    }
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
    /* The page's own ready signal (it is `error` with no Worker answer), not a guess from a sleep. */
    await waitForState(page, ["ready", "error"]);
    if (state !== null)
      await page.waitForFunction(
        ({ selector, want }) =>
          document.querySelector(selector)?.dataset.state === want,
        {
          selector: `${gate("browser")} [aria-label="Verdict"]`,
          want: state,
        },
        { timeout: 60_000, polling: 50 },
      );
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * The probe table of the open page, as a reader sees it: whether it fits its card, which visible
 * cells hold more than their box, which words of a visible cell or head break across two lines
 * (a `<wbr>` after a "/" is a break between words), and which visible elements pass the edge of a
 * card by more than 1 px.
 */
async function measureProbe(page, cards) {
  /* Fonts loaded and two frames: the head's lines are those of the final face. */
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  return page.evaluate(
    ({ table, cardSelectors }) => {
      /* A cell the stacked layout hides visually (clip-path) takes no part. */
      const hidden = (el) => getComputedStyle(el).clipPath !== "none";
      const tables = [...document.querySelectorAll(table)]
        .filter((t) => t.offsetParent !== null)
        .map((t) => {
          const card = t.closest("section") ?? t.parentElement;
          const c = card.getBoundingClientRect();
          const cs = getComputedStyle(card);
          const b = t.getBoundingClientRect();
          const inset = (border, pad) =>
            parseFloat(cs[border]) + parseFloat(cs[pad]);
          const cells = [...t.querySelectorAll("th, td")].filter(
            (cell) => !hidden(cell),
          );
          const words = [];
          for (const cell of cells) {
            const walker = document.createTreeWalker(
              cell,
              NodeFilter.SHOW_TEXT,
            );
            for (let n; (n = walker.nextNode());) {
              for (const m of n.textContent.matchAll(/[^\s/]+/g)) {
                const range = document.createRange();
                range.setStart(n, m.index);
                range.setEnd(n, m.index + m[0].length);
                const tops = new Set(
                  [...range.getClientRects()]
                    .filter((r) => r.width > 0)
                    .map((r) => Math.round(r.top)),
                );
                if (tops.size > 1) words.push(m[0]);
              }
            }
          }
          const lineCount = (el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return new Set(
              [...range.getClientRects()]
                .filter((r) => r.width > 0)
                .map((r) => Math.round(r.top)),
            ).size;
          };
          /* The offset heads by their markup, shown or not: a selector that finds no label and
             note would otherwise measure every head as one line and pass. */
          const offsetHeads = [...t.querySelectorAll("thead th")].filter(
            (th) =>
              th.querySelector("[class*=label]") &&
              th.querySelector("[class*=note]"),
          ).length;
          const heads = [...t.querySelectorAll("thead th")]
            .filter((th) => !hidden(th))
            .map((th) => {
              const label = th.querySelector("[class*=label]");
              const note = th.querySelector("[class*=note]");
              return {
                text: th.textContent.trim(),
                /* Lines as drawn: the label and the note have their own line heights, and the hidden
                   comma between them takes no line. */
                lines:
                  label && note
                    ? lineCount(label) + lineCount(note)
                    : lineCount(th),
                labelLines: label && note ? lineCount(label) : null,
                noteLines: label && note ? lineCount(note) : null,
              };
            });
          return {
            heads,
            offsetHeads,
            remPx: parseFloat(
              getComputedStyle(document.documentElement).fontSize,
            ),
            probeWidth: t.parentElement.getBoundingClientRect().width,
            card: card.dataset.gate ?? card.localName,
            left: b.left - (c.left + inset("borderLeftWidth", "paddingLeft")),
            right:
              c.right - inset("borderRightWidth", "paddingRight") - b.right,
            scroll: t.scrollWidth - t.clientWidth,
            wide: cells.filter(
              (cell) => cell.scrollWidth - cell.clientWidth > 1,
            ).length,
            words,
          };
        });
      const spill = [];
      for (const selector of cardSelectors) {
        const card = document.querySelector(selector);
        if (!card || card.offsetParent === null) continue;
        const edge = card.getBoundingClientRect();
        for (const el of card.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (cs.position === "absolute" || cs.position === "fixed") continue;
          if (cs.clipPath !== "none") continue;
          const b = el.getBoundingClientRect();
          if (b.width <= 0 || b.height <= 0) continue;
          /* Inside a scroll container the content scrolls; the container itself is measured. */
          let inScroller = false;
          for (let p = el.parentElement; p && p !== card; p = p.parentElement) {
            const o = getComputedStyle(p);
            if (o.overflowX !== "visible" || o.position === "absolute")
              inScroller = true;
          }
          if (inScroller) continue;
          const over = Math.max(edge.left - b.left, b.right - edge.right);
          if (over > 1)
            spill.push(
              `${selector} > ${el.localName}${el.id ? `#${el.id}` : ""} by ${over.toFixed(1)} px`,
            );
        }
      }
      return { tables, spill };
    },
    { table: gate("probe-table"), cardSelectors: Object.values(cards) },
  );
}

/* The note wraps only in a probe narrower than this (the `gmt-probe` container step). */
const NOTE_WRAPS_UNDER_REM = 25;

/* The "Correct" and "Yours" heads: each a label with a note under it. */
const OFFSET_HEADS = 2;

function probeProblems(tag, probe) {
  if (probe.tables.length === 0) fail(`${tag}: no probe table to measure`);
  for (const t of probe.tables) {
    if (t.offsetHeads !== OFFSET_HEADS)
      fail(
        `${tag}: the probe table has ${t.offsetHeads} heads with a label and a note (${OFFSET_HEADS} expected)`,
      );
    for (const head of t.heads) {
      if (head.lines > 3)
        fail(
          `${tag}: the "${head.text}" head is ${head.lines} lines tall (at most 3)`,
        );
      if (head.labelLines !== null && head.labelLines > 1)
        fail(`${tag}: the label of the "${head.text}" head wraps`);
      if (
        head.noteLines !== null &&
        head.noteLines > 1 &&
        t.probeWidth >= NOTE_WRAPS_UNDER_REM * t.remPx
      )
        fail(
          `${tag}: the note of the "${head.text}" head wraps in a ${t.probeWidth.toFixed(0)} px table`,
        );
    }
    if (t.wide > 0)
      fail(`${tag}: ${t.wide} probe table cell(s) hold more than their box`);
    if (t.words.length > 0)
      fail(
        `${tag}: a probe table word breaks across two lines: ${[...new Set(t.words)].join(", ")}`,
      );
    if (t.left < -1 || t.right < -1 || t.scroll > 1)
      fail(
        `${tag}: a probe table does not fit its card (${t.left.toFixed(1)} px in on the left, ${t.right.toFixed(1)} px on the right, ${t.scroll} px of scroll)`,
      );
  }
  for (const line of probe.spill) fail(`${tag}: ${line} past its card`);
}

/**
 * The "Yours" cells go from `+00:00` to `-03:30` and back; the card, the table, its columns and
 * every head must keep their widths and heights, as they do when the clock ticks.
 */
async function readoutHoldsStill(page) {
  return page.evaluate((table) => {
    const wrap = document.querySelector(table);
    if (!wrap) return ["no probe table to check"];
    const card = wrap.closest("section");
    const cells = [...wrap.querySelectorAll("tbody td:last-child span[id]")];
    /* No readout cells would change nothing, and pass. */
    if (cells.length === 0) return ["no readout cells to check"];
    const sizes = () =>
      [card, wrap, wrap.querySelector("table"), ...wrap.querySelectorAll("th")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => {
          const b = el.getBoundingClientRect();
          return [b.width, b.height];
        });
    const saved = cells.map((cell) => cell.innerHTML);
    for (const cell of cells) cell.textContent = "+00:00";
    const before = sizes();
    const moved = [];
    for (const reading of ["-03:30", "+01:00", "+00:00"]) {
      for (const cell of cells) cell.textContent = reading;
      sizes().forEach(([w, h], i) => {
        if (
          Math.abs(w - before[i][0]) > 0.5 ||
          Math.abs(h - before[i][1]) > 0.5
        )
          moved.push(
            `box ${i} ${before[i].map(Math.round)} to ${[w, h].map(Math.round)} at ${reading}`,
          );
      });
    }
    cells.forEach((cell, i) => {
      cell.innerHTML = saved[i];
    });
    return moved;
  }, gate("probe-table"));
}

for (const engineName of ENGINES) {
  const browser = await launchBrowser(engineName);
  try {
    for (const path of PAGES) {
      setPage(path);
      const offsets = await expectedOffsets(regionOf(path));
      for (const theme of ["dark", "light"]) {
        for (const width of WIDTHS) {
          const { context, page } = await openPage(browser, {
            width,
            theme,
            state: null,
            offsets,
          });
          try {
            /* The map draws when it scrolls into view; the check needs its frame, labels and card heights. */
            await page.locator(gate("map-section")).scrollIntoViewIfNeeded();
            await page
              .waitForSelector(gate("map-svg"), { timeout: 15000 })
              .catch(() => {});
            await page.waitForTimeout(500);
            const data = await page.evaluate(
              ({ cards, part }) => {
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
                const stack = rect(part.stack);
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
                        bottom = Math.min(
                          bottom,
                          p.getBoundingClientRect().bottom,
                        );
                    }
                    return bottom;
                  };
                  const consider = (el) => {
                    const cs = getComputedStyle(el);
                    if (cs.display === "none" || cs.visibility === "hidden")
                      return;
                    const b = el.getBoundingClientRect();
                    if (b.width <= 0 || b.height <= 0) return;
                    lowest = Math.max(
                      lowest,
                      Math.min(b.bottom, clipBottom(el)),
                    );
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
                    if (cs.display === "none" || cs.visibility === "hidden")
                      continue;
                    if (rects.length === 0) continue;
                    const bottom = Math.max(...rects.map((r) => r.bottom));
                    lowest = Math.max(lowest, Math.min(bottom, clipBottom(el)));
                  }
                  /* The drawing, and the pin panel: a bordered box that holds its size for every zone, so
             what it reserves inside is not empty card space. */
                  for (const el of card.querySelectorAll(
                    `${part.svg}, ${part.pin}`,
                  ))
                    consider(el);
                  return lowest;
                };
                const emptyUnder = (selector) => {
                  const el = document.querySelector(selector);
                  if (!el || el.offsetParent === null) return null;
                  const pad =
                    parseFloat(getComputedStyle(el).paddingBottom) || 0;
                  return (
                    el.getBoundingClientRect().bottom - pad - contentBottom(el)
                  );
                };
                const mapFrame = document.querySelector(part.frame);
                const svg = mapFrame?.querySelector(part.svg);
                const frame =
                  mapFrame && mapFrame.offsetParent !== null
                    ? mapFrame.getBoundingClientRect()
                    : null;
                const view = svg
                  ?.getAttribute("viewBox")
                  ?.split(" ")
                  .map(Number);
                const labels = [...document.querySelectorAll(part.label)]
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
                return {
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
              {
                cards: CARDS,
                part: {
                  stack: gate("stack"),
                  svg: gate("map-svg"),
                  pin: gate("map-pin"),
                  frame: gate("map-frame"),
                  label: gate("map-label"),
                },
              },
            );
            const tag = `${engineName} ${width}px ${theme}`;
            measured += 1;
            if (data.hscroll) fail(`${tag}: the page scrolls sideways`);
            const present = Object.entries(data.rects).filter(([, r]) => r);
            /* A renamed class or a page that did not render leaves nothing to measure: a fail, not a pass. */
            if (!data.stack)
              fail(
                `${tag}: the card stack (the stack gate hook) is not on the page`,
              );
            if (present.length === 0) fail(`${tag}: no card found on the page`);
            for (const [name, r] of present) {
              if (!data.stack) break;
              if (
                r.left < data.stack.left - 1 ||
                r.right > data.stack.right + 1
              ) {
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
            probeProblems(tag, await measureProbe(page, CARDS));
            for (const move of await readoutHoldsStill(page))
              fail(`${tag}: a reading moved the probe card (${move})`);
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
                if (
                  !(map.right <= pick.left + 1 && pick.right <= clocks.left + 1)
                )
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
                if (
                  !(map.bottom <= pick.top + 1 && pick.bottom <= clocks.top + 1)
                )
                  fail(
                    `${tag}: the cards are not stacked map, zone card, clocks`,
                  );
              }
            }
            if (SHOTS) {
              mkdirSync(SHOTS, { recursive: true });
              const name = `${WORD}-${engineName}-${theme}-${width}`;
              await page
                .locator(gate("stack"))
                .screenshot({ path: `${SHOTS}/${name}.png` });
              await page
                .locator(gate("browser"))
                .screenshot({ path: `${SHOTS}/${name}-browser.png` });
            }
            console.log(`${tag}: ${present.length} cards checked`);
          } finally {
            await context.close();
          }
        }
        /* The probe table in each verdict the browser can give: a 300 px card stacks, 420 px does not. */
        for (const width of STATE_WIDTHS) {
          for (const state of STATES) {
            const { context, page } = await openPage(browser, {
              width,
              theme,
              state,
              offsets,
            });
            try {
              const tag = `${engineName} ${width}px ${theme} verdict ${state}`;
              measured += 1;
              probeProblems(tag, await measureProbe(page, CARDS));
              console.log(`${tag}: probe table checked`);
            } finally {
              await context.close();
            }
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}

recordMeasured(GATE, measured);
if (failures.length > 0) {
  console.error(failures.map((line) => `FAIL ${line}`).join("\n"));
  process.exit(1);
}
console.log("canada layout: ok");
