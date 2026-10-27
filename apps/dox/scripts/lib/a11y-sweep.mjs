/**
 * The shared frame of the three a11y gates (`a11y-axe.mjs`, `a11y-tab-walk.mjs`,
 * `a11y-media.mjs`): flags, the page list from `dist`, and one browser context per page, width and
 * theme, run a few at a time.
 *
 * A gate supplies `check({ page, path, width, browserName })`, which returns findings as
 * `{ rule, selector?, message }`. This module adds the page, browser, width and theme, writes each
 * through `recordFinding`, prints one line per cell, counts the cells it measured, and ends the run:
 * exit 0 when nothing failed, 1 for any finding or when nothing was measured.
 *
 * A cell is measured after `load`, `document.fonts.ready` and two animation frames.
 */
import { chromium, firefox, webkit } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockOffSite, emptyRunProblem } from "../gate-checks.mjs";
import { applyPageContract } from "../gates/contract.mjs";
import { recordFinding, recordMeasured } from "../gates/findings.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST_SITE = path.join(HERE, "../../dist/gmt");
const LAUNCHERS = { chromium, firefox, webkit };

/** Every `index.html` folder under `dist/gmt`, as site paths; exits 2 when `dist` is missing. */
export function distPages(gate) {
  if (!existsSync(path.join(DIST_SITE, "index.html"))) {
    console.error(
      `${gate}: apps/dox/dist/gmt/index.html is missing; build the site first (pnpm --filter dox gates builds it).`,
    );
    process.exit(2);
  }
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        walk(path.join(dir, entry.name), `${rel}${entry.name}/`);
      else if (entry.name === "index.html") out.push(rel);
    }
  };
  walk(DIST_SITE, "/");
  return out.sort();
}

/** The value after `--name` in `args`, or `fallback`. */
function opt(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
}

/**
 * Parse the shared flags and answer the page contract. `pages` is the gate's own page list;
 * `defaults.widths` its widths when `--widths` is absent.
 */
export function parseSweep({ gate, pages, defaults }) {
  const args = process.argv.slice(2);
  const selected = applyPageContract({ gate, pages, argv: args });
  const browsers = opt(args, "browsers", "chromium").split(",").filter(Boolean);
  for (const name of browsers) {
    if (!LAUNCHERS[name]) {
      console.error(
        `${gate}: unknown browser "${name}" (chromium, webkit, firefox)`,
      );
      process.exit(2);
    }
  }
  const theme = opt(args, "theme", "dark");
  if (theme !== "dark" && theme !== "light") {
    console.error(`${gate}: --theme takes dark or light`);
    process.exit(2);
  }
  const widths = opt(args, "widths", defaults.widths).split(",").map(Number);
  if (widths.some((w) => !Number.isInteger(w) || w < 200)) {
    console.error(`${gate}: --widths takes a comma list of pixel widths`);
    process.exit(2);
  }
  const concurrency = Number(opt(args, "concurrency", "4"));
  return {
    args,
    base: opt(args, "base", "http://127.0.0.1:48291/gmt").replace(/\/$/, ""),
    browsers,
    theme,
    widths,
    concurrency:
      Number.isInteger(concurrency) && concurrency > 0 ? concurrency : 4,
    pages: selected ?? pages,
  };
}

/**
 * `load`, then fonts, then two animation frames, then every `.gmt-grow` region at rest: the page
 * is as it will be for the reader. A region still easing to its height (`data-growing`, a JS frame
 * loop and not a CSS animation) is clipped at a stale height, so the text after it sits over it
 * and a target-size or focus-obscured reading is of a layout nobody rests on. The loop releases
 * every region within 4 s (`MAX_GROW_MS`), so the 10 s cap here is never the thing that ends the wait.
 */
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const growing = () => document.querySelector(".gmt-grow[data-growing]");
    // Done when none has been easing for a whole 500 ms: a region the widget mounts a beat late
    // starts its ease only then, so the first quiet frame is not the end.
    const until = performance.now() + 10000;
    let quietSince = null;
    while (performance.now() < until) {
      if (growing()) quietSince = null;
      else {
        quietSince ??= performance.now();
        if (performance.now() - quietSince >= 500) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Let running CSS transitions and finite CSS animations (an entrance fade) finish, at most `limit`
 * ms, so a computed style is not read half way between its two values. Looping animations are left.
 */
export async function settleTransitions(page, limit = 600) {
  await page.evaluate(async (ms) => {
    const running = () =>
      document.getAnimations().filter(
        (a) =>
          // A finished animation that fills forwards stays listed, with `finished` already
          // resolved: awaiting it again would spin the microtask queue and starve the timers.
          (a.playState === "running" || a.playState === "pending") &&
          (a instanceof CSSTransition ||
            Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)),
      );
    const settled = (async () => {
      // Waits for what runs, then looks again after a beat: a row the virtualizer mounts as a
      // list scrolls starts its own fade only once it exists, so one pass can miss it. Done
      // when a whole beat passes with nothing running.
      for (;;) {
        const now = running();
        if (now.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (running().length === 0) return;
          continue;
        }
        await Promise.all(now.map((a) => a.finished.catch(() => {})));
      }
    })();
    await Promise.race([
      settled,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }, limit);
}

/**
 * `/dox/` with the widget rail open: click the first example card, which mounts its widget in the
 * rail without waiting on the model. Returns a reason when the rail did not open, else null.
 */
export async function openRail(page) {
  const card = page.locator("[data-widget]").first();
  if ((await card.count()) === 0)
    return "no example card (a [data-widget] button) on the page";
  await card.click();
  try {
    await page
      .locator('[aria-label="Widget panel"]')
      .first()
      .waitFor({ timeout: 5000 });
  } catch {
    return "the example card did not open the widget panel";
  }
  await page.waitForTimeout(1500);
  await settle(page);
  return null;
}

/**
 * Run `check` for every page at every width in every browser. `contextOptions` is merged into each
 * context (the media gate sets `reducedMotion`). Returns nothing; the process exits.
 */
export async function sweep({
  gate,
  run,
  check,
  contextOptions = {},
  browserNote = () => "",
}) {
  const { base, browsers, theme, widths, concurrency, pages } = run;
  let measured = 0;
  let failedCells = 0;
  const started = performance.now();

  for (const browserName of browsers) {
    const browser = await LAUNCHERS[browserName].launch();
    const cells = pages.flatMap((p) =>
      widths.map((width) => ({ path: p, width })),
    );
    let next = 0;

    const work = async () => {
      while (next < cells.length) {
        const cell = cells[next++];
        const found = [];
        let ok = false;
        const context = await browser.newContext({
          viewport: { width: cell.width, height: 900 },
          colorScheme: theme,
          ...contextOptions,
        });
        try {
          await context.addInitScript((t) => {
            try {
              localStorage.setItem("starlight-theme", t);
            } catch {}
          }, theme);
          await blockOffSite(context, base);
          const page = await context.newPage();
          const res = await page.goto(base + cell.path, { waitUntil: "load" });
          if (!res || res.status() !== 200) {
            found.push({
              rule: "http-status",
              message: `the page answered HTTP ${res ? res.status() : "none"}, not 200`,
            });
          } else {
            await settle(page);
            found.push(
              ...(await check({
                page,
                context,
                path: cell.path,
                width: cell.width,
                browserName,
              })),
            );
            ok = true;
          }
        } catch (error) {
          found.push({
            rule: "check-crashed",
            message: `the check crashed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
          });
        } finally {
          await context.close().catch(() => {});
        }
        if (ok) measured++;
        if (found.length > 0) failedCells++;
        for (const f of found) {
          recordFinding({
            gate,
            rule: f.rule,
            page: cell.path,
            selector: f.selector ?? null,
            browser: browserName,
            width: cell.width,
            theme,
            message: f.message,
          });
        }
        console.log(
          `${found.length === 0 ? "ok  " : "FAIL"} ${browserName} ${cell.width}px ${cell.path}${browserNote(browserName)}`,
        );
        for (const f of found.slice(0, 5)) {
          console.log(
            `       ${f.rule}${f.selector ? `  ${f.selector}` : ""}  ${f.message}`,
          );
        }
        if (found.length > 5)
          console.log(`       … and ${found.length - 5} more in the report`);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, cells.length) }, work),
    );
    await browser.close();
  }

  const empty = emptyRunProblem(measured, "pages");
  if (empty) console.error(`${gate}: ${empty}`);
  recordMeasured(gate, measured);
  const seconds = ((performance.now() - started) / 1000).toFixed(0);
  console.log(
    `${gate}: ${failedCells === 0 && !empty ? "PASS" : "FAIL"}  ${measured} cells measured, ${failedCells} with findings  ${seconds}s`,
  );
  process.exit(failedCells > 0 || empty ? 1 : 0);
}
