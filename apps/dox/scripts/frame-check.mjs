#!/usr/bin/env node
/**
 * Frame-check gate: three shapes a reader sees, measured on the built site.
 *
 * - Install tabs (`/install/`): under each tab the code frame hangs from the tab row, so the
 *   visible `pre` has a square start-start corner and keeps a radius on its start-end corner. The
 *   gate clicks every tab and reads each panel's computed corners.
 * - Filing cards (`/upstream/`): each card head reads like a GitHub row. The state icon sits on
 *   the title's first line, even when the title wraps, and so do the number and the badge when
 *   they share that line: each within 2 px of the middle of that line.
 * - List markers (`/why-gmt/`, `/migrate/luxon/`): a list written in Markdown has a dash, and the
 *   checklist a tick, each within 2 px of the middle of its item's first line. A list a component
 *   builds (the diff cards, the figures) has none of the prose dash.
 *
 * A page with no tab panel to read, no card head or no marker to measure fails, so no check can
 * pass on a page that lost what it checks. It runs at 1440 and 390 px.
 *
 * Usage (from apps/dox, after a build):
 *   node scripts/frame-check.mjs [--base http://127.0.0.1:48291/gmt] [--browsers chromium,webkit]
 *     [--pages /install/] [--list-pages]
 *
 * Without `--base` it serves `dist` itself on a free port. Exit 0 pass, 1 any finding, 2 usage or a
 * missing build.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { serveStatic } from "./lib/static-server.mjs";

const GATE = "frame-check";
const CHECKS = {
  "/install/": "tabs",
  "/upstream/": "heads",
  "/why-gmt/": "markers",
  "/migrate/luxon/": "markers",
};
const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const ENGINES = ["chromium", "firefox", "webkit"];
const DIST = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
);

const args = process.argv.slice(2);
const pages =
  applyPageContract({ gate: GATE, pages: Object.keys(CHECKS), argv: args }) ??
  Object.keys(CHECKS);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
};
const FLAGS = new Set(["--base", "--browsers", "--pages"]);
const unknownFlag = args.find((a) => a.startsWith("--") && !FLAGS.has(a));
if (unknownFlag) {
  console.error(
    `${GATE}: unknown option ${unknownFlag} (${[...FLAGS].join(", ")})`,
  );
  process.exit(2);
}
const browsers = opt("browsers", "chromium").split(",").filter(Boolean);
for (const name of browsers) {
  if (!ENGINES.includes(name)) {
    console.error(`${GATE}: unknown browser "${name}" (${ENGINES.join(", ")})`);
    process.exit(2);
  }
}

let server = null;
let base = opt("base", "");
if (base === "") {
  if (!existsSync(path.join(DIST, "gmt", "index.html"))) {
    console.error(
      `${GATE}: apps/dox/dist/gmt/index.html is missing; build the site first.`,
    );
    process.exit(2);
  }
  server = await serveStatic(DIST, 0);
  base = `http://127.0.0.1:${server.address().port}/gmt`;
}
base = base.replace(/\/$/, "");

/** Two frames, so a click's restyle has landed before the read. */
const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );

/** What is wrong with the code frame under each tab of the page. */
async function tabFrameProblems(page) {
  const tabs = await page.locator("starlight-tabs [role=tab]").all();
  const problems = [];
  let read = 0;
  for (const [i, tab] of tabs.entries()) {
    await tab.click();
    await frames(page);
    const corners = await page.evaluate(() => {
      const panel = [...document.querySelectorAll("[role=tabpanel]")].find(
        (el) => !el.hidden,
      );
      const pre = panel?.querySelector("pre");
      if (!pre) return null;
      const cs = getComputedStyle(pre);
      return { start: cs.borderStartStartRadius, end: cs.borderStartEndRadius };
    });
    if (corners === null) continue;
    read += 1;
    if (corners.start !== "0px")
      problems.push(
        `tab ${i}: the frame's start-start corner is ${corners.start}, not square`,
      );
    if (corners.end === "0px")
      problems.push(`tab ${i}: the frame's start-end corner lost its radius`);
  }
  if (read === 0) problems.push("no tab panel with a code frame to check");
  return problems;
}

/** What is wrong with each filing card head of the page. */
function upstreamHeadProblems(page) {
  return page.evaluate(() => {
    const middle = (r) => r.top + r.height / 2;
    const problems = [];
    const heads = document.querySelectorAll(".gmt-upstream-head");
    if (heads.length === 0) problems.push("no filing card heads to check");
    for (const [i, head] of heads.entries()) {
      const title = head.querySelector(".gmt-upstream-title");
      const range = document.createRange();
      if (title) range.selectNodeContents(title);
      const first = title
        ? [...range.getClientRects()].find((r) => r.width > 0)
        : undefined;
      if (!first) {
        problems.push(`card ${i}: no title line to measure against`);
        continue;
      }
      const line = middle(first);
      const icon = head.querySelector(".gmt-upstream-state svg");
      if (!icon) problems.push(`card ${i}: no state icon`);
      else if (Math.abs(middle(icon.getBoundingClientRect()) - line) > 2)
        problems.push(
          `card ${i}: the state icon is off the title's first line`,
        );
      const badge = head.querySelector(".gmt-upstream-status");
      if (!badge) continue;
      const b = badge.getBoundingClientRect();
      // Wrapped below the title, the badge starts a line of its own; that is fine.
      if (b.top < first.bottom && Math.abs(middle(b) - line) > 2)
        problems.push(`card ${i}: the badge is off the title's first line`);
    }
    return problems;
  });
}

/** What is wrong with the list markers in the page's content. */
function markerProblems(page) {
  return page.evaluate(() => {
    const middle = (r) => r.top + r.height / 2;
    const problems = [];
    let measured = 0;
    for (const li of document.querySelectorAll(".sl-markdown-content li")) {
      const mark = getComputedStyle(li, "::before");
      if (mark.content === "none" || mark.display === "none") continue;
      const list = li.parentElement;
      const prose =
        list?.localName === "ul" &&
        !list.hasAttribute("class") &&
        !list.closest(".not-content");
      const where = `"${li.textContent.trim().slice(0, 40)}"`;
      if (!prose && !li.closest(".gmt-checklist")) {
        // A component's own marker is its business; the prose dash is not.
        if (mark.position === "absolute" && mark.height === "1px")
          problems.push(`${where}: a component list item has the prose dash`);
        continue;
      }
      // The first line of text: a range over the whole item would also return the box of a
      // paragraph inside it.
      const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.textContent.trim() === ""
            ? NodeFilter.FILTER_SKIP
            : NodeFilter.FILTER_ACCEPT,
      });
      const text = walker.nextNode();
      if (!text) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      const first = [...range.getClientRects()].find((r) => r.width > 0);
      if (!first) continue;
      // A pseudo-element has no box to read, so the paint position is worked out from its
      // computed style. Anything that style cannot place fails instead of passing unmeasured.
      const markTop = Number.parseFloat(mark.top);
      const markHeight = Number.parseFloat(mark.height);
      const shift = Number.parseFloat(mark.marginTop) || 0;
      if (
        mark.position !== "absolute" ||
        !Number.isFinite(markTop) ||
        !Number.isFinite(markHeight)
      ) {
        problems.push(`${where}: the marker has no position to measure`);
        continue;
      }
      if (mark.transform !== "none" || (mark.translate ?? "none") !== "none") {
        problems.push(
          `${where}: the marker is moved by a transform this check cannot measure`,
        );
        continue;
      }
      const box = li.getBoundingClientRect();
      const top = box.top + li.clientTop + markTop + shift;
      const centre = top + markHeight / 2;
      measured += 1;
      const off = centre - middle(first);
      if (Math.abs(off) > 2)
        problems.push(
          `${where}: the marker is ${off.toFixed(1)} px off its first line`,
        );
    }
    if (measured === 0) problems.push("no list marker to measure");
    // One line per page is enough to find the rule; the rest repeat it.
    return problems.length > 5
      ? [...problems.slice(0, 5), `and ${problems.length - 5} more`]
      : problems;
  });
}

let failures = 0;
let measured = 0;
const report = (browserName, width, pagePath, rule, message) => {
  failures += 1;
  console.log(`FAIL ${browserName} ${width}px ${pagePath}\n       ${message}`);
  recordFinding({
    gate: GATE,
    rule,
    page: pagePath,
    target: "page",
    browser: browserName,
    width,
    message,
  });
};

for (const browserName of browsers) {
  const browser = await launchBrowser(browserName);
  for (const pagePath of pages) {
    for (const size of WIDTHS) {
      const context = await browser.newContext({ viewport: size });
      try {
        await blockOffSite(context, base);
        const page = await context.newPage();
        const res = await page.goto(base + pagePath, { waitUntil: "load" });
        if (!res || res.status() !== 200)
          throw new Error(
            `the page answered HTTP ${res ? res.status() : "none"}, not 200`,
          );
        await page.waitForFunction(() => document.fonts.status === "loaded");
        await frames(page);
        const check = CHECKS[pagePath];
        const problems =
          check === "tabs"
            ? await tabFrameProblems(page)
            : check === "heads"
              ? await upstreamHeadProblems(page)
              : await markerProblems(page);
        for (const problem of problems)
          report(browserName, size.width, pagePath, check, problem);
        measured += 1;
      } catch (error) {
        report(
          browserName,
          size.width,
          pagePath,
          "check-crashed",
          `the check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
        );
      } finally {
        await context.close().catch(() => {});
      }
    }
  }
  await browser.close();
}

server?.close();
recordMeasured(GATE, measured);
console.log(`${GATE}: ${measured} cell(s), ${failures} finding(s)`);
process.exit(failures > 0 || measured === 0 ? 1 : 0);
