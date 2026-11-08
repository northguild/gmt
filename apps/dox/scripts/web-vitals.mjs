#!/usr/bin/env node
/**
 * Core Web Vitals for three pages of the Dox site, by hand. Not a gate; no CI job runs it.
 *
 * Pages: the home page (the globe hero), a guide and a reference page. Each is measured four ways:
 *
 * - Lighthouse, mobile and desktop presets, `--runs` runs each (default 3): the median LCP, CLS
 *   and TBT. TBT is Lighthouse's lab stand-in for INP.
 * - INP, in Playwright Chromium with 4x CPU throttling and the `web-vitals` library: the page
 *   loads, then does what a reader does (opens search with Ctrl+K and types; opens and closes the
 *   mobile menu at 390x844; toggles the theme; on the home page, drags the globe once).
 * - The PageSpeed Insights API, read-only, for the same pages on a live origin: lab numbers and
 *   the CrUX field data, or "no field data" when the site has none.
 *
 * Thresholds ("good" at the 75th percentile, web.dev/articles/vitals): LCP <= 2.5 s, CLS <= 0.1,
 * INP <= 200 ms. TBT <= 200 ms is Lighthouse's own mark.
 *
 * Usage, from `apps/dox`, against a served `dist` (`npx serve`-style, any free port) and/or the
 * live origin:
 *
 *     node scripts/web-vitals.mjs --origin http://127.0.0.1:4500 [--live https://northguild.dev]
 *         [--runs 3] [--skip lighthouse,inp,psi]
 *
 * `--origin` serves the site's root, so the pages are `<origin>/gmt/...`. The PSI call needs no key
 * at a low request rate; set `PSI_API_KEY` in the environment for a higher quota, and never write
 * it into a file. Lighthouse runs through `npx` at the pinned version below and uses the Chromium
 * that Playwright installed.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

/** Pinned: a range would let the numbers move between runs of this script. */
const LIGHTHOUSE = "lighthouse@13.5.0";
const WEB_VITALS =
  "https://cdn.jsdelivr.net/npm/web-vitals@5.1.0/dist/web-vitals.attribution.iife.js";

const PAGES = [
  { name: "home", path: "/gmt/", globe: true },
  { name: "guide", path: "/gmt/guides/how-to/add-business-days/" },
  { name: "reference", path: "/gmt/reference/zoned/calculate/startOfZoned/" },
];

const { values } = parseArgs({
  options: {
    origin: { type: "string" },
    live: { type: "string" },
    runs: { type: "string", default: "3" },
    skip: { type: "string", default: "" },
  },
});
const skip = new Set(values.skip.split(",").filter(Boolean));
const runs = Number(values.runs);
if (!values.origin && !values.live) {
  console.error("Pass --origin <served dist> and/or --live <origin>.");
  process.exit(1);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const fmt = (n, unit = "") =>
  n === undefined || Number.isNaN(n)
    ? "-"
    : `${Math.round(n * 1000) / 1000}${unit}`;

/** One Lighthouse run's LCP (ms), CLS and TBT (ms). */
function lighthouseRun(url, preset) {
  const dir = mkdtempSync(join(tmpdir(), "lh-"));
  const out = join(dir, "r.json");
  const args = [
    "--yes",
    LIGHTHOUSE,
    url,
    "--output=json",
    `--output-path=${out}`,
    "--quiet",
    "--only-categories=performance",
    "--chrome-flags=--headless=new --no-sandbox",
    ...(preset === "desktop" ? ["--preset=desktop"] : []),
  ];
  const result = spawnSync("npx", args, {
    encoding: "utf8",
    env: { ...process.env, CHROME_PATH: chromium.executablePath() },
  });
  if (result.status !== 0)
    throw new Error(`lighthouse failed: ${result.stderr}`);
  const audits = JSON.parse(readFileSync(out, "utf8")).audits;
  rmSync(dir, { recursive: true, force: true });
  return {
    lcp: audits["largest-contentful-paint"].numericValue,
    cls: audits["cumulative-layout-shift"].numericValue,
    tbt: audits["total-blocking-time"].numericValue,
  };
}

/** INP of one page under 4x CPU throttling, after the reader's interactions. */
async function inpOf(browser, url, globe) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(url, { waitUntil: "load" });
  // Let the page settle first: a reader's first click comes after the load, and an interaction made
  // while the globe is still starting would measure the start, not the page.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.addScriptTag({ url: WEB_VITALS });
  await page.evaluate(() => {
    window.__inp = [];
    window.webVitals.onINP((m) => window.__inp.push(m.value), {
      reportAllChanges: true,
    });
  });
  const pause = () => page.waitForTimeout(400);
  // Search: Ctrl+K opens it, a word narrows it, Escape closes it.
  await page.keyboard.press("Control+k");
  await pause();
  await page.keyboard.type("zoned", { delay: 60 });
  await pause();
  await page.keyboard.press("Escape");
  await pause();
  // Theme toggle.
  const theme = page
    .locator("button[aria-label*='theme' i], starlight-theme-select select")
    .first();
  if (await theme.count()) {
    await theme.click().catch(() => {});
    await pause();
  }
  // Mobile menu at 390x844.
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page
    .locator("starlight-menu-button button, button[aria-label*='menu' i]")
    .first();
  if (await menu.count()) {
    await menu.click().catch(() => {});
    await pause();
    await menu.click().catch(() => {});
    await pause();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Home: one drag across the globe.
  if (globe) {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 120,
        box.y + box.height / 2,
        { steps: 12 },
      );
      await page.mouse.up();
      await pause();
    }
  }
  // On a busy page the library reports late: give it time to.
  await page.waitForTimeout(2000);
  // INP is only reported once the page is hidden or on a change; read the last value.
  const values = await page.evaluate(() => window.__inp);
  await context.close();
  // No value means no interaction took 16 ms (the Event Timing floor) or longer.
  return values.length ? values[values.length - 1] : undefined;
}

/** PageSpeed Insights for one URL and strategy: lab numbers and CrUX field data (or none). */
async function psi(url, strategy) {
  const key = process.env.PSI_API_KEY ? `&key=${process.env.PSI_API_KEY}` : "";
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance${key}`;
  const res = await fetch(api);
  if (!res.ok)
    throw new Error(
      `PSI ${res.status} for ${url}: ${(await res.text()).slice(0, 200)}`,
    );
  const body = await res.json();
  const a = body.lighthouseResult.audits;
  const field = body.loadingExperience?.metrics;
  return {
    lcp: a["largest-contentful-paint"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    field: field
      ? {
          lcp: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
          cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile / 100,
          inp: field.INTERACTION_TO_NEXT_PAINT?.percentile,
        }
      : undefined,
  };
}

const rows = [];
const row = (...cells) => rows.push(cells);
row("source", "page", "LCP", "CLS", "TBT or INP");

if (values.origin && !skip.has("lighthouse")) {
  for (const preset of ["mobile", "desktop"]) {
    for (const p of PAGES) {
      const rs = Array.from({ length: runs }, () =>
        lighthouseRun(values.origin + p.path, preset),
      );
      row(
        `lab ${preset}`,
        p.name,
        fmt(median(rs.map((r) => r.lcp)), " ms"),
        fmt(median(rs.map((r) => r.cls))),
        `TBT ${fmt(median(rs.map((r) => r.tbt)), " ms")}`,
      );
    }
  }
}
if (values.origin && !skip.has("inp")) {
  // The globe draws with WebGPU where the browser has it and falls back to canvas 2D where not.
  // Playwright's `chromium` channel has a GPU; the default headless shell has none, so it measures
  // the fallback. Both are reader paths, so both are measured.
  for (const [label, options] of [
    ["webgpu", { channel: "chromium" }],
    ["canvas2d", {}],
  ]) {
    const browser = await chromium.launch(options);
    for (const p of PAGES) {
      const inp = await inpOf(browser, values.origin + p.path, p.globe);
      row(
        `INP 4x CPU ${label}`,
        p.name,
        "-",
        "-",
        inp === undefined ? "INP none >= 16 ms" : `INP ${fmt(inp, " ms")}`,
      );
    }
    await browser.close();
  }
}
if (values.live && !skip.has("psi")) {
  for (const strategy of ["mobile", "desktop"]) {
    for (const p of PAGES) {
      const r = await psi(values.live + p.path, strategy);
      row(
        `PSI ${strategy}`,
        p.name,
        fmt(r.lcp, " ms"),
        fmt(r.cls),
        `TBT ${fmt(r.tbt, " ms")}`,
      );
      row(
        `CrUX ${strategy}`,
        p.name,
        r.field ? fmt(r.field.lcp, " ms") : "no field data",
        r.field ? fmt(r.field.cls) : "-",
        r.field ? `INP ${fmt(r.field.inp, " ms")}` : "-",
      );
    }
  }
}

const widths = rows[0].map((_, i) =>
  Math.max(...rows.map((r) => String(r[i]).length)),
);
for (const r of rows)
  console.log(r.map((c, i) => String(c).padEnd(widths[i])).join("  "));
