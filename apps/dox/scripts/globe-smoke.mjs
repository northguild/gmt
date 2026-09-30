/**
 * The globe's GPU gate (#289).
 *
 * CI has no GPU, and jsdom has no WebGPU, so nothing in `pnpm test` can prove a
 * shader compiles or that the globe draws anything. This script does, against a
 * real browser and a real adapter. It is the globe's equivalent of
 * `visual-snapshot.mjs`: run it locally before calling globe work done.
 *
 * What it checks, per page and per renderer:
 *
 * - the expected backend actually started (`data-renderer` on the canvas);
 * - no console error, page error or uncaptured GPU error appeared;
 * - the canvas is not blank;
 * - the WebGPU and canvas-2D renderings of the same frame agree, pixel for
 *   pixel, within a threshold — the parity that keeps the fallback honest;
 * - the fallback takes over when WebGPU is unavailable, without the reader
 *   seeing a failure;
 * - drag, keyboard and zoom all move the globe.
 *
 * The clock is pinned so both renderers see the same instant — otherwise the
 * terminator moves between captures and every comparison is noise.
 *
 * Usage, from `apps/dox`:
 *
 *     pnpm build && pnpm globe:smoke
 *
 * **This needs a real GPU.** Playwright's `channel: "chromium"` provides one.
 * The headless shell with `--enable-unsafe-webgpu` does expose a SwiftShader
 * software adapter, but measured against this workload it drops its GPU instance
 * partway through a frame ("a valid external Instance reference no longer
 * exists"), so it cannot be the gate. `GLOBE_SMOKE_SOFTWARE=1` selects it anyway,
 * which is useful for one thing: watching the globe survive a GPU that goes away.
 * It falls back to canvas-2D and stays usable, which is the behaviour the
 * fallback exists for.
 */

import { chromium } from "@playwright/test";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const DOX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(DOX, "dist");
const OUT = path.join(DOX, ".globe-smoke");

/**
 * A fixed instant, so both renderers place the sun identically.
 *
 * `page.clock` installs it before any script runs, so the globe's own
 * `getUnixNow()` reports it too. Handed over as the ISO string, which Playwright
 * accepts directly — `new Date` is banned repo-wide (`date-ban.test.ts`), and
 * this file is inside the scanned tree.
 */
const FIXED_INSTANT = "2026-03-20T09:30:00Z";

/** The pages the globe appears on, and the size to check each at. */
const PAGES = [
  { name: "home", route: "/", width: 1440, height: 900 },
  {
    name: "zoned-earth",
    route: "/tools/zoned-earth/",
    width: 1440,
    height: 900,
  },
  {
    name: "zoned-earth-mobile",
    route: "/tools/zoned-earth/",
    width: 390,
    height: 844,
  },
];

/** Zoom levels to compare at, since zoom changes line widths and label rules. */
const ZOOMS = [1, 3];

/**
 * How far the two renderers may differ.
 *
 * They are different rasterisers, so thin translucent strokes and antialiased
 * text never match exactly. The labels differ by design as well: the GPU path
 * samples a texture atlas while the fallback draws text straight to the canvas.
 * What this threshold is really guarding is the *shape* of the globe — a missing
 * landmass, a mis-projected coastline or a lost layer moves it by far more.
 */
const MAX_DIFF_RATIO = 0.08;
const PIXELMATCH_THRESHOLD = 0.2;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
};

function serve(root) {
  const server = createServer((request, response) => {
    const requested = decodeURIComponent((request.url ?? "/").split("?")[0]);
    let file = path.join(root, requested);
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    if (!existsSync(file)) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type":
        CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    // Localhost, which is a secure context, so `navigator.gpu` is exposed.
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, base: `http://localhost:${server.address().port}` }),
    );
  });
}

/**
 * Try for a real GPU first, then a software adapter.
 *
 * `GLOBE_SMOKE_SOFTWARE=1` skips straight to SwiftShader. See this file's header:
 * that adapter is not stable enough to gate on, and the run is expected to end
 * with the globe falling back to canvas-2D.
 */
async function launch() {
  const attempts = [
    {
      label: "chromium channel (hardware adapter)",
      options: { channel: "chromium" },
    },
    {
      label: "headless shell with SwiftShader",
      options: { args: ["--enable-unsafe-webgpu"] },
    },
  ];
  if (process.env.GLOBE_SMOKE_SOFTWARE === "1") attempts.shift();
  for (const attempt of attempts) {
    let browser;
    try {
      browser = await chromium.launch(attempt.options);
    } catch {
      continue;
    }
    const page = await browser.newPage();
    const { server, base } = await serve(DIST);
    let adapter = null;
    try {
      await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
      adapter = await page.evaluate(async () => {
        if (!("gpu" in navigator)) return null;
        const found = await navigator.gpu.requestAdapter();
        return found ? (found.info?.architecture ?? "unknown") : null;
      });
    } catch {
      adapter = null;
    }
    await page.close();
    server.close();
    if (adapter) return { browser, adapter, label: attempt.label };
    await browser.close();
  }
  return null;
}

const failures = [];
const notes = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

/** Load a page with a pinned clock and collect anything that went wrong. */
async function open(browser, base, { route, width, height }, query) {
  const page = await browser.newPage({ viewport: { width, height } });
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  await page.clock.install({ time: FIXED_INSTANT });
  await page.goto(`${base}${route}${query}`, { waitUntil: "networkidle" });
  const stage = page.locator(".gmt-globe-stage").first();
  await stage.waitFor({ state: "visible", timeout: 15_000 });
  /* The globe mounts on an IntersectionObserver and reveals over a transition,
     so give it a beat before reading pixels. */
  await page.waitForTimeout(2500);
  return { page, stage, problems };
}

async function readState(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".gmt-globe");
    const canvas = root?.querySelector("canvas.gmt-globe-canvas") ?? null;
    return {
      renderer: canvas?.dataset?.renderer ?? null,
      unavailable: root?.dataset?.state === "unavailable",
      canvasSize: canvas ? [canvas.width, canvas.height] : null,
      clockRows:
        root?.querySelectorAll('[data-role="clocks"] [role="option"]').length ??
        0,
    };
  });
}

/**
 * True when a capture is a flat colour, which is what a globe that failed to
 * draw looks like.
 *
 * Measured by how many pixels differ from the capture's own mean, not by alpha:
 * the stage is screenshotted against the page, so every pixel comes back opaque
 * whether the globe drew or not.
 */
function isBlank(png) {
  let total = 0;
  const pixels = png.data.length / 4;
  for (let i = 0; i < png.data.length; i += 4) {
    total += png.data[i] + png.data[i + 1] + png.data[i + 2];
  }
  const mean = total / (pixels * 3);
  let varied = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const value = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
    if (Math.abs(value - mean) > 6) varied++;
  }
  // A drawn globe fills most of a square stage; well under a fifth means nothing.
  return varied < pixels / 5;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error("globe-smoke: no dist/ — run `pnpm build` first.");
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const launched = await launch();
  if (!launched) {
    console.error(
      "globe-smoke: no WebGPU adapter available in any browser configuration.\n" +
        "This gate cannot pass without one — it exists to prove the shaders compile\n" +
        "and the globe draws. Install Playwright's chromium channel\n" +
        "(`npx playwright install chromium`) and try again.",
    );
    process.exit(1);
  }
  const { browser, adapter, label } = launched;
  console.log(
    `globe-smoke: ${label}, adapter "${adapter}", clock pinned to ${FIXED_INSTANT}`,
  );

  const { server, base } = await serve(DIST);

  for (const target of PAGES) {
    for (const zoom of ZOOMS) {
      const shots = {};
      for (const renderer of ["webgpu", "canvas2d"]) {
        const { page, stage, problems } = await open(
          browser,
          base,
          target,
          `?globe=${renderer}`,
        );
        const state = await readState(page);

        check(
          state.renderer === renderer,
          `${target.name} @${zoom}: expected the ${renderer} renderer, got ${state.renderer}`,
        );
        check(
          !state.unavailable,
          `${target.name} @${zoom} (${renderer}): the widget reported itself unavailable`,
        );
        check(
          state.clockRows > 0,
          `${target.name} @${zoom} (${renderer}): the zone clock list is empty`,
        );
        for (const problem of problems) {
          failures.push(`${target.name} @${zoom} (${renderer}): ${problem}`);
        }

        if (zoom !== 1) {
          await page.evaluate((factor) => {
            const button = document.querySelector("[data-globe-zoom='in']");
            for (let i = 0; i < factor; i++) button?.click();
          }, zoom);
          await page.waitForTimeout(900);
        }

        const file = path.join(OUT, `${target.name}-z${zoom}-${renderer}.png`);
        await stage.screenshot({ path: file });
        shots[renderer] = PNG.sync.read(
          await stage.screenshot({ type: "png" }),
        );
        check(
          !isBlank(shots[renderer]),
          `${target.name} @${zoom} (${renderer}): the canvas is blank`,
        );
        await page.close();
      }

      // Parity between the two renderings of the same frame.
      const a = shots.webgpu;
      const b = shots.canvas2d;
      if (a && b && a.width === b.width && a.height === b.height) {
        const diff = new PNG({ width: a.width, height: a.height });
        const changed = pixelmatch(
          a.data,
          b.data,
          diff.data,
          a.width,
          a.height,
          { threshold: PIXELMATCH_THRESHOLD },
        );
        const ratio = changed / (a.width * a.height);
        writeFileSync(
          path.join(OUT, `${target.name}-z${zoom}-diff.png`),
          PNG.sync.write(diff),
        );
        notes.push(
          `${target.name} @${zoom}: ${(ratio * 100).toFixed(2)}% of pixels differ between renderers`,
        );
        check(
          ratio <= MAX_DIFF_RATIO,
          `${target.name} @${zoom}: renderers differ on ${(ratio * 100).toFixed(2)}% of pixels (limit ${(MAX_DIFF_RATIO * 100).toFixed(0)}%)`,
        );
      } else if (a && b) {
        failures.push(`${target.name} @${zoom}: captures differ in size`);
      }
    }
  }

  // --- the fallback, with WebGPU hidden from the page -----------------------
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const problems = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    /* Hiding `navigator.gpu` rather than adding a product flag: this is exactly
       what a browser without WebGPU looks like, and it keeps the test out of the
       shipped code. */
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "gpu", {
        get: () => undefined,
        configurable: true,
      });
    });
    await page.clock.install({ time: FIXED_INSTANT });
    await page.goto(`${base}/tools/zoned-earth/`, { waitUntil: "networkidle" });
    await page
      .locator(".gmt-globe-stage")
      .first()
      .waitFor({ state: "visible" });
    await page.waitForTimeout(2500);
    const state = await readState(page);
    check(
      state.renderer === "canvas2d",
      `no-WebGPU fallback: expected canvas2d, got ${state.renderer}`,
    );
    check(
      !state.unavailable,
      "no-WebGPU fallback: the widget reported itself unavailable",
    );
    for (const problem of problems)
      failures.push(`no-WebGPU fallback: ${problem}`);
    await page.close();
  }

  // --- interaction ---------------------------------------------------------
  {
    const { page, stage } = await open(
      browser,
      base,
      PAGES[1],
      "?globe=webgpu",
    );
    const box = await stage.boundingBox();
    const rotationOf = () =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas.gmt-globe-canvas");
        return canvas ? canvas.getAttribute("data-probe-rotation") : null;
      });

    // Drag: the globe must move, and the page must not scroll under it.
    const before = await stage.screenshot({ type: "png" });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const afterDrag = await stage.screenshot({ type: "png" });
    check(
      Buffer.compare(before, afterDrag) !== 0,
      "interaction: dragging did not change the globe",
    );

    // Keyboard: the canvas is focusable and the arrow keys rotate it.
    await page.locator("canvas.gmt-globe-canvas").first().focus();
    const beforeKey = await stage.screenshot({ type: "png" });
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(900);
    const afterKey = await stage.screenshot({ type: "png" });
    check(
      Buffer.compare(beforeKey, afterKey) !== 0,
      "interaction: the arrow keys did not rotate the globe",
    );

    // Zoom buttons. The cluster is ambient chrome, hidden and inert until the
    // stage is hovered or focused, so hover it first as a reader would.
    await stage.hover();
    const beforeZoom = await stage.screenshot({ type: "png" });
    await page.locator("[data-globe-zoom='in']").first().click();
    await page.waitForTimeout(900);
    const afterZoom = await stage.screenshot({ type: "png" });
    check(
      Buffer.compare(beforeZoom, afterZoom) !== 0,
      "interaction: the zoom-in button did nothing",
    );

    /* The wheel at the zoom floor belongs to the page, not the globe: a reader
       who scrolls onto the hero must not get stuck on it. */
    await stage.hover();
    await page.locator("[data-globe-zoom='reset']").first().click();
    await page.waitForTimeout(900);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(400);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    check(
      scrollAfter > scrollBefore,
      "interaction: the wheel at the zoom floor did not let the page scroll",
    );
    void rotationOf;
    await page.close();
  }

  server.close();
  await browser.close();

  for (const note of notes) console.log(`  ${note}`);
  if (failures.length > 0) {
    console.error(`\nglobe-smoke: ${failures.length} failure(s)`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(`\nCaptures and diffs are in ${path.relative(DOX, OUT)}/`);
    process.exit(1);
  }
  console.log(
    `\nglobe-smoke: all checks passed. Captures in ${path.relative(DOX, OUT)}/`,
  );
}

await main();
