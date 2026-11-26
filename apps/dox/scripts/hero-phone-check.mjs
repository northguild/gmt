#!/usr/bin/env node
/**
 * Hero phone gate: the stacked landing on a phone, and the locked one beside it.
 *
 * Per phone profile (`?globe=canvas2d`, after `data-entrance` settles and the sky has drawn):
 *   - first screen (portrait): the title, the "Get started" and "Ask Dox" buttons under it, and
 *     the globe disc lie inside `0..innerHeight`; the buttons sit above the Earth's stage; the
 *     atmosphere fills the band between the gutters and above the zoom row, rim whole;
 *   - no carousel: no `data-home-carousel`, and no page hidden, inert or scrolling inside itself;
 *   - header clearance: a scroll to each pane and a hash jump to its heading leave the heading
 *     below the header;
 *   - zone sheet: a tap on the Earth leaves it shut; a touch tap on "Find a zone" leaves `scrollY`
 *     alone and the search field inside the visual viewport; Escape closes it and returns focus to
 *     the button;
 *   - targets: the zoom stack's four buttons and the sheet's buttons, field and option rows are at
 *     least 44 x 44 on a coarse pointer, and a set that finds none fails;
 *   - stillness: a touch drag on the Earth moves the disc's box by under 0.5 px;
 *   - width: nothing scrolls sideways, before and after the sheet opens;
 *   - layout shift: zero from load to settled (engines that report it: Chromium);
 *   - the zone card (the zone is pinned, so one shows on every host) lies across the screen and
 *     inside the Earth's stage with its pin at the centre and stepped toward each edge, and above
 *     the open sheet;
 *   - star dots: the sky's camera radius, which sets the dot scale, is below the 1440 x 900 one.
 * The header holds on `/` and `/guides/` at every profile: the title wrapper is not clipped, the
 * wordmark and name keep the 12 px text floor, below 50rem the bar shows no Dox, GitHub or Discord
 * link, and on `/` the hero shows "Get started" and "Ask Dox" only, with no eyebrow.
 * Beside the phones: at 1440 x 900 the carousel is wired and its pager shown, and a
 * stacked-to-locked resize shows the pane the reader was at, and no other, with no entrance motion
 * in the frames after it.
 *
 * The dev server will not do: its toolbar sits over the zoom row on a short screen.
 *
 * Serve a build statically first (never the owner's dev server), then:
 *   node scripts/hero-phone-check.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit]
 * Exits non-zero on any failure.
 */
import { launchBrowser } from "./lib/browser-launch.mjs";
import {
  GATE,
  check,
  firstScreen,
  header,
  open as openPage,
  panes,
  scrolled,
  tally,
  cameraRadius,
} from "./lib/hero-phone-steps.mjs";
import { card, dots, sheet, stillness } from "./lib/hero-phone-touch.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordMeasured } from "./gates/findings.mjs";

const PAGES = ["/", "/guides/"];
const SELECTED =
  (await applyPageContract({ gate: GATE, pages: PAGES })) ?? PAGES;

/** Playwright device, then the viewport with the browser bars subtracted (CSS px). */
const PROFILES = [
  ["iPhone SE (3rd gen)", 375, 667],
  ["iPhone 15", 393, 659],
  ["iPhone 17 Pro", 402, 681],
  ["iPhone 17 Pro Max", 440, 763],
  ["iPhone 15 landscape", 844, 390],
  /* 568 high: the zoom row sits about 24 px under the fold while the disc and title fit. */
  ["iPhone SE (3rd gen)", 320, 568],
];
const LOCKED = { width: 1440, height: 900 };

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const open = (browser, device, viewport, path) =>
  openPage(browser, device, viewport, path, base);
const browsers = flag("browsers", "chromium,webkit").split(",");
for (const name of browsers) {
  if (!["chromium", "firefox", "webkit"].includes(name)) {
    console.error(`${GATE}: unknown browser "${name}"`);
    process.exit(2);
  }
}

/** The cell a check names in its findings. */
const cell = (browser, label, path, width) => ({ browser, label, path, width });

/** The landing's phone checks, one profile. */
async function phone(browser, [device, width, height], engine, lockedRadius) {
  const ctx = cell(engine, `${width}x${height}`, "/", width);
  ctx.lockedRadius = lockedRadius;
  const { context, page } = await open(browser, device, { width, height }, "/");
  try {
    await firstScreen(ctx, page, width, height);
    await panes(ctx, page);
    // Before any drag: a script's drag is not input, so the card it moves would count as a shift.
    await dots(ctx, page);
    await card(ctx, page, width);
    await sheet(ctx, page);
    await page.evaluate(() => scrollTo(0, 0));
    await scrolled(page);
    await stillness(ctx, page);
    await header(ctx, page, true);
    tally.measured++;
  } finally {
    await context.close();
  }
}

/** A docs page: only the header holds there. */
async function docsHeader(browser, [device, width, height], engine) {
  const ctx = {
    browser: engine,
    label: `${width}x${height}`,
    path: "/guides/",
    width,
  };
  const { context, page } = await open(
    browser,
    device,
    { width, height },
    "/guides/",
  );
  try {
    await header(ctx, page, false);
    tally.measured++;
  } finally {
    await context.close();
  }
}

/** The locked landing: carousel wired, pager shown. Returns the sky's camera radius. */
async function locked(browser, engine) {
  const ctx = {
    browser: engine,
    label: "1440x900",
    path: "/",
    width: LOCKED.width,
  };
  const { context, page } = await open(browser, "Desktop Chrome", LOCKED, "/");
  try {
    await page
      .waitForFunction(
        () => document.documentElement.dataset.homeCarousel === "on",
        null,
        { timeout: 30_000 },
      )
      .catch(() => {});
    const on = await page.evaluate(
      () => document.documentElement.dataset.homeCarousel,
    );
    check(
      ctx,
      on === "on",
      "carousel-off",
      `data-home-carousel is "${on}" on the locked landing`,
      "root",
    );
    check(
      ctx,
      await page.getByRole("button", { name: /^next/i }).isVisible(),
      "pager-hidden",
      "the pager is not shown on the locked landing",
      "pager",
    );
    tally.measured++;
    return await page.evaluate(cameraRadius);
  } finally {
    await context.close();
  }
}

/** Stacked to locked: the pane the reader was at shows, and no entrance motion plays. */
async function rewire(browser, engine) {
  const ctx = {
    browser: engine,
    label: "844x390 -> 1280x800",
    path: "/",
    width: 1280,
  };
  const { context, page } = await open(
    browser,
    "iPhone 15 landscape",
    { width: 844, height: 390 },
    "/",
  );
  try {
    await page.evaluate(() => {
      const panes = document.querySelectorAll("[data-page]");
      panes[Math.min(2, panes.length - 1)].scrollIntoView();
    });
    await scrolled(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForFunction(
      () => document.documentElement.dataset.homeCarousel === "on",
      null,
      { timeout: 30_000 },
    );
    /* Over a run of frames, not one read: an entrance that starts a frame after the wire would
       be missed by a single look. */
    const after = await page.evaluate(async () => {
      const panes = [...document.querySelectorAll("[data-page]")];
      let moving = 0;
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const finite = panes
          .flatMap((p) => p.getAnimations())
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
        moving = Math.max(moving, finite.length);
      }
      const shown = panes.flatMap((p, i) => {
        const s = getComputedStyle(p);
        const off =
          p.hidden ||
          p.inert ||
          s.display === "none" ||
          s.visibility === "hidden";
        return off ? [] : [i];
      });
      return { moving, shown, want: Math.min(2, panes.length - 1) };
    });
    check(
      ctx,
      after.shown.length === 1 && after.shown[0] === after.want,
      "rewire-wrong-pane",
      `pane(s) ${after.shown.join(", ") || "none"} show after the resize; the reader was at ${after.want}`,
      "pane",
    );
    check(
      ctx,
      after.moving === 0,
      "rewire-motion",
      `${after.moving} entrance animation(s) play on a pane after the resize`,
      "pane",
    );
    tally.measured++;
  } finally {
    await context.close();
  }
}

const crashed =
  (engine, [, width, height], path) =>
  (error) =>
    check(
      { browser: engine, label: `${width}x${height}`, path, width },
      false,
      "check-crashed",
      String(error.stack).split("\n").slice(0, 3).join(" | "),
    );

for (const engine of browsers) {
  const browser = await launchBrowser(engine);
  try {
    if (SELECTED.includes("/")) {
      const radius = await locked(browser, engine);
      for (const profile of PROFILES)
        await phone(browser, profile, engine, radius).catch(
          crashed(engine, profile, "/"),
        );
      await rewire(browser, engine);
    }
    if (SELECTED.includes("/guides/"))
      for (const profile of PROFILES)
        await docsHeader(browser, profile, engine).catch(
          crashed(engine, profile, "/guides/"),
        );
  } finally {
    await browser.close();
  }
}

recordMeasured(GATE, tally.measured);
if (tally.failed > 0) {
  console.error(`${GATE}: ${tally.failed} failure(s)`);
  process.exit(1);
}
console.log(`${GATE}: ${tally.measured} cells ok`);
