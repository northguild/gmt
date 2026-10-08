#!/usr/bin/env node
/**
 * Smooth-growth gate (context/dox/specs/dox-smooth-growth.md § 5).
 *
 * Measures how a tool page's height changes frame by frame, so "result regions
 * ease instead of popping" is a number and not an impression. For each of the
 * 18 tool pages it samples the page root's height on every animation frame, in
 * two passes:
 *
 *   load         4 s from DOMContentLoaded, while the async mount fills the
 *                server-rendered empty sections;
 *   interaction  after the page rests: switch the preset (or another input),
 *                sample 2 s, drag a handle or range across ~60% of its track
 *                in ~20 pointer steps, sample 2 s.
 *
 * Per run it reports total growth, the largest frame-to-frame jump, the number
 * of frames over 48 px, the final height, whether every `.gmt-grow` is at rest
 * (no inline height, no `data-growing`) and the median frame interval.
 *
 * Assertions (the exit code is non-zero when any fails):
 *   - the page answers HTTP 200, its root selector matches an element, and at
 *     least a handful of frames were recorded: a run that measured nothing fails
 *     rather than reporting zeros;
 *   - every interaction the page's row asks for happened (a select that was not
 *     visible, a handle that could not be dragged, a drag that left the value
 *     where it was, a page that never reached rest all fail);
 *   - the largest jump of the root and of `<main>` is at most 48 px (not under
 *     `--reduce`, whose heights snap by design);
 *   - every `.gmt-grow` is at rest at the end;
 *   - the final height equals the `prefers-reduced-motion: reduce` run's, within 1 px;
 *   - Zoned Earth does not grow;
 *   - under `--reduce`, `[data-growing]` never appears.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev
 * server), for example:
 *   pnpm exec astro build --outDir /tmp/dist-x
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory /tmp/dist-x
 *
 * Usage:
 *   node scripts/grow-measure.mjs --base http://127.0.0.1:4351 --out <dir>
 *     [--browsers chromium,webkit] [--widths 1440,390] [--reduce] [--video]
 *     [--css "<extra css>"] [--only <slug,...>] [--reduce-ref <results.json>]
 *     [--frames]
 *
 * Without `--reduce` the script first runs each combination under reduced
 * motion to get the reference final height (or reads `--reduce-ref`, a
 * `results.json` from an earlier `--reduce` run). `--css` injects a style tag at
 * the end of <head> (try a rule: `--css ".gmt-enter{animation:none !important}"`).
 * `--video` records the load pass into `<out>/video/`. `--frames` writes every
 * run's per-frame samples (`t`, root height `h`, main height `m`, growing `g`)
 * to `<out>/frames/<browser>-<width>-<slug>-<pass>.json`, to find which frame
 * made a jump.
 *
 * Chromium and WebKit only: Firefox is blocked by the sandbox on this machine.
 */

import { chromium, webkit } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  crashProblem,
  dragProblem,
  emptyRunProblem,
  jumpProblems,
  maxFrameJump,
  pageProblems,
  skippedProblem,
} from "./gate-checks.mjs";

const JUMP_LIMIT_PX = 48;
const HEIGHT_MATCH_PX = 1;
const LOAD_MS = 4000;
const INTERACT_MS = 2000;

/* One row per page. `root` is the element whose height is sampled. `preset` is
   the select the interaction pass switches (to the next option); a tool with no
   preset names the input it changes instead. `drag` is the handle or range the
   second half drags. */
const PAGES = [
  {
    slug: "dst-inspector",
    root: ".gmt-widget",
    preset: '[data-role="value-preset"]',
    drag: '[data-role="ticker-handle"]',
  },
  {
    slug: "interval-visualizer",
    root: ".gmt-widget",
    preset: '[data-role="relationship-preset"]',
    drag: '[data-role="handle-a-end"]',
  },
  {
    slug: "converter-bench",
    root: ".gmt-widget",
    preset: '[data-role="convert-target"]',
    presetNote: "no preset; changes the target zone",
    drag: null,
  },
  {
    slug: "dwell-ledger",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="handle-exit"]',
  },
  {
    slug: "free-time-ledger",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="handle-end"]',
  },
  {
    slug: "billing-deadlines",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "delivery-scheduler",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "connection-checker",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="handling"]',
  },
  {
    slug: "timetable-reader",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="handle-1"]',
  },
  {
    slug: "crossing-clock",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "cutoff-stack",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "cutoff-ruler",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "cutoff-countdown",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="now-slider"]',
  },
  {
    slug: "punctuality-board",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: ".gmt-handle[data-role]:not([hidden])",
  },
  {
    slug: "eta-drift",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="tolerance-slider"]',
  },
  {
    slug: "departure-board",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: '[data-role="handle-after"]',
  },
  {
    slug: "dtm-decoder",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "x12-time-reader",
    root: ".gmt-widget",
    preset: '[data-role="preset"]',
    drag: null,
  },
  {
    slug: "zone-planner",
    root: ".gmt-scrubber-block",
    preset: null,
    click: '[data-role="dst-preset"]',
    presetNote: "no preset; clicks Jump to the next DST transition",
    drag: '[data-role="slider"]',
  },
  {
    slug: "zoned-earth",
    root: ".gmt-globe",
    preset: null,
    drag: null,
    noGrowth: true,
    presetNote: "no input; load pass only",
  },
].map((p) => ({ ...p, path: `/tools/${p.slug}/` }));

function parseArgs(argv) {
  const o = {
    base: null,
    out: null,
    browsers: ["chromium", "webkit"],
    widths: [1440, 390],
    reduce: false,
    video: false,
    css: "",
    only: null,
    reduceRef: null,
    frames: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--base") o.base = next();
    else if (a === "--out") o.out = next();
    else if (a === "--browsers") o.browsers = next().split(",");
    else if (a === "--widths") o.widths = next().split(",").map(Number);
    else if (a === "--reduce") o.reduce = true;
    else if (a === "--video") o.video = true;
    else if (a === "--css") o.css = next();
    else if (a === "--only") o.only = next().split(",");
    else if (a === "--reduce-ref") o.reduceRef = next();
    else if (a === "--frames") o.frames = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!o.base || !o.out) {
    console.error(
      "Usage: node scripts/grow-measure.mjs --base <url> --out <dir> [--browsers chromium,webkit] [--widths 1440,390] [--reduce] [--video] [--css <css>] [--only <slug,...>] [--reduce-ref <results.json>] [--frames]",
    );
    process.exit(2);
  }
  if (!o.widths.length || o.widths.some((w) => !Number.isFinite(w) || w <= 0)) {
    console.error("--widths needs positive numbers, e.g. 1440,390");
    process.exit(2);
  }
  for (const b of o.browsers) {
    if (b !== "chromium" && b !== "webkit") {
      console.error(
        `Unsupported browser "${b}". Firefox is blocked by the sandbox on this machine; only chromium and webkit run.`,
      );
      process.exit(2);
    }
  }
  return o;
}

/* Runs before any page script. Samples on every animation frame once started;
   `auto` starts it at DOMContentLoaded for the load pass.

   Each frame has two heights. `h` is read in a task after the frame, as the
   first version of this gate did. `p` is the height that was PAINTED: read at the
   end of the frame's last ResizeObserver callback, which is after layout, after
   every box has been pinned, and before paint. The two differ when a mount task
   runs between a frame's rendering and the sampling task: it fills a section,
   `h` forces layout and sees the new height, and the next frame's ResizeObserver
   pass pins the box before anything is drawn, so that height was never on screen.
   The gate asserts on `p`; `h` is kept (as `rawMaxJump`) so the two can be
   compared. To get a ResizeObserver callback in every frame, a 1 px sentinel
   changes width each frame, and the page's own ResizeObserver is wrapped so its
   callbacks are followed by a read. A frame in which no callback ran falls back
   to the later reading (the old measurement) and is counted as `unpainted`,
   which is reported and not asserted. */
function samplerInit({ rootSelector, auto }) {
  const S = (window.__grow = {
    frames: [],
    t0: 0,
    running: false,
    n: 0,
    unpainted: 0,
  });
  /* The latest read of the frame in progress: set at the end of a
     ResizeObserver callback, used by the sampling task after the frame. */
  let painted = null;
  const read = () => {
    const root = document.querySelector(rootSelector);
    const main = document.querySelector("main");
    if (!root) return null;
    return {
      n: S.n,
      h: root.getBoundingClientRect().height,
      m: main ? main.getBoundingClientRect().height : 0,
      g: document.querySelector("[data-growing]") ? 1 : 0,
    };
  };
  const NativeResizeObserver = window.ResizeObserver;
  if (NativeResizeObserver) {
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback) {
        super((entries, observer) => {
          try {
            callback.call(observer, entries, observer);
          } finally {
            if (S.running) painted = read() ?? painted;
          }
        });
      }
    };
  }
  let sentinel = null;
  const ensureSentinel = () => {
    if (sentinel || !NativeResizeObserver || !document.documentElement) return;
    sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:fixed;left:-9999px;top:0;height:1px;width:1px;pointer-events:none";
    document.documentElement.append(sentinel);
    new window.ResizeObserver(() => {}).observe(sentinel);
  };
  const record = () => {
    const raw = read();
    // Nothing to measure until the root is in the document. A root that never
    // appears leaves zero frames, which the run reports as a failure.
    if (!raw) return;
    const exact = painted && painted.n === S.n ? painted : null;
    if (!exact) S.unpainted += 1;
    const use = exact ?? raw;
    S.frames.push({
      n: S.n,
      t: performance.now() - S.t0,
      h: use.h,
      m: use.m,
      g: use.g,
      raw: raw.h,
      rawMain: raw.m,
    });
  };
  /* Sampled in a task after the frame, not inside the rAF callback: a read
     there forces layout before ResizeObserver has run, so it would see the
     unclipped height the frame never paints. */
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    if (!S.running) return;
    record();
    requestAnimationFrame(loop);
  };
  const loop = () => {
    if (!S.running) return;
    S.n += 1;
    ensureSentinel();
    if (sentinel) sentinel.style.width = S.n % 2 ? "2px" : "1px";
    channel.port2.postMessage(0);
  };
  S.start = () => {
    S.frames = [];
    S.unpainted = 0;
    S.n = 0;
    painted = null;
    S.t0 = performance.now();
    S.running = true;
    requestAnimationFrame(loop);
  };
  S.stop = () => {
    S.running = false;
    return S.frames;
  };
  // Started at once, so a mount that beats DOMContentLoaded is still seen.
  if (auto) S.start();
}

function stats(frames) {
  const hs = frames.map((f) => f.h);
  const ms = frames.map((f) => f.m);
  const jumps = hs.slice(1).map((h, i) => Math.abs(h - hs[i]));
  const dts = frames
    .slice(1)
    .map((f, i) => f.t - frames[i].t)
    .sort((a, b) => a - b);
  return {
    frames: frames.length,
    firstH: hs[0] ?? 0,
    finalH: hs[hs.length - 1] ?? 0,
    growth: (hs[hs.length - 1] ?? 0) - (hs[0] ?? 0),
    maxJump: maxFrameJump(hs),
    // Speed, not step: the largest jump scaled to a 60 Hz frame, so a stalled
    // frame (a long mount task) is not mistaken for a fast ease.
    maxPer60: Math.max(
      0,
      ...jumps.map(
        (j, i) => (j * 1000) / 60 / Math.max(1, frames[i + 1].t - frames[i].t),
      ),
    ),
    // The same jump read in a task after the frame, as before painted heights
    // were read: kept for comparison, never asserted.
    rawMaxJump: maxFrameJump(frames.map((f) => f.raw)),
    over48: jumps.filter((j) => j > JUMP_LIMIT_PX).length,
    mainMaxJump: maxFrameJump(ms),
    medianDt: dts.length ? dts[Math.floor(dts.length / 2)] : 0,
    growingSeen: frames.some((f) => f.g === 1),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Polls until no `[data-growing]` exists and the root height has held for 500 ms. */
async function waitForRest(page, rootSelector, capMs = 8000) {
  const start = performance.now();
  let last = -1;
  let since = performance.now();
  while (performance.now() - start < capMs) {
    const { h, growing } = await page.evaluate((sel) => {
      const r = document.querySelector(sel);
      return {
        h: r ? r.getBoundingClientRect().height : 0,
        growing: !!document.querySelector("[data-growing]"),
      };
    }, rootSelector);
    if (growing || Math.abs(h - last) > 0.01) since = performance.now();
    last = h;
    if (!growing && performance.now() - since >= 800) return true;
    await sleep(100);
  }
  return false;
}

/* True when every `.gmt-grow` is at rest. Polls up to 1 s so the timeout
   fallback (duration + 100 ms) has run. */
async function growsAtRest(page) {
  const probe = () =>
    page.evaluate(() => {
      const els = [...document.querySelectorAll(".gmt-grow")];
      return {
        count: els.length,
        bad: els.filter(
          (el) => el.style.height || el.hasAttribute("data-growing"),
        ).length,
      };
    });
  let r = await probe();
  for (let i = 0; i < 10 && r.bad > 0; i++) {
    await sleep(100);
    r = await probe();
  }
  return r;
}

async function drag(page, selector) {
  const el = page.locator(selector).first();
  if (!(await el.isVisible().catch(() => false))) return "handle not visible";
  await el.scrollIntoViewIfNeeded();
  /* The value the control exposes, null when it exposes none. */
  const readValue = () =>
    el
      .evaluate(
        (node) => node.getAttribute("aria-valuenow") ?? node.value ?? null,
      )
      .catch(() => null);
  const before = await readValue();
  const info = await el.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    if (node instanceof HTMLInputElement && node.type === "range") {
      const pct =
        (Number(node.value) - Number(node.min)) /
        (Number(node.max) - Number(node.min));
      return {
        x: rect.left + pct * rect.width,
        y: rect.top + rect.height / 2,
        trackLeft: rect.left,
        trackWidth: rect.width,
      };
    }
    const track = node.parentElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      trackLeft: track.left,
      trackWidth: track.width,
    };
  });
  const dir = info.x - info.trackLeft < info.trackWidth / 2 ? 1 : -1;
  const dx = dir * info.trackWidth * 0.6;
  await page.mouse.move(info.x, info.y);
  await page.mouse.down();
  const STEPS = 20;
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(info.x + (dx * i) / STEPS, info.y);
    await sleep(16);
  }
  await page.mouse.up();
  const after = await readValue();
  const moved = dragProblem(before, after);
  return moved.length ? moved[0] : null;
}

async function changeInput(page, def) {
  if (def.click) {
    const el = page.locator(def.click).first();
    if (!(await el.isVisible().catch(() => false)))
      return "click target not visible";
    await el.click();
    return null;
  }
  if (!def.preset) return "no input";
  const sel = page.locator(def.preset).first();
  if (!(await sel.isVisible().catch(() => false))) return "select not visible";
  const idx = await sel.evaluate((s) => {
    const n = s.options.length;
    return n < 2 ? -1 : s.selectedIndex === n - 1 ? 0 : s.selectedIndex + 1;
  });
  if (idx < 0) return "select has one option";
  await sel.selectOption({ index: idx });
  return null;
}

async function runOneUnguarded(
  browser,
  o,
  def,
  width,
  pass,
  reduce,
  withVideo,
) {
  const height = width === 390 ? 844 : 900;
  const ctxOpts = {
    viewport: { width, height },
    reducedMotion: reduce ? "reduce" : "no-preference",
  };
  let videoDir;
  if (withVideo) {
    videoDir = path.join(o.out, "video", ".tmp");
    ctxOpts.recordVideo = { dir: videoDir, size: { width, height } };
  }
  const context = await browser.newContext(ctxOpts);
  if (o.css) {
    /* Appended to the end of <head> so it beats the site's tokens at equal specificity. */
    await context.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document")
        return route.continue();
      const response = await route.fetch();
      const body = (await response.text()).replace(
        "</head>",
        `<style data-grow-measure>${o.css}</style></head>`,
      );
      await route.fulfill({ response, body });
    });
  }
  const page = await context.newPage();
  await context.addInitScript(samplerInit, {
    rootSelector: def.root,
    auto: pass === "load",
  });
  const notes = [];
  /* Anything here fails the run: the page was not the page, or the pass did not
     do what it claims to. Notes are for what is merely worth knowing. */
  const problems = [];
  let stat;
  let frames = [];
  try {
    const response = await page.goto(new URL(def.path, o.base).href, {
      waitUntil: "domcontentloaded",
    });
    const status = response ? response.status() : null;
    if (pass === "load") {
      /* At least 4 s, then until the root has held its height for 1 s, so a
         slow mount (a cold polyfill chunk on a busy machine) is measured as the
         growth it is, not cut off at 4 s. Capped at 12 s. */
      await page
        .waitForFunction(
          ([min, hold]) => {
            const f = window.__grow.frames;
            const last = f.at(-1);
            if (!last || last.t < min) return false;
            const recent = f.filter((x) => x.t >= last.t - hold);
            return (
              last.t - f[0].t >= hold &&
              recent.every((x) => x.g === 0 && Math.abs(x.h - last.h) < 0.01)
            );
          },
          [LOAD_MS, 1000],
          { timeout: 12000, polling: 100 },
        )
        .catch(() => notes.push("root never held its height; stopped at 12 s"));
      frames = await page.evaluate(() => window.__grow.stop());
    } else {
      await page.waitForLoadState("networkidle").catch(() => {});
      if (!(await waitForRest(page, def.root)))
        problems.push("page never reached rest before the interaction");
      if (def.noGrowth || (!def.preset && !def.click && !def.drag)) {
        notes.push(def.presetNote ?? "no interaction");
        frames = [];
        await page.evaluate(() => window.__grow.start());
        await sleep(INTERACT_MS);
        frames = await page.evaluate(() => window.__grow.stop());
      } else {
        await page.evaluate(() => window.__grow.start());
        const skip1 = await changeInput(page, def);
        problems.push(...skippedProblem("the input change", skip1));
        if (!skip1 && def.presetNote) notes.push(def.presetNote);
        await sleep(INTERACT_MS);
        if (def.drag) {
          const skip2 = await drag(page, def.drag);
          problems.push(...skippedProblem("the drag", skip2));
          await sleep(INTERACT_MS);
        } else notes.push("no drag handle");
        frames = await page.evaluate(() => window.__grow.stop());
      }
    }
    stat = stats(frames);
    stat.unpainted = await page.evaluate(() => window.__grow.unpainted);
    const rootFound = await page.evaluate(
      (sel) => !!document.querySelector(sel),
      def.root,
    );
    problems.push(
      ...pageProblems({
        status,
        rootSelector: def.root,
        rootFound,
        frames: frames.length,
      }),
    );
    const rest = await growsAtRest(page);
    stat.growCount = rest.count;
    stat.atRest = rest.bad === 0;
    if (!stat.atRest) notes.push(`${rest.bad} .gmt-grow not at rest`);
  } finally {
    const video = page.video();
    await page.close().catch(() => {});
    if (video) {
      const dest = path.join(
        o.out,
        "video",
        `${browser.browserType().name()}-${width}-${def.slug}-${pass}${reduce ? "-reduce" : ""}.webm`,
      );
      await video
        .saveAs(dest)
        .catch((e) => notes.push(`video not saved: ${e.message}`));
      await video.delete().catch(() => {});
    }
    await context.close().catch(() => {});
  }
  return { ...stat, notes, problems, rawFrames: frames };
}

/* A run that throws (a page or browser closed under it) is a failed run with a
   row of its own, not a crash that leaves no results at all. */
async function runOne(...args) {
  try {
    return await runOneUnguarded(...args);
  } catch (error) {
    return {
      frames: 0,
      firstH: 0,
      finalH: 0,
      growth: 0,
      maxJump: 0,
      maxPer60: 0,
      rawMaxJump: 0,
      over48: 0,
      mainMaxJump: 0,
      medianDt: 0,
      growingSeen: false,
      growCount: 0,
      atRest: false,
      unpainted: 0,
      notes: [],
      problems: crashProblem(error),
    };
  }
}

function mdTable(results, reduceMode) {
  const head = reduceMode
    ? "| page | browser | width | pass | growth | max jump | >48 px | final H | at rest | data-growing seen | verdict |"
    : "| page | browser | width | pass | growth | max jump | px at 60 Hz | >48 px | final H | ref H | match | at rest | median dt | raw max jump | verdict |";
  const sep = head.replace(/[^|]+/g, (m) => "-".repeat(Math.max(3, m.length)));
  const f = (n) => (Math.round(n * 10) / 10).toString();
  const rows = results.map((r) =>
    reduceMode
      ? `| ${r.slug} | ${r.browser} | ${r.width} | ${r.pass} | ${f(r.growth)} | ${f(r.maxJump)} | ${r.over48} | ${f(r.finalH)} | ${r.atRest ? "yes" : "NO"} | ${r.growingSeen ? "YES" : "no"} | ${r.ok ? "ok" : "FAIL: " + r.failures.join("; ")} |`
      : `| ${r.slug} | ${r.browser} | ${r.width} | ${r.pass} | ${f(r.growth)} | ${f(r.maxJump)} | ${f(r.maxPer60)} | ${r.over48} | ${f(r.finalH)} | ${r.refH == null ? "n/a" : f(r.refH)} | ${r.finalMatch == null ? "n/a" : r.finalMatch ? "yes" : "NO"} | ${r.atRest ? "yes" : "NO"} | ${f(r.medianDt)} ms | ${f(r.rawMaxJump ?? 0)} | ${r.ok ? "ok" : "FAIL: " + r.failures.join("; ")} |`,
  );
  return [head, sep, ...rows].join("\n");
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  await mkdir(o.out, { recursive: true });
  const pages = o.only ? PAGES.filter((p) => o.only.includes(p.slug)) : PAGES;
  if (!pages.length) {
    console.error("--only matched no page");
    process.exit(2);
  }
  const key = (b, w, slug, pass) => `${b}|${w}|${slug}|${pass}`;
  let refs = new Map();
  if (o.reduceRef) {
    const ref = JSON.parse(await readFile(o.reduceRef, "utf8"));
    for (const r of ref.results)
      refs.set(key(r.browser, r.width, r.slug, r.pass), r.finalH);
  }

  const results = [];
  for (const name of o.browsers) {
    const browser = await (name === "webkit" ? webkit : chromium).launch();
    try {
      for (const width of o.widths) {
        for (const def of pages) {
          for (const pass of ["load", "interaction"]) {
            let refProblems = [];
            let refH = refs.get(key(name, width, def.slug, pass)) ?? null;
            if (!o.reduce && refH == null) {
              const ref = await runOne(
                browser,
                o,
                def,
                width,
                pass,
                true,
                false,
              );
              refH = ref.finalH;
              refProblems = ref.problems;
              refs.set(key(name, width, def.slug, pass), refH);
            }
            let r = await runOne(
              browser,
              o,
              def,
              width,
              pass,
              o.reduce,
              o.video && pass === "load",
            );
            /* Two independent page loads that disagree on the final height are
               usually a slow mount in one of them; measure both once more
               before calling it a failure. */
            if (
              !o.reduce &&
              refH != null &&
              Math.abs(r.finalH - refH) > HEIGHT_MATCH_PX
            ) {
              const again = await runOne(
                browser,
                o,
                def,
                width,
                pass,
                true,
                false,
              );
              refH = again.finalH;
              refProblems = again.problems;
              r = await runOne(browser, o, def, width, pass, false, false);
              r.notes.push("final height re-measured after a mismatch");
            }
            const failures = [
              ...r.problems,
              ...refProblems.map((p) => `reduced-motion reference: ${p}`),
              ...jumpProblems({
                maxJump: r.maxJump,
                mainMaxJump: r.mainMaxJump,
                limit: JUMP_LIMIT_PX,
                reduce: o.reduce,
              }),
            ];
            if (!r.atRest) failures.push("a .gmt-grow is not at rest");
            const finalMatch =
              refH == null || o.reduce
                ? null
                : Math.abs(r.finalH - refH) <= HEIGHT_MATCH_PX;
            if (finalMatch === false)
              failures.push(`final ${r.finalH} != reduced ${refH}`);
            if (def.noGrowth && Math.abs(r.growth) > HEIGHT_MATCH_PX)
              failures.push(`grew ${Math.round(r.growth)} px`);
            if (o.reduce && r.growingSeen)
              failures.push("[data-growing] appeared under reduced motion");
            if (o.frames) {
              await mkdir(path.join(o.out, "frames"), { recursive: true });
              await writeFile(
                path.join(
                  o.out,
                  "frames",
                  `${name}-${width}-${def.slug}-${pass}.json`,
                ),
                JSON.stringify(r.rawFrames),
              );
            }
            delete r.rawFrames;
            const row = {
              slug: def.slug,
              browser: name,
              width,
              pass,
              refH,
              finalMatch,
              ...r,
              ok: failures.length === 0,
              failures,
            };
            results.push(row);
            console.log(
              `${row.ok ? "ok  " : "FAIL"} ${name} ${width} ${def.slug} ${pass}: growth ${Math.round(r.growth)} px, max jump ${Math.round(r.maxJump)} px, >48 ${r.over48}, final ${Math.round(r.finalH)}${failures.length ? " :: " + failures.join("; ") : ""}`,
            );
          }
        }
      }
    } finally {
      await browser.close().catch(() => {});
    }
  }

  const suffix =
    o.browsers.join(",") === "chromium,webkit"
      ? ""
      : `.${o.browsers.join("-")}`;
  const meta = {
    base: o.base,
    reduce: o.reduce,
    css: o.css,
    widths: o.widths,
    browsers: o.browsers,
    firefox: "blocked by the sandbox on this machine; not run",
  };
  await writeFile(
    path.join(o.out, `results${suffix}.json`),
    JSON.stringify({ meta, results }, null, 2),
  );
  const failed = results.filter((r) => !r.ok);
  // Zero runs would otherwise print "all 0 runs passed".
  const empty = emptyRunProblem(results.length, "runs");
  if (empty) failed.push({ slug: "(none)" });
  const md = [
    `# Growth measurement`,
    ``,
    `base ${o.base}; reduce ${o.reduce}; css ${o.css || "(none)"}; Firefox: blocked by the sandbox, not run.`,
    ``,
    mdTable(results, o.reduce),
    ``,
    empty
      ? `FAIL: ${empty}`
      : failed.length
        ? `${failed.length} of ${results.length} runs failed.`
        : `All ${results.length} runs passed.`,
    ``,
  ].join("\n");
  await writeFile(path.join(o.out, `results${suffix}.md`), md);
  if (empty) console.error(empty);
  console.log(
    `\n${failed.length ? failed.length + " of " + results.length + " runs failed" : "all " + results.length + " runs passed"}`,
  );
  process.exit(failed.length ? 1 : 0);
}

await main();
