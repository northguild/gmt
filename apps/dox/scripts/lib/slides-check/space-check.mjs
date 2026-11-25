/**
 * The space-stage family of the slide-deck gate, at the first size on the canvas-2D renderer. Over a
 * full tour: after each step the flight settles, the camera rests on the place the slide names, and
 * the frames cost what the budget allows; no layer has a margin; going back to the wall hangs it whole
 * again, each pane drawn where its capture is; and at rest the stage asks for no frame.
 */
import { blockOffSite } from "../../gate-checks.mjs";
import { frames } from "../page-frames.mjs";
import {
  angularDistance,
  forwardWalk,
  frameVerdict,
  marginedLayers,
  parsePair,
  unlockDecks,
} from "../slides-check-helpers.mjs";
import { probeWall } from "../wall-probe.mjs";
import { findingAt, readSlides, settle } from "./reads.mjs";

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

/** Counts the page's animation-frame requests, so a stage at rest can be shown to ask for none. */
const COUNT_FRAMES = () => {
  window.__frameRequests = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    window.__frameRequests += 1;
    return raf(callback);
  };
};

/**
 * Starts timing the frames in which the camera is moving. The tour sets `step` to the step being
 * flown, so the worst frame names the step to fly again (`worstStep`).
 */
const START_TIMING = (spaceSelector) => {
  const timing = {
    on: true,
    last: 0,
    deltas: [],
    worst: 0,
    worstAt: "",
    step: -1,
    worstStep: -1,
  };
  window.__frameTiming = timing;
  const loop = (now) => {
    if (!timing.on) return;
    const d = document.querySelector(spaceSelector)?.dataset ?? {};
    const flying =
      d.flight === "moving" || d.wall === "approach" || d.wall === "breaking";
    if (flying && timing.last) {
      const delta = now - timing.last;
      timing.deltas.push(delta);
      // Where the worst frame fell, so a finding names the moment to profile.
      if (delta > timing.worst) {
        timing.worst = delta;
        timing.worstStep = timing.step;
        timing.worstAt = `${location.hash || "#"}, flight ${d.flight ?? "-"}, wall ${d.wall ?? "-"}`;
      }
    }
    timing.last = flying ? now : 0;
    window.requestAnimationFrame(loop);
  };
  window.requestAnimationFrame(loop);
};

const wallState = (page) =>
  page.evaluate(
    (sel) => document.querySelector(sel)?.dataset.wall ?? "",
    SPACE,
  );

/** The layers placed by inset keep no margin, or what they draw drifts off what the stage measures. */
async function checkLayerMargins(page, at) {
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
}

/** Waits for the camera to rest and reads how far it is from the slide's place. False when it cannot be read. */
async function restOnPlace(page, at, label, target) {
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
  const s = await page.evaluate((sel) => {
    const d = document.querySelector(sel)?.dataset ?? {};
    return {
      rotation: d.rotation ?? "",
      target: d.target ?? "",
      spin: d.spin ?? "",
    };
  }, SPACE);
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
}

/** While the wall breaks, waits it out and counts the lit clock pins. */
async function checkWallBreak(page, at, label, wallPins) {
  const wall = await wallState(page);
  if (wall !== "approach" && wall !== "breaking") return;
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
  if (pins < wallPins)
    at(
      "clock-pins",
      `at ${label} ${pins} clock pin(s) were lit, under ${wallPins}`,
    );
}

/** Waits until the camera rests and the wall is not breaking; quietly, as the tour reports either. */
async function still(page) {
  await page
    .waitForFunction(
      (sel) => {
        const d = document.querySelector(sel)?.dataset ?? {};
        return (
          d.flight === "rest" && d.wall !== "approach" && d.wall !== "breaking"
        );
      },
      SPACE,
      { timeout: SETTLE_MS + WALL_SETTLE_MS },
    )
    .catch(() => {});
}

/**
 * Marks the step about to be flown, from where the deck is now, and adds it to `steps`: `how` is
 * `"next"` for a Next press, or the address of a jump.
 */
async function markStep(page, steps, how) {
  const from = await page.evaluate(() => location.hash);
  steps.push({ from, how });
  await page.evaluate((i) => {
    window.__frameTiming.step = i;
  }, steps.length - 1);
}

/** Flies `step` again from where it started, timed afresh, and resolves to its frame times. */
async function flyAgain(page, step) {
  await page.evaluate((from) => {
    location.hash = from;
  }, step.from);
  await settle(page);
  await still(page);
  await page.evaluate(START_TIMING, SPACE);
  if (step.how === "next") await page.keyboard.press("ArrowRight");
  else
    await page.evaluate((to) => {
      location.hash = to;
    }, step.how);
  await settle(page);
  await still(page);
  return page.evaluate(() => {
    window.__frameTiming.on = false;
    return window.__frameTiming.deltas;
  });
}

/** Next steps through the main slides, each checked for where the camera lands and the wall's break. */
async function tourSlides(page, at, slides, wallPins, steps) {
  await page.keyboard.press("Home");
  await settle(page);
  await restOnPlace(page, at, "the first slide", "deck");
  await page.evaluate(START_TIMING, SPACE);
  // Next steps reach the main slides only; the spares are a jump away.
  const main = slides.filter((s) => !s.spare);
  for (const [i, step] of forwardWalk(main).entries()) {
    if (i > 0) {
      await markStep(page, steps, "next");
      await page.keyboard.press("ArrowRight");
      await settle(page);
    }
    const label = `slide "${main[step.slide].title}" build ${step.build}`;
    await checkWallBreak(page, at, label, wallPins);
    await restOnPlace(
      page,
      at,
      label,
      `deck › slide "${main[step.slide].title}"`,
    );
  }
}

/** Going back to the wall, from the last slide, puts it whole again. */
async function checkWallRestored(page, at, slides, steps) {
  const wallSlide = slides.find((s) => s.place === "wall");
  if (wallSlide) {
    await markStep(page, steps, `#${wallSlide.id}`);
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
}

/**
 * The whole wall is what is drawn: each pane's centre matches its capture. Then the page zoomed out
 * to half size doubles the viewport in CSS pixels, the cards reflow, and each pane must still hang
 * on its card.
 */
async function checkWallPanes(page, at, size) {
  const probe = await probeWall(page, SPACE);
  for (const problem of probe.problems)
    at("wall-pane-mismatch", `after stepping back to the wall, ${problem}`);
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
}

/** At rest, the stage asks for no frame at all. */
async function checkFramesAtRest(page, at) {
  await page.waitForTimeout(REST_WATCH_MS);
  const before = await page.evaluate(() => window.__frameRequests);
  await page.waitForTimeout(REST_WATCH_MS);
  const after = await page.evaluate(() => window.__frameRequests);
  if (after !== before)
    at(
      "frames-at-rest",
      `${after - before} frame(s) were requested in ${REST_WATCH_MS} ms with the camera at rest`,
    );
}

/**
 * Resolves to the cells measured: 1 when the tour ran to its end, 0 when the globe never started
 * or the check crashed. `env.wallPins` is how many clock pins the wall must light.
 */
export async function checkSpace(env) {
  const { browser, base, pagePath, size, wallPins } = env;
  const at = findingAt(env);
  const context = await browser.newContext({ viewport: size });
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
      return 0;
    }
    await settle(page);
    await checkLayerMargins(page, at);
    const slides = await readSlides(page);
    const steps = [];
    await tourSlides(page, at, slides, wallPins, steps);
    await checkWallRestored(page, at, slides, steps);
    const { deltas, worstAt, worstStep } = await page.evaluate(() => {
      window.__frameTiming.on = false;
      return window.__frameTiming;
    });
    await checkWallPanes(page, at, size);
    await checkFramesAtRest(page, at);
    // Last, as flying a step again leaves the deck wherever that step ends.
    const step = steps[worstStep];
    const verdict = await frameVerdict(deltas, () =>
      step ? flyAgain(page, step) : [],
    );
    if (verdict)
      at("frame-budget", `over a full tour: ${verdict} (worst at ${worstAt})`);
    return 1;
  } catch (error) {
    at(
      "check-crashed",
      `the space check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
    return 0;
  } finally {
    await context.close().catch(() => {});
  }
}
