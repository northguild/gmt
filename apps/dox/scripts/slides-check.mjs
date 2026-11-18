#!/usr/bin/env node
/**
 * Slide-deck gate: the deck shell, measured on the built site (`context/dox/specs/dox-g12`).
 *
 * Each deck route under `/slides/` is loaded with `?globe=canvas2d` (so CI needs no GPU) at
 * 1280x720, 1920x1080 and 1024x768, and checked:
 *
 * - every slide is reachable from the first by next steps alone, and back by previous steps, and
 *   each step lands on the slide and build the address names;
 * - `#<id>/<n>` opens that slide and build;
 * - no element of the shown slide leaves the stage box, and the page never scrolls sideways;
 * - the stage box does not move or resize while stepping through every build;
 * - with scripts off, every slide heading is in the page, in order;
 * - in print, every slide section breaks after the page and no canvas is displayed;
 * - the space stage, at 1280x720 on the canvas-2D renderer: after each step the flight settles
 *   within 2.5 s, the camera rests within 0.5 degrees of the place the slide names, nothing asks for
 *   a frame for 500 ms at rest, and over the whole tour the median frame is within 17.5 ms and
 *   none takes more than 34 ms;
 * - no layer of the space stage, nor the blank, has a margin;
 * - going back to the wall from the last slide hangs it whole again, each pane drawn under its
 *   caption's figure to a pixel, and a pixel probe at each pane's centre matches that pane's capture.
 *
 * Usage (from apps/dox, after a build):
 *   node scripts/slides-check.mjs [--base http://127.0.0.1:4351/gmt] [--browsers chromium]
 *     [--pages /slides/give-me-temporal/] [--list-pages]
 *
 * Without `--base` it serves `dist` itself on a free port. Exit 0 pass, 1 any finding, 2 usage or a
 * missing build.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { serveStatic } from "./lib/static-server.mjs";
import { probeWall } from "./lib/wall-probe.mjs";
import {
  backwardWalk,
  deckRoutes,
  angularDistance,
  forwardWalk,
  frameVerdict,
  insideBox,
  parsePair,
  isSixteenByNine,
  marginedLayers,
  sameBox,
  unlockDecks,
} from "./lib/slides-check-helpers.mjs";

const GATE = "slides-check";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "..", "dist");
const PAGES_DIR = path.join(HERE, "..", "src", "pages", "slides");
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
];
const ENGINES = ["chromium", "firefox", "webkit"];
const STAGE = "[data-deck-stage]";

const routes = deckRoutes(
  readdirSync(PAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name),
);

const args = process.argv.slice(2);
const pages =
  (await applyPageContract({ gate: GATE, pages: routes, argv: args })) ??
  routes;
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

let failures = 0;
let measured = 0;
const report = (browserName, width, pagePath, rule, target, message) => {
  failures += 1;
  console.log(
    `FAIL ${browserName} ${width}px ${pagePath}\n       ${rule}: ${message}`,
  );
  recordFinding({
    gate: GATE,
    rule,
    page: pagePath,
    target,
    browser: browserName,
    width,
    message,
  });
};

const frames = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );

/** Waits out the slide fade, so a read sees the settled stage. */
const settle = async (page) => {
  await frames(page);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (a) =>
          a.playState !== "running" ||
          a.effect?.getTiming().iterations === Infinity,
      ),
  );
};

const stageBox = (page) =>
  page.locator(STAGE).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

/** The slides as the DOM lists them: id, title, build count. */
const readSlides = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-slide]")].map((s) => ({
      id: s.id,
      title: s.querySelector("h2")?.textContent?.trim() ?? "",
      builds: s.querySelectorAll("[data-build]").length,
      place: s.dataset.place ?? "",
    })),
  );

/** The boxes of the shown slide's visible elements that fall outside the stage. */
const escapees = (page, stage) =>
  page.evaluate((outer) => {
    const out = [];
    const shown = document.querySelector("[data-slide][data-shown]");
    if (!shown) return ["no slide is shown"];
    for (const el of shown.querySelectorAll("*")) {
      if (el.closest("[data-notes]")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const tol = 1;
      if (
        r.x < outer.x - tol ||
        r.y < outer.y - tol ||
        r.right > outer.x + outer.width + tol ||
        r.bottom > outer.y + outer.height + tol
      )
        out.push(
          `<${el.localName}> "${(el.textContent ?? "").trim().slice(0, 30)}" at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
    }
    return out;
  }, stage);

/** One page at one size, with scripts on. */
async function checkStage(browserName, browser, pagePath, size) {
  const context = await browser.newContext({ viewport: size });
  try {
    await blockOffSite(context, base);
    await unlockDecks(context);
    const page = await context.newPage();
    const url = `${base}${pagePath}?globe=canvas2d`;
    const res = await page.goto(url, { waitUntil: "load" });
    if (!res || res.status() !== 200)
      throw new Error(`the page answered HTTP ${res ? res.status() : "none"}`);
    await page.waitForSelector('html[data-deck="stage"]');
    await settle(page);
    const slides = await readSlides(page);
    const at = (rule, message, target = "page") =>
      report(browserName, size.width, pagePath, rule, target, message);
    if (slides.length < 2) {
      at("no-slides", `found ${slides.length} slide(s), need at least 2`);
      return;
    }
    const stage0 = await stageBox(page);
    if (!isSixteenByNine(stage0))
      at(
        "stage-ratio",
        `the stage is ${Math.round(stage0.width)}x${Math.round(stage0.height)}, not 16:9`,
      );
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    if (sideways) at("sideways-scroll", "the page scrolls sideways");
    const bar = await page.evaluate(() => {
      const el = document.querySelector(".gmt-deck-bar");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const off = [...el.querySelectorAll("button")].filter((b) => {
        const c = b.getBoundingClientRect();
        return c.top < r.top - 0.5 || c.bottom > r.bottom + 0.5;
      }).length;
      return { bottom: r.bottom, off };
    });
    if (bar === null) at("bar-clipped", "the controls bar is missing");
    else if (bar.bottom > size.height + 0.5)
      at(
        "bar-clipped",
        `the controls bar ends at ${Math.round(bar.bottom)} px, below the ${size.height} px window`,
      );
    else if (bar.off > 0)
      at("bar-clipped", `${bar.off} control(s) in the bar sit outside it`);

    // Forward: next steps alone, from the first slide.
    const walk = forwardWalk(slides);
    const hashOf = () => page.evaluate(() => location.hash);
    await page.keyboard.press("Home");
    await settle(page);
    for (const [i, state] of walk.entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowRight");
        await settle(page);
      }
      const label = `slide "${slides[state.slide].title}" build ${state.build}`;
      const target = `deck › slide "${slides[state.slide].title}"`;
      const got = await hashOf();
      const wantHash = i === 0 ? [state.hash, ""] : [state.hash];
      if (!wantHash.includes(got))
        at(
          "step-lost",
          `stepping forward to ${label}: the address is "${got}", not "${state.hash}"`,
          target,
        );
      const box = await stageBox(page);
      if (!sameBox(box, stage0))
        at("stage-moved", `the stage moved or resized at ${label}`, target);
      const slideBox = await page
        .locator("[data-slide][data-shown]")
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      if (!insideBox(slideBox, box))
        at(
          "slide-outside-stage",
          `the shown slide leaves the stage at ${label}`,
          target,
        );
      const strays = await escapees(page, box);
      if (strays.length)
        at(
          "content-outside-stage",
          `at ${label}: ${strays.slice(0, 3).join("; ")}${strays.length > 3 ? ` and ${strays.length - 3} more` : ""}`,
          target,
        );
    }
    // At the end, one more next step goes nowhere.
    const lastHash = await hashOf();
    await page.keyboard.press("ArrowRight");
    await settle(page);
    if ((await hashOf()) !== lastHash)
      at("step-past-end", "a next step on the last slide moved the deck");

    // Backward: previous steps alone.
    for (const [i, state] of backwardWalk(slides).entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowLeft");
        await settle(page);
      }
      const got = await hashOf();
      if (
        got !== state.hash &&
        !(state.hash === `#${slides[0].id}` && got === "")
      )
        at(
          "step-lost",
          `stepping back to slide "${slides[state.slide].title}" build ${state.build}: the address is "${got}", not "${state.hash}"`,
          `deck › slide "${slides[state.slide].title}"`,
        );
    }

    // Deep links: every state opens directly.
    for (const state of walk) {
      await page.goto(`${url}${state.hash}`, { waitUntil: "load" });
      await page.waitForSelector('html[data-deck="stage"]');
      await settle(page);
      const got = await page.evaluate(() => ({
        id: document.querySelector("[data-slide][data-shown]")?.id ?? null,
        reached: [
          ...document.querySelectorAll("[data-slide][data-shown] [data-build]"),
        ].filter((b) => b.getAttribute("data-reached") !== "false").length,
      }));
      if (got.id !== slides[state.slide].id || got.reached !== state.build)
        at(
          "deep-link",
          `${state.hash} opened slide "${got.id}" with ${got.reached} build(s), not "${slides[state.slide].id}" with ${state.build}`,
          `deck › slide "${slides[state.slide].title}"`,
        );
    }
    measured += 1;
  } catch (error) {
    report(
      browserName,
      size.width,
      pagePath,
      "check-crashed",
      "page",
      `the check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await context.close().catch(() => {});
  }
}

/** The longest hop takes 4 s (`hopDuration` at 180°); a flight still moving after this is slow. */
const SETTLE_MS = 5000;
const REST_WATCH_MS = 500;
const PLACE_TOLERANCE_DEG = 0.5;
const SPACE = "[data-deck-space]";
/** The shatter, the shards' settling and the Earth's turn all finish inside this. */
const TURN_SETTLE_MS = 16000;
/** The Earth carries one clock pin per zone the matrix runs in, up to twelve. */
const WALL_PINS = Math.min(
  12,
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../src/data/zone-matrix.json", import.meta.url)),
      "utf8",
    ),
  ).matrix.zones.length,
);

/** Counts the page's animation-frame requests, so a stage at rest can be shown to ask for none. */
const COUNT_FRAMES = () => {
  window.__frameRequests = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    window.__frameRequests += 1;
    return raf(callback);
  };
};

/** Starts timing the frames in which the camera is moving. */
const START_TIMING = (spaceSelector) => {
  const timing = { on: true, last: 0, deltas: [] };
  window.__frameTiming = timing;
  const loop = (now) => {
    if (!timing.on) return;
    const d = document.querySelector(spaceSelector)?.dataset ?? {};
    const flying =
      d.flight === "moving" || d.wall === "approach" || d.wall === "breaking";
    if (flying && timing.last) timing.deltas.push(now - timing.last);
    timing.last = flying ? now : 0;
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
};

/** The space stage over a full tour: where each step lands, when it stops, and what it costs. */
async function checkSpace(browserName, browser, pagePath, size) {
  const context = await browser.newContext({ viewport: size });
  const at = (rule, message, target = "page") =>
    report(browserName, size.width, pagePath, rule, target, message);
  try {
    await blockOffSite(context, base);
    await unlockDecks(context);
    await context.addInitScript(COUNT_FRAMES);
    const page = await context.newPage();
    await page.goto(`${base}${pagePath}?globe=canvas2d`, { waitUntil: "load" });
    await page.waitForSelector('html[data-deck="stage"]');
    try {
      await page.waitForSelector(`${SPACE}[data-globe="ready"]`, {
        timeout: 10000,
      });
    } catch {
      at("globe-missing", "the globe did not start on the canvas-2D renderer");
      return;
    }
    await settle(page);
    // The layers placed by inset keep no margin, or what they draw drifts off what the stage measures.
    const layers = await page.evaluate(
      (sel) =>
        Array.from(
          document.querySelectorAll(`${sel} > *, [data-deck-blank]`),
          (el) => {
            const cs = getComputedStyle(el);
            return {
              name: el.cloneNode(false).outerHTML.split(">")[0] + ">",
              margins: [
                cs.marginTop,
                cs.marginRight,
                cs.marginBottom,
                cs.marginLeft,
              ].map(parseFloat),
            };
          },
        ),
      SPACE,
    );
    for (const problem of marginedLayers(layers))
      at("layer-offset", problem, "deck");
    const slides = await readSlides(page);
    const state = () =>
      page.evaluate((sel) => {
        const d = document.querySelector(sel)?.dataset ?? {};
        return {
          flight: d.flight ?? "",
          rotation: d.rotation ?? "",
          target: d.target ?? "",
        };
      }, SPACE);
    const restOnPlace = async (label, target) => {
      try {
        await page.waitForFunction(
          (sel) => document.querySelector(sel)?.dataset.flight === "rest",
          SPACE,
          { timeout: SETTLE_MS },
        );
      } catch {
        at(
          "flight-slow",
          `at ${label} the camera was still moving after ${SETTLE_MS} ms`,
          target,
        );
        return false;
      }
      const s = await state();
      const rotation = parsePair(s.rotation);
      const goal = parsePair(s.target);
      if (!rotation || !goal) {
        at(
          "place-unread",
          `at ${label} the stage published no rotation or target`,
          target,
        );
        return false;
      }
      const off = angularDistance(rotation, goal);
      if (off > PLACE_TOLERANCE_DEG)
        at(
          "place-missed",
          `at ${label} the camera rests ${off.toFixed(2)} degrees from the slide's place, over ${PLACE_TOLERANCE_DEG}`,
          target,
        );
      return true;
    };

    await page.keyboard.press("Home");
    await settle(page);
    await restOnPlace("the first slide", "deck");
    await page.evaluate(START_TIMING, SPACE);
    for (const [i, step] of forwardWalk(slides).entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowRight");
        await settle(page);
      }
      const label = `slide "${slides[step.slide].title}" build ${step.build}`;
      const wallDone = await page.evaluate((sel) => {
        const d = document.querySelector(sel)?.dataset ?? {};
        return { wall: d.wall ?? "", turn: d.turn ?? "" };
      }, SPACE);
      if (
        wallDone.wall === "approach" ||
        wallDone.wall === "breaking" ||
        wallDone.turn
      ) {
        try {
          await page.waitForFunction(
            (sel) => {
              const d = document.querySelector(sel)?.dataset ?? {};
              return d.wall !== "approach" && d.wall !== "breaking" && !d.turn;
            },
            SPACE,
            { timeout: TURN_SETTLE_MS },
          );
        } catch {
          at(
            "wall-slow",
            `at ${label} the wall or the Earth's turn was still running after ${TURN_SETTLE_MS} ms`,
          );
        }
        const pins = await page.evaluate(
          (sel) => Number(document.querySelector(sel)?.dataset.clocks ?? 0),
          SPACE,
        );
        if (pins < WALL_PINS)
          at(
            "clock-pins",
            `at ${label} ${pins} clock pin(s) were lit, under ${WALL_PINS}`,
          );
      }
      await restOnPlace(label, `deck › slide "${slides[step.slide].title}"`);
    }
    // Going back to the wall, from the last slide, puts it whole again.
    const wallSlide = slides.find((s) => s.place === "wall");
    if (wallSlide) {
      await page.evaluate((id) => {
        location.hash = `#${id}`;
      }, wallSlide.id);
      await settle(page);
    }
    try {
      await page.waitForFunction(
        (sel) => {
          const d = document.querySelector(sel)?.dataset ?? {};
          return d.wall === "whole" && d.flight === "rest";
        },
        SPACE,
        { timeout: SETTLE_MS * 2 },
      );
    } catch {
      at(
        "wall-not-restored",
        "going back to the wall from the last slide did not hang the wall again",
      );
    }
    const deltas = await page.evaluate(() => {
      window.__frameTiming.on = false;
      return window.__frameTiming.deltas;
    });
    const verdict = frameVerdict(deltas);
    if (verdict) at("frame-budget", `over a full tour: ${verdict}`);

    // And the whole wall is what is drawn: each pane's centre matches its capture.
    const probe = await probeWall(page, SPACE);
    for (const problem of probe.problems)
      at("wall-pane-mismatch", `after stepping back to the wall, ${problem}`);

    // At rest, the stage asks for no frame at all.
    await page.waitForTimeout(REST_WATCH_MS);
    const before = await page.evaluate(() => window.__frameRequests);
    await page.waitForTimeout(REST_WATCH_MS);
    const after = await page.evaluate(() => window.__frameRequests);
    if (after !== before)
      at(
        "frames-at-rest",
        `${after - before} frame(s) were requested in ${REST_WATCH_MS} ms with the camera at rest`,
      );
    measured += 1;
  } catch (error) {
    at(
      "check-crashed",
      `the space check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await context.close().catch(() => {});
  }
}

/** With scripts off, and in print. */
async function checkArticle(browserName, browser, pagePath, size) {
  const at = (rule, message) =>
    report(browserName, size.width, pagePath, rule, "page", message);
  let expected = [];
  const live = await browser.newContext({ viewport: size });
  try {
    await blockOffSite(live, base);
    await unlockDecks(live);
    const page = await live.newPage();
    await page.goto(`${base}${pagePath}?globe=canvas2d`, { waitUntil: "load" });
    expected = (await readSlides(page)).map((s) => s.title);
    await page.emulateMedia({ media: "print" });
    const print = await page.evaluate(() => ({
      sections: [...document.querySelectorAll("[data-slide]")].map((s) => ({
        title: s.querySelector("h2")?.textContent?.trim() ?? "",
        breakAfter: getComputedStyle(s).breakAfter,
      })),
      bar: [...document.querySelectorAll(".gmt-deck-bar")].filter(
        (c) => getComputedStyle(c).display !== "none",
      ).length,
      canvases: [...document.querySelectorAll("canvas")].filter(
        (c) => getComputedStyle(c).display !== "none",
      ).length,
    }));
    for (const s of print.sections)
      if (s.breakAfter !== "page")
        at(
          "print-break",
          `in print, slide "${s.title}" has break-after "${s.breakAfter}", not "page"`,
        );
    if (print.bar > 0)
      at(
        "print-controls",
        "in print, the controls bar is displayed and adds a blank page",
      );
    if (print.canvases > 0)
      at(
        "print-canvas",
        `in print, ${print.canvases} canvas(es) are displayed`,
      );
  } catch (error) {
    at(
      "check-crashed",
      `the print check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await live.close().catch(() => {});
  }

  const plain = await browser.newContext({
    viewport: size,
    javaScriptEnabled: false,
  });
  try {
    await blockOffSite(plain, base);
    const page = await plain.newPage();
    await page.goto(`${base}${pagePath}`, { waitUntil: "load" });
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll("[data-slide] h2")].map(
        (h) => h.textContent?.trim() ?? "",
      ),
    );
    if (JSON.stringify(titles) !== JSON.stringify(expected))
      at(
        "no-js-order",
        `without scripts the slide headings read ${JSON.stringify(titles)}, not ${JSON.stringify(expected)}`,
      );
    measured += 1;
  } catch (error) {
    at(
      "check-crashed",
      `the no-script check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await plain.close().catch(() => {});
  }
}

for (const browserName of browsers) {
  const browser = await launchBrowser(browserName);
  for (const pagePath of pages) {
    for (const size of SIZES) {
      await checkStage(browserName, browser, pagePath, size);
      await checkArticle(browserName, browser, pagePath, size);
    }
    await checkSpace(browserName, browser, pagePath, SIZES[0]);
  }
  await browser.close();
}

server?.close();
recordMeasured(GATE, measured);
console.log(`${GATE}: ${measured} cell(s), ${failures} finding(s)`);
process.exit(failures > 0 || measured === 0 ? 1 : 0);
