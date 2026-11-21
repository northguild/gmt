/**
 * The stage family of the slide-deck gate: one deck page at one size, scripts on. The stage is 16:9
 * and the page never scrolls sideways; the controls bar is whole; next steps reach every slide and
 * previous steps come back, each landing on the address it names, with the stage still and the shown
 * slide inside it; every state opens by its address.
 */
import { blockOffSite } from "../../gate-checks.mjs";
import {
  backwardWalk,
  forwardWalk,
  insideBox,
  isSixteenByNine,
  sameBox,
  unlockDecks,
} from "../slides-check-helpers.mjs";
import { escapees, findingAt, readSlides, settle, stageBox } from "./reads.mjs";

const hashOf = (page) => page.evaluate(() => location.hash);

/** The finding text for what leaves the stage, naming the first three. */
const strayList = (strays) =>
  `${strays.slice(0, 3).join("; ")}${strays.length > 3 ? ` and ${strays.length - 3} more` : ""}`;

/** The stage's shape, the page's width and the controls bar. */
async function checkLayout(page, size, stage0, at) {
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
}

/** Next steps alone from the first slide, then one past the end. */
async function walkForward(page, main, stage0, at) {
  const walk = forwardWalk(main);
  await page.keyboard.press("Home");
  await settle(page);
  for (const [i, state] of walk.entries()) {
    if (i > 0) {
      await page.keyboard.press("ArrowRight");
      await settle(page);
    }
    const label = `slide "${main[state.slide].title}" build ${state.build}`;
    const target = `deck › slide "${main[state.slide].title}"`;
    const got = await hashOf(page);
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
      at("content-outside-stage", `at ${label}: ${strayList(strays)}`, target);
  }
  // At the end, one more next step goes nowhere.
  const lastHash = await hashOf(page);
  await page.keyboard.press("ArrowRight");
  await settle(page);
  if ((await hashOf(page)) !== lastHash)
    at("step-past-end", "a next step on the last slide moved the deck");
}

/** Previous steps alone, from the last slide. */
async function walkBackward(page, main, at) {
  for (const [i, state] of backwardWalk(main).entries()) {
    if (i > 0) {
      await page.keyboard.press("ArrowLeft");
      await settle(page);
    }
    const got = await hashOf(page);
    if (got !== state.hash && !(state.hash === `#${main[0].id}` && got === ""))
      at(
        "step-lost",
        `stepping back to slide "${main[state.slide].title}" build ${state.build}: the address is "${got}", not "${state.hash}"`,
        `deck › slide "${main[state.slide].title}"`,
      );
  }
}

/** Deep links: every state opens directly, the spares' too. */
async function checkDeepLinks(page, url, slides, at) {
  for (const state of forwardWalk(slides)) {
    await page.goto(`${url}${state.hash}`, { waitUntil: "load" });
    await page.waitForSelector('html[data-deck="stage"]');
    await settle(page);
    const got = await page.evaluate(() => ({
      id: document.querySelector("[data-slide][data-shown]")?.id ?? null,
      reached: Math.max(
        0,
        ...[
          ...document.querySelectorAll("[data-slide][data-shown] [data-build]"),
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
        `at slide "${slides[state.slide].title}" build ${state.build}: ${strayList(strays)}`,
        `deck › slide "${slides[state.slide].title}"`,
      );
  }
}

/** Resolves to the cells measured: 1 when the check ran to its end, 0 when it stopped early or crashed. */
export async function checkStage(env) {
  const { browser, base, pagePath, size } = env;
  const at = findingAt(env);
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
    if (slides.length < 2) {
      at("no-slides", `found ${slides.length} slide(s), need at least 2`);
      return 0;
    }
    const stage0 = await stageBox(page);
    await checkLayout(page, size, stage0, at);
    // The spares sit after `thanks` and only a jump reaches them, so the steps walk the main slides;
    // the deep links reach the spares.
    const main = slides.filter((s) => !s.spare);
    await walkForward(page, main, stage0, at);
    await walkBackward(page, main, at);
    await checkDeepLinks(page, url, slides, at);
    return 1;
  } catch (error) {
    at(
      "check-crashed",
      `the check crashed: ${String(error?.message ?? error).split("\n")[0]}`,
    );
    return 0;
  } finally {
    await context.close().catch(() => {});
  }
}
