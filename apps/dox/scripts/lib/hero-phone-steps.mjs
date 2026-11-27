/**
 * The steps of the `hero-phone` gate (`scripts/hero-phone-check.mjs`): one function per thing
 * the landing must hold on a phone. Each takes the cell's `ctx` (`browser`, `label`, `path`,
 * `width`) and a Playwright page, and reports through `check`.
 */
import { devices } from "@playwright/test";
import { recordFinding } from "../gates/findings.mjs";

export const GATE = "hero-phone";
const BAR_BREAK = 800; // 50rem
export const TARGET = 44;
/** The atmosphere's reach beyond the disc (`ATMOSPHERE` in src/lib/globe-frame.ts). */
const ATMOSPHERE = 1.06;

/** What the run has counted; the gate script reads it at the end. */
export const tally = { failed: 0, measured: 0 };
/** One assertion; `ctx` names the cell. */
export function check(ctx, ok, rule, message, target = "page") {
  if (ok) return;
  tally.failed++;
  console.error(
    `  ! ${rule} · ${ctx.browser} ${ctx.label} ${ctx.path}: ${message}`,
  );
  recordFinding({
    gate: GATE,
    rule,
    page: ctx.path,
    target,
    browser: ctx.browser,
    width: ctx.width,
    message,
  });
}

/** The viewer's zone. The globe selects it at load only when it is in the zone list, and a
    runner's own zone (UTC, say) may not be, so it is pinned: the zone card then shows on every
    host. */
export const ZONE = "Africa/Nairobi";

/** Opens `path` under `base` in its own touch context, waits for the entrance and the first sky draw. */
export async function open(browser, device, viewport, path, base) {
  const context = await browser.newContext({
    ...devices[device],
    viewport,
    timezoneId: ZONE,
  });
  await context.addInitScript(() => {
    window.__shift = 0;
    try {
      window.__po = new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.__shift += e.value;
      });
      window.__po.observe({ type: "layout-shift", buffered: true });
    } catch {
      window.__po = null;
    }
  });
  const page = await context.newPage();
  await page.goto(`${base}${path}?globe=canvas2d`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  if (path === "/") await settle(page);
  return { context, page };
}

export async function settle(page) {
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.entrance !== "wait" &&
      document.querySelector("[data-sky-canvas='stars']")?.dataset.skyCamera !==
        undefined,
    null,
    { timeout: 60_000 },
  );
  for (let i = 0; i < 5; i++) {
    const left = await page.evaluate(async () => {
      const finite = () =>
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.allSettled(finite().map((a) => a.finished));
      return finite().length;
    });
    if (left === 0) return;
  }
}

/** Runs in the page: the camera radius the sky drew with (it sets the star dot scale). */
export const cameraRadius = () =>
  Number(
    document
      .querySelector("[data-sky-canvas='stars']")
      ?.dataset.skyCamera?.split(" ")[2],
  );

/** Tap the centre of a locator with the touch screen (`tap()` scrolls by the visual-viewport gap). */
export async function tapCentre(page, locator) {
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** Waits until `scrollY` is the same for a run of frames (a hash jump may scroll smoothly). */
export const scrolled = (page) =>
  page.waitForFunction(() => {
    const s = (window.__still ??= { y: -1, n: 0 });
    s.n = scrollY === s.y ? s.n + 1 : 0;
    s.y = scrollY;
    return s.n >= 8;
  });

/** The header checks that hold on every page at every profile. */
export async function header(ctx, page, onLanding) {
  const home = page.getByRole("link", { name: "NorthGuild home" });
  const clipped = await home.evaluate(
    (a) => a.parentElement.scrollWidth > a.parentElement.clientWidth,
  );
  check(
    ctx,
    !clipped,
    "title-clipped",
    "the header's title wrapper is clipped",
    "header title",
  );
  /* The wordmark and the name keep the 12px text floor; a custom property hides it from the
     static font-floor test, so the computed size is read here. */
  for (const sel of [".gmt-ng-wordmark", ".site-title"]) {
    const size = await page
      .locator(`header ${sel}`)
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
      .catch(() => null);
    if (size !== null)
      check(
        ctx,
        size >= 12,
        "title-below-floor",
        `${sel} is ${size}px, under the 12px floor`,
        sel,
      );
  }
  const narrow = ctx.width < BAR_BREAK;
  const bar = page
    .getByRole("banner")
    .getByRole("link", { name: /dox|github|discord/i });
  if (narrow) {
    for (const link of await bar.all())
      check(
        ctx,
        !(await link.isVisible()),
        "bar-icon-shown",
        `the bar shows "${await link.getAttribute("aria-label")}" below 50rem`,
        "banner link",
      );
  }
  if (narrow && onLanding) {
    const hero = page.locator('[data-gate="hero-copy"]');
    for (const name of ["Start", "Dox"])
      check(
        ctx,
        await hero.getByRole("link", { name }).isVisible(),
        "hero-button-missing",
        `the "${name}" button is not shown`,
        name,
      );
    check(
      ctx,
      !(await hero.getByRole("link", { name: /prompt/i }).isVisible()),
      "prompt-shown",
      'the "Prompt" button shows below 50rem',
      "Prompt",
    );
    for (const link of await hero
      .getByRole("link", { name: /github|discord/i })
      .all())
      check(
        ctx,
        !(await link.isVisible()),
        "hero-social-shown",
        "a GitHub or Discord link shows in the hero",
        "social link",
      );
    check(
      ctx,
      !(await hero
        .getByText("@northguild/gmt", { exact: true })
        .first()
        .isVisible()),
      "eyebrow-shown",
      "the eyebrow shows below 50rem",
      "eyebrow",
    );
    check(
      ctx,
      await page
        .getByRole("heading", { level: 1, name: "Give Me Temporal" })
        .isVisible(),
      "title-missing",
      'the h1 "Give Me Temporal" is not the page heading',
      "title",
    );
  }
}

export async function firstScreen(ctx, page, width, height) {
  const portrait = height > width;
  const m = await page.evaluate(() => {
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return {
        top: b.top,
        bottom: b.bottom,
        width: b.width,
        height: b.height,
      };
    };
    return {
      title: box(document.querySelector("h1[data-page-title]")),
      stage: box(document.querySelector('[data-gate="globe-stage"]')),
      zoom: box(document.querySelector('[data-gate="globe-zoom"]')),
      /* The engine sizes the hit area to the disc itself, atmosphere excluded. */
      disc: box(document.querySelector('[data-gate="globe-hit"]')),
      buttons: box(document.querySelector(".gmt-hero-nav .gmt-hero-actions")),
      carousel: document.documentElement.dataset.homeCarousel,
    };
  });
  if (portrait) {
    const inside = (b) => b.top >= -0.5 && b.bottom <= height + 0.5;
    check(
      ctx,
      inside(m.title),
      "title-off-screen",
      `the title spans ${m.title.top.toFixed(0)}..${m.title.bottom.toFixed(0)} of ${height}`,
      "title",
    );
    /* As on the other NorthGuild landings, the two buttons follow the tagline, above the Earth,
       in one row. */
    check(
      ctx,
      inside(m.buttons) &&
        m.buttons.bottom <= m.stage.top + 0.5 &&
        m.buttons.height < 2 * TARGET,
      "buttons-off-first-screen",
      `the buttons span ${m.buttons.top.toFixed(0)}..${m.buttons.bottom.toFixed(0)} (one row is under ${2 * TARGET}px), the stage starts at ${m.stage.top.toFixed(0)}, of ${height}`,
      "hero buttons",
    );
    /* The disc, not the stage: at 320 x 568 the zoom row under it sits below the fold. */
    check(
      ctx,
      inside(m.disc),
      "globe-off-screen",
      `the disc spans ${m.disc.top.toFixed(0)}..${m.disc.bottom.toFixed(0)} of ${height}`,
      "globe disc",
    );
    /* The atmosphere fills the band between the gutters and above the zoom row, 8px clear of
       it: its rim is drawn whole, so the disc is that band over the atmosphere's reach. */
    const want =
      Math.min(width - 32, m.zoom.top - m.stage.top - 8) / ATMOSPHERE;
    check(
      ctx,
      m.disc.width >= want - 1,
      "disc-small",
      `the disc is ${m.disc.width.toFixed(0)}px across, under ${want.toFixed(0)}px`,
      "globe disc",
    );
    check(
      ctx,
      m.stage.width >= Math.min(width - 32, height / 2) - 1,
      "stage-small",
      `the stage is ${m.stage.width.toFixed(0)}px wide`,
      "globe stage",
    );
  }
  const pager = await page.getByRole("button", { name: /^next/i }).isVisible();
  check(
    ctx,
    !pager,
    "pager-shown",
    "the pager shows on a stacked layout",
    "pager",
  );
  check(
    ctx,
    m.carousel === undefined,
    "carousel-on",
    `data-home-carousel is "${m.carousel}" on a stacked layout`,
    "root",
  );
}

export async function panes(ctx, page) {
  const panes = await page.evaluate(() =>
    [...document.querySelectorAll("[data-page]")].map((p) => {
      const s = getComputedStyle(p);
      return {
        name: p.dataset.page,
        hidden:
          p.hidden ||
          s.visibility === "hidden" ||
          s.display === "none" ||
          p.inert,
        scrolls: /auto|scroll/.test(s.overflowY),
      };
    }),
  );
  for (const p of panes) {
    check(
      ctx,
      !p.hidden,
      "pane-hidden",
      `the "${p.name}" pane is hidden or inert`,
      p.name,
    );
    check(
      ctx,
      !p.scrolls,
      "pane-scrolls",
      `the "${p.name}" pane scrolls inside itself`,
      p.name,
    );
  }

  // Header clearance: the heading's top is at or below the header, by scroll and by hash.
  const names = await page.evaluate(() =>
    [...document.querySelectorAll("[data-page]")].map((p) => p.dataset.page),
  );
  for (const name of names) {
    for (const how of ["scroll", "hash"]) {
      await page.evaluate(
        ([pane, mode]) => {
          const el = [...document.querySelectorAll("[data-page]")].find(
            (p) => p.dataset.page === pane,
          );
          const h = el.querySelector("h1, h2, h3");
          window.__still = undefined;
          if (mode === "hash" && h?.id) location.hash = h.id;
          else el.scrollIntoView();
        },
        [name, how],
      );
      await scrolled(page);
      const gap = await page.evaluate((pane) => {
        const el = [...document.querySelectorAll("[data-page]")].find(
          (p) => p.dataset.page === pane,
        );
        const h = el.querySelector("h1, h2, h3");
        return h
          ? h.getBoundingClientRect().top -
              document.querySelector("header").getBoundingClientRect().bottom
          : 0;
      }, name);
      check(
        ctx,
        gap >= -0.5,
        "heading-under-header",
        `${how} to "${name}" leaves its heading ${(-gap).toFixed(0)}px under the header`,
        name,
      );
    }
  }
  await page.evaluate(() => scrollTo(0, 0));
  await scrolled(page);
}
