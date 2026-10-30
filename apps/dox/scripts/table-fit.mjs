#!/usr/bin/env node
/**
 * Table-fit gate: no table on a built page scrolls sideways at the desktop width.
 *
 * A table that scrolls hides its last columns behind a drag. The check opens every built page that
 * holds a `<table` (`lib/table-pages.mjs`, read from `dist`, never a fixed list), opens every
 * `<details>` and tab panel, and for each table in `main` finds its scroll box: the table itself or
 * the nearest ancestor whose `overflow-x` is `auto`, `scroll` or `hidden`. It fails when the box's
 * `scrollWidth` is more than 1 px past its `clientWidth`. A table with no scroll box is measured
 * two ways, and fails when either is more than 1 px over. With automatic layout it grows to fit its
 * content, so its own scroll width never passes its client width: it is measured against the
 * content box of the nearest block that holds it and against `main`'s content box (a flex or grid
 * item that holds it can grow with it). With `table-layout: fixed` its box stays in the column and
 * the content spills out of its cells: its own `scrollWidth` is measured against its `clientWidth`.
 * A table that is not drawn (`display: none` at this width) is not measured.
 * A failure names the widest piece that cannot break (an element that holds its words together
 * with `white-space: nowrap` or `pre`, or a code element that does not wrap at its spaces), which is
 * what to give a break point or move to the entries layout.
 *
 * Usage (from apps/dox, after a build):
 *   node scripts/table-fit.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium,webkit]
 *     [--width 1440] [--pages /a/,/b/] [--list-pages]
 *
 * Without `--base` it serves `dist` itself on a free port. The runner's contract: `--list-pages`
 * prints the table pages and exits; with `GATE_REPORT` set every scrolling table is a finding.
 * Last line `table-fit: <pages> pages, <tables> tables, <n> scroll`. Exit 0 pass, 1 any finding
 * or no table measured at all, 2 usage or a missing build.
 */
import { chromium, firefox, webkit } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { serveStatic } from "./lib/static-server.mjs";
import { listTablePages } from "./lib/table-pages.mjs";

const GATE = "table-fit";
const HEIGHT = 900;
const AT_A_TIME = 8;
const LAUNCHERS = { chromium, firefox, webkit };
const DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
);

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
};
const FLAGS = new Set([
  "--base",
  "--browsers",
  "--width",
  "--pages",
  "--list-pages",
]);
const unknownFlag = args.find((a) => a.startsWith("--") && !FLAGS.has(a));
if (unknownFlag) {
  console.error(
    `${GATE}: unknown option ${unknownFlag} (${[...FLAGS].join(", ")})`,
  );
  process.exit(2);
}

if (!existsSync(path.join(DIST, "gmt", "index.html"))) {
  console.error(
    `${GATE}: apps/dox/dist/gmt/index.html is missing; build the site first.`,
  );
  process.exit(2);
}

const all = listTablePages(DIST);
const selected = applyPageContract({ gate: GATE, pages: all, argv: args });
const pages = selected ?? all;
const browsers = opt("browsers", "chromium").split(",").filter(Boolean);
for (const name of browsers) {
  if (!LAUNCHERS[name]) {
    console.error(
      `${GATE}: unknown browser "${name}" (chromium, webkit, firefox)`,
    );
    process.exit(2);
  }
}
const width = Number(opt("width", "1440"));
if (!Number.isInteger(width) || width < 200) {
  console.error(`${GATE}: --width takes a pixel width`);
  process.exit(2);
}

let server = null;
let base = opt("base", "");
if (base === "") {
  server = await serveStatic(DIST, 0);
  base = `http://127.0.0.1:${server.address().port}/gmt`;
}
base = base.replace(/\/$/, "");

/** Runs in the page: every table in `main`, with whether it scrolls and its widest fixed piece. */
function measureTables() {
  for (const d of document.querySelectorAll("details")) d.open = true;
  for (const p of document.querySelectorAll("[role=tabpanel][hidden]")) {
    p.removeAttribute("hidden");
  }
  const scrollBox = (table) => {
    for (let el = table; el && el !== document.body; el = el.parentElement) {
      const x = getComputedStyle(el).overflowX;
      if (x === "auto" || x === "scroll" || x === "hidden") return el;
    }
    return null;
  };
  /** The nearest ancestor that lays out as a block, not inline or `display: contents`. */
  const holder = (table) => {
    let el = table.parentElement;
    while (el && /^(inline|contents)$/.test(getComputedStyle(el).display)) {
      el = el.parentElement;
    }
    return el ?? document.body;
  };
  /** The left and right edges of an element's content box. */
  const contentEdges = (el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      left: r.left + el.clientLeft + parseFloat(style.paddingLeft),
      right:
        r.left +
        el.clientLeft +
        el.clientWidth -
        parseFloat(style.paddingRight),
    };
  };
  const main = document.querySelector("main");
  /** How far the table reaches past the room it has, and that room's width. */
  const measure = (table) => {
    const box = scrollBox(table);
    if (box) {
      return {
        overflow: box.scrollWidth - box.clientWidth,
        boxWidth: box.clientWidth,
      };
    }
    const t = table.getBoundingClientRect();
    if (t.width === 0 && t.height === 0) return { overflow: 0, boxWidth: 0 };
    const past = (edges) =>
      Math.max(t.right - edges.right, edges.left - t.left);
    const inHolder = contentEdges(holder(table));
    const inMain = contentEdges(main);
    const spill = table.scrollWidth - table.clientWidth;
    const room = past(inHolder) >= past(inMain) ? inHolder : inMain;
    const grows = Math.max(past(inHolder), past(inMain));
    return grows >= spill
      ? {
          overflow: Math.round(grows),
          boxWidth: Math.round(room.right - room.left),
        }
      : { overflow: spill, boxWidth: table.clientWidth };
  };
  return [...document.querySelectorAll("main table")].map((table) => {
    const { overflow, boxWidth } = measure(table);
    let widest = null;
    if (overflow > 1) {
      // A piece that cannot break is read from its computed style, not from a class: an element
      // that holds its words together (`nowrap`, `pre`), or a code element that does not wrap
      // at its spaces (`pre-wrap`, which the break-pointed code uses).
      for (const piece of table.querySelectorAll("code, code *, span, a")) {
        const ws = getComputedStyle(piece).whiteSpace;
        const holds =
          ws === "nowrap" ||
          ws === "pre" ||
          (piece.matches("code") && ws !== "pre-wrap");
        if (!holds) continue;
        const w = piece.getBoundingClientRect().width;
        if (!widest || w > widest.width) {
          widest = {
            width: Math.round(w),
            text: piece.textContent.trim().slice(0, 60),
          };
        }
      }
    }
    return {
      scrolls: overflow > 1,
      overflow,
      boxWidth,
      headers: [...table.querySelectorAll("th")]
        .slice(0, 3)
        .map((th) => th.textContent.trim()),
      widest,
    };
  });
}

let tables = 0;
let scrolling = 0;
let measuredPages = 0;

for (const browserName of browsers) {
  const browser = await LAUNCHERS[browserName].launch();
  let next = 0;
  const work = async () => {
    while (next < pages.length) {
      const pagePath = pages[next++];
      const context = await browser.newContext({
        viewport: { width, height: HEIGHT },
      });
      try {
        await blockOffSite(context, base);
        const page = await context.newPage();
        const res = await page.goto(base + pagePath, { waitUntil: "load" });
        if (!res || res.status() !== 200) {
          throw new Error(
            `the page answered HTTP ${res ? res.status() : "none"}, not 200`,
          );
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
        });
        const found = await page.evaluate(measureTables);
        measuredPages += 1;
        tables += found.length;
        for (const t of found.filter((f) => f.scrolls)) {
          scrolling += 1;
          const piece = t.widest
            ? `; widest unbreakable piece ${t.widest.width}px "${t.widest.text}"`
            : "";
          const message = `table "${t.headers.join(" | ")}" scrolls sideways: ${t.overflow}px past a ${t.boxWidth}px box${piece}`;
          console.log(
            `FAIL ${browserName} ${width}px ${pagePath}\n       ${message}`,
          );
          recordFinding({
            gate: GATE,
            rule: "table-scrolls",
            page: pagePath,
            target: `table "${t.headers.join(" | ")}"`,
            browser: browserName,
            width,
            message,
          });
        }
      } catch (error) {
        scrolling += 1;
        const message = `the check crashed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
        console.log(
          `FAIL ${browserName} ${width}px ${pagePath}\n       ${message}`,
        );
        recordFinding({
          gate: GATE,
          rule: "check-crashed",
          page: pagePath,
          target: "page",
          browser: browserName,
          width,
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
recordMeasured(GATE, measuredPages);
console.log(
  `${GATE}: ${pages.length} pages, ${tables} tables, ${scrolling} scroll`,
);
if (tables === 0) {
  console.log(`FAIL no table measured: \`main table\` matched nothing`);
}
process.exit(scrolling > 0 || measuredPages === 0 || tables === 0 ? 1 : 0);
