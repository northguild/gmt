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
 * And for the Earth imagery (#293), which only the WebGPU renderer draws:
 *
 * - the parity comparison runs with the image withheld, so it compares the
 *   vector layers alone — the base layer differs between the renderers by
 *   design. Withholding it is also the failed-load path: the globe has to come
 *   out flat and whole, not broken;
 * - with the image allowed, WebGPU in the dark theme — and in the landing
 *   hero, a dark island, in the light theme too — requests it once and draws
 *   it, while the rest of the light theme, canvas-2D, the no-WebGPU fallback,
 *   raised contrast, forced colours and a reference page never request it;
 * - at 5× the imagery has faded out, and the WebGPU globe matches its own
 *   flat rendering.
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
/**
 * The pages the globe appears on, and the size to check each at. `darkHero`
 * marks the landing hero, a dark island that shows the imagery in the light
 * theme too; every other globe is flat in the light theme.
 */
const PAGES = [
  { name: "home", route: "/", width: 1440, height: 900, darkHero: true },
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

/**
 * Presses of the zoom-in button (×1.4 each) to compare at, since zoom changes
 * line widths and label rules. Five clamps at the 5× top of the range, where
 * the imagery has faded out.
 */
const ZOOMS = [0, 3, 5];
const TOP_ZOOM_PRESSES = 5;

/** The zoom a number of presses lands on, for messages: `1×`, `2.74×`, `5×`. */
function zoomLabel(presses) {
  const zoom = Math.min(1.4 ** presses, 5);
  return `${Number(zoom.toFixed(2))}×`;
}

/** The Earth imagery, which only the WebGPU renderer fetches. */
const IMAGERY_PATH = "/earth-blue-marble.webp";

/** A reference page, which must load no globe code and no image. */
const REFERENCE_ROUTE = "/reference/zoned/calculate/addZoned/";

/**
 * The share of the stage the imagery has to change to count as drawn. It
 * replaces the whole sphere's base layer, so a real draw changes far more;
 * this only has to tell "drew" from "did not".
 */
const MIN_IMAGERY_RATIO = 0.15;

/**
 * A finer pixelmatch threshold for that check. The dark theme's flat sphere
 * is a near-black wash and the imagery's ocean a deep blue, a change the
 * parity threshold above is tuned to forgive.
 */
const IMAGERY_PIXELMATCH_THRESHOLD = 0.05;

/**
 * How far the WebGPU globe at 5× may differ from its own flat rendering. The
 * imagery has faded out there, and both captures are taken still, with the
 * tooltip's ticking clock masked, so the two should be the same picture.
 */
const MAX_FADED_RATIO = 0.005;

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

/**
 * Load a page with a pinned clock and collect anything that went wrong.
 *
 * `theme` is set the way `ThemeProvider.astro` reads it on first paint, so it
 * is in force before any globe code runs; left out, the page takes its own
 * default. `withholdImagery` fails the image request at the network, and
 * `emulate` passes media emulation (`contrast`, `forcedColors`) to the page.
 */
async function open(
  browser,
  base,
  { route, width, height },
  query,
  { theme, withholdImagery = false, emulate = {}, waitForStage = true } = {},
) {
  const page = await browser.newPage({
    viewport: { width, height },
    ...emulate,
  });
  const problems = [];
  const imagery = { requests: 0, statuses: [] };
  const requests = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The withheld image failing is the point of that run, not a problem.
    if (withholdImagery && /Failed to load resource/.test(message.text()))
      return;
    problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    requests.push(request.url());
    if (new URL(request.url()).pathname === IMAGERY_PATH) imagery.requests++;
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === IMAGERY_PATH) {
      imagery.statuses.push(response.status());
    }
  });
  if (withholdImagery) {
    await page.route(`**${IMAGERY_PATH}`, (request) => request.abort());
  }
  if (theme) {
    await page.addInitScript((value) => {
      localStorage.setItem("starlight-theme", value);
    }, theme);
  }
  await page.clock.install({ time: FIXED_INSTANT });
  await page.goto(`${base}${route}${query}`, { waitUntil: "networkidle" });
  const stage = page.locator(".gmt-globe-stage").first();
  if (waitForStage) {
    await stage.waitFor({ state: "visible", timeout: 15_000 });
    /* The globe mounts on an IntersectionObserver, reveals over a transition,
       and fades the imagery in once it lands, so give it a beat before
       reading pixels. */
    await page.waitForTimeout(2500);
  }
  return { page, stage, problems, imagery, requests };
}

/** Press zoom-in `presses` times and let the ease settle. */
async function zoomIn(page, presses) {
  if (presses === 0) return;
  await page.evaluate((count) => {
    const button = document.querySelector("[data-globe-zoom='in']");
    for (let i = 0; i < count; i++) button?.click();
  }, presses);
  await page.waitForTimeout(900);
}

/** The share of pixels that differ between two same-sized captures. */
function diffRatio(a, b, file, threshold = PIXELMATCH_THRESHOLD) {
  if (a.width !== b.width || a.height !== b.height) return null;
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold,
  });
  if (file) writeFileSync(path.join(OUT, file), PNG.sync.write(diff));
  return changed / (a.width * a.height);
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
        const { page, stage, problems, imagery } = await open(
          browser,
          base,
          target,
          `?globe=${renderer}`,
          { withholdImagery: renderer === "webgpu" },
        );
        const state = await readState(page);

        check(
          state.renderer === renderer,
          `${target.name} @${zoomLabel(zoom)}: expected the ${renderer} renderer, got ${state.renderer}`,
        );
        check(
          !state.unavailable,
          `${target.name} @${zoomLabel(zoom)} (${renderer}): the widget reported itself unavailable`,
        );
        check(
          state.clockRows > 0,
          `${target.name} @${zoomLabel(zoom)} (${renderer}): the zone clock list is empty`,
        );
        if (renderer === "canvas2d") {
          check(
            imagery.requests === 0,
            `${target.name} @${zoomLabel(zoom)} (canvas2d): requested the Earth imagery, which only WebGPU draws`,
          );
        }
        for (const problem of problems) {
          failures.push(
            `${target.name} @${zoomLabel(zoom)} (${renderer}): ${problem}`,
          );
        }

        await zoomIn(page, zoom);

        const file = path.join(OUT, `${target.name}-z${zoom}-${renderer}.png`);
        await stage.screenshot({ path: file });
        shots[renderer] = PNG.sync.read(
          await stage.screenshot({ type: "png" }),
        );
        check(
          !isBlank(shots[renderer]),
          `${target.name} @${zoomLabel(zoom)} (${renderer}): the canvas is blank`,
        );
        await page.close();
      }

      /* Parity between the two renderings of the same frame. The WebGPU one
         had its imagery withheld, so this compares the vector layers alone. */
      const a = shots.webgpu;
      const b = shots.canvas2d;
      const ratio =
        a && b ? diffRatio(a, b, `${target.name}-z${zoom}-diff.png`) : null;
      if (ratio !== null) {
        notes.push(
          `${target.name} @${zoomLabel(zoom)}: ${(ratio * 100).toFixed(2)}% of pixels differ between renderers`,
        );
        check(
          ratio <= MAX_DIFF_RATIO,
          `${target.name} @${zoomLabel(zoom)}: renderers differ on ${(ratio * 100).toFixed(2)}% of pixels (limit ${(MAX_DIFF_RATIO * 100).toFixed(0)}%)`,
        );
      } else if (a && b) {
        failures.push(
          `${target.name} @${zoomLabel(zoom)}: captures differ in size`,
        );
      }
    }
  }

  // --- the Earth imagery ---------------------------------------------------
  for (const target of PAGES) {
    /* The dark theme draws the imagery: at rest the image is requested once,
       arrives, and changes the globe from its own flat rendering. */
    {
      const theme = "dark";
      const label = `${target.name} imagery (${theme})`;
      const captures = {};
      for (const withholdImagery of [true, false]) {
        const { page, stage, problems, imagery } = await open(
          browser,
          base,
          target,
          "?globe=webgpu",
          { theme, withholdImagery },
        );
        const state = await readState(page);
        check(
          state.renderer === "webgpu",
          `${label}: expected the webgpu renderer, got ${state.renderer}`,
        );
        for (const problem of problems) failures.push(`${label}: ${problem}`);
        if (!withholdImagery) {
          check(
            imagery.requests === 1,
            `${label}: expected one request for the image, saw ${imagery.requests}`,
          );
          check(
            imagery.statuses.includes(200),
            `${label}: the image did not arrive (${imagery.statuses.join(", ") || "no response"})`,
          );
          await stage.screenshot({
            path: path.join(OUT, `${target.name}-imagery-${theme}.png`),
          });
        }
        captures[withholdImagery ? "flat" : "shown"] = PNG.sync.read(
          await stage.screenshot({ type: "png" }),
        );
        await page.close();
      }
      const ratio = diffRatio(
        captures.flat,
        captures.shown,
        `${target.name}-imagery-${theme}-diff.png`,
        IMAGERY_PIXELMATCH_THRESHOLD,
      );
      notes.push(
        `${label}: imagery changes ${(ratio * 100).toFixed(2)}% of pixels`,
      );
      check(
        ratio !== null && ratio >= MIN_IMAGERY_RATIO,
        `${label}: the imagery did not draw (${((ratio ?? 0) * 100).toFixed(2)}% changed, need ${(MIN_IMAGERY_RATIO * 100).toFixed(0)}%)`,
      );
    }

    /* The light theme turns the imagery off — no request — except in the
       landing hero, which keeps the dark theme and so shows it. */
    {
      const label = `${target.name} imagery (light)`;
      const expected = target.darkHero ? 1 : 0;
      const { page, problems, imagery } = await open(
        browser,
        base,
        target,
        "?globe=webgpu",
        { theme: "light" },
      );
      const state = await readState(page);
      check(
        state.renderer === "webgpu",
        `${label}: expected the webgpu renderer, got ${state.renderer}`,
      );
      for (const problem of problems) failures.push(`${label}: ${problem}`);
      check(
        imagery.requests === expected,
        target.darkHero
          ? `${label}: expected one request for the image in the dark hero, saw ${imagery.requests}`
          : `${label}: requested the Earth imagery, which the light theme turns off`,
      );
      await page.close();
    }

    /* At 5× the imagery has faded out: the globe is its own flat rendering,
       which the parity loop has already held against canvas-2D. Both captures
       are taken with reduced motion, so the ambient spin cannot move the globe
       between them, and with the tooltip masked, so its clock cannot tick. */
    const still = {};
    for (const withholdImagery of [true, false]) {
      const { page, stage, problems, imagery } = await open(
        browser,
        base,
        target,
        "?globe=webgpu",
        {
          theme: "dark",
          withholdImagery,
          emulate: { reducedMotion: "reduce" },
        },
      );
      for (const problem of problems) {
        failures.push(
          `${target.name} imagery @${zoomLabel(TOP_ZOOM_PRESSES)}: ${problem}`,
        );
      }
      /* Without this the comparison below passes for a globe whose image
         simply never arrived. */
      if (!withholdImagery) {
        check(
          imagery.statuses.includes(200),
          `${target.name} imagery @${zoomLabel(TOP_ZOOM_PRESSES)}: the image did not arrive, so the fade-out proves nothing`,
        );
      }
      await zoomIn(page, TOP_ZOOM_PRESSES);
      still[withholdImagery ? "flat" : "shown"] = PNG.sync.read(
        await stage.screenshot({
          type: "png",
          mask: [page.locator(".gmt-globe-tooltip")],
        }),
      );
      await page.close();
    }
    {
      const ratio = diffRatio(
        still.flat,
        still.shown,
        `${target.name}-z${TOP_ZOOM_PRESSES}-imagery-diff.png`,
      );
      notes.push(
        `${target.name} @${zoomLabel(TOP_ZOOM_PRESSES)}: imagery-on differs from flat on ${((ratio ?? 1) * 100).toFixed(2)}% of pixels`,
      );
      check(
        ratio !== null && ratio <= MAX_FADED_RATIO,
        `${target.name} @${zoomLabel(TOP_ZOOM_PRESSES)}: the imagery has not faded out (${((ratio ?? 1) * 100).toFixed(2)}% differs from flat, limit ${(MAX_FADED_RATIO * 100).toFixed(1)}%)`,
      );
    }
  }

  /* The landing hero keeps the dark theme in the light theme: every element
     in it computes the same colours in both. A light-only rule that reaches
     into the island, or a Starlight colour it does not re-map, shows up here
     as a difference — the CSS tests can only check the rules they know of. */
  {
    const hero = PAGES.find((target) => target.darkHero);
    const computed = {};
    for (const theme of ["dark", "light"]) {
      const { page, problems } = await open(
        browser,
        base,
        hero,
        "?globe=webgpu",
        { theme, emulate: { reducedMotion: "reduce" } },
      );
      for (const problem of problems) {
        failures.push(`dark hero (${theme}): ${problem}`);
      }
      computed[theme] = await page.evaluate(() => {
        const properties = [
          "color",
          "background-color",
          "border-top-color",
          "border-bottom-color",
          "outline-color",
          "box-shadow",
          "text-decoration-color",
          "fill",
          "stroke",
        ];
        const root = document.querySelector(".gmt-herostage");
        if (!root) return [];
        return [...root.querySelectorAll("*")]
          .filter((element) => element.tagName !== "CANVAS")
          .map((element) => {
            const style = getComputedStyle(element);
            const name = `${element.tagName.toLowerCase()}${[
              ...element.classList,
            ]
              .filter((c) => !c.startsWith("astro-"))
              .map((c) => `.${c}`)
              .join("")}`;
            return {
              name,
              values: properties.map(
                (property) =>
                  `${property}: ${style.getPropertyValue(property)}`,
              ),
            };
          });
      });
      await page.close();
    }
    const { dark, light } = computed;
    check(
      dark.length > 0 && dark.length === light.length,
      `dark hero: ${dark.length} elements in the dark theme, ${light.length} in the light`,
    );
    const differences = [];
    for (let i = 0; i < Math.min(dark.length, light.length); i++) {
      dark[i].values.forEach((value, k) => {
        if (value !== light[i].values[k]) {
          differences.push(
            `${dark[i].name} ${value} | light ${light[i].values[k]}`,
          );
        }
      });
    }
    notes.push(`dark hero: ${dark.length} elements compared across themes`);
    check(
      differences.length === 0,
      `dark hero: ${differences.length} computed colour(s) differ from the dark theme:\n      ${differences.slice(0, 12).join("\n      ")}`,
    );
  }

  /* Raised contrast and forced colours zero the imagery token, which is also
     what stops the download. In the dark theme, which would otherwise draw it. */
  for (const [name, emulate] of [
    ["prefers-contrast: more", { contrast: "more" }],
    ["forced-colors: active", { forcedColors: "active" }],
  ]) {
    const { page, problems, imagery } = await open(
      browser,
      base,
      PAGES[1],
      "?globe=webgpu",
      { theme: "dark", emulate },
    );
    const state = await readState(page);
    check(
      state.renderer === "webgpu",
      `${name}: expected the webgpu renderer, got ${state.renderer}`,
    );
    check(
      imagery.requests === 0,
      `${name}: requested the Earth imagery, which this preference turns off`,
    );
    for (const problem of problems) failures.push(`${name}: ${problem}`);
    await page.close();
  }

  /* A reference page loads no globe code and no image. The image check is
     exact. The code check goes by chunk name, so it catches the globe's own
     modules but would miss them folded into a shared chunk; the static
     guarantee is `renderer-graph.test.ts` and the lazy mount in
     `globe-mount.ts`. */
  {
    const { page, problems, requests } = await open(
      browser,
      base,
      { route: REFERENCE_ROUTE, width: 1440, height: 900 },
      "",
      { waitForStage: false },
    );
    await page.waitForTimeout(1500);
    const globeRequests = requests.filter((url) =>
      /globe|renderer-webgpu|renderer-canvas2d|earth-blue-marble/i.test(
        new URL(url).pathname,
      ),
    );
    check(
      globeRequests.length === 0,
      `reference page: loaded globe code or imagery (${globeRequests.join(", ")})`,
    );
    for (const problem of problems) failures.push(`reference page: ${problem}`);
    await page.close();
  }

  // --- the fallback, with WebGPU hidden from the page -----------------------
  {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const problems = [];
    let imageryRequests = 0;
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === IMAGERY_PATH) imageryRequests++;
    });
    /* Hiding `navigator.gpu` rather than adding a product flag: this is exactly
       what a browser without WebGPU looks like, and it keeps the test out of the
       shipped code. */
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "gpu", {
        get: () => undefined,
        configurable: true,
      });
    });
    // The dark theme, which would draw the imagery if WebGPU were there.
    await page.addInitScript(() => {
      localStorage.setItem("starlight-theme", "dark");
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
    check(
      imageryRequests === 0,
      "no-WebGPU fallback: requested the Earth imagery, which only WebGPU draws",
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
