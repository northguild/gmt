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
      // As the deck counts them: builds that share a number reveal together, one step.
      builds: Math.max(
        0,
        ...[...s.querySelectorAll("[data-build]")].map(
          (b) => Number(b.getAttribute("data-build")) || 1,
        ),
      ),
      place: s.dataset.place ?? "",
      spare: s.hasAttribute("data-spare"),
    })),
  );

/**
 * The boxes of the shown slide's visible elements that fall outside the stage. What sits in a box
 * that scrolls (a chat's answer, a tool's panel) is reached by scrolling it, so the box stands for
 * it: the box itself is checked.
 */
const escapees = (page, stage) =>
  page.evaluate((outer) => {
    const out = [];
    const shown = document.querySelector("[data-slide][data-shown]");
    if (!shown) return ["no slide is shown"];
    const scrolls = (el) => {
      for (let a = el.parentElement; a && a !== shown; a = a.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(a);
        if ([overflowX, overflowY].some((o) => o === "auto" || o === "scroll"))
          return true;
      }
      return false;
    };
    for (const el of shown.querySelectorAll("*")) {
      if (el.closest("[data-notes]") || scrolls(el)) continue;
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
      // A closed menu's items have no box: only the controls on screen count.
      const off = [...el.querySelectorAll("button")].filter((b) => {
        const c = b.getBoundingClientRect();
        if (c.width === 0 || c.height === 0) return false;
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

    // Forward: next steps alone, from the first slide. The spares sit after `thanks` and only a
    // jump reaches them, so the steps walk the main slides; the deep links below reach the spares.
    const main = slides.filter((s) => !s.spare);
    const walk = forwardWalk(main);
    const hashOf = () => page.evaluate(() => location.hash);
    await page.keyboard.press("Home");
    await settle(page);
    for (const [i, state] of walk.entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowRight");
        await settle(page);
      }
      const label = `slide "${main[state.slide].title}" build ${state.build}`;
      const target = `deck › slide "${main[state.slide].title}"`;
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
    for (const [i, state] of backwardWalk(main).entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowLeft");
        await settle(page);
      }
      const got = await hashOf();
      if (
        got !== state.hash &&
        !(state.hash === `#${main[0].id}` && got === "")
      )
        at(
          "step-lost",
          `stepping back to slide "${main[state.slide].title}" build ${state.build}: the address is "${got}", not "${state.hash}"`,
          `deck › slide "${main[state.slide].title}"`,
        );
    }

    // Deep links: every state opens directly, the spares' too.
    for (const state of forwardWalk(slides)) {
      await page.goto(`${url}${state.hash}`, { waitUntil: "load" });
      await page.waitForSelector('html[data-deck="stage"]');
      await settle(page);
      const got = await page.evaluate(() => ({
        id: document.querySelector("[data-slide][data-shown]")?.id ?? null,
        reached: Math.max(
          0,
          ...[
            ...document.querySelectorAll(
              "[data-slide][data-shown] [data-build]",
            ),
          ]
            .filter((b) => b.getAttribute("data-reached") !== "false")
            .map((b) => Number(b.getAttribute("data-build")) || 1),
        ),
      }));
      if (got.id !== slides[state.slide].id || got.reached !== state.build)
        at(
          "deep-link",
          `${state.hash} opened slide "${got.id}" with ${got.reached} build(s), not "${slides[state.slide].id}" with ${state.build}`,
          `deck › slide "${slides[state.slide].title}"`,
        );
      // The steps above saw every main slide; a spare is seen here.
      if (!slides[state.slide].spare) continue;
      const strays = await escapees(page, await stageBox(page));
      if (strays.length)
        at(
          "content-outside-stage",
          `at slide "${slides[state.slide].title}" build ${state.build}: ${strays.slice(0, 3).join("; ")}${strays.length > 3 ? ` and ${strays.length - 3} more` : ""}`,
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

/**
 * The longest hop takes 4 s (`hopDuration` at 180°), and a turning Earth eases down for 2 s
 * (`AMBIENT_RAMP_MS`) before the camera flies back; a flight still moving after both is slow.
 */
const SETTLE_MS = 7000;
const REST_WATCH_MS = 500;
const PLACE_TOLERANCE_DEG = 0.5;
const SPACE = "[data-deck-space]";
/** The shatter and the shards' settling finish inside this. */
const WALL_SETTLE_MS = 16000;
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
          spin: d.spin ?? "",
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
      // A slide that turns the Earth has no place to rest on: the camera never stops there.
      if (s.spin === "on") return true;
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
    // Next steps reach the main slides only; the spares are a jump away.
    const main = slides.filter((s) => !s.spare);
    for (const [i, step] of forwardWalk(main).entries()) {
      if (i > 0) {
        await page.keyboard.press("ArrowRight");
        await settle(page);
      }
      const label = `slide "${main[step.slide].title}" build ${step.build}`;
      const wallDone = await page.evaluate((sel) => {
        const d = document.querySelector(sel)?.dataset ?? {};
        return { wall: d.wall ?? "" };
      }, SPACE);
      if (wallDone.wall === "approach" || wallDone.wall === "breaking") {
        try {
          await page.waitForFunction(
            (sel) => {
              const d = document.querySelector(sel)?.dataset ?? {};
              return d.wall !== "approach" && d.wall !== "breaking";
            },
            SPACE,
            { timeout: WALL_SETTLE_MS },
          );
        } catch {
          at(
            "wall-slow",
            `at ${label} the wall was still breaking after ${WALL_SETTLE_MS} ms`,
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
      await restOnPlace(label, `deck › slide "${main[step.slide].title}"`);
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

    // Zooming the page out to half size doubles the viewport in CSS pixels: the cards reflow, and
    // each pane must still hang on its card.
    await page.setViewportSize({
      width: size.width * 2,
      height: size.height * 2,
    });
    await settle(page);
    await frames(page);
    const zoomed = await probeWall(page, SPACE);
    for (const problem of zoomed.problems)
      at(
        "wall-pane-mismatch",
        `after the page was zoomed out to half size on the wall, ${problem}`,
      );
    await page.setViewportSize(size);
    await settle(page);
    await frames(page);

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

const TALK = "/slides/give-me-temporal/";
const RECORDED = path.join(
  HERE,
  "..",
  "src",
  "slides",
  "give-me-temporal",
  "recorded",
);
const TRANSCRIPT_FILE =
  "apps/dox/src/slides/give-me-temporal/quotes/agent-answer.json";
const TRANSCRIPT_COMMAND =
  "cd scripts/zone-matrix && fnm exec --using=26 -- node agent-answer.mjs";

/** Every file under a folder, for the secret grep. */
function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesUnder(path.join(dir, e.name))
      : [path.join(dir, e.name)],
  );
}

/**
 * What only Deck 0 promises: the owner's transcript is in, the live demos play recordings and say
 * so, the page tool shows both JSON panels, the deck page registers its three tools, the spares
 * come after `thanks` and outside the pace plan, the Moon build sits on `day-off`, and no dev
 * secret reached `dist/` or the recordings. Runs once, at the first size.
 */
async function checkDeckContent(browserName, browser, pagePath, size) {
  const at = (rule, message) =>
    report(browserName, size.width, pagePath, rule, "deck", message);
  const context = await browser.newContext({ viewport: size });
  try {
    await blockOffSite(context, base);
    await unlockDecks(context);
    await context.addInitScript(() => {
      window.__registeredTools = [];
      Object.defineProperty(navigator, "modelContext", {
        configurable: true,
        value: {
          registerTool(tool) {
            window.__registeredTools.push(tool?.name);
          },
        },
      });
    });
    const page = await context.newPage();
    await page.goto(`${base}${pagePath}?globe=canvas2d`, { waitUntil: "load" });

    // A pending row on `agents` is headed by its model; the panel on `agent-answer` is the quoted one.
    const pending = await page.evaluate(() =>
      [...document.querySelectorAll('[data-quote="pending"]')].map(
        (el) =>
          el.closest("tr")?.querySelector("th")?.textContent?.trim() ??
          "the quoted answer",
      ),
    );
    for (const name of new Set(pending))
      at(
        "transcript-missing",
        `${name} is not ready: fill ${TRANSCRIPT_FILE}, then record the run with \`${TRANSCRIPT_COMMAND}\``,
      );

    const order = await page.evaluate(() =>
      [...document.querySelectorAll("[data-slide]")].map((s) => ({
        id: s.id,
        spare: s.hasAttribute("data-spare"),
        minutes: s.getAttribute("data-minutes"),
      })),
    );
    const lastMain = order.filter((s) => !s.spare).at(-1);
    const firstSpare = order.findIndex((s) => s.spare);
    const qa = order.findIndex((s) => s.id === "qa");
    if (lastMain?.id !== "thanks")
      at("spare-order", "`thanks` is not the last main slide");
    if (qa < 0 || order[qa + 1]?.id !== "thanks")
      at("spare-order", "`qa` does not come right before `thanks`");
    if (firstSpare < 0 || order.slice(0, firstSpare).some((s) => s.spare))
      at("spare-order", "the spare slides do not follow `thanks`");
    for (const s of order.filter((o) => o.spare))
      if (s.minutes !== null)
        at("spare-minutes", `spare slide ${s.id} sits in the pace plan`);
    if (order.slice(firstSpare).some((s) => !s.spare))
      at("spare-order", "a main slide comes after a spare slide");

    const moon = await page
      .locator('#day-off [data-build][data-place="moon"]')
      .count();
    if (moon === 0)
      at("moon-step", "day-off has no build that carries the Moon place");

    // Offline, every live demo plays its recording and says so.
    for (const id of ["ask-dox", "qa"]) {
      await page.evaluate((i) => {
        document.getElementById(i)?.scrollIntoView();
      }, id);
      const source = page.locator(`#${id} [data-slot="source"]`).first();
      try {
        await source.waitFor({ state: "attached", timeout: 15000 });
        await page.waitForFunction(
          (el) => /Recorded/.test(el?.textContent ?? ""),
          await source.elementHandle(),
          { timeout: 15000 },
        );
      } catch {
        at(
          "live-recorded",
          `${id} does not show "Recorded" with the network cut`,
        );
      }
    }

    // The page tool runs as the slide shows: Dox's turn lists both Easters, and the receipt opens the grids.
    await page.evaluate(() => {
      document.getElementById("page-tools")?.scrollIntoView();
    });
    try {
      await page.waitForFunction(
        () => {
          const slide = document.getElementById("page-tools");
          const turn = slide?.querySelector(
            '.gmt-hive-turn[data-role="assistant"]',
          );
          return (
            /Julian:\s*\d{4}-\d{2}-\d{2}/.test(turn?.textContent ?? "") &&
            slide?.querySelector(".gmt-hive-receipt") !== null
          );
        },
        undefined,
        { timeout: 15000 },
      );
    } catch {
      at(
        "page-tools-answer",
        "page-tools shows no Easter dates or no receipt from the page tool",
      );
    }

    const tools = await page.evaluate(() => window.__registeredTools ?? []);
    if (tools.length !== 3)
      at(
        "page-tools-registered",
        `the deck page registered ${tools.length} tool(s), not 3: ${JSON.stringify(tools)}`,
      );
    measured += 1;
  } catch (error) {
    at(
      "check-crashed",
      `the deck content check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
  } finally {
    await context.close().catch(() => {});
  }

  const secrets = ["DOX_DEV_KEY"];
  if (process.env.DOX_DEV_KEY) secrets.push(process.env.DOX_DEV_KEY);
  for (const file of [...filesUnder(DIST), ...filesUnder(RECORDED)]) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const secret of secrets)
      if (text.includes(secret)) {
        at(
          "dev-secret",
          `${path.relative(path.join(HERE, ".."), file)} holds ${secret === "DOX_DEV_KEY" ? "the name DOX_DEV_KEY" : "the dev key's value"}`,
        );
        break;
      }
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
    if (pagePath === TALK)
      await checkDeckContent(browserName, browser, pagePath, SIZES[0]);
  }
  await browser.close();
}

server?.close();
recordMeasured(GATE, measured);
console.log(`${GATE}: ${measured} cell(s), ${failures} finding(s)`);
process.exit(failures > 0 || measured === 0 ? 1 : 0);
