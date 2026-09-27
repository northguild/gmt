#!/usr/bin/env node
/**
 * Visual regression harness (context/dox/reference/design-system.md, "Verifying a
 * change is visually safe").
 *
 * Not a full Playwright test suite — a small capture script. Boots `astro preview`
 * against the already-built `dist/`, screenshots a fixed page list (plus the search
 * modal and mobile menu interaction states) in both themes and two viewports, and
 * saves PNGs under `.visual/<label>/`. Run `visual:before` on a clean tree before a
 * CSS/markup change, `visual:after` once the change lands, then `visual:diff` to
 * assert the two sets match wherever they should — a pure refactor must produce
 * a near-zero pixel diff for every page not intentionally touched by that change.
 *
 * `visual:diff` does a perceptual pixel diff (pixelmatch), not a byte-identical
 * hash. Byte-identical was tried first and doesn't work here: any page with
 * `backdrop-filter: blur()` (the glass panels, the search modal's dimmed
 * backdrop) re-encodes to a different PNG on every single run even with zero
 * code change and ambient motion/live clocks already frozen — confirmed by
 * diffing two such runs, where the pixel differences are sub-visual GPU blur
 * dithering noise, not a rendering difference. This is a known class of
 * flakiness for GPU-composited blur, not specific to this harness — it's why
 * every real screenshot-diff tool (Percy, Chromatic, Playwright's own
 * `toHaveScreenshot`) compares pixels with a tolerance instead of hashing.
 *
 * Usage:
 *   pnpm run build && pnpm run visual:before   # capture the baseline
 *   ...make changes, pnpm run build...
 *   pnpm run visual:after                      # capture the comparison set
 *   pnpm run visual:diff                       # assert before ~= after (exit 1 over threshold)
 */

import { chromium } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const execFileAsync = promisify(execFile);

// Loose enough to absorb GPU blur dithering noise (observed: a few hundred to
// low-thousands of pixels differing by a handful of RGB levels each, scattered
// across blurred regions, on an otherwise-unchanged page), tight enough that a
// real layout/color regression — which changes a large contiguous region, not
// a light dusting of noise — still fails loudly.
const MAX_DIFF_PIXEL_RATIO = 0.002; // 0.2% of the image

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Other worktrees of this repo routinely leave their own `astro preview` daemons
// running on 4321-4399 (astro preview is a persistent background process, not a
// one-shot server) — picking a port in that range risks silently hitting a stale
// server from an unrelated worktree instead of failing loudly. 48173 is well clear
// of it.
const PORT = 48173;
const BASE_URL = `http://localhost:${PORT}`;
// Sentinel string only this repo's built pages contain — used to confirm the preview
// server we're talking to is actually serving THIS worktree's dist/, not a stray
// process left running on the same port by another worktree or a previous run.
const SENTINEL = "Give Me Temporal";

const label = process.argv[2];
if (label === "diff") {
  await diffSnapshots();
  // Exit with whatever diffSnapshots set (0 if all identical, 1 if any
  // differed or was missing) — do not hardcode 0 here, or every failure gets
  // silently swallowed.
  process.exit(process.exitCode ?? 0);
}
if (label !== "before" && label !== "after") {
  console.error("Usage: node scripts/visual-snapshot.mjs <before|after|diff>");
  process.exit(1);
}

/* Page list — see design-system.md's "Verifying a change is visually safe": landing,
   a dense reference page, the two /tools pages this epic is actively changing, and one
   page per teaching widget.

   Widened 2026-09-10 for `DOX-C3b`. The list carried exactly one widget page
   (`getDstTransitions`, for the DST inspector), which meant `DOX-C3b`'s
   "every Tier 2 widget page renders identically after the mount(root) refactor"
   was unverifiable for two of the three widgets it refactors — the interval
   visualizer and the converter bench had no visual coverage at all. Each entry
   below is the canonical page hosting one widget. */
const PAGES = [
  { slug: "home", path: "/" },
  { slug: "install", path: "/install/" },
  { slug: "zoned-earth", path: "/tools/zoned-earth/" },
  { slug: "zone-planner", path: "/tools/zone-planner/" },
  { slug: "dst-inspector", path: "/reference/zoned/get/getDstTransitions/" },
  {
    slug: "interval-visualizer",
    path: "/reference/zoned/interval/intervalIntersectionZoned/",
  },
  {
    slug: "converter-bench",
    path: "/reference/zoned/convert/convertZonedToZoned/",
  },
  /* The standalone /tools pages for the same three widgets. Covered separately
     from the reference pages above because they are a different rendering: no
     surrounding API documentation, their own prose, and — for the permalink
     targets — the page a reader actually lands on from the chat. */
  { slug: "tool-dst-inspector", path: "/tools/dst-inspector/" },
  { slug: "tool-interval-visualizer", path: "/tools/interval-visualizer/" },
  { slug: "tool-converter-bench", path: "/tools/converter-bench/" },
  { slug: "tool-dwell-ledger", path: "/tools/dwell-ledger/" },
  { slug: "tool-free-time-ledger", path: "/tools/free-time-ledger/" },
  { slug: "tool-billing-deadlines", path: "/tools/billing-deadlines/" },
  { slug: "tool-delivery-scheduler", path: "/tools/delivery-scheduler/" },
  { slug: "tool-connection-checker", path: "/tools/connection-checker/" },
  { slug: "tool-timetable-reader", path: "/tools/timetable-reader/" },
  { slug: "tool-crossing-clock", path: "/tools/crossing-clock/" },
  /* Added last, deliberately. Through DOX-C3b this was the page being changed
     on almost every step, so covering it earlier would have meant a gate that
     failed by design and got ignored. It is stable now, and it is the only page
     that renders the chat island at all — the empty state, the composer, the
     brain badge and the widget rail's collapsed-to-nothing layout are covered
     by nothing else. */
  { slug: "dox", path: "/dox/" },
];

const THEMES = ["dark", "light"];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

// The globe's clock readouts re-render every second (see src/lib/globe.ts's
// `setInterval(tickClocks, 1000)` and zone-clock-list.ts's `.gmt-clock-time`),
// so home/zoned-earth are never byte-identical run to run on their own —
// confirmed by diffing two builds with no code change between them, where
// only this text differed pixel-for-pixel. Masking it is what makes the
// byte-identical assertion meaningful rather than something that cries wolf
// on every run. A selector that matches nothing on a given page is a no-op
// for Playwright's `mask`, so this is safe to apply everywhere.
/*
 * Regions whose content is a function of the wall clock, and therefore differs
 * between any two captures taken minutes apart. Masked rather than waited out —
 * no settle delay can make "now" the same twice.
 *
 * The globe canvas was added 2026-09-10, after a baseline and a comparison taken
 * ~30 minutes apart diverged by up to 1% on every light-theme page carrying a
 * globe. The visible difference was a crescent down the right-hand limb: the
 * day/night terminator, whose position `globe-terminator.ts` computes from the
 * current time. It is not flake and it does not settle — it is the widget
 * working. Its own correctness is covered by `globe.test.ts`; what this harness
 * is for is catching layout and style regressions around it.
 */
const LIVE_CLOCK_SELECTORS = [
  ".gmt-clock-time",
  ".gmt-globe-tooltip-time",
  ".gmt-globe-stage canvas",
];

// Confirms both that something is listening on PORT and that it's actually serving
// THIS worktree's build, not a stray daemon left running by another worktree or an
// earlier run on the same port (see the PORT comment above).
async function waitForOurServer(url, timeoutMs = 30_000) {
  // `performance.now()`, not `Date.now()`: this is a polling stopwatch, and a monotonic clock
  // cannot be dragged backwards mid-wait by a clock correction. GMT handles date values, not
  // elapsed time, so it is not the tool here either.
  const start = performance.now();
  for (;;) {
    try {
      const res = await fetch(url);
      const body = await res.text();
      if (body.includes(SENTINEL)) return;
      throw new Error(
        `something is listening on ${url} but it isn't this worktree's dist/ ` +
          `(sentinel "${SENTINEL}" not found in the response) — likely a stale ` +
          `preview daemon from another worktree; pick a different PORT`,
      );
    } catch (err) {
      if (performance.now() - start > timeoutMs) {
        throw new Error(
          `preview server did not come up at ${url}: ${err.message}`,
        );
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

// `astro preview` auto-daemonizes when its stdin isn't a TTY (which is always true
// under `spawn`) — the process this function returns from `spawn` is a short-lived
// launcher, not the actual server, so `child.kill()` does not stop it. Use
// `astro preview stop` for teardown instead (see main()'s `finally`).
async function stopPreviewDaemon() {
  try {
    await execFileAsync("pnpm", ["exec", "astro", "preview", "stop"], {
      cwd: ROOT,
    });
  } catch {
    // "No preview server is running" exits non-zero in some astro versions — fine.
  }
}

async function loadPng(filePath) {
  const buf = await readFile(filePath);
  return PNG.sync.read(buf);
}

// Returns the fraction of pixels that differ (0 = identical), or throws if
// the two images aren't the same size (a real layout change, not noise).
function pixelDiffRatio(before, after) {
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `size mismatch: ${before.width}x${before.height} vs ${after.width}x${after.height}`,
    );
  }
  const { width, height } = before;
  const diffCount = pixelmatch(before.data, after.data, null, width, height, {
    threshold: 0.1,
  });
  return diffCount / (width * height);
}

// DOX-C0 (#171): the "byte-identical screenshot gate" design-system.md and the
// DOX-C0 DoD both call for was, until this story, a human eyeballing 20+ PNGs —
// `visual-snapshot.mjs` only ever captured, it never compared. This makes the
// DoD line an actual pass/fail: perceptually diff every before/after pair
// (see MAX_DIFF_PIXEL_RATIO above for why not byte-identical) and fail loudly
// on any diff over threshold or any file missing from either side.
/** One snapshot's verdict line, and whether it counts as a failure. */
async function compareOne(name, beforePath, afterPath) {
  let ratio;
  try {
    const [before, after] = await Promise.all([
      loadPng(beforePath),
      loadPng(afterPath),
    ]);
    ratio = pixelDiffRatio(before, after);
  } catch (err) {
    return {
      failed: true,
      line: `✗ ${name.padEnd(32)} ERROR (${err.message})`,
    };
  }

  const percent = `${(ratio * 100).toFixed(3)}% diff`;
  return ratio <= MAX_DIFF_PIXEL_RATIO
    ? {
        failed: false,
        line: `✓ ${name.padEnd(32)} ${percent} (within tolerance)`,
      }
    : { failed: true, line: `✗ ${name.padEnd(32)} ${percent} — DIFFERS` };
}

/**
 * A snapshot present on only one side cannot be compared, so it is reported as missing.
 *
 * A function declaration, not a `const` arrow: `diffSnapshots()` runs from a top-level
 * `await` near the top of this module, before any `const` below it is initialised, so an
 * arrow here threw a ReferenceError the first time a snapshot was missing.
 */
function missingLine(name, hasBefore) {
  return `✗ ${name.padEnd(32)} MISSING (${hasBefore ? "no after" : "no before"})`;
}

async function reportSnapshot(name, dirs, presence) {
  if (!presence.hasBefore || !presence.hasAfter) {
    console.log(missingLine(name, presence.hasBefore));
    return true;
  }
  const { failed, line } = await compareOne(
    name,
    path.join(dirs.beforeDir, name),
    path.join(dirs.afterDir, name),
  );
  console.log(line);
  return failed;
}

function reportDiffTotal(failures, total) {
  console.log();
  if (failures === 0) {
    console.log(`All ${total} snapshots match within tolerance.`);
    return;
  }
  console.error(
    `${failures} of ${total} snapshot(s) differ (beyond ${MAX_DIFF_PIXEL_RATIO * 100}% tolerance) or are missing.`,
  );
  process.exitCode = 1;
}

async function diffSnapshots() {
  const beforeDir = path.join(ROOT, ".visual", "before");
  const afterDir = path.join(ROOT, ".visual", "after");

  const [beforeFiles, afterFiles] = await Promise.all([
    readdir(beforeDir).catch(() => []),
    readdir(afterDir).catch(() => []),
  ]);
  const allNames = [...new Set([...beforeFiles, ...afterFiles])].sort();

  if (allNames.length === 0) {
    console.error(
      `No snapshots found in ${path.relative(ROOT, beforeDir)}/ or ` +
        `${path.relative(ROOT, afterDir)}/ — run visual:before and visual:after first.`,
    );
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  for (const name of allNames) {
    const failed = await reportSnapshot(
      name,
      { beforeDir, afterDir },
      {
        hasBefore: beforeFiles.includes(name),
        hasAfter: afterFiles.includes(name),
      },
    );
    if (failed) failures++;
  }

  reportDiffTotal(failures, allNames.length);
}

/** Starts `astro preview` detached, so the shots are taken against a built site. */
function startPreviewDaemon() {
  console.log(`Starting astro preview on port ${PORT}...`);
  spawn("pnpm", ["exec", "astro", "preview", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  }).unref();
}

/**
 * A page context pinned to one viewport and theme.
 *
 * `reducedMotion: "reduce"` is the load-bearing part: the globe's ambient rotation
 * (`src/lib/globe.ts`'s `requestAnimationFrame` loop) runs at real elapsed time, so a fixed wait
 * cannot land on the same angle across two process launches. `globe.ts` already skips ambient
 * rotation entirely when `prefers-reduced-motion` matches, so emulating it is what makes
 * home/zoned-earth deterministic rather than a workaround. The theme is set before any page
 * script runs, matching how `ThemeProvider.astro` reads localStorage on first paint.
 */
async function newThemedContext(browser, viewport, theme) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  await context.addInitScript((t) => {
    localStorage.setItem("starlight-theme", t);
  }, theme);
  return context;
}

async function shoot(page, outDir, fileName, clockMasks, options = {}) {
  await page.screenshot({
    path: path.join(outDir, fileName),
    mask: clockMasks,
    ...options,
  });
  console.log(`  captured ${fileName}`);
}

/** Every page in `PAGES`, full height. */
async function capturePages(page, outDir, clockMasks, theme, viewport) {
  for (const p of PAGES) {
    await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "networkidle" });
    // Let ambient globe rotation / any load-time animation settle to a consistent frame.
    await page.waitForTimeout(300);
    await shoot(
      page,
      outDir,
      `${p.slug}-${theme}-${viewport.name}.png`,
      clockMasks,
      { fullPage: true },
    );
  }
}

/** The search modal — desktop only, because its trigger is hidden on mobile in favour of the menu. */
async function captureSearchModal(page, outDir, clockMasks, theme, viewport) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.click("[data-open-modal]");
  await page.waitForSelector("dialog[open]", { state: "visible" });
  await page.waitForTimeout(150);
  await shoot(page, outDir, `search-${theme}-${viewport.name}.png`, clockMasks);
}

/**
 * The mobile menu — mobile only, since the sidebar is already open on desktop.
 *
 * `/install/` because it has a sidebar to toggle; `home` uses the splash template and never
 * renders the menu button. The wait is on `attached`, not `visible`: `aria-expanded` toggles on
 * the wrapping `<starlight-menu-button>` (see Starlight's `MobileMenuToggle.astro`), which has no
 * box of its own because its only child is `position: fixed`, so it never becomes "visible".
 */
async function captureMobileMenu(page, outDir, clockMasks, theme, viewport) {
  await page.goto(`${BASE_URL}/install/`, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Menu"]');
  await page.waitForSelector('starlight-menu-button[aria-expanded="true"]', {
    state: "attached",
  });
  await page.waitForTimeout(150);
  await shoot(page, outDir, `menu-${theme}-${viewport.name}.png`, clockMasks);
}

/**
 * One viewport/theme pass: every page, plus the one interaction state that viewport can show.
 *
 * The interaction shots exist so the DoD's "search modal" and "mobile menu" lines are captured
 * rather than asserted.
 */
async function captureOnePass(browser, outDir, viewport, theme) {
  const context = await newThemedContext(browser, viewport, theme);
  try {
    const page = await context.newPage();
    const clockMasks = LIVE_CLOCK_SELECTORS.map((sel) => page.locator(sel));
    await capturePages(page, outDir, clockMasks, theme, viewport);
    const captureInteraction =
      viewport.name === "desktop" ? captureSearchModal : captureMobileMenu;
    await captureInteraction(page, outDir, clockMasks, theme, viewport);
  } finally {
    await context.close();
  }
}

async function captureAll(outDir) {
  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        await captureOnePass(browser, outDir, viewport, theme);
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const outDir = path.join(ROOT, ".visual", label);
  await mkdir(outDir, { recursive: true });

  // Clear any daemon this project left running (e.g. from a prior interrupted run)
  // before starting a fresh one.
  await stopPreviewDaemon();
  startPreviewDaemon();

  try {
    await waitForOurServer(BASE_URL);
    await captureAll(outDir);
  } finally {
    await stopPreviewDaemon();
  }

  console.log(`Done. Screenshots in ${path.relative(ROOT, outDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
