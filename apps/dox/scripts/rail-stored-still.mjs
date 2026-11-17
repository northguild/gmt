#!/usr/bin/env node
/**
 * Rail stored width gate: the /dox widget rail paints at the width the reader saved, and does not
 * jump to it after hydration.
 *
 * `rail-prepaint.ts` puts the saved width (`localStorage` `gmt-dox-rail-width`) on `<html>` from an
 * inline head script, so the server-rendered rail is already that wide on its first frame, and
 * `RailResizer` later moves the value to the hive body without changing a pixel. Unit tests cannot
 * assert layout, so this runs in a browser against the built site.
 *
 * Scenario 1 (1440 x 900): an init script saves a width of 600 and records the rail's rendered
 * width on every animation frame from the first frame the rail exists until one second after
 * `load`. Every frame must be the final width (1 px for rounding), and the final width must be the
 * saved one clamped to the rail's own bounds (its computed min and max inline size).
 *
 * Scenario 2: a double-click on the separator "Resize the widget panel" returns the rail to its
 * default width, which is its computed minimum, and it stays there for a second and across a
 * further stretch of frames.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server):
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage: node scripts/rail-stored-still.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit,firefox]
 *        [--pages /dox/] [--list-pages]
 * Exits non-zero on any failure.
 */
import { launchBrowser } from "./lib/browser-launch.mjs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";

const GATE = "rail-stored-still";
const PAGES = ["/dox/"];
const ENGINES = ["chromium", "firefox", "webkit"];
const STORAGE_KEY = "gmt-dox-rail-width";
const SAVED = 600;
/** The rail, whichever panel it holds: the examples list or a widget. Named by its label. */
const RAIL = 'aside[aria-label="Examples"], aside[aria-label="Widget panel"]';

const PAGES_ARG = await applyPageContract({ gate: GATE, pages: PAGES });
const SELECTED = PAGES_ARG ?? PAGES;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const browsers = flag("browsers", "chromium,webkit,firefox").split(",");
for (const name of browsers) {
  if (!ENGINES.includes(name)) {
    console.error(`${GATE}: unknown browser "${name}"`);
    process.exit(2);
  }
}

const failures = [];
let measured = 0;
const fail = (rule, browser, path, message) => {
  failures.push(`${browser} ${path}: ${message}`);
  console.error(`  ! ${rule} · ${browser} ${path}: ${message}`);
  recordFinding({
    gate: GATE,
    rule,
    page: path,
    target: "rail",
    browser,
    message,
  });
};

/** Runs in the page before any script of its own: save the width and record every frame. */
function installRecorder([key, saved, selector]) {
  try {
    localStorage.setItem(key, String(saved));
  } catch {
    // Storage blocked: the gate reports the missing frames.
  }
  const frames = [];
  const state = { frames, stop: false, start: () => {} };
  window.__rail = state;
  const tick = () => {
    const rail = document.querySelector(selector);
    if (rail) frames.push(rail.getBoundingClientRect().width);
    if (!state.stop) requestAnimationFrame(tick);
  };
  state.start = () => {
    state.stop = false;
    requestAnimationFrame(tick);
  };
  state.start();
}

/** Runs in the page: the rail's rendered width and the bounds its own CSS gives it. */
function readRail(selector) {
  const rail = document.querySelector(selector);
  if (!rail) return null;
  const style = getComputedStyle(rail);
  return {
    width: rail.getBoundingClientRect().width,
    min: parseFloat(style.minInlineSize),
    max: parseFloat(style.maxInlineSize),
  };
}

const spread = (frames) => Math.max(...frames) - Math.min(...frames);

async function scenario(browser, name, path) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await blockOffSite(context, base);
  await context.addInitScript(installRecorder, [STORAGE_KEY, SAVED, RAIL]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error.message ?? error)));
  try {
    await page.goto(`${base}${path}`, { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const first = await page.evaluate(() => {
      window.__rail.stop = true;
      return [...window.__rail.frames];
    });
    const rail = await page.evaluate(readRail, RAIL);
    if (!rail || first.length === 0) {
      fail("no-rail", name, path, "the widget rail never appeared");
      return;
    }
    const expected = Math.min(Math.max(SAVED, rail.min), rail.max);
    const last = first[first.length - 1];
    if (Math.abs(last - expected) > 1)
      fail(
        "saved-width",
        name,
        path,
        `the rail ends ${last.toFixed(1)} px wide, not the saved ${SAVED} px clamped to ${expected.toFixed(1)} px`,
      );
    if (spread(first) > 1)
      fail(
        "jump",
        name,
        path,
        `the rail changed width while loading: ${[...new Set(first.map((w) => Math.round(w * 10) / 10))].join(" -> ")} px over ${first.length} frames`,
      );

    // A double-click on the separator resets to the default and holds it there.
    await page.evaluate(() => {
      window.__rail.frames.length = 0;
      window.__rail.start();
    });
    // The handle is a zero-width line whose hit area is drawn around it, so Playwright's own
    // click cannot act on it; the mouse goes to the middle of the line.
    const box = await page
      .getByRole("separator", { name: "Resize the widget panel" })
      .boundingBox();
    if (!box) throw new Error("the separator has no box");
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => {
      window.__rail.stop = true;
      return [...window.__rail.frames];
    });
    const reset = await page.evaluate(readRail, RAIL);
    if (Math.abs(reset.width - reset.min) > 1)
      fail(
        "reset",
        name,
        path,
        `after a double-click the rail is ${reset.width.toFixed(1)} px wide, not its default ${reset.min.toFixed(1)} px`,
      );
    const settled = after.slice(-30);
    if (settled.length > 0 && spread(settled) > 1)
      fail(
        "reset-holds",
        name,
        path,
        `the rail did not stay at its default after the double-click: ${[...new Set(settled.map((w) => Math.round(w * 10) / 10))].join(" -> ")} px`,
      );
    for (const text of errors) fail("page-error", name, path, text);
    measured++;
  } catch (error) {
    fail(
      "gate-error",
      name,
      path,
      String(error?.message ?? error).split("\n")[0],
    );
  } finally {
    await context.close();
  }
}

for (const name of browsers) {
  const browser = await launchBrowser(name);
  for (const path of SELECTED) await scenario(browser, name, path);
  await browser.close();
}

recordMeasured(GATE, measured);
if (failures.length) {
  console.error(
    `${GATE}: ${failures.length} failure(s) across ${measured} scenario(s)`,
  );
  process.exit(1);
}
console.log(`${GATE}: ${measured} scenario(s) pass`);
