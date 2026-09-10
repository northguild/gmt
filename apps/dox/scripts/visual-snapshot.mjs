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

// Page list — see design-system.md's "Verifying a change is visually safe": landing,
// a dense reference page, the two /tools pages this epic is actively changing, and one
// teaching-widget page (gmt-widget.css is touched by the Phase 1 cleanup).
const PAGES = [
  { slug: "home", path: "/" },
  { slug: "install", path: "/install/" },
  { slug: "zoned-earth", path: "/tools/zoned-earth/" },
  { slug: "zone-planner", path: "/tools/zone-planner/" },
  { slug: "dst-inspector", path: "/reference/zoned/get/getDstTransitions/" },
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
const LIVE_CLOCK_SELECTORS = [".gmt-clock-time", ".gmt-globe-tooltip-time"];

// Confirms both that something is listening on PORT and that it's actually serving
// THIS worktree's build, not a stray daemon left running by another worktree or an
// earlier run on the same port (see the PORT comment above).
async function waitForOurServer(url, timeoutMs = 30_000) {
  const start = Date.now();
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
      if (Date.now() - start > timeoutMs) {
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
    const beforePath = path.join(beforeDir, name);
    const afterPath = path.join(afterDir, name);
    const hasBefore = beforeFiles.includes(name);
    const hasAfter = afterFiles.includes(name);

    if (!hasBefore || !hasAfter) {
      console.log(
        `✗ ${name.padEnd(32)} MISSING (${hasBefore ? "no after" : "no before"})`,
      );
      failures++;
      continue;
    }

    let ratio;
    try {
      const [before, after] = await Promise.all([
        loadPng(beforePath),
        loadPng(afterPath),
      ]);
      ratio = pixelDiffRatio(before, after);
    } catch (err) {
      console.log(`✗ ${name.padEnd(32)} ERROR (${err.message})`);
      failures++;
      continue;
    }

    if (ratio <= MAX_DIFF_PIXEL_RATIO) {
      console.log(
        `✓ ${name.padEnd(32)} ${(ratio * 100).toFixed(3)}% diff (within tolerance)`,
      );
    } else {
      console.log(
        `✗ ${name.padEnd(32)} ${(ratio * 100).toFixed(3)}% diff — DIFFERS`,
      );
      failures++;
    }
  }

  console.log();
  if (failures > 0) {
    console.error(
      `${failures} of ${allNames.length} snapshot(s) differ (beyond ${MAX_DIFF_PIXEL_RATIO * 100}% tolerance) or are missing.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`All ${allNames.length} snapshots match within tolerance.`);
  }
}

async function main() {
  const outDir = path.join(ROOT, ".visual", label);
  await mkdir(outDir, { recursive: true });

  // Clear any daemon this project left running (e.g. from a prior interrupted run)
  // before starting a fresh one.
  await stopPreviewDaemon();

  console.log(`Starting astro preview on port ${PORT}...`);
  spawn("pnpm", ["exec", "astro", "preview", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  }).unref();

  try {
    await waitForOurServer(BASE_URL);

    const browser = await chromium.launch();
    try {
      for (const viewport of VIEWPORTS) {
        for (const theme of THEMES) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            // The globe's ambient auto-rotation (src/lib/globe.ts's
            // `requestAnimationFrame` loop) runs at real elapsed time, so a
            // fixed wait can't land on the same rotation angle across two
            // separate process launches — globe.ts already checks
            // `prefers-reduced-motion` and skips starting ambient rotation
            // entirely when it matches (`if (reduceMotion?.matches) return;`
            // before `ambientActive = true`), so emulating it here is what
            // makes home/zoned-earth deterministic, not a workaround.
            reducedMotion: "reduce",
          });
          // Set the theme before any page script runs, matching how
          // ThemeProvider.astro reads localStorage on first paint.
          await context.addInitScript((t) => {
            localStorage.setItem("starlight-theme", t);
          }, theme);
          const page = await context.newPage();
          const clockMasks = LIVE_CLOCK_SELECTORS.map((sel) =>
            page.locator(sel),
          );

          for (const p of PAGES) {
            await page.goto(`${BASE_URL}${p.path}`, {
              waitUntil: "networkidle",
            });
            // Let ambient globe rotation / any load-time animation settle to a
            // consistent frame before the shot.
            await page.waitForTimeout(300);
            const fileName = `${p.slug}-${theme}-${viewport.name}.png`;
            await page.screenshot({
              path: path.join(outDir, fileName),
              fullPage: true,
              mask: clockMasks,
            });
            console.log(`  captured ${fileName}`);
          }

          // Two interaction states, one per viewport, so the DoD's "search
          // modal" and "mobile menu" lines are actually captured rather than
          // asserted. Desktop-only for search (the trigger is hidden on
          // mobile in favor of the menu) and mobile-only for the menu (the
          // sidebar is already visible on desktop, so there's nothing to
          // toggle).
          if (viewport.name === "desktop") {
            await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
            await page.click("[data-open-modal]");
            await page.waitForSelector("dialog[open]", { state: "visible" });
            await page.waitForTimeout(150);
            const fileName = `search-${theme}-${viewport.name}.png`;
            await page.screenshot({
              path: path.join(outDir, fileName),
              mask: clockMasks,
            });
            console.log(`  captured ${fileName}`);
          } else {
            // `install` has a sidebar to toggle; `home` (splash template)
            // doesn't render the menu button at all.
            await page.goto(`${BASE_URL}/install/`, {
              waitUntil: "networkidle",
            });
            await page.click('button[aria-label="Menu"]');
            // `aria-expanded` toggles on the wrapping <starlight-menu-button>
            // custom element, not on the <button> itself — see
            // @astrojs/starlight/components/MobileMenuToggle.astro. That
            // wrapper has no box of its own (its only child is
            // `position: fixed`), so it never satisfies Playwright's default
            // "visible" wait — "attached" is the right state to wait for.
            await page.waitForSelector(
              'starlight-menu-button[aria-expanded="true"]',
              { state: "attached" },
            );
            await page.waitForTimeout(150);
            const fileName = `menu-${theme}-${viewport.name}.png`;
            await page.screenshot({
              path: path.join(outDir, fileName),
              mask: clockMasks,
            });
            console.log(`  captured ${fileName}`);
          }

          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    await stopPreviewDaemon();
  }

  console.log(`Done. Screenshots in ${path.relative(ROOT, outDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
