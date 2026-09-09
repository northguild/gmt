#!/usr/bin/env node
/**
 * Visual regression harness (context/dox/reference/design-system.md, "Verifying a
 * change is visually safe").
 *
 * Not a full Playwright test suite — a small capture script. Boots `astro preview`
 * against the already-built `dist/`, screenshots a fixed page list in both themes and
 * two viewports, and saves PNGs under `.visual/<label>/`. Run `visual:before` on a clean
 * tree before a CSS/markup change, `visual:after` once the change lands, and diff the
 * two folders by eye (or any image diff tool) — a pure refactor must produce
 * byte-identical pairs for every page not intentionally touched by that change.
 *
 * Usage:
 *   pnpm run build && pnpm run visual:before   # capture the baseline
 *   ...make changes, pnpm run build...
 *   pnpm run visual:after                      # capture the comparison set
 */

import { chromium } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
if (label !== "before" && label !== "after") {
  console.error("Usage: node scripts/visual-snapshot.mjs <before|after>");
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
          });
          // Set the theme before any page script runs, matching how
          // ThemeProvider.astro reads localStorage on first paint.
          await context.addInitScript((t) => {
            localStorage.setItem("starlight-theme", t);
          }, theme);
          const page = await context.newPage();

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
