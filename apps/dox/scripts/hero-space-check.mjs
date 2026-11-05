/**
 * The landing hero's gate: the frameless Earth and its zone drawer.
 *
 * No unit test can say where a disc sits, whether a panel moved it, or that a popup stays inside a
 * drawer, so this loads the built landing page in a real browser and measures it. It checks, in
 * order:
 *
 * - no frame: the stage has no border, fill, shadow or clip, and nothing in the hero is a bracket;
 * - position: the disc is centred in the globe area at 390, 768, 1280, 1440 and 1920 px, and its
 *   atmosphere clears the copy by 16 px;
 * - the drawer: shut and out of the accessibility tree on load, opened by a drag (focus staying out
 *   of it) or the magnifier (focus in the search), closed by its close or Escape, and then opened
 *   again only by the magnifier; a sheet below the disc at 390 px; the disc never moves and the
 *   page never shifts;
 * - the close: a tab lapping the drawer's edge by 1px at its middle, hidden and skipped by Tab while shut, and the location
 *   card stays clear of it or hides;
 * - the search: its name, placeholder and hidden label; its suggestions open downward, opaque,
 *   scrolling and inside the drawer, here and in the Zone Planner;
 * - zoom: at maximum the globe fills the hero, edge to edge, outside the copy;
 * - no sideways scroll from 320 to 2560 px; a steady frame rate; no frames off screen;
 * - the night sky: the credit names the star catalogue and its licence; the stars are the real sky
 *   for the page's clock and the globe's camera (`data-sky-view`); at rest the sky is not
 *   redrawn; a 60 px drag lowers the view's right ascension by the longitude the globe turned and
 *   moves the stars left; the ambient spin redraws it at most once a frame, at a median draw of
 *   2 ms and a median frame of 17.5 ms; under reduced motion nothing animates, no frame is
 *   requested and no meteor falls, though the reader's own drag still carries the stars; no
 *   source names a body that is not in the catalogue;
 * - the arrival from northguild.dev: a fixture standing in for that site is served at the origin's
 *   `/` with the companion rules; a click through to the build gives a view transition of the
 *   `from-landing` type, in which the bar dissolves over 240 ms, the page over 600 ms, and the mark
 *   and the wordmark do not move, and they sit within 0.5 px of the fixture's boxes; under reduced
 *   motion there is no transition;
 * - interaction: drag, wheel, the zoom buttons and the arrow keys work, a click selects a zone, and
 *   a wheel over the copy scrolls the page and never zooms.
 * - the landing carousel: on a landscape screen 64rem wide and up the page never scrolls, the pages
 *   share the column and each fits it; the wheel turns one page per gesture, the arrows, the dots
 *   and the arrow keys move between them, Escape and a press on the Earth do not, and the Earth,
 *   the buttons and the pager never move; the arrows are 24 px targets named after the page they
 *   open, and the one with nowhere to go is hidden and out of the tab order; a link into a later
 *   page opens it and leaving it clears the address; a hash that is not valid percent-encoding
 *   still starts the landing; narrower or portrait, the carousel pages and the wheel scrolls the
 *   page; without scripts, or with the module blocked, every page reads in order;
 * - the carousel's motion: five quick turns in both themes keep one running animation per page,
 *   a median frame of 17.5 ms and none over 34 ms, and under reduced motion only `opacity`
 *   animates; axe finds nothing on any page, in either theme.
 *
 * Usage, from `apps/dox`, against a served build (`scripts/lib/static-server.mjs`):
 *
 *     node scripts/hero-space-check.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium]
 *
 * It uses a real GPU when Playwright's `chromium` channel has one, and the canvas-2D renderer
 * (`?globe=canvas2d`) where it reads pixels. Exits non-zero on any failure.
 */
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { blockOffSite, colorAlpha } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { gate, resolveMisses } from "./lib/locate.mjs";

const GATE = "hero-space";
const ROUTE = "/";
const PLANNER = "/tools/zone-planner/";

const wanted = applyPageContract({ gate: GATE, pages: [ROUTE, PLANNER] });

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const browsers = flag("browsers", "chromium").split(",");
if (browsers.some((name) => name !== "chromium")) {
  console.error("hero-space: only chromium runs this gate (it needs WebGPU)");
  process.exit(2);
}

const HERO = gate("hero-stage");
const COPY = gate("hero-copy");
const STAGE = gate("globe-stage");
const LAYER = gate("globe-layer");
const HIT = gate("globe-hit");
const DRAWER = gate("globe-drawer");
const REGION = `${DRAWER} > [role="region"]`;
const CLOSE = `${DRAWER} > button`;
const TOOLTIP = gate("globe-tooltip");
const ZOOM_IN = "[data-globe-zoom='in']";
const ZOOM_OUT = "[data-globe-zoom='out']";
const ZOOM_RESET = "[data-globe-zoom='reset']";

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };
const SETTLE = 2600;
const REM = 16;

const failures = [];
let measured = 0;

/** One failed check, written for the screen and the runner. */
function fail(rule, target, message, size) {
  const text = `${size ? `${size.width}px ` : ""}${message}`;
  failures.push(`${rule} · ${target}: ${text}`);
  console.error(`  ! ${rule} · ${target}: ${text}`);
  recordFinding({
    gate: GATE,
    rule,
    page: ROUTE,
    target,
    browser: "chromium",
    width: size?.width ?? null,
    message: text,
  });
}

const check = (ok, rule, target, message, size) => {
  if (!ok) fail(rule, target, message, size);
  return ok;
};

const r1 = (n) => Math.round(n * 10) / 10;
const centre = (box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

async function launch() {
  for (const options of [{ channel: "chromium" }, {}]) {
    try {
      return await chromium.launch(options);
    } catch {
      // try the next
    }
  }
  throw new Error("hero-space: no Chromium could launch");
}

/** The landing page at a size, settled, with the layout shift counter running. */
/** Whether the main thread answers a trivial script inside `ms`. */
async function answersWithin(page, ms) {
  const answered = page.evaluate(() => true).then(() => true);
  const late = new Promise((resolve) => setTimeout(() => resolve(false), ms));
  return Promise.race([answered, late]);
}

/** How long the page may take to bring the globe up before a check gives up on it. */
const LOAD_TIMEOUT = 90_000;

async function open(
  browser,
  size,
  {
    query = "",
    reduce = false,
    context: extra = {},
    lateFont = 0,
    fixed = 0,
    init = null,
  } = {},
) {
  const context = await browser.newContext({
    viewport: size,
    reducedMotion: reduce ? "reduce" : "no-preference",
    ...extra,
  });
  await blockOffSite(context, base);
  if (fixed > 0) await context.clock.setFixedTime(fixed);
  if (lateFont > 0) {
    await context.route("**/*.woff2", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, lateFont));
      await route.continue();
    });
  }
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  if (init) await page.addInitScript(init);
  await page.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__shift += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    /* Every frame from the first paint: the title's size and the copy column's box. */
    window.__frames = [];
    const raf = window.requestAnimationFrame.bind(window);
    const stopAt = performance.now() + 5000;
    const sample = () => {
      const h1 = document.querySelector("h1[data-page-title]");
      const lead = document.querySelector(".gmt-hero-lead");
      if (h1 && lead && window.__frames.length < 400) {
        const box = lead.getBoundingClientRect();
        window.__frames.push([
          getComputedStyle(h1).fontSize,
          Math.round(box.top * 10) / 10,
          Math.round(box.height * 10) / 10,
        ]);
      }
      if (performance.now() < stopAt) raf(sample);
    };
    raf(sample);
  });
  /* These waits are readiness conditions, not budgets: a machine running several gates at once
     takes far longer than 15 s to bring the WebGPU globe up, and the checks that follow measure
     the page, not how fast it loaded. */
  await page.goto(`${base}${ROUTE}${query}`, {
    waitUntil: "networkidle",
    timeout: LOAD_TIMEOUT,
  });
  await page.locator(HIT).waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
  if (!(await answersWithin(page, 1000)))
    problems.push("the page did not answer within 1s after load");
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getBoundingClientRect().width > 10,
    HIT,
    { timeout: LOAD_TIMEOUT },
  );
  await page.waitForTimeout(SETTLE);
  return { page, context, problems };
}

const hitBox = (page) => page.locator(HIT).boundingBox();

/** A box in the page's own coordinates, so a scroll between two measures does not move it. */
async function onPage(page, box) {
  const y = await page.evaluate(() => window.scrollY);
  return box && { ...box, y: box.y + y };
}

/** The union of every descendant box of the copy that is shown: where the words and buttons are. */
function copyRect(page) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const el of root.querySelectorAll("*")) {
      // A page the carousel is not showing keeps its box but draws nothing.
      if (el.closest("[hidden], [data-page]:not([data-shown])")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return { left, top, right, bottom };
  }, COPY);
}

const regionOpen = (page) =>
  page.evaluate(
    (sel) => !document.querySelector(sel)?.hasAttribute("inert"),
    REGION,
  );

async function dragOnEarth(page, dx = 140) {
  // On a phone the copy sits above the Earth, so the Earth can start below the fold.
  await page.locator(HIT).scrollIntoViewIfNeeded();
  const c = centre(await hitBox(page));
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx, c.y + 10, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);
}

// --- the checks ------------------------------------------------------------

async function checkNoFrame(browser) {
  for (const size of [WIDE, NARROW]) {
    const { page, context } = await open(browser, size, { reduce: true });
    const found = await page.evaluate(
      ({ stage, hero }) => {
        const el = document.querySelector(stage);
        const style = getComputedStyle(el);
        const pseudo = ["::before", "::after"].map(
          (p) => getComputedStyle(el, p).content,
        );
        // A bracket is a corner the page draws: one a rule has switched off is not.
        const brackets = [...document.querySelectorAll(`${hero} *`)].filter(
          (node) =>
            /brackets/.test(String(node.className)) &&
            ["::before", "::after"].some(
              (p) => getComputedStyle(node, p).display !== "none",
            ),
        );
        return {
          borders: [
            "border-top-width",
            "border-right-width",
            "border-bottom-width",
            "border-left-width",
          ].map((p) => style.getPropertyValue(p)),
          background: style.backgroundColor,
          image: style.backgroundImage,
          shadow: style.boxShadow,
          overflow: `${style.overflowX} ${style.overflowY}`,
          pseudo,
          brackets: brackets.length,
        };
      },
      { stage: STAGE, hero: HERO },
    );
    const t = "hero › globe stage";
    check(
      found.borders.every((w) => w === "0px"),
      "framed",
      t,
      `has a border (${found.borders.join(" ")})`,
      size,
    );
    check(
      colorAlpha(found.background) === 0 && found.image === "none",
      "framed",
      t,
      `has a fill (${found.background}, ${found.image})`,
      size,
    );
    check(
      found.shadow === "none",
      "framed",
      t,
      `has a shadow (${found.shadow})`,
      size,
    );
    check(
      found.overflow === "visible visible",
      "framed",
      t,
      `clips its content (${found.overflow})`,
      size,
    );
    check(
      found.pseudo.every((c) => c === "none" || c === "normal"),
      "framed",
      t,
      `draws pseudo-elements (${found.pseudo.join(" ")})`,
      size,
    );
    check(
      found.brackets === 0,
      "framed",
      "hero › brackets",
      "the hero carries a bracket",
      size,
    );
    await context.close();
    measured++;
  }
}

async function checkPosition(browser) {
  const sizes = [
    [390, 844],
    [768, 844],
    [1280, 900],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
    [3008, 1692],
  ];
  for (const [width, height] of sizes) {
    const size = { width, height };
    const { page, context } = await open(browser, size, { reduce: true });
    const hit = await hitBox(page);
    const stage = await page.locator(STAGE).boundingBox();
    const disc = centre(hit);
    const area = centre(stage);
    const t = "hero › disc";
    const wide = width >= 1280;
    const copy = await copyRect(page);
    const radius = (hit.width / 2) * 1.06;
    check(
      Math.abs(disc.y - area.y) <= 1,
      "off-centre",
      t,
      `the disc centre y is ${r1(disc.y)} and the globe area's ${r1(area.y)}`,
      size,
    );
    if (!wide) {
      check(
        Math.abs(disc.x - area.x) <= 1,
        "off-centre",
        t,
        `the disc centre x is ${r1(disc.x)} and the globe area's ${r1(area.x)}`,
        size,
      );
      if (width < 1280) {
        const main = await page.locator("main").first().boundingBox();
        check(
          Math.abs(disc.x - centre(main).x) <= 2,
          "off-centre",
          t,
          `the disc centre x ${r1(disc.x)} is not main's ${r1(centre(main).x)}`,
          size,
        );
      }
    } else {
      /* The page's centre, or where the copy's end pushes it: measured from the live copy. */
      const page_ = width / 2;
      const clear = copy.right + 16 + radius;
      const want = Math.max(page_, clear);
      check(
        Math.abs(disc.x - want) <= 1,
        "off-centre",
        t,
        `the disc centre x is ${r1(disc.x)}; the page's centre is ${r1(page_)} and the copy-clear x ${r1(clear)}, so ${r1(want)} was due`,
        size,
      );
      const zoom = await page.locator(gate("globe-zoom")).boundingBox();
      if (zoom) {
        const nx = Math.max(zoom.x, Math.min(disc.x, zoom.x + zoom.width));
        const ny = Math.max(zoom.y, Math.min(disc.y, zoom.y + zoom.height));
        const off = Math.hypot(nx - disc.x, ny - disc.y) - hit.width / 2;
        check(
          off >= 8,
          "zoom-stack",
          "hero › zoom stack",
          `the zoom stack is ${r1(off)} px off the disc, not 8`,
          size,
        );
      }
      console.log(
        `     centre ${width}x${height}: disc ${r1(disc.x)} (page ${r1(page_)}, copy-clear ${r1(clear)}), copy ends ${r1(copy.right)}, gap ${r1(disc.x - radius - copy.right)}`,
      );
    }
    const gap =
      width < 1280
        ? disc.y - radius - copy.bottom
        : disc.x - radius - copy.right;
    check(
      gap >= 16 - 0.01,
      "copy-crowded",
      "hero › copy",
      `the atmosphere clears the copy by ${r1(gap)} px, not 16`,
      size,
    );
    await context.close();
    measured++;
  }
}

async function checkDrawer(browser, size) {
  const t = "hero › zone drawer";
  const { page, context, problems } = await open(browser, size, {
    reduce: true,
  });
  for (const problem of problems) fail("page-error", "page", problem, size);
  const finder = page.getByRole("region", { name: "Zone finder" });
  const magnifier = page.getByRole("button", { name: "Find a zone" });
  const before = await onPage(page, await hitBox(page));

  check(
    (await finder.count()) === 0 && !(await regionOpen(page)),
    "drawer-open-on-load",
    t,
    "the drawer is in the accessibility tree on load",
    size,
  );
  check(
    (await page
      .locator(REGION)
      .evaluate((el) => getComputedStyle(el).visibility)) === "hidden",
    "drawer-open-on-load",
    t,
    "the drawer is visible on load",
    size,
  );

  await dragOnEarth(page);
  check(
    await regionOpen(page),
    "drawer-no-open",
    t,
    "a drag did not open it",
    size,
  );
  const inDrawer = await page.evaluate(
    (sel) => document.querySelector(sel)?.contains(document.activeElement),
    REGION,
  );
  check(
    !inDrawer,
    "drawer-moved-focus",
    t,
    "a drag moved focus into the drawer",
    size,
  );
  const opened = await onPage(page, await hitBox(page));
  check(
    ["x", "y", "width", "height"].every(
      (k) => Math.abs(opened[k] - before[k]) <= 0.5,
    ),
    "disc-moved",
    "hero › disc",
    `opening the drawer moved the disc (${r1(before.x)},${r1(before.y)} to ${r1(opened.x)},${r1(opened.y)})`,
    size,
  );

  await checkPlacement(page, size, t);

  /* A list that lost its height bound once froze the page, so the list must fit the drawer and
     the page must answer straight away. */
  const drawerBox = await page.locator(REGION).boundingBox();
  const listBox = await page
    .locator(REGION)
    .getByRole("listbox")
    .first()
    .boundingBox();
  check(
    listBox !== null && listBox.height <= drawerBox.height + 1,
    "drawer-list-unbounded",
    t,
    `the zone list is ${r1(listBox?.height ?? 0)} px high in a ${r1(drawerBox.height)} px drawer`,
    size,
  );
  check(
    await answersWithin(page, 1000),
    "page-unresponsive",
    t,
    "the page did not answer within 1s after the drawer opened",
    size,
  );

  if (size.width < 800) {
    const region = await onPage(page, await page.locator(REGION).boundingBox());
    check(
      region.y >= before.y + before.height,
      "sheet-over-disc",
      t,
      `the sheet's top ${r1(region.y)} is above the disc's bottom ${r1(before.y + before.height)}`,
      size,
    );
  }

  await page.getByRole("button", { name: "Close zone list" }).click();
  await page.waitForTimeout(400);
  check(
    !(await regionOpen(page)),
    "drawer-no-close",
    t,
    "the close did not close it",
    size,
  );
  await dragOnEarth(page, -140);
  check(
    !(await regionOpen(page)),
    "drawer-reopened",
    t,
    "a drag reopened a drawer the reader closed",
    size,
  );

  await magnifier.click();
  await page.waitForTimeout(400);
  check(
    await regionOpen(page),
    "drawer-no-open",
    t,
    "the magnifier did not open it",
    size,
  );
  const search = page.getByRole("combobox", { name: "Find a zone" });
  check(
    await search.evaluate((el) => el === document.activeElement),
    "drawer-focus",
    t,
    "the magnifier did not focus the search",
    size,
  );
  await checkEscape(page, size, t);
  const shift = await page.evaluate(() => window.__shift);
  check(
    shift === 0,
    "layout-shift",
    t,
    `layout shift ${shift.toFixed(4)}, not 0`,
    size,
  );
  await context.close();
  measured++;
}

/** The drawer inside the hero: 16 px in from the top and bottom of the hero's content box (below
    the header, which the hero runs under), or the sheet in the bay. */
async function checkPlacement(page, size, t) {
  const box = await page.locator(HERO).boundingBox();
  const padTop = await page
    .locator(HERO)
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingTop));
  const hero = { ...box, y: box.y + padTop, height: box.height - padTop };
  const region = await page.locator(REGION).boundingBox();
  const gap = 16;
  if (size.width >= 1280) {
    check(
      Math.abs(region.y - (hero.y + gap)) <= 1,
      "drawer-placement",
      t,
      `the drawer's top ${r1(region.y)} is not 16 px below the hero's top ${r1(hero.y)}`,
      size,
    );
  } else {
    check(
      region.y >= hero.y,
      "drawer-placement",
      t,
      `the sheet's top ${r1(region.y)} is above the hero's top ${r1(hero.y)}`,
      size,
    );
  }
  check(
    Math.abs(region.y + region.height - (hero.y + hero.height - gap)) <= 1,
    "drawer-placement",
    t,
    `the drawer's bottom ${r1(region.y + region.height)} is not 16 px above the hero's bottom ${r1(hero.y + hero.height)}`,
    size,
  );
  if (size.width < 1280) {
    check(
      Math.abs(region.x - gap) <= 1 &&
        Math.abs(region.x + region.width - (size.width - gap)) <= 1,
      "drawer-placement",
      t,
      `the sheet spans ${r1(region.x)} to ${r1(region.x + region.width)}, not 16 px in from both sides`,
      size,
    );
  }
}

/** Escape, as the combobox pattern and the disclosure pattern together decide it. */
async function checkEscape(page, size, t) {
  const magnifier = page.getByRole("button", { name: "Find a zone" });
  const search = page.getByRole("combobox", { name: "Find a zone" });
  const expanded = () => search.getAttribute("aria-expanded");
  const onMagnifier = () =>
    magnifier.evaluate((el) => el === document.activeElement);
  const reopen = async () => {
    if (!(await regionOpen(page))) {
      await magnifier.click();
      await page.waitForTimeout(400);
    }
  };

  await reopen();
  check(
    (await expanded()) === "false",
    "escape",
    t,
    "opening by the magnifier left the suggestions open over the zone list",
    size,
  );
  await search.fill("");
  await search.pressSequentially("af");
  await page.waitForTimeout(200);
  check(
    (await expanded()) === "true",
    "escape",
    t,
    "typing did not open the suggestions",
    size,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  check(
    (await expanded()) === "false" && (await regionOpen(page)),
    "escape",
    t,
    "Escape with the suggestions open did not close only them",
    size,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(350);
  check(
    !(await regionOpen(page)) && (await onMagnifier()),
    "escape",
    t,
    "a second Escape did not close the drawer and focus the magnifier",
    size,
  );

  // With the suggestions shut, one Escape closes the drawer: the field untouched, and holding text
  // that matches nothing. Emptying the field lists every zone, so there the first Escape shuts the
  // list and the second closes the drawer, as with any open list.
  for (const typed of [null, "zzz", ""]) {
    const what =
      typed === null
        ? "the zone's name"
        : typed === ""
          ? "no text"
          : `"${typed}"`;
    await reopen();
    if (typed !== null) await search.fill(typed);
    await page.waitForTimeout(200);
    if (typed !== "") {
      check(
        (await expanded()) === "false",
        "escape",
        t,
        `the suggestions are open with ${what} in the search`,
        size,
      );
    } else {
      check(
        (await expanded()) === "true",
        "escape",
        t,
        "emptying the search did not list the zones",
        size,
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
      check(
        (await expanded()) === "false" && (await regionOpen(page)),
        "escape",
        t,
        "Escape over the full list did not close only the list",
        size,
      );
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
    check(
      !(await regionOpen(page)) && (await onMagnifier()),
      "escape",
      t,
      `Escape with the suggestions shut and ${what} in the search did not close the drawer and focus the magnifier`,
      size,
    );
  }
}

async function checkClose(browser) {
  const t = "hero › drawer close";
  {
    const { page, context } = await open(browser, WIDE, { reduce: true });
    const closed = await page
      .locator(CLOSE)
      .evaluate((el) => getComputedStyle(el).visibility);
    check(
      closed === "hidden",
      "close-visible-shut",
      t,
      "the close shows while the drawer is shut",
      WIDE,
    );
    await page.getByRole("button", { name: "Zoom in" }).focus();
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      seen.push(
        await page.evaluate(
          (sel) => document.activeElement === document.querySelector(sel),
          CLOSE,
        ),
      );
    }
    check(
      !seen.includes(true),
      "close-tabbable-shut",
      t,
      "Tab reaches the close while it is shut",
      WIDE,
    );

    await page.getByRole("button", { name: "Find a zone" }).click();
    await page.waitForTimeout(1200);
    const close = await page.locator(CLOSE).boundingBox();
    const region = await page.locator(REGION).boundingBox();
    check(
      Math.abs(centre(close).y - centre(region).y) <= 1,
      "close-misplaced",
      t,
      `its centre ${r1(centre(close).y)} is not the drawer's ${r1(centre(region).y)}`,
      WIDE,
    );
    // A tab on the pane: its joining edge laps the pane's left edge by 1px.
    const lap = close.x + close.width - region.x;
    check(
      Math.abs(lap - 1) <= 0.5,
      "close-misplaced",
      t,
      `it laps the drawer's left edge by ${r1(lap)} px, not 1`,
      WIDE,
    );

    // The card, with the pin walked across the globe: it clears the close or it hides.
    const hit = page.locator(HIT);
    await hit.focus();
    let worst = null;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(i < 20 ? "ArrowLeft" : "ArrowRight");
      await page.waitForTimeout(120);
      const card = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el || el.hidden) return null;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none")
          return null;
        const r = el.getBoundingClientRect();
        return { right: r.right, bottom: r.bottom, top: r.top };
      }, TOOLTIP);
      if (card && card.right > close.x - 8) {
        worst = Math.max(worst ?? -Infinity, card.right - (close.x - 8));
      }
    }
    check(
      worst === null,
      "card-under-close",
      "hero › location card",
      `the card reaches ${r1(worst)} px past the close's clearance`,
      WIDE,
    );
    await context.close();
    measured++;
  }
  {
    const { page, context } = await open(browser, NARROW, { reduce: true });
    await page.getByRole("button", { name: "Find a zone" }).click();
    await page.waitForTimeout(1200);
    const close = await page.locator(CLOSE).boundingBox();
    const region = await page.locator(REGION).boundingBox();
    const lap = close.y + close.height - region.y;
    check(
      Math.abs(lap - 1) <= 0.5 &&
        Math.abs(centre(close).x - centre(region).x) <= 1,
      "close-misplaced",
      t,
      `it laps the sheet's top edge by ${r1(lap)} px, not 1, or is off its centre`,
      NARROW,
    );
    await context.close();
    measured++;
  }
}

async function checkSearch(browser, wanted) {
  const both = !wanted || wanted.includes(PLANNER);
  for (const size of wanted && !wanted.includes(ROUTE) ? [] : [WIDE, NARROW]) {
    const t = "hero › zone search";
    const { page, context } = await open(browser, size, { reduce: true });
    await page.getByRole("button", { name: "Find a zone" }).click();
    await page.waitForTimeout(1000);
    const search = page.getByRole("combobox", { name: "Find a zone" });
    check(
      (await search.getAttribute("placeholder")) ===
        "Find zone, e.g. Asia/Tokyo",
      "search-label",
      t,
      "the placeholder is not 'Find zone, e.g. Asia/Tokyo'",
      size,
    );
    const label = await page.evaluate(() => {
      const input = document.querySelector("[role='combobox']");
      const el =
        input?.labels?.[0] ??
        document.querySelector(`label[for='${input?.id}']`);
      const r = el?.getBoundingClientRect();
      return r ? { w: r.width, h: r.height } : null;
    });
    check(
      label !== null && label.w <= 1 && label.h <= 1,
      "search-label",
      t,
      `the label is ${label ? `${label.w}x${label.h}` : "missing"}, not a 1x1 hidden one`,
      size,
    );
    await search.fill("");
    await search.pressSequentially("af");
    await page.waitForTimeout(500);
    const popup = await page.evaluate((regionSel) => {
      const list = document.querySelector(
        "gmt-listbox:not([hidden])[data-popup], gmt-combobox gmt-listbox",
      );
      const input = document.querySelector("[role='combobox']");
      const region = document.querySelector(regionSel);
      const r = list?.getBoundingClientRect();
      const i = input?.getBoundingClientRect();
      const d = region?.getBoundingClientRect();
      const s = list ? getComputedStyle(list) : null;
      return r && i && d && s
        ? {
            top: r.top,
            bottom: r.bottom,
            inputBottom: i.bottom,
            drawerBottom: d.bottom,
            height: r.height,
            background: s.backgroundColor,
            overflowY: s.overflowY,
          }
        : null;
    }, REGION);
    if (
      !check(
        popup !== null,
        "popup-missing",
        t,
        "no suggestions opened for 'af'",
        size,
      )
    ) {
      await context.close();
      continue;
    }
    check(
      popup.top >= popup.inputBottom - 0.5,
      "popup-above",
      t,
      `the suggestions start at ${r1(popup.top)}, above the input's bottom ${r1(popup.inputBottom)}`,
      size,
    );
    check(
      popup.bottom <= popup.drawerBottom + 0.5,
      "popup-overflows",
      t,
      `the suggestions end at ${r1(popup.bottom)}, past the drawer's bottom ${r1(popup.drawerBottom)}`,
      size,
    );
    const covered = await page.evaluate((regionSel) => {
      const region = document.querySelector(regionSel);
      const list = region.querySelector("gmt-combobox gmt-listbox");
      const p = list.getBoundingClientRect();
      const hit = [];
      for (const el of region.querySelectorAll("[role='option']")) {
        if (list.contains(el)) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const across = Math.min(r.right, p.right) - Math.max(r.left, p.left);
        const down = Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top);
        if (across > 0.5 && down > 0.5) hit.push(el.dataset.value);
      }
      return hit;
    }, REGION);
    check(
      covered.length === 0,
      "popup-over-rows",
      t,
      `the suggestions lie over visible zone rows (${covered.slice(0, 3).join(", ")})`,
      size,
    );
    check(
      colorAlpha(popup.background) >= 0.99,
      "popup-translucent",
      t,
      `the suggestions' background is ${popup.background}`,
      size,
    );
    check(
      popup.overflowY === "auto",
      "popup-no-scroll",
      t,
      `the suggestions' overflow-y is ${popup.overflowY}`,
      size,
    );
    check(
      popup.height <= 16 * REM + 0.5,
      "popup-tall",
      t,
      `the suggestions are ${r1(popup.height)} px high, over 16rem`,
      size,
    );
    await context.close();
    measured++;
  }

  // The Zone Planner's popup carries the same look.
  if (!both) return;
  const context = await browser.newContext({ viewport: WIDE });
  await blockOffSite(context, base);
  const page = await context.newPage();
  await page.goto(`${base}${PLANNER}`, { waitUntil: "networkidle" });
  const add = page.getByRole("combobox", { name: "Add a zone" });
  await add.click();
  await add.pressSequentially("a");
  await page.waitForTimeout(500);
  const found = await add.evaluate((input) => {
    const list = input.closest("gmt-combobox")?.querySelector("gmt-listbox");
    if (!list) return null;
    const s = getComputedStyle(list);
    return {
      background: s.backgroundColor,
      overflowY: s.overflowY,
      height: list.getBoundingClientRect().height,
    };
  });
  const t = "zone planner › add a zone";
  if (
    check(
      found !== null,
      "popup-missing",
      t,
      "no suggestions opened for 'a'",
      WIDE,
    )
  ) {
    check(
      colorAlpha(found.background) >= 0.99,
      "popup-translucent",
      t,
      `background ${found.background}`,
      WIDE,
    );
    check(
      found.overflowY === "auto",
      "popup-no-scroll",
      t,
      `overflow-y ${found.overflowY}`,
      WIDE,
    );
    check(
      found.height <= 16 * REM + 0.5,
      "popup-tall",
      t,
      `${r1(found.height)} px high`,
      WIDE,
    );
  }
  await context.close();
  measured++;
}

let shared = null;
async function launchShared() {
  shared ??= await launch();
  return shared;
}

async function checkZoomFills(browser) {
  for (const size of [WIDE, { width: 1920, height: 1080 }, NARROW]) {
    const { page, context } = await open(browser, size, {
      query: "?globe=canvas2d",
      reduce: true,
    });
    for (let i = 0; i < 8; i++) await page.locator(ZOOM_IN).click();
    await page.waitForTimeout(1500);
    const result = await page.evaluate(
      ({ hero, copy, layer }) => {
        const heroBox = document.querySelector(hero).getBoundingClientRect();
        const canvas = document.querySelector(`${layer} > canvas`);
        const box = canvas.getBoundingClientRect();
        const cr = document.querySelector(copy).getBoundingClientRect();
        const ctx = canvas.getContext("2d");
        const sx = canvas.width / box.width;
        const sy = canvas.height / box.height;
        const holes = [];
        const probe = (x, y) => {
          if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom)
            return;
          // Where the copy is stacked above the Earth (a phone), everything above the copy's
          // end is the copy's band: the Earth is framed in the area below it.
          if (cr.width >= heroBox.width * 0.9 && y <= cr.bottom) return;
          const px = ctx.getImageData(
            Math.min(
              canvas.width - 1,
              Math.max(0, Math.round((x - box.left) * sx)),
            ),
            Math.min(
              canvas.height - 1,
              Math.max(0, Math.round((y - box.top) * sy)),
            ),
            1,
            1,
          ).data;
          if (px[3] < 16)
            holes.push(`${Math.round(x)},${Math.round(y)} alpha ${px[3]}`);
        };
        // The night side is the theme's own translucent wash, so "bare" is no paint at all.
        const inset = 3;
        for (let x = heroBox.left + inset; x < heroBox.right; x += 40) {
          probe(x, heroBox.top + inset);
          probe(x, heroBox.bottom - inset);
        }
        for (let y = heroBox.top + inset; y < heroBox.bottom; y += 40) {
          probe(heroBox.left + inset, y);
          probe(heroBox.right - inset, y);
        }
        return {
          hero: [heroBox.left, heroBox.top, heroBox.width, heroBox.height],
          canvas: [box.left, box.top, box.width, box.height],
          holes: holes.slice(0, 4),
        };
      },
      { hero: HERO, copy: COPY, layer: LAYER },
    );
    const t = "hero › globe at maximum zoom";
    const translucent = await page.evaluate(() =>
      [...document.querySelectorAll("[data-globe-zoom], [data-globe-search]")]
        .map((el) => [
          el.getAttribute("aria-label"),
          getComputedStyle(el).backgroundColor,
        ])
        .filter(([, bg]) => !bg.startsWith("rgb(")),
    );
    check(
      translucent.length === 0,
      "zoom-stack-translucent",
      t,
      `zoom stack controls with a background that is not opaque: ${translucent.map(([name, bg]) => `${name} ${bg}`).join("; ")}`,
      size,
    );
    check(
      result.hero.every((v, i) => Math.abs(v - result.canvas[i]) <= 1),
      "zoom-not-filling",
      t,
      `the canvas ${result.canvas.map(r1).join(",")} is not the hero ${result.hero.map(r1).join(",")}`,
      size,
    );
    check(
      result.holes.length === 0,
      "zoom-not-filling",
      t,
      `the Earth leaves the hero's edge bare (${result.holes.join("; ")})`,
      size,
    );
    await context.close();
    measured++;
  }
}

async function checkFit(browser) {
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920, 2560]) {
    const size = { width, height: 900 };
    const context = await browser.newContext({
      viewport: size,
      reducedMotion: "reduce",
    });
    await blockOffSite(context, base);
    const page = await context.newPage();
    await page.goto(`${base}${ROUTE}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const wide = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    check(
      wide[0] === wide[1],
      "sideways-scroll",
      "page",
      `scrollWidth ${wide[0]} is not clientWidth ${wide[1]}`,
      size,
    );
    await context.close();
    measured++;
  }
}

async function checkFrames(browser) {
  {
    const { page, context } = await open(browser, WIDE);
    const median = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          let last = performance.now();
          const tick = (now) => {
            times.push(now - last);
            last = now;
            if (times.length < 121) requestAnimationFrame(tick);
            else {
              const sorted = times.slice(1).sort((a, b) => a - b);
              resolve(sorted[Math.floor(sorted.length / 2)]);
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    check(
      median <= 17.5,
      "slow-frames",
      "hero › globe",
      `median frame ${median.toFixed(1)} ms over 120, limit 17.5`,
      WIDE,
    );
    await context.close();
    measured++;
  }
  {
    const { page, context } = await open(browser, NARROW);
    await page.evaluate(() => {
      window.__frames = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => {
        window.__frames++;
        return raf(cb);
      };
    });
    /* The landing is shorter than two screens, so its foot still shows the Earth. A spacer gives
       the page room to scroll the hero out of sight, which is what this measures. */
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.blockSize = `${2 * window.innerHeight}px`;
      document.body.append(spacer);
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(800);
    check(
      await page.evaluate(
        (sel) => document.querySelector(sel).getBoundingClientRect().bottom < 0,
        HERO,
      ),
      "draws-off-screen",
      "hero › globe",
      "the hero is still on screen at the foot of the page, so nothing was measured",
      NARROW,
    );
    await page.evaluate(() => {
      window.__frames = 0;
    });
    await page.waitForTimeout(500);
    const frames = await page.evaluate(() => window.__frames);
    check(
      frames === 0,
      "draws-off-screen",
      "hero › globe",
      `${frames} frame callbacks in 500 ms with the hero off screen`,
      NARROW,
    );
    await context.close();
    measured++;
  }
}

async function checkInteraction(browser) {
  const t = "hero › globe";
  const { page, context } = await open(browser, WIDE, { reduce: true });
  // The card's clock ticks, so the pictures are of the Earth alone.
  await page.addStyleTag({ content: `${TOOLTIP} { visibility: hidden; }` });
  // The sun creeps, so two pictures of a still Earth differ by a few faint pixels: only a real
  // change (many pixels, clearly different) counts.
  const shot = async () => PNG.sync.read(await page.screenshot());
  const moved = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const d =
        Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d > 30) n++;
    }
    return n > 400;
  };
  const differs = async (act, rule, what) => {
    const a = await shot();
    await act();
    await page.waitForTimeout(1000);
    const b = await shot();
    check(moved(a, b), rule, t, `${what} did not change the globe`, WIDE);
  };
  await differs(() => dragOnEarth(page, 120), "no-drag", "a drag");
  await page.locator(HIT).focus();
  await differs(
    async () => {
      for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    },
    "no-keys",
    "the arrow keys",
  );
  const c = centre(await hitBox(page));
  await differs(
    async () => {
      await page.mouse.move(c.x, c.y);
      await page.mouse.wheel(0, -400);
    },
    "no-wheel",
    "a wheel zooming in",
  );
  // A reader's work on the globe opens the zone list, which hides the zoom stack; the buttons
  // are for a shut list, so it is shut before each press.
  const press = async (selector) => {
    if (await regionOpen(page)) {
      await page.locator(CLOSE).click();
      await page.waitForTimeout(400);
    }
    await page.locator(selector).click();
  };
  await differs(() => press(ZOOM_OUT), "no-zoom-out", "the zoom-out button");
  await differs(() => press(ZOOM_IN), "no-zoom-in", "the zoom-in button");
  await differs(() => press(ZOOM_RESET), "no-reset", "the reset button");

  // A click selects a zone: the search value and the clocks selection follow.
  if (!(await regionOpen(page))) {
    await page.getByRole("button", { name: "Find a zone" }).click();
    await page.waitForTimeout(800);
  }
  const search = page.getByRole("combobox", { name: "Find a zone" });
  const value = () => search.inputValue();
  const selected = () =>
    page.evaluate(
      () =>
        document.querySelector(
          "[role='listbox'] [role='option'][aria-selected='true']",
        )?.textContent ?? "",
    );
  const was = [await value(), await selected()];
  const box = await hitBox(page);
  for (const [dx, dy] of [
    [-0.45, 0.2],
    [0.1, -0.3],
    [-0.2, -0.45],
    [0.3, 0.3],
  ]) {
    await page.mouse.click(
      box.x + box.width / 2 + dx * box.width,
      box.y + box.height / 2 + dy * box.height,
    );
    await page.waitForTimeout(500);
    if ((await value()) !== was[0]) break;
  }
  const now = [await value(), await selected()];
  check(
    now[0] !== was[0],
    "no-select",
    t,
    "a click on the Earth did not update the search value",
    WIDE,
  );
  check(
    now[1] !== was[1],
    "no-select",
    t,
    "a click on the Earth did not update the clocks' selection",
    WIDE,
  );

  // A wheel on the copy belongs to the page.
  if (await regionOpen(page)) {
    await page.getByRole("button", { name: "Close zone list" }).click();
    await page.waitForTimeout(400);
  }
  await page.locator(ZOOM_RESET).click();
  await page.waitForTimeout(2500);
  const copy = await copyRect(page);
  // The pointer leaves the reset button first, so its hover fill is not in the picture.
  await page.mouse.move(
    (copy.left + copy.right) / 2,
    (copy.top + copy.bottom) / 2,
  );
  await page.waitForTimeout(400);
  const still = await shot();
  const y0 = await page.evaluate(() => window.scrollY);
  // In carousel mode the landing never scrolls: a wheel over the copy steps to the next page
  // instead, which is checked on its own, and the way back is the previous arrow.
  const carousel = await page.evaluate(
    () => document.documentElement.dataset.homeCarousel === "on",
  );
  if (carousel) {
    // The words take the pointer; the gaps between them belong to the Earth.
    const title = await page.locator("h1[data-page-title]").boundingBox();
    await page.mouse.move(
      title.x + title.width / 2,
      title.y + title.height / 2,
    );
  }
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);
  const y1 = await page.evaluate(() => window.scrollY);
  check(
    carousel ? y1 === y0 : y1 > y0,
    "wheel-on-copy",
    t,
    carousel
      ? "a wheel over the copy scrolled the carousel page"
      : "a wheel over the copy did not scroll the page",
    WIDE,
  );
  if (carousel) {
    await page.getByRole("button", { name: "Previous: Intro" }).click();
    // On the first page the previous arrow turns off and hands focus to the next arrow; its ring
    // is not the Earth, so it leaves the picture.
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(
      (copy.left + copy.right) / 2,
      (copy.top + copy.bottom) / 2,
    );
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  check(
    !moved(await shot(), still),
    "wheel-on-copy",
    t,
    "a wheel over the copy zoomed the globe",
    WIDE,
  );
  await context.close();
  measured++;
}

// --- the zone list ---------------------------------------------------------

const ZONE_TOOL = "/tools/zoned-earth/";
/** The row gap the virtualizer lays between rows (`ROW_GAP` in `zone-clock-list.ts`). */
const ROW_GAP = 4;
const nextFrames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 30)),
        ),
      ),
  );

/** The clock list as it stands: its box, scroll state, mounted rows in order and active option. */
function listSnapshot(page) {
  return page.evaluate(() => {
    const panel = document.querySelector("[data-clock-sizer]").parentElement;
    const p = panel.getBoundingClientRect();
    const rows = [...panel.querySelectorAll("[role='option']")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          index: Number(el.dataset.index),
          name: el.dataset.value,
          top: r.top,
          bottom: r.bottom,
          id: el.id,
        };
      })
      .sort((a, b) => a.index - b.index);
    return {
      count: panel.count,
      scrollTop: panel.scrollTop,
      max: panel.scrollHeight - panel.clientHeight,
      panel: { top: p.top, bottom: p.bottom },
      rows,
      active: panel.getAttribute("aria-activedescendant"),
    };
  });
}

/** What is wrong with the rows now showing: overlaps, holes, an unfilled viewport. Empty when sound. */
function listProblems(snap) {
  const problems = [];
  const { rows, panel } = snap;
  if (rows.length === 0 && snap.count > 0) return ["no row is mounted"];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (b.index !== a.index + 1) {
      problems.push(
        `rows ${a.index} and ${b.index} are mounted with a row missing between`,
      );
      continue;
    }
    const gap = b.top - a.bottom;
    if (gap < -0.5)
      problems.push(`rows ${a.index} and ${b.index} overlap by ${r1(-gap)} px`);
    if (gap > ROW_GAP + 1.5)
      problems.push(
        `a ${r1(gap)} px gap between rows ${a.index} and ${b.index}`,
      );
  }
  const shown = rows.filter(
    (row) => row.bottom > panel.top && row.top < panel.bottom,
  );
  if (shown.length === 0) {
    problems.push("no row is inside the list's box");
  } else {
    // The box's edge may sit in the gap between two rows, so an edge shortfall up to one gap is
    // fine; a hole is a row that should show and is not mounted.
    const edge = ROW_GAP + 1;
    if (snap.scrollTop > 1 && shown[0].top > panel.top + edge)
      problems.push(
        `the list starts ${r1(shown[0].top - panel.top)} px below its top with rows above it`,
      );
    if (
      snap.scrollTop < snap.max - 1 &&
      shown.at(-1).bottom < panel.bottom - edge
    )
      problems.push(
        `the list ends ${r1(panel.bottom - shown.at(-1).bottom)} px above its bottom with rows below it`,
      );
  }
  return problems;
}

/**
 * Scroll the list and let it settle: rows are measured as they mount, so the scroll height
 * grows while a reader scrolls. "end" keeps pressing on the end until the height holds still,
 * as a reader holding the key down does, and a position waits out the measuring passes.
 */
const scrollList = async (page, to) => {
  for (let pass = 0; pass < 8; pass++) {
    const settled = await page.evaluate(
      (top) =>
        new Promise((resolve) => {
          const panel =
            document.querySelector("[data-clock-sizer]").parentElement;
          panel.style.scrollBehavior = "auto";
          const before = panel.scrollHeight;
          panel.scrollTop = top === "end" ? panel.scrollHeight : top;
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              setTimeout(
                () =>
                  resolve(
                    panel.scrollHeight === before &&
                      (top !== "end" ||
                        panel.scrollTop >=
                          panel.scrollHeight - panel.clientHeight - 1),
                  ),
                120,
              ),
            ),
          );
        }),
      to,
    );
    if (settled) return;
  }
};

/** The option the list says is active, when it is mounted and inside the list's box. */
function activeProblem(snap) {
  const row = snap.rows.find((r) => r.id === snap.active);
  if (!row) return `the active option ${snap.active} is not a mounted row`;
  if (row.top < snap.panel.top - 1.5 || row.bottom > snap.panel.bottom + 1.5)
    return `the active row ${row.index} (${r1(row.top)} to ${r1(row.bottom)}) is outside the list ${r1(snap.panel.top)} to ${r1(snap.panel.bottom)}`;
  return null;
}

async function checkZoneList(browser, { label, size, route, drawer }) {
  const t = `zone list › ${label}`;
  const context = await browser.newContext({
    viewport: size,
    reducedMotion: "reduce",
  });
  await blockOffSite(context, base);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await page
    .locator("[data-clock-sizer]")
    .waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForTimeout(SETTLE);
  if (drawer) {
    await page.getByRole("button", { name: "Find a zone" }).click();
    await page.waitForTimeout(1200);
  }
  const panel = page.getByRole("listbox", { name: /Pinned zones/ });

  // Scroll through every position: rows never overlap or leave gaps, and every zone shows up once.
  let snap = await listSnapshot(page);
  const total = snap.count;
  check(total > 100, "zone-list", t, `the list has ${total} zones`, size);
  const seen = new Set();
  const step = Math.max(40, (snap.panel.bottom - snap.panel.top) * 0.7);
  let first = true;
  for (let top = 0; ; top += step) {
    await scrollList(page, Math.min(top, snap.max));
    snap = await listSnapshot(page);
    for (const row of snap.rows) seen.add(row.index);
    const problems = listProblems(snap);
    if (
      !check(
        problems.length === 0,
        "zone-list-rows",
        t,
        `at scroll ${Math.round(snap.scrollTop)}: ${problems.join("; ")}`,
        size,
      )
    )
      break;
    if (first) {
      first = false;
      check(
        snap.rows[0]?.index === 0 && snap.rows[0].top >= snap.panel.top - 1,
        "zone-list-ends",
        t,
        "the first zone is not at the top of the list",
        size,
      );
    }
    if (top >= snap.max) break;
  }
  await scrollList(page, "end");
  snap = await listSnapshot(page);
  const last = snap.rows.find((row) => row.index === total - 1);
  check(
    last !== undefined &&
      last.bottom <= snap.panel.bottom + 1 &&
      last.top >= snap.panel.top - 1,
    "zone-list-ends",
    t,
    `the last zone (${total - 1}) is not reachable at the end of the list`,
    size,
  );
  for (const row of snap.rows) seen.add(row.index);
  check(
    seen.size === total,
    "zone-list-ends",
    t,
    `${total - seen.size} of ${total} zones never showed while scrolling`,
    size,
  );

  // A wheel over the list scrolls it.
  await scrollList(page, 0);
  // On a phone the sheet can sit below the fold: a pointer off the screen gets no wheel.
  await panel.scrollIntoViewIfNeeded();
  /* The page may still be gliding to the sheet; a box taken mid-glide puts the pointer, and the
     wheel with it, beside the list. Measure once the page is still, and wait for the list to move
     rather than for a fixed time, so a busy machine is not mistaken for a dead wheel. */
  await scrollSettled(page);
  const box = await panel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 900);
  await nextFrames(page);
  await page
    .waitForFunction(
      () =>
        document.querySelector("[data-clock-sizer]").parentElement.scrollTop >
        100,
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
  snap = await listSnapshot(page);
  check(
    snap.scrollTop > 100,
    "zone-list-wheel",
    t,
    `a wheel over the list moved it ${Math.round(snap.scrollTop)} px`,
    size,
  );
  check(
    listProblems(snap).length === 0,
    "zone-list-rows",
    t,
    `after a wheel: ${listProblems(snap).join("; ")}`,
    size,
  );

  // Filter while scrolled well down: the list restarts at its top, filled.
  await scrollList(page, "end");
  const gear = page.locator("button[aria-controls$='-gear-panel']").first();
  await gear.click();
  await page.getByRole("switch", { name: /In DST/ }).click();
  await page.waitForTimeout(500);
  await nextFrames(page);
  snap = await listSnapshot(page);
  check(
    snap.count > 0 && snap.count < total,
    "zone-list-filter",
    t,
    `filtering left ${snap.count} of ${total} zones`,
    size,
  );
  check(
    listProblems(snap).length === 0 && snap.rows[0]?.index === 0,
    "zone-list-filter",
    t,
    `after a filter: ${listProblems(snap).join("; ") || "row 0 is not first"}`,
    size,
  );
  await scrollList(page, "end");
  snap = await listSnapshot(page);
  const filteredLast = snap.rows.find((row) => row.index === snap.count - 1);
  check(
    filteredLast !== undefined && filteredLast.bottom <= snap.panel.bottom + 1,
    "zone-list-filter",
    t,
    "the last filtered zone is not reachable",
    size,
  );
  await page.getByRole("switch", { name: /In DST/ }).click();
  await page.waitForTimeout(500);
  await nextFrames(page);
  snap = await listSnapshot(page);
  check(
    snap.count === total,
    "zone-list-filter",
    t,
    `clearing the filter left ${snap.count} of ${total} zones`,
    size,
  );
  await gear.click();

  // The keys: Home, End and every Arrow step keep the active row on screen.
  await scrollList(page, 0);
  await panel.focus();
  await page.keyboard.press("End");
  await nextFrames(page);
  snap = await listSnapshot(page);
  let problem = activeProblem(snap);
  check(
    problem === null && snap.rows.at(-1)?.index === total - 1,
    "zone-list-keys",
    t,
    `End: ${problem ?? "the last row is not mounted"}`,
    size,
  );
  await page.keyboard.press("Home");
  await nextFrames(page);
  snap = await listSnapshot(page);
  problem = activeProblem(snap);
  check(
    problem === null && snap.rows[0]?.index === 0,
    "zone-list-keys",
    t,
    `Home: ${problem ?? "the first row is not mounted"}`,
    size,
  );
  let bad = null;
  for (let i = 1; i < total && bad === null; i++) {
    await page.keyboard.press("ArrowDown");
    await nextFrames(page);
    snap = await listSnapshot(page);
    bad =
      activeProblem(snap) ??
      (i % 10 === 0 ? (listProblems(snap)[0] ?? null) : null);
    if (bad) bad = `ArrowDown ${i}: ${bad}`;
  }
  check(bad === null, "zone-list-keys", t, bad ?? "", size);
  for (let i = 0; i < 40 && bad === null; i++) {
    await page.keyboard.press("ArrowUp");
    await nextFrames(page);
    snap = await listSnapshot(page);
    bad = activeProblem(snap);
    if (bad) bad = `ArrowUp ${i}: ${bad}`;
  }
  check(bad === null, "zone-list-keys", t, bad ?? "", size);

  check(pageErrors.length === 0, "page-error", t, pageErrors.join("; "), size);
  await context.close();
  measured++;
}

async function checkZoneLists(browser) {
  await checkZoneList(browser, {
    label: "drawer, wide",
    size: WIDE,
    route: ROUTE,
    drawer: true,
  });
  await checkZoneList(browser, {
    label: "drawer, narrow",
    size: NARROW,
    route: ROUTE,
    drawer: true,
  });
  await checkZoneList(browser, {
    label: "zoned earth",
    size: WIDE,
    route: ZONE_TOOL,
    drawer: false,
  });
}

// --- the phone menu --------------------------------------------------------

/** The phone menu opens onto the sidebar pane, and the Dox link in it can be tapped. */
async function checkMobileMenu(browser) {
  const t = "mobile menu";
  const context = await browser.newContext({
    viewport: NARROW,
    reducedMotion: "reduce",
  });
  await blockOffSite(context, base);
  const page = await context.newPage();
  await page.goto(`${base}${PLANNER}`, { waitUntil: "networkidle" });
  const pane = page.locator("#starlight__sidebar");
  const shown = () =>
    pane.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        visible: getComputedStyle(el).visibility === "visible",
        width: r.width,
        height: r.height,
      };
    });
  let state = await shown();
  check(
    !state.visible,
    "menu-shut",
    t,
    "the menu pane shows before the button is pressed",
    NARROW,
  );
  await page.locator('button[aria-label="Menu"]').click();
  await page.waitForTimeout(300);
  state = await shown();
  check(
    state.visible && state.width > 0 && state.height > 0,
    "menu-opens",
    t,
    `the menu button was pressed and the pane is ${state.visible ? "" : "not "}visible (${r1(state.width)} x ${r1(state.height)})`,
    NARROW,
  );
  const link = page.locator(".mobile-preferences a[href$='/dox/']");
  // The pane scrolls, with smooth scrolling on: go to its end and let it settle before measuring.
  await pane.evaluate((el) => {
    el.style.scrollBehavior = "auto";
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(300);
  const reach = await link.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    return {
      inside:
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth,
      reachable: hit === el || el.contains(hit),
    };
  });
  check(
    reach.inside,
    "menu-dox-link",
    t,
    "the Dox link is outside the screen with the menu open",
    NARROW,
  );
  check(
    reach.reachable,
    "menu-dox-link",
    t,
    "something covers the Dox link with the menu open",
    NARROW,
  );
  await page.locator('button[aria-label="Menu"]').click();
  await page.waitForTimeout(300);
  state = await shown();
  check(
    !state.visible,
    "menu-shut",
    t,
    "the menu pane still shows after the button is pressed again",
    NARROW,
  );
  await context.close();
  measured++;
}

// --- the location card beside the sheet -------------------------------------

/** On a phone the card is clear of the open sheet, or not drawn. */
async function checkNarrowCard(browser) {
  const t = "hero › card beside the sheet";
  const { page, context } = await open(browser, NARROW, { reduce: true });
  await page.getByRole("button", { name: "Find a zone" }).click();
  await page.waitForTimeout(600);
  const result = await page.evaluate(
    ({ tip, region }) => {
      const card = document.querySelector(tip);
      const sheet = document.querySelector(region).getBoundingClientRect();
      const style = getComputedStyle(card);
      const r = card.getBoundingClientRect();
      const drawn =
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        r.width > 0 &&
        r.height > 0;
      const overlap =
        r.left < sheet.right &&
        r.right > sheet.left &&
        r.top < sheet.bottom &&
        r.bottom > sheet.top;
      return {
        drawn,
        overlap,
        card: [r.top, r.bottom],
        sheet: [sheet.top, sheet.bottom],
      };
    },
    { tip: TOOLTIP, region: REGION },
  );
  check(
    !result.drawn || !result.overlap,
    "card-over-sheet",
    t,
    `the card (${r1(result.card[0])} to ${r1(result.card[1])}) is drawn over the sheet (${r1(result.sheet[0])} to ${r1(result.sheet[1])})`,
    NARROW,
  );
  await context.close();
  measured++;
}

// --- forced colours, contrast and reduced motion -----------------------------

/** What a reader with a system colour scheme sees of the drawer's controls. */
/* `open`: the zone list is open, so the zoom stack is hidden and the close button shows; shut, the reverse. */
async function controlProblems(page, open) {
  return page.evaluate(
    ({ region, zoomSel, open }) => {
      const out = [];
      const names = open
        ? ["Close zone list"]
        : ["Zoom in", "Zoom out", "Reset zoom", "Find a zone"];
      const rgbaAlpha = (c) => {
        const m =
          c.match(/\/\s*([\d.]+)\)/) ?? c.match(/rgba\([^)]*,\s*([\d.]+)\)/);
        return m ? Number(m[1]) : 1;
      };
      for (const name of names) {
        const el = [...document.querySelectorAll("button")].find(
          (b) =>
            (b.getAttribute("aria-label") ?? b.textContent).trim() === name,
        );
        if (!el) {
          out.push(`${name}: no such button`);
          continue;
        }
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (
          s.visibility !== "visible" ||
          r.width < 1 ||
          r.height < 1 ||
          Number(s.opacity) < 1
        )
          out.push(`${name}: not visible`);
        if (rgbaAlpha(s.color) < 1)
          out.push(`${name}: its text is see-through`);
        if (s.color === s.backgroundColor && rgbaAlpha(s.backgroundColor) === 1)
          out.push(`${name}: its text is its background`);
      }
      if (!open) return out;
      const search = document.querySelector(`${region} input[role="combobox"]`);
      const ss = getComputedStyle(search);
      if (parseFloat(ss.borderTopWidth) < 1 && parseFloat(ss.outlineWidth) < 1)
        out.push("the search has no edge");
      const box = document.querySelector(region);
      const filtered = [box, ...box.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        return s.backdropFilter !== "none" || s.filter !== "none";
      });
      if (filtered.length)
        out.push(
          `${filtered.length} element(s) in the drawer are blurred or filtered`,
        );
      void zoomSel;
      return out;
    },
    { region: REGION, zoomSel: ZOOM_IN, open },
  );
}

async function checkAccessMode(browser, { label, context, media }) {
  const t = `hero › ${label}`;
  const { page, context: ctx } = await open(browser, WIDE, {
    reduce: true,
    context,
  });
  const on = await page.evaluate((q) => matchMedia(q).matches, media);
  check(
    on,
    "access-emulation",
    t,
    `${media} did not take effect, so nothing here was measured`,
    WIDE,
  );
  for (const problem of await controlProblems(page, false)) {
    fail("access-controls", t, problem, WIDE);
  }
  await page.getByRole("button", { name: "Find a zone" }).click();
  await page.waitForTimeout(600);
  for (const problem of await controlProblems(page, true)) {
    fail("access-controls", t, problem, WIDE);
  }
  await ctx.close();
  measured++;
}

/** Under reduced motion the drawer fades in place: it never slides, and it does fade. */
// --- the night sky ---------------------------------------------------------

const SKY_STARS = "[data-sky-canvas='stars']";
const SKY_METEOR = "[data-sky-canvas='meteor']";

/** What the stars canvas says it drew: the view (RA, Dec, instant) and how many draws, how long the last took. */
const skyReading = (page) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const [ra, dec, instant] = (el?.dataset.skyView ?? "0 0 0")
      .split(" ")
      .map(Number);
    return {
      draws: Number(el?.dataset.skyDraws ?? 0),
      ms: Number(el?.dataset.skyMs ?? 0),
      ra,
      dec,
      instant,
      /* The page's own clock, the one the sky is given. */
      clock: performance.timeOrigin + performance.now(),
    };
  }, SKY_STARS);

/** The shortest signed difference between two angles, degrees, in (-180, 180]. */
const angleGap = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

/** The stars canvas's bright cores (alpha of 200 or more), as [x, y] pairs in canvas pixels. */
const brightCores = (page) =>
  page.evaluate((sel) => {
    const canvas = document.querySelector(sel);
    const { width, height } = canvas;
    const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const cores = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] >= 200) cores.push([x, y]);
    return { width, height, cores };
  }, SKY_STARS);

/**
 * The shift (dx, dy) most of the stars made between two draws: every bright pixel of `before` votes
 * for its offset to every bright pixel of `after` (8 px bins, within a window), and the most
 * voted bin wins. The shift is not quite rigid (the projection bends it), so a bin, not a pixel.
 */
function bestShift(before, after, sign = 0) {
  const BIN = 8;
  const votes = new Map();
  for (const [x, y] of before.cores)
    for (const [u, v] of after.cores) {
      const dx = u - x;
      const dy = v - y;
      /* A 60 px drag turns the sky about 12 degrees (about 110 px): a far offset is a coincidence among few bright stars, not a shift. */
      if (Math.abs(dx) > 400 || Math.abs(dy) > 200) continue;
      if (sign !== 0 && Math.sign(dx) !== sign) continue;
      const key = `${Math.round(dx / BIN)},${Math.round(dy / BIN)}`;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
  let best = { dx: 0, dy: 0, hits: 0, runnerUp: 0 };
  for (const [key, hits] of votes) {
    if (hits <= best.hits) continue;
    const [bx, by] = key.split(",").map(Number);
    best = { dx: bx * BIN, dy: by * BIN, hits, runnerUp: 0 };
  }
  /* The runner-up is the best bin clear of the peak (more than 2 bins away), so a peak split over neighbouring bins is not a rival. */
  for (const [key, hits] of votes) {
    const [bx, by] = key.split(",").map(Number);
    if (
      Math.max(Math.abs(bx * BIN - best.dx), Math.abs(by * BIN - best.dy)) <=
      2 * BIN
    )
      continue;
    best.runnerUp = Math.max(best.runnerUp, hits);
  }
  return best;
}

const median = (list) =>
  [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

/** Starts recording, per animation frame, the frame time and each draw's duration. */
const startSkyRecorder = (page) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    window.__skySamples = [];
    window.__skyFrames = [];
    let last = performance.now();
    let seen = Number(el.dataset.skyDraws);
    const tick = (now) => {
      window.__skyFrames.push(now - last);
      last = now;
      const draws = Number(el.dataset.skyDraws);
      if (draws !== seen) {
        window.__skySamples.push(Number(el.dataset.skyMs));
        seen = draws;
      }
      window.__skyTick = requestAnimationFrame(tick);
    };
    window.__skyTick = requestAnimationFrame(tick);
  }, SKY_STARS);

const stopSkyRecorder = (page) =>
  page.evaluate(() => {
    cancelAnimationFrame(window.__skyTick);
    return { ms: window.__skySamples, frames: window.__skyFrames };
  });

/** The words the sky must never be built from; spelt in two halves so this file does not hold them. */
const BANNED_SKY = new RegExp(
  `${["aur", "ora"].join("")}|${["com", "et"].join("")}`,
  "i",
);

/** No invented sky: nothing in the sources names a body that is not in the star catalogue. */
async function checkSkySources() {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "generated" && entry.name !== "node_modules")
          walk(path);
      } else if (
        /\.(astro|css|mjs|ts|tsx|md|mdx|json)$/.test(entry.name) &&
        BANNED_SKY.test(readFileSync(path, "utf8"))
      )
        found.push(path);
    }
  };
  walk(join(here, "..", "src"));
  walk(here);
  check(
    found.length === 0,
    "sky-invented",
    "hero › night sky",
    `the sources name a sky body that is not in the catalogue: ${found.join(", ")}`,
    WIDE,
  );
  measured++;
}

async function checkSky(browser) {
  const t = "hero › night sky";
  /* A fixed instant, so the stars on screen (and the vote for their shift) do not depend on the hour the gate runs. */
  const pin = SKY_PINS.drag;
  const { page, context, problems } = await open(browser, WIDE, {
    fixed: pin.at,
    context: { timezoneId: pin.zone },
  });
  for (const problem of problems) fail("page-error", "page", problem, WIDE);

  // The credit: the star catalogue and its licence, in the popup the info button opens.
  await page.getByRole("button", { name: "Data credits" }).click();
  for (const text of ["HYG v4.4", "CC BY-SA 4.0"])
    check(
      await page
        .getByText(text)
        .first()
        .isVisible()
        .catch(() => false),
      "sky-credit",
      t,
      `the data credits do not name ${text}`,
      WIDE,
    );
  await page.keyboard.press("Escape");

  // The view is true for the page's clock.
  const c = centre(await hitBox(page));
  const first = await skyReading(page);
  check(first.draws >= 1, "sky-missing", t, "the sky was never drawn", WIDE);

  // At rest (the pointer on the Earth holds the spin off) the sky is not redrawn.
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(300);
  const rest = await skyReading(page);
  check(
    rest.instant === pin.at,
    "sky-clock",
    t,
    `the sky shows the instant ${rest.instant}, the pinned clock is ${pin.at}`,
    WIDE,
  );
  await page.waitForTimeout(4000);
  const still = await skyReading(page);
  check(
    still.draws === rest.draws,
    "sky-redraws-at-rest",
    t,
    `${still.draws - rest.draws} sky draw(s) in 4 s at rest`,
    WIDE,
  );

  // A drag to the right lowers the view's right ascension by the longitude the globe turned.
  const before = await brightCores(page);
  check(
    before.cores.length > 0,
    "sky-missing",
    t,
    "no bright star on the stars canvas",
    WIDE,
  );
  const disc = (await hitBox(page)).width / 2;
  const heldAt = await skyReading(page);
  await startSkyRecorder(page);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y, { steps: 30 });
  await page.waitForTimeout(300);
  const dragged = await skyReading(page);
  const drag = await stopSkyRecorder(page);
  const turn = (60 * 90) / disc;
  const lowered = angleGap(heldAt.ra, dragged.ra);
  check(
    Math.abs(lowered - turn) <= 0.5,
    "sky-follows-drag",
    t,
    `a 60 px drag turned the globe ${r1(turn)} degrees and lowered the view's right ascension by ${r1(lowered)}`,
    WIDE,
  );
  const after = await brightCores(page);
  await page.mouse.up();
  // The stars move left: the best match among shifts to the left beats the best among shifts to the right.
  const left = bestShift(before, after, -1);
  const right = bestShift(before, after, 1);
  check(
    left.dx < -10 &&
      left.hits > right.hits &&
      left.hits >= before.cores.length / 10,
    "sky-follows-drag",
    t,
    `a 60 px drag right: best leftward shift ${left.dx} px with ${left.hits} votes, best rightward ${right.dx} px with ${right.hits}, from ${before.cores.length} bright pixels (they must move left)`,
    WIDE,
  );
  check(
    left.hits >= 2 * left.runnerUp,
    "sky-follows-drag",
    t,
    `the leftward shift ${left.dx} px has ${left.hits} votes and the runner-up ${left.runnerUp}: the peak must stand at least twice as high`,
    WIDE,
  );
  check(
    drag.ms.length > 0,
    "sky-follows-drag",
    t,
    "the drag drew the sky no more",
    WIDE,
  );
  check(
    drag.ms.length <= drag.frames.length,
    "sky-redraws-at-rest",
    t,
    `${drag.ms.length} draws in ${drag.frames.length} frames`,
    WIDE,
  );

  // The ambient spin moves the camera, so the sky follows it, at most once a frame.
  await page.mouse.move(2, 2);
  await page.waitForTimeout(3500);
  const spinFrom = await skyReading(page);
  await startSkyRecorder(page);
  await page.waitForTimeout(6000);
  const spin = await stopSkyRecorder(page);
  const spinTo = await skyReading(page);
  check(
    spinTo.draws > spinFrom.draws,
    "sky-follows-spin",
    t,
    "the sky was not redrawn in the ambient spin",
    WIDE,
  );
  check(
    spin.ms.length <= spin.frames.length,
    "sky-redraws-at-rest",
    t,
    `${spin.ms.length} draws in ${spin.frames.length} frames of the spin`,
    WIDE,
  );
  const draws = [...drag.ms, ...spin.ms];
  if (draws.length)
    check(
      median(draws) <= 2,
      "sky-slow-draw",
      t,
      `median sky draw ${median(draws).toFixed(2)} ms over ${draws.length}, limit 2`,
      WIDE,
    );
  const frames = [...drag.frames, ...spin.frames];
  check(
    median(frames) <= 17.5,
    "slow-frames",
    t,
    `median frame ${median(frames).toFixed(1)} ms while the sky moves, limit 17.5`,
    WIDE,
  );
  await context.close();
  measured++;
}

/**
 * Instants and zones for the Sun and Moon, found with `sky-math` for each zone's starting camera:
 * a half Moon on screen, clear of the Earth; the Sun 34 degrees from it,
 * just inside the Earth's rim, so its glare spills past the edge; the Sun 40 degrees out, in the
 * clear.
 */
const SKY_PINS = {
  half: {
    zone: "Europe/Berlin",
    at: 1_796_127_600_000,
    /* The screen direction from the Moon toward the Sun along the great circle, unit length: a 0.005 step projected by sky-math. */
    toSun: [-0.489, 0.872],
  },
  /* The drag check: Berlin's start camera at a night hour, with many bright stars off the disc. */
  drag: { zone: "Europe/Berlin", at: 1_794_000_000_000 },
  rim: { zone: "Africa/Nairobi", at: 1_794_252_000_000 },
  clear: { zone: "Europe/Berlin", at: 1_794_000_000_000 },
  /* At a 1440 × 900 window, with the intro centred in the stage, the Sun's track crosses the eyebrow, title, tagline and first button; the copy check walks it along that track. */
  glare: { zone: "Europe/Berlin", at: 1_804_098_000_000 },
};

/** The pixels of the stars canvas in a square of `half` pixels each way around a point, as [r, g, b, a] lists. */
const skyPixels = (page, x, y, half) =>
  page.evaluate(
    ([sel, px, py, h]) => {
      const canvas = document.querySelector(sel);
      const box = canvas.getBoundingClientRect();
      const k = canvas.width / box.width;
      const left = Math.max(0, Math.round((px - h) * k));
      const top = Math.max(0, Math.round((py - h) * k));
      const size = Math.max(1, Math.round(2 * h * k));
      const data = canvas
        .getContext("2d")
        .getImageData(left, top, size, size).data;
      const out = [];
      for (let i = 0; i < data.length; i += 4)
        out.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
      return out;
    },
    [SKY_STARS, x, y, half],
  );

async function pinnedSky(browser, pin) {
  const opened = await open(browser, WIDE, {
    reduce: true,
    fixed: pin.at,
    context: { timezoneId: pin.zone },
  });
  const read = await opened.page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const canvas = el.getBoundingClientRect();
    const [sx, sy, mx, my, lit] = el.dataset.skyBodies.split(" ").map(Number);
    return {
      sun: { x: sx, y: sy },
      moon: { x: mx, y: my },
      lit,
      origin: { x: canvas.left, y: canvas.top },
      view: el.dataset.skyView,
    };
  }, SKY_STARS);
  const hit = await hitBox(opened.page);
  return {
    ...opened,
    ...read,
    earth: {
      x: hit.x + hit.width / 2 - read.origin.x,
      y: hit.y + hit.height / 2 - read.origin.y,
      radius: hit.width / 2,
    },
  };
}

/**
 * Watches the sky from the first frame: what the two layers computed and how many draws the stars
 * canvas had while the hero was not yet `data-sky="ready"`, and the draw count and view the moment
 * it became so. Runs in the page, before the page's own scripts.
 */
function watchSkyReveal() {
  const log = { frames: 0, opacity: 0, draws: 0, ready: null };
  window.__reveal = log;
  const layers = () => ({
    band: document.querySelector(".gmt-sky-band"),
    stars: document.querySelector("[data-sky-canvas='stars']"),
  });
  const snap = () => {
    const { band, stars } = layers();
    return band && stars
      ? {
          band: Number(getComputedStyle(band).opacity),
          stars: Number(getComputedStyle(stars).opacity),
          draws: Number(stars.dataset.skyDraws ?? 0),
          view: stars.dataset.skyView ?? "",
        }
      : null;
  };
  const step = () => {
    if (log.ready) return;
    const now = snap();
    if (now) {
      log.frames += 1;
      log.opacity = Math.max(log.opacity, now.band, now.stars);
      log.draws = Math.max(log.draws, now.draws);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  new MutationObserver(() => {
    if (!log.ready && document.querySelector("[data-sky='ready']"))
      log.ready = {
        ...snap(),
        clock: performance.timeOrigin + performance.now(),
      };
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-sky"],
  });
}

/** Sidereal time in degrees at a Unix instant (Meeus 12.4). */
const siderealAt = (ms) => {
  const d = ms / 86_400_000 + 2_440_587.5 - 2_451_545;
  return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360;
};

/** The hero opens as plain void: no layer shows and none is drawn until the sky is drawn once, at the globe's true camera. */
async function checkSkyReveal(browser) {
  const t = "hero › sky from black";
  const pin = SKY_PINS.half;
  const { page, context, problems } = await open(browser, WIDE, {
    fixed: pin.at,
    context: { timezoneId: pin.zone },
    init: watchSkyReveal,
  });
  for (const problem of problems) fail("page-error", "page", problem, WIDE);
  const log = await page.evaluate(() => window.__reveal);
  check(
    log.frames > 0 && log.opacity === 0 && log.draws === 0,
    "sky-from-black",
    t,
    `before the sky was ready the layers reached opacity ${log.opacity} and ${log.draws} draw(s) over ${log.frames} frame(s), both must be 0`,
    WIDE,
  );
  check(
    log.ready?.draws === 1 && log.ready.band === 0 && log.ready.stars === 0,
    "sky-from-black",
    t,
    `at ready the sky had ${log.ready?.draws} draw(s) and opacity ${log.ready?.band}/${log.ready?.stars}, it must be exactly 1 draw with the fade not begun`,
    WIDE,
  );
  // The view drawn is the globe's: at its start rotation (a Berlin visitor looks down on Berlin), for the pinned clock.
  const [ra, dec, instant] = (log.ready?.view ?? "0 0 0")
    .split(" ")
    .map(Number);
  const expectRa = (siderealAt(pin.at) + 180 + 13.405 + 360) % 360;
  check(
    Math.abs(angleGap(ra, expectRa)) <= 0.05 &&
      Math.abs(dec + 52.52) <= 0.05 &&
      instant === pin.at,
    "sky-from-black",
    t,
    `the first draw showed ${ra} ${dec} at ${instant}, the globe's own start view is ${r1(expectRa)} -52.52 at ${pin.at}`,
    WIDE,
  );
  const faded = await page.evaluate(() => ({
    band: getComputedStyle(document.querySelector(".gmt-sky-band")).opacity,
    stars: getComputedStyle(document.querySelector("[data-sky-canvas='stars']"))
      .opacity,
  }));
  check(
    faded.band === "1" && faded.stars === "1",
    "sky-from-black",
    t,
    `after the fade the layers' opacity is ${faded.band} and ${faded.stars}, it must be 1`,
    WIDE,
  );
  await context.close();

  // No globe: the sky is drawn once, at the start rotation, and shows all the same.
  const lonely = await browser.newContext({
    viewport: WIDE,
    timezoneId: pin.zone,
  });
  await blockOffSite(lonely, base);
  await lonely.clock.setFixedTime(pin.at);
  await lonely.route(/\/_astro\/globe\.[^/]*\.js$/, (route) => route.abort());
  const bare = { page: await lonely.newPage(), context: lonely };
  await bare.page.addInitScript(watchSkyReveal);
  await bare.page.goto(`${base}${ROUTE}`, { waitUntil: "load" });
  await bare.page
    .waitForFunction(() => document.querySelector("[data-sky='ready']"), null, {
      timeout: 8000,
    })
    .catch(() => {});
  const lone = await bare.page.evaluate(() => ({
    ready: window.__reveal.ready,
    before: window.__reveal.draws,
  }));
  check(
    lone.ready?.draws === 1 && lone.before === 0,
    "sky-from-black",
    t,
    `with no globe the sky had ${lone.ready?.draws ?? "no"} draw(s) at ready and ${lone.before} before it, it must be 1 and 0`,
    WIDE,
  );
  await bare.context.close();
}

// --- the entrance ----------------------------------------------------------

/**
 * Records the entrance from the first script on the page: when each `data-entrance` value lands,
 * every frame's length from `t0`, the running animations each frame grouped by target and
 * pseudo-element, the copy's lowest opacity, the largest paint, and the location card every
 * 100 ms.
 */
function watchEntrance() {
  const log = {
    entrance: [],
    dawn: null,
    armed: null,
    firstFrame: null,
    t0: null,
    groups: new Map(),
    canvasAnimated: false,
    filters: new Set(),
    props: new Set(),
    starts: new Map(),
    frames: [],
    slow: [],
    card: [],
    copy: null,
    lcp: null,
  };
  window.__entrance = log;
  new PerformanceObserver((list) => {
    const entry = list.getEntries().at(-1);
    if (entry)
      log.lcp = {
        at: Math.round(entry.startTime),
        element: entry.element?.className?.toString?.() ?? "",
      };
  }).observe({ type: "largest-contentful-paint", buffered: true });
  const stamp = () => Math.round(performance.now());
  const note = () => {
    const value = document.documentElement?.dataset.entrance ?? "";
    if (value && log.entrance.at(-1)?.[0] !== value)
      log.entrance.push([value, stamp()]);
  };
  note();
  new MutationObserver(() => {
    note();
    if (!log.dawn && document.querySelector("[data-dawn='done']"))
      log.dawn = stamp();
    if (
      !log.armed &&
      document.querySelector("[data-gate='globe-zoom'][data-ready]")
    )
      log.armed = stamp();
  }).observe(document, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-entrance", "data-dawn", "data-ready"],
  });
  const scaleOf = (card) => {
    const value = getComputedStyle(card).scale;
    return value === "none" ? 1 : Number.parseFloat(value);
  };
  const labels = new Map();
  let last = null;
  let nextCard = 0;
  const step = (now) => {
    const t0 =
      performance.getEntriesByName("gmt-entrance-t0")[0]?.startTime ?? null;
    if (t0 !== null && log.t0 === null) log.t0 = Math.round(t0);
    const canvas = document.querySelector("[data-renderer]");
    if (canvas && log.firstFrame === null && canvas.dataset.entered === "true")
      log.firstFrame = stamp();
    const counts = new Map();
    for (const a of document.getAnimations()) {
      const target = a.effect?.target;
      // Transitions (hover colours, scroll reveals further down) are not the entrance.
      if (
        !target ||
        a.playState !== "running" ||
        typeof a.animationName !== "string"
      )
        continue;
      if (target.matches?.("[data-renderer]")) log.canvasAnimated = true;
      const pseudo = a.effect.pseudoElement ?? "";
      const host =
        target.dataset?.gate ??
        target.className?.toString?.() ??
        target.tagName;
      const label = `${host}${pseudo}`;
      // An animation still in its delay, with no backwards fill, sets nothing yet.
      const inEffect = a.effect.getComputedTiming().progress !== null;
      const names = new Set();
      for (const frame of a.effect.getKeyframes())
        for (const name of Object.keys(frame)) names.add(name);
      if (a.animationName.startsWith("ng-"))
        for (const name of names) log.props.add(name);
      /* One animation per element, per property: two on an element are fine while they move
         different properties. */
      for (const name of names) {
        if (
          !inEffect ||
          ["offset", "easing", "composite", "computedOffset"].includes(name)
        )
          continue;
        const each = counts.get(target) ?? new Map();
        const key = `${pseudo}\u0000${name}`;
        each.set(key, (each.get(key) ?? 0) + 1);
        counts.set(target, each);
        labels.set(target, host);
      }
      if (!log.starts.has(a)) {
        const timing = a.effect.getComputedTiming();
        log.starts.set(a, {
          name: a.animationName,
          key: label,
          delay: timing.delay,
          end: timing.endTime,
        });
      }
    }
    for (const [target, each] of counts)
      for (const [key, count] of each) {
        const [pseudo, property] = key.split("\u0000");
        const name = `${labels.get(target)}${pseudo} ${property}`;
        log.groups.set(name, Math.max(log.groups.get(name) ?? 0, count));
      }
    const h1 = document.querySelector("h1[data-page-title]");
    if (h1) log.filters.add(getComputedStyle(h1).filter);
    // The copy is the page's largest text: it is on screen from the first frame, never faded in.
    const tagline = document.querySelector(".gmt-hero-tagline");
    if (h1 && tagline) {
      const lowest = Math.min(
        Number(getComputedStyle(h1).opacity),
        Number(getComputedStyle(tagline).opacity),
      );
      log.copy ??= { first: lowest, lowest, at: stamp() };
      log.copy.lowest = Math.min(log.copy.lowest, lowest);
    }
    const since = log.t0 === null ? null : now - log.t0;
    if (since !== null && since >= 0 && since <= 2900 && last !== null) {
      log.frames.push(Math.round((now - last) * 10) / 10);
      if (now - last > 34)
        log.slow.push([Math.round(since), Math.round(now - last)]);
    }
    last = now;
    const card = document.querySelector("[data-gate='globe-tooltip']");
    if (card && since !== null && now >= nextCard) {
      nextCard = now + 100;
      const style = getComputedStyle(card);
      const box = card.getBoundingClientRect();
      const pin = Number.parseFloat(card.style.left);
      const pop = card
        .getAnimations()
        .find((a) => a.animationName === "ng-pop");
      log.card.push({
        clock: pop ? Math.round(Number(pop.currentTime)) : null,
        // The pop's own clock, so a frame that arrives late shifts nothing the card is judged by.
        at: pop ? Math.round(Number(pop.currentTime)) : Math.round(since),
        hidden:
          card.hidden ||
          style.visibility === "hidden" ||
          style.display === "none",
        opacity: Number(style.opacity),
        scale: scaleOf(card),
        centre: box.left + box.width / 2,
        pin: Number.isFinite(pin)
          ? (card.offsetParent?.getBoundingClientRect().left ?? 0) + pin
          : null,
      });
    }
    if (performance.now() < 9000 && (since === null || since < 3200))
      requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The opening: it starts together, each piece animates one way, smoothly, and the card comes last. */
async function checkEntrance(browser) {
  const t = "hero › entrance";
  const { page, context, problems } = await open(browser, WIDE, {
    init: watchEntrance,
  });
  for (const problem of problems) fail("page-error", "page", problem, WIDE);
  const log = await page.evaluate(() => {
    const l = window.__entrance;
    return {
      entrance: l.entrance,
      dawn: l.dawn,
      armed: l.armed,
      firstFrame: l.firstFrame,
      t0: l.t0,
      groups: [...l.groups],
      canvasAnimated: l.canvasAnimated,
      filters: [...l.filters],
      props: [...l.props],
      runs: [...l.starts.values()],
      frames: l.frames,
      slow: l.slow,
      card: l.card,
      copy: l.copy,
      lcp: l.lcp,
    };
  });
  const order = log.entrance.map(([name]) => name).join(" > ");
  check(
    /^wait > run( > done)?$/.test(order),
    "entrance-order",
    t,
    `the page went through "${order}", it must hold, run once and rest (wait > run > done)`,
    WIDE,
  );
  const runAt = log.entrance.find(([name]) => name === "run")?.[1] ?? Infinity;
  check(
    log.firstFrame === null || log.firstFrame >= runAt,
    "entrance-order",
    t,
    `the globe drew its first lit frame at ${log.firstFrame} ms, before the entrance ran at ${runAt} ms`,
    WIDE,
  );
  check(
    log.dawn !== null &&
      log.armed !== null &&
      Math.abs(log.armed - log.dawn) <= 120,
    "entrance-order",
    t,
    `the zoom stack armed at ${log.armed} ms and the dawn ended at ${log.dawn} ms, they must land together`,
    WIDE,
  );
  check(
    log.copy !== null && log.copy.lowest === 1,
    "entrance-copy-first",
    t,
    `the title and the tagline were at opacity ${log.copy?.first ?? "none"} on the first frame (${log.copy?.at ?? "?"} ms) and ${log.copy?.lowest ?? "none"} at the lowest, they must be at 1 throughout: the freeze plays over text that is already there`,
    WIDE,
  );
  check(
    log.lcp !== null && log.lcp.at < runAt,
    "entrance-copy-first",
    t,
    `the largest paint (${log.lcp?.element ?? "none"}) came at ${log.lcp?.at ?? "never"} ms, after the entrance ran at ${runAt} ms: the copy must not wait for the sky`,
    WIDE,
  );
  const crowded = log.groups.filter(([, count]) => count > 1);
  check(
    log.groups.length > 0 && crowded.length === 0 && !log.canvasAnimated,
    "entrance-one-animation",
    t,
    `${crowded.map(([key, count]) => `${key} ran ${count} animations at once`).join("; ")}${log.groups.length ? "" : "nothing animated"}${log.canvasAnimated ? " the hero canvas is animated" : ""}: each target must run one and the canvas none`,
    WIDE,
  );
  check(
    log.filters.length === 1 && log.filters[0] === "none",
    "entrance-cheap",
    t,
    `the title's filter was ${log.filters.join(", ")} during the entrance, it must stay none (no blur on text)`,
    WIDE,
  );
  const allowed = new Set([
    "offset",
    "easing",
    "composite",
    "computedOffset",
    "opacity",
    "color",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "maskImage",
    "maskSize",
    "maskRepeat",
    "maskClip",
    "maskPosition",
    "webkitMaskPositionX",
    "webkitMaskPositionY",
    "maskPositionX",
    "maskPositionY",
    "scale",
    "translate",
  ]);
  const stray = log.props.filter((name) => !allowed.has(name));
  check(
    stray.length === 0,
    "entrance-cheap",
    t,
    `the entrance animates ${stray.join(", ")}, it may animate only opacity, mask, colour, border colour, scale and translate (no blur, filter or shadow)`,
    WIDE,
  );
  const sorted = [...log.frames].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? Infinity;
  const worst = sorted.at(-1) ?? Infinity;
  check(
    sorted.length > 60 && median <= 17.5 && worst <= 34,
    "entrance-smooth",
    t,
    `from t0 to t0 + 2.9 s the median frame was ${median} ms and the longest ${worst} ms over ${sorted.length} frames (frames over 34 ms at ${JSON.stringify(log.slow.slice(0, 8))}), they must be at most 17.5 and 34`,
    WIDE,
  );
  const card = log.runs.filter((run) => run.name === "ng-pop");
  const rest = log.runs.filter(
    (run) => (run.name ?? "").startsWith("ng-") && run.name !== "ng-pop",
  );
  // The glint and a header chip's shine ride on a freeze, so the card starts after every freeze and
  // ends after all.
  const freezes = rest.filter(
    (run) => run.name !== "ng-glint" && run.name !== "ng-shine",
  );
  check(
    card.length > 0 &&
      rest.length > 0 &&
      Math.min(...card.map((run) => run.delay)) >=
        Math.max(...freezes.map((run) => run.delay)) &&
      Math.max(...card.map((run) => run.end)) >=
        Math.max(...rest.map((run) => run.end)),
    "entrance-card-last",
    t,
    `the location card must start after and end after every other piece (card ${JSON.stringify(card.map((r) => [r.delay, r.end]))}, rest ${JSON.stringify(rest.map((r) => [r.delay, r.end]).slice(0, 4))})`,
    WIDE,
  );
  // The card stays out of sight until the Earth is lit (exposure passes .95 at 1.83 s), is whole
  // within .7 s of that, is exactly itself at 2.65 s, and grows out of its pin.
  const early = log.card.filter(
    (sample) => sample.at < 1830 && !sample.hidden && sample.opacity > 0.01,
  );
  check(
    log.card.length > 10 && early.length === 0,
    "entrance-card-last",
    t,
    `the location card showed at ${early.map((s) => `${s.at} ms (opacity ${s.opacity})`).join(", ") || "no sample"} before the Earth was lit (1830 ms), it must stay hidden`,
    WIDE,
  );
  const whole = log.card.find(
    (sample) => sample.opacity >= 0.999 && Math.abs(sample.scale - 1) <= 0.02,
  );
  check(
    whole !== undefined && whole.at <= 1830 + 700 + 100,
    "entrance-card-last",
    t,
    `the location card first reached full size at ${whole?.at ?? "never"} ms, it must be within 700 ms of the Earth being lit (1830 ms)`,
    WIDE,
  );
  const settled = log.card.filter((sample) => sample.at >= 2750);
  check(
    settled.length > 0 &&
      settled.every(
        (sample) =>
          sample.opacity === 1 && sample.scale === 1 && !sample.hidden,
      ),
    "entrance-card-last",
    t,
    `the location card after 2.65 s was ${JSON.stringify(settled.slice(0, 2))}, it must be opacity 1 and scale 1`,
    WIDE,
  );
  const growing = log.card.filter(
    (sample) =>
      sample.at >= 2000 &&
      sample.at < 2650 &&
      sample.pin !== null &&
      sample.scale > 0.3 &&
      sample.scale < 0.99,
  );
  check(
    growing.every((sample) => Math.abs(sample.centre - sample.pin) <= 1),
    "entrance-card-last",
    t,
    `the location card grew off its pin: ${growing.map((s) => `${s.at} ms centre ${r1(s.centre)} pin ${r1(s.pin)}`).join("; ")}`,
    WIDE,
  );
  const resting = await page.evaluate(() => ({
    entrance: document.documentElement.dataset.entrance,
    running: document
      .getAnimations()
      .filter((a) => a instanceof CSSAnimation && a.playState === "running")
      .length,
    // Nothing of the entrance is left once it is done, so the sky cannot fade a second time.
    left: document
      .getAnimations()
      .filter(
        (a) => a instanceof CSSAnimation && a.animationName.startsWith("ng-"),
      )
      .map((a) => a.animationName),
    h1: getComputedStyle(document.querySelector("h1[data-page-title]")).opacity,
    mask: getComputedStyle(document.querySelector("h1[data-page-title]"))
      .maskImage,
  }));
  check(
    resting.entrance === "done" &&
      resting.running === 0 &&
      resting.left.length === 0 &&
      resting.h1 === "1" &&
      resting.mask === "none",
    "entrance-rest",
    t,
    `after the entrance the page is "${resting.entrance}" with ${resting.running} running and ${resting.left.length} left over (${resting.left.join(", ")}) animation(s), title opacity ${resting.h1} and mask ${resting.mask}, it must be done, 0, 1 and none`,
    WIDE,
  );
  await context.close();

  // Arriving through a view transition leaves the header as it is. Chromium often skips a
  // transition into the landing while the machine is busy, so the page is marked as a transition
  // arrival before it loads and the rule is judged on what it does with that mark.
  const second = await browser.newContext({
    viewport: WIDE,
    reducedMotion: "no-preference",
  });
  await blockOffSite(second, base);
  const from = await second.newPage();
  await from.addInitScript(() => {
    const mark = () => {
      if (!document.documentElement) return false;
      document.documentElement.dataset.arrival = "transition";
      return true;
    };
    if (!mark())
      new MutationObserver((_, observer) => {
        if (mark()) observer.disconnect();
      }).observe(document, { childList: true });
  });
  await from.goto(`${base}/`, {
    waitUntil: "networkidle",
    timeout: LOAD_TIMEOUT,
  });
  await from.waitForFunction(
    () => document.documentElement.dataset.entrance === "run",
    null,
    { timeout: LOAD_TIMEOUT },
  );
  const header = await from.evaluate(() => ({
    arrival: document.documentElement.dataset.arrival,
    animated: document
      .getAnimations()
      .filter(
        (a) =>
          a instanceof CSSAnimation &&
          a.effect?.target instanceof Element &&
          a.effect.target.closest(".header"),
      ).length,
    opacity: getComputedStyle(document.querySelector(".gmt-ng-link")).opacity,
  }));
  check(
    header.arrival === "transition" &&
      header.animated === 0 &&
      header.opacity === "1",
    "entrance-arrival",
    t,
    `a page reached through a view transition had arrival "${header.arrival}", ${header.animated} header animation(s) and header opacity ${header.opacity}, it must be "transition", 0 and 1`,
    WIDE,
  );
  await second.close();
  measured++;
}

/** The fixture page that stands in for northguild.dev: its header carries the companion rules. */
const NG_LANDING = readFileSync(
  new URL("./fixtures/ng-landing.html", import.meta.url),
  "utf8",
);

/** Where the two sites meet. The fixture is the origin's `/`, the build is under `base`. */
const SITE_ORIGIN = new URL(base).origin;

/** The mark's and the wordmark's boxes in the bar of the page in view, in CSS px. */
function barBoxes(page, mark, wordmark) {
  return page.evaluate(
    ([markSel, wordmarkSel]) => {
      const box = (sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r
          ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
          : null;
      };
      return { mark: box(markSel), wordmark: box(wordmarkSel) };
    },
    [mark, wordmark],
  );
}

/**
 * Opens the fixture, clicks through to the build and reports what the arriving page saw: the
 * transition's types, the animations on its pseudo-elements once it was ready, and the bar's
 * boxes on both sides. A cross-document transition is sometimes skipped while the machine is busy,
 * so a missing one is tried again.
 */
async function crossSiteArrival(browser, { reduce, attempts }) {
  const context = await browser.newContext({
    viewport: WIDE,
    reducedMotion: reduce ? "reduce" : "no-preference",
  });
  await blockOffSite(context, base);
  await context.route(`${SITE_ORIGIN}/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: NG_LANDING,
    }),
  );
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    /* Registered before the page's own listener; the types are read after the reveal. */
    addEventListener("pagereveal", (e) => {
      window.__vt = e.viewTransition;
      window.__pseudo = null;
      e.viewTransition?.ready
        .then(() => {
          window.__pseudo = document.getAnimations().flatMap((a) => {
            const effect = a.effect;
            if (!effect?.pseudoElement) return [];
            const timing = effect.getTiming();
            return [
              {
                pseudo: effect.pseudoElement,
                duration: Number(timing.duration),
                easing: timing.easing,
              },
            ];
          });
        })
        .catch(() => {});
    });
  });
  let result = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await page.goto(`${SITE_ORIGIN}/`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const from = await barBoxes(page, ".ng-mark", ".ng-wordmark");
    await Promise.all([
      page.waitForURL(`${base}/`, { timeout: LOAD_TIMEOUT }),
      page.locator(".ng-home").click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: LOAD_TIMEOUT });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      () => document.documentElement.dataset.arrival !== undefined,
      null,
      { timeout: LOAD_TIMEOUT },
    );
    const seen = await page.evaluate(async () => {
      const vt = window.__vt;
      if (vt) await vt.finished.catch(() => {});
      return {
        transition: Boolean(vt),
        types: vt ? [...vt.types] : [],
        pseudo: window.__pseudo,
        arrival: document.documentElement.dataset.arrival,
      };
    });
    const to = await barBoxes(page, ".gmt-ng-link svg", ".gmt-ng-wordmark");
    result = { ...seen, from, to };
    if (seen.transition || reduce) break;
  }
  await context.close();
  return { ...result, problems };
}

/** The arrival from northguild.dev: the mark holds, the bar and the page dissolve. */
async function checkCrossSite(browser) {
  const t = "hero › arrival from northguild.dev";
  const arrival = await crossSiteArrival(browser, {
    reduce: false,
    attempts: 4,
  });
  check(
    arrival.problems.length === 0,
    "arrival-errors",
    t,
    arrival.problems.join("; "),
    WIDE,
  );
  const typed =
    arrival.transition &&
    arrival.types.length === 1 &&
    arrival.types[0] === "from-landing";
  check(
    typed,
    "arrival-type",
    t,
    `the page reached from northguild.dev saw ${arrival.transition ? `a view transition of type [${arrival.types.join(", ")}]` : "no view transition"}, it must be one of type [from-landing]`,
    WIDE,
  );
  check(
    arrival.arrival === "transition",
    "arrival-mark",
    t,
    `the page noted its arrival as "${arrival.arrival}", it must be "transition"`,
    WIDE,
  );
  if (typed) {
    const animations = arrival.pseudo ?? [];
    const named = (pseudo, name) =>
      animations.find(
        (a) => a.pseudo === `::view-transition-${pseudo}(${name})`,
      );
    // A CSS animation's easing lives on its keyframes, so only the length is read here.
    const fade = (a, ms) => Boolean(a) && a.duration === ms;
    check(
      fade(named("old", "ng-header"), 240) &&
        fade(named("new", "ng-header"), 240),
      "arrival-bar",
      t,
      `the bar's old and new snapshots must dissolve over 240ms, found ${JSON.stringify(animations.filter((a) => a.pseudo.includes("ng-header")))}`,
      WIDE,
    );
    check(
      fade(named("old", "root"), 600) && fade(named("new", "root"), 600),
      "arrival-page",
      t,
      `the page's old and new snapshots must dissolve over 600ms, found ${JSON.stringify(animations.filter((a) => a.pseudo.includes("(root)")))}`,
      WIDE,
    );
    check(
      !animations.some((a) => /ng-(mark|wordmark)/.test(a.pseudo)),
      "arrival-still",
      t,
      `the mark and the wordmark must not animate, found ${JSON.stringify(animations.filter((a) => /ng-(mark|wordmark)/.test(a.pseudo)))}`,
      WIDE,
    );
  }
  for (const part of ["mark", "wordmark"]) {
    const was = arrival.from?.[part];
    const now = arrival.to?.[part];
    if (!was || !now) {
      fail(
        "arrival-boxes",
        t,
        `the ${part} has no box on ${was ? "the build" : "the fixture"}`,
        WIDE,
      );
      continue;
    }
    const off = Math.max(
      ...["left", "top", "right", "bottom"].map((edge) =>
        Math.abs(was[edge] - now[edge]),
      ),
    );
    check(
      off < 0.5,
      "arrival-boxes",
      t,
      `the ${part} sits ${r1(off)}px from where it was on the fixture (${JSON.stringify(was)} then ${JSON.stringify(now)}), it must be within 0.5px`,
      WIDE,
    );
  }

  // Reduced motion: the pages still link up, with no transition between them.
  const reduced = await crossSiteArrival(browser, {
    reduce: true,
    attempts: 1,
  });
  check(
    !reduced.transition && reduced.arrival === "load",
    "arrival-reduced",
    t,
    `under reduced motion the arrival ${reduced.transition ? "ran a view transition" : `was noted as "${reduced.arrival}"`}, it must be a plain load`,
    WIDE,
  );
  measured++;
}

/** The Sun and the Moon at pinned instants: the clock is the page's, the phase is the sky's. */
async function checkSkyBodies(browser) {
  const t = "hero › sun and moon";

  // A half Moon: about half its disc is lit, and the lit half faces the Sun.
  const half = await pinnedSky(browser, SKY_PINS.half);
  check(
    Number(half.view.split(" ")[2]) === SKY_PINS.half.at,
    "sky-bodies",
    t,
    `the page clock was not pinned: the sky shows ${half.view}`,
    WIDE,
  );
  const disc = await skyPixels(half.page, half.moon.x, half.moon.y, 6);
  const lit = disc.filter(([r, g, b, a]) => a > 180 && r + g + b > 600);
  const body = disc.filter(([, , , a]) => a > 5);
  check(
    Number.isFinite(half.moon.x) &&
      lit.length >= body.length * 0.25 &&
      lit.length <= body.length * 0.75,
    "sky-bodies",
    t,
    `at a half Moon (${half.lit.toFixed(2)} lit) ${lit.length} of ${body.length} disc pixels are bright, limit a quarter to three quarters`,
    WIDE,
  );
  // Where the lit pixels sit against the whole disc, so the rounding of the sample cancels.
  const side = Math.sqrt(disc.length);
  const centroid = (keep) => {
    let n = 0;
    let x = 0;
    let y = 0;
    disc.forEach((pixel, i) => {
      if (!keep(pixel)) return;
      n++;
      x += i % side;
      y += Math.floor(i / side);
    });
    return { x: n ? x / n : 0, y: n ? y / n : 0 };
  };
  const brightAt = centroid(([r, g, b, a]) => a > 180 && r + g + b > 600);
  const bodyAt = centroid(([, , , a]) => a > 5);
  const mx = brightAt.x - bodyAt.x;
  const my = brightAt.y - bodyAt.y;
  const [ux, uy] = SKY_PINS.half.toSun;
  const along = (mx * ux + my * uy) / (Math.hypot(mx, my) || 1);
  check(
    along > 0.5,
    "sky-bodies",
    t,
    `the lit side of the Moon points ${r1((Math.acos(Math.max(-1, Math.min(1, along))) * 180) / Math.PI)} degrees off the Sun's direction, limit 60`,
    WIDE,
  );
  await half.context.close();
  measured++;

  // The Sun just behind the Earth: its glare spills past the rim on its own side only.
  const rim = await pinnedSky(browser, SKY_PINS.rim);
  const away = Math.hypot(rim.sun.x - rim.earth.x, rim.sun.y - rim.earth.y);
  check(
    Number.isFinite(away) && away < rim.earth.radius,
    "sky-bodies",
    t,
    `the pinned Sun is ${r1(away)} px from the Earth's centre, not inside its ${r1(rim.earth.radius)} px disc`,
    WIDE,
  );
  const u = {
    x: (rim.sun.x - rim.earth.x) / away,
    y: (rim.sun.y - rim.earth.y) / away,
  };
  const reach = rim.earth.radius + 6;
  const strongest = async (sign) =>
    Math.max(
      ...(
        await skyPixels(
          rim.page,
          rim.earth.x + sign * u.x * reach,
          rim.earth.y + sign * u.y * reach,
          1.5,
        )
      ).map(([, , , a]) => a),
    );
  const near = await strongest(1);
  const far = await strongest(-1);
  check(
    near >= 20 && near > far + 15,
    "sky-bodies",
    t,
    `the glare is ${near}/255 past the rim on the Sun's side and ${far}/255 on the far side; it must show on the first and not the second`,
    WIDE,
  );
  await rim.context.close();
  measured++;

  // The Sun in the clear is a near-white core.
  const clear = await pinnedSky(browser, SKY_PINS.clear);
  const core = await skyPixels(clear.page, clear.sun.x, clear.sun.y, 1);
  const brightest = core.reduce(
    (a, b) => (b[0] + b[1] + b[2] > a[0] + a[1] + a[2] ? b : a),
    [0, 0, 0, 0],
  );
  check(
    Number.isFinite(clear.sun.x) &&
      brightest[3] > 200 &&
      brightest[0] > 235 &&
      brightest[1] > 235 &&
      brightest[2] > 215,
    "sky-bodies",
    t,
    `the Sun's core is rgba(${brightest.join(", ")}) at ${r1(clear.sun.x)}, ${r1(clear.sun.y)}; it must be near-white`,
    WIDE,
  );
  await clear.context.close();
  measured++;
}

/** WCAG relative luminance of an sRGB colour, channels 0 to 255. */
const luminance = ([r, g, b]) =>
  [r, g, b]
    .map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);

const contrastOf = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * The copy over the Sun's glare, at the default motion the reader gets. The Sun is walked across the
 * copy by moving the page's clock (the sky redraws on a visibility change) while the pointer holds
 * the ambient spin off, so the worst case is measured, not a pinned one: for every letter pixel the contrast against the same frame with the
 * text hidden (the halo stays), taking the lowest over the walk. The walk must carry the Sun's centre
 * over the title and the tagline, within a row of the eyebrow, and to within 60 px of the first button, or it measured
 * nothing.
 */
const COPY_WALK = { from: -5, to: 5, step: 0.125 };
const COPY_PARTS = [
  /* A step of the walk moves the Sun about 10 px, so the 12 px eyebrow is reached within one row of it. */
  { name: "eyebrow", selector: ".gmt-hero-eyebrow", within: [12] },
  { name: "title", selector: "h1[data-page-title]", within: [0] },
  { name: "tagline", selector: ".gmt-hero-tagline", within: [0] },
  /* Only the first button lies on the Sun's track; the others are checked wherever the glare falls. */
  {
    name: "button",
    selector: ".gmt-hero-actions .sl-link-button",
    within: [60],
  },
];

async function checkSkyCopy(browser) {
  const t = "hero › sun behind the copy";
  const opened = await open(browser, WIDE, {
    fixed: SKY_PINS.glare.at,
    context: { timezoneId: SKY_PINS.glare.zone },
  });
  const { page, context } = opened;
  const draws = () =>
    page.evaluate(() =>
      Number(
        document.querySelector("[data-sky-canvas='stars']").dataset.skyDraws,
      ),
    );
  /* Hovering the Earth holds the ambient spin off, so the camera stays where it is for the walk. */
  const earth = await hitBox(page);
  await page.mouse.move(earth.x + earth.width / 2, earth.y + earth.height / 2);
  await page.waitForTimeout(600);
  const parts = await page.evaluate((list) => {
    return list.flatMap(({ name, selector, within }) =>
      [...document.querySelectorAll(selector)].map((el, n) => {
        const box = el.getBoundingClientRect();
        return {
          name: `${name} ${n + 1}`,
          within: within[n] ?? Infinity,
          color: getComputedStyle(el).color,
          x: Math.floor(box.left),
          y: Math.floor(box.top),
          width: Math.ceil(box.width),
          height: Math.ceil(box.height),
        };
      }),
    );
  }, COPY_PARTS);
  const area = {
    x: Math.min(...parts.map((p) => p.x)),
    y: Math.min(...parts.map((p) => p.y)),
  };
  area.width = Math.max(...parts.map((p) => p.x + p.width)) - area.x;
  area.height = Math.max(...parts.map((p) => p.y + p.height)) - area.y;
  const grab = async () =>
    PNG.sync.read(
      await page.screenshot({
        clip: { ...area },
      }),
    );
  /* The copy fades its colour; without this the bare frame would catch a letter half way back. */
  await page.addStyleTag({
    content:
      ":is(.gmt-hero-lead, .gmt-hero-actions) * { transition: none !important; }",
  });
  const hide = await page.addStyleTag({
    content:
      ":is(.gmt-hero-lead, .gmt-hero-actions) * { -webkit-text-fill-color: transparent !important; }",
  });
  await hide.evaluate((el) => (el.disabled = true));
  const worst = parts.map(() => ({ ratio: Infinity, glyphs: 0 }));
  const nearest = parts.map(() => Infinity);
  for (let k = COPY_WALK.from; k <= COPY_WALK.to + 1e-9; k += COPY_WALK.step) {
    await context.clock.setFixedTime(SKY_PINS.glare.at + k * 3_600_000);
    const before = await draws();
    await page.evaluate(() => {
      for (const hidden of [true, false]) {
        Object.defineProperty(document, "hidden", {
          value: hidden,
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
    await page.waitForFunction(
      ([d]) =>
        Number(
          document.querySelector("[data-sky-canvas='stars']").dataset.skyDraws,
        ) > d,
      [before],
      { timeout: 5000 },
    );
    /* Both frames must come from one draw, or the stars' own motion would read as a letter. */
    let shown;
    let bare;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.waitForTimeout(120);
      const first = await draws();
      shown = await grab();
      await hide.evaluate((el) => (el.disabled = false));
      bare = await grab();
      await hide.evaluate((el) => (el.disabled = true));
      if ((await draws()) === first) break;
    }
    const sun = await page.evaluate(() => {
      const el = document.querySelector("[data-sky-canvas='stars']");
      const canvas = el.getBoundingClientRect();
      const [x, y] = el.dataset.skyBodies.split(" ").map(Number);
      return { x: x + canvas.left, y: y + canvas.top };
    });
    parts.forEach((part, n) => {
      const dx = Math.max(part.x - sun.x, 0, sun.x - (part.x + part.width));
      const dy = Math.max(part.y - sun.y, 0, sun.y - (part.y + part.height));
      nearest[n] = Math.min(nearest[n], Math.hypot(dx, dy));
      const [r, g, b] = part.color.match(/\d+(\.\d+)?/g).map(Number);
      let low = Infinity;
      let glyphs = 0;
      for (let row = 0; row < part.height; row++) {
        for (let col = 0; col < part.width; col++) {
          const i =
            ((row + part.y - area.y) * area.width + col + part.x - area.x) * 4;
          const change =
            Math.abs(shown.data[i] - bare.data[i]) +
            Math.abs(shown.data[i + 1] - bare.data[i + 1]) +
            Math.abs(shown.data[i + 2] - bare.data[i + 2]);
          if (change < 120) continue;
          glyphs++;
          low = Math.min(
            low,
            contrastOf(
              [r, g, b],
              [bare.data[i], bare.data[i + 1], bare.data[i + 2]],
            ),
          );
        }
      }
      if (glyphs > 20 && low < worst[n].ratio)
        worst[n] = { ratio: low, glyphs };
    });
  }
  parts.forEach((part, n) => {
    check(
      nearest[n] <= part.within,
      "sky-copy",
      t,
      `the Sun came ${r1(nearest[n])} px from the ${part.name}, so its glare was not behind it (limit ${part.within} px)`,
      WIDE,
    );
    check(
      worst[n].glyphs > 20 && worst[n].ratio >= 7,
      "sky-copy",
      t,
      `the ${part.name} is ${worst[n].ratio.toFixed(2)}:1 against the worst pixel behind a letter as the Sun's glare crosses it (${worst[n].glyphs} letter pixels), floor 7:1`,
      WIDE,
    );
  });
  await context.close();
  measured++;
}

async function checkSkyReduced(browser) {
  const t = "hero › night sky, reduced motion";
  const { page, context } = await open(browser, WIDE, { reduce: true });
  const reading = await skyReading(page);
  await page.waitForTimeout(4000);
  check(
    (await skyReading(page)).draws === reading.draws,
    "sky-motion",
    t,
    "the sky was redrawn in 4 s of reduced motion",
    WIDE,
  );
  const stats = await page.evaluate(
    (sel) =>
      new Promise((resolve) => {
        /* The globe asks for a frame each second to tick its clocks, so frames are counted
           where the meteor would draw: any call that touches the meteor canvas. */
        let frames = 0;
        const meteor = document.querySelector(sel);
        const proto = CanvasRenderingContext2D.prototype;
        for (const name of [
          "clearRect",
          "stroke",
          "fill",
          "fillRect",
          "setTransform",
        ]) {
          const original = proto[name];
          proto[name] = function (...args) {
            if (this.canvas === meteor) frames++;
            return original.apply(this, args);
          };
        }
        setTimeout(() => {
          const canvas = document.querySelector(sel);
          const { width, height } = canvas;
          const data = canvas
            .getContext("2d")
            .getImageData(0, 0, width, height).data;
          let ink = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) ink++;
          resolve({ frames, ink, animations: document.getAnimations().length });
        }, 10_000);
      }),
    SKY_METEOR,
  );
  check(
    stats.animations === 0,
    "sky-motion",
    t,
    `${stats.animations} animation(s) running`,
    WIDE,
  );
  check(
    stats.frames === 0,
    "sky-motion",
    t,
    `${stats.frames} draw call(s) on the meteor canvas in 10 s`,
    WIDE,
  );
  check(stats.ink === 0, "sky-motion", t, "a meteor was drawn", WIDE);

  // The reader's own drag still carries the stars: they follow the camera.
  const held = await skyReading(page);
  const c = centre(await hitBox(page));
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 200, c.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  check(
    (await skyReading(page)).draws > held.draws,
    "sky-motion",
    t,
    "the reader's drag did not move the stars",
    WIDE,
  );
  await context.close();
  measured++;
}

async function checkReducedMotion(browser) {
  const t = "hero › reduced motion";
  const { page, context } = await open(browser, WIDE, { reduce: true });
  const samples = await page.evaluate(
    (sel) =>
      new Promise((resolve) => {
        const region = document.querySelector(sel);
        const rows = [];
        const stop = performance.now() + 700;
        const tick = () => {
          const s = getComputedStyle(region);
          rows.push({
            translate: s.translate,
            transform: s.transform,
            animation: s.animationName,
            opacity: Number(s.opacity),
          });
          if (performance.now() < stop) requestAnimationFrame(tick);
          else resolve(rows);
        };
        document.querySelector("button[aria-label='Find a zone']").click();
        requestAnimationFrame(tick);
      }),
    REGION,
  );
  const still = (v) => v === "none" || v === "0px 0px" || v === "0px";
  check(
    samples.every(
      (s) =>
        still(s.translate) &&
        (s.transform === "none" || s.transform === "matrix(1, 0, 0, 1, 0, 0)"),
    ),
    "reduce-no-slide",
    t,
    "the drawer moved while it opened",
    WIDE,
  );
  check(
    samples.every((s) => s.animation === "none"),
    "reduce-no-slide",
    t,
    "the drawer ran an animation while it opened",
    WIDE,
  );
  check(
    samples.some((s) => s.opacity > 0 && s.opacity < 1) &&
      samples.at(-1).opacity === 1,
    "reduce-fades",
    t,
    "the drawer did not fade from clear to solid",
    WIDE,
  );
  await context.close();
  measured++;
}

async function checkAccess(browser) {
  await checkAccessMode(browser, {
    label: "forced colours",
    context: { forcedColors: "active" },
    media: "(forced-colors: active)",
  });
  await checkAccessMode(browser, {
    label: "more contrast",
    context: { contrast: "more" },
    media: "(prefers-contrast: more)",
  });
  await checkReducedMotion(browser);
}

// --- touch -----------------------------------------------------------------

/** A finger on the glass: swipes off the Earth scroll the page, a pinch on it zooms the Earth only. */
/** Resolves once the page's scroll position has not changed for ten frames in a row. */
const scrollSettled = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        let last = -1;
        let still = 0;
        const frame = () => {
          still = scrollY === last ? still + 1 : 0;
          last = scrollY;
          if (still >= 10) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );

async function checkTouch(browser) {
  const t = "hero › touch";
  const context = await browser.newContext({
    viewport: NARROW,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  await blockOffSite(context, base);
  const page = await context.newPage();
  await page.goto(`${base}${ROUTE}`, { waitUntil: "networkidle" });
  await page.locator(HIT).waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForTimeout(SETTLE);
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })),
    });
  const wait = (ms) => page.waitForTimeout(ms);

  const actions = await page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)).touchAction,
    HIT,
  );
  check(
    actions === "none",
    "touch-action",
    t,
    `the Earth's touch-action is ${actions}, not none`,
    NARROW,
  );

  // A swipe that starts on the copy, off the Earth, scrolls the page.
  const copy = await page.locator(COPY).boundingBox();
  const from = {
    x: copy.x + 30,
    y: Math.min(copy.y + copy.height - 10, NARROW.height - 120),
  };
  await touch("touchStart", [from]);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", [{ x: from.x, y: from.y - i * 25 }]);
    await wait(16);
  }
  await touch("touchEnd", []);
  /* The swipe's fling keeps scrolling after the finger lifts; wait until the page has held still. */
  await scrollSettled(page);
  const scrolled = await page.evaluate(() => scrollY);
  check(
    scrolled > 20,
    "touch-swipe",
    t,
    `a swipe off the Earth moved the page ${r1(scrolled)} px`,
    NARROW,
  );
  await page.evaluate(() => scrollTo(0, 0));
  await scrollSettled(page);

  // A pinch on the Earth changes the Earth, and leaves the page at its own scale and place.
  await page.addStyleTag({ content: `${TOOLTIP} { visibility: hidden; }` });
  // The Earth is below the intro on a phone: bring it into view first, then hold the place.
  await page.locator(HIT).scrollIntoViewIfNeeded();
  await scrollSettled(page);
  const placed = await page.evaluate(() => scrollY);
  const shot = async () => PNG.sync.read(await page.screenshot());
  const before = await shot();
  const disc = await hitBox(page);
  const c = centre(disc);
  const at = (d) => [
    { x: c.x - d, y: c.y },
    { x: c.x + d, y: c.y },
  ];
  await touch("touchStart", at(30));
  for (let d = 40; d <= 110; d += 10) {
    await touch("touchMove", at(d));
    await wait(16);
  }
  await touch("touchEnd", []);
  await wait(1000);
  const after = await shot();
  let changed = 0;
  for (let i = 0; i < before.data.length; i += 4) {
    const d =
      Math.abs(before.data[i] - after.data[i]) +
      Math.abs(before.data[i + 1] - after.data[i + 1]) +
      Math.abs(before.data[i + 2] - after.data[i + 2]);
    if (d > 30) changed++;
  }
  check(
    changed > 400,
    "touch-pinch",
    t,
    `a pinch on the Earth changed ${changed} pixels`,
    NARROW,
  );
  const page2 = await page.evaluate(() => ({
    scale: visualViewport.scale,
    x: scrollX,
    y: scrollY,
    inner: innerWidth,
  }));
  check(
    page2.scale === 1,
    "touch-pinch",
    t,
    `the page zoomed to ${page2.scale}`,
    NARROW,
  );
  check(
    page2.y === placed && page2.x === 0,
    "touch-pinch",
    t,
    `the page scrolled to ${page2.x}, ${page2.y}`,
    NARROW,
  );
  await context.close();
  measured++;
}

async function resolveOnly(browser) {
  const { page, context } = await open(browser, WIDE, { reduce: true });
  const miss = await resolveMisses(page, [
    { name: "hero", sel: HERO, min: 1, max: 1 },
    { name: "hero copy", sel: COPY, min: 1, max: 1 },
    { name: "globe stage", sel: STAGE, min: 1, max: 1 },
    { name: "globe layer", sel: LAYER, min: 1, max: 1 },
    { name: "globe hit area", sel: HIT, min: 1, max: 1 },
    { name: "zone drawer", sel: DRAWER, min: 1, max: 1 },
    { name: "drawer region", sel: REGION, min: 1, max: 1 },
    { name: "drawer close", sel: CLOSE, min: 1, max: 1 },
    { name: "location card", sel: TOOLTIP, min: 1, max: 1 },
  ]);
  console.log(`${miss.length ? "FAIL" : "ok  "} resolve ${ROUTE}`);
  for (const m of miss) console.log(`       ${m}`);
  await context.close();
  return miss.length ? 1 : 0;
}

const ZOOM = gate("globe-zoom");
const STACK_SIZES = [
  { width: 2560, height: 1440 },
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

/** The zoom stack's box, the hero's and the Earth's disc (the hit area is its circle). */
function stackGeometry(page) {
  return page.evaluate(
    ({ zoom, hero, hit }) => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect();
      const z = box(zoom);
      const h = box(hero);
      const d = box(hit);
      const cx = d.left + d.width / 2;
      const cy = d.top + d.height / 2;
      const nx = Math.max(z.left, Math.min(cx, z.right));
      const ny = Math.max(z.top, Math.min(cy, z.bottom));
      return {
        right: h.right - z.right,
        bottom: h.bottom - z.bottom,
        radius: d.width / 2,
        gap: Math.hypot(nx - cx, ny - cy) - d.width / 2,
      };
    },
    { zoom: ZOOM, hero: HERO, hit: HIT },
  );
}

/** What a reader sees of the zoom stack: drawn, and reachable. */
function stackState(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const style = getComputedStyle(el);
    return {
      visible: style.visibility === "visible" && Number(style.opacity) > 0,
      inert: el.hasAttribute("inert"),
    };
  }, ZOOM);
}

/**
 * The zoom stack sits in the hero's bottom-right corner, a step in from both edges, and
 * never on the Earth. It is gone, and inert, while the zone list is open; the copy does not
 * move or go under the Earth in that time, and the stack is back, with focus on the
 * magnifier, once the list shuts.
 */
async function checkStack(browser) {
  const t = "hero › zoom stack";
  for (const size of STACK_SIZES) {
    const { page, context, problems } = await open(browser, size, {
      reduce: true,
    });
    for (const problem of problems) fail("page-error", "page", problem, size);
    const at = await stackGeometry(page);
    if (size.width >= 1280) {
      check(
        Math.abs(at.right - 16) <= 1 && Math.abs(at.bottom - 16) <= 1,
        "stack-corner",
        t,
        `the stack is ${r1(at.right)} px from the hero's right and ${r1(at.bottom)} px from its bottom, not 16`,
        size,
      );
    }
    check(
      at.radius > 0 && at.gap >= 0,
      "stack-on-earth",
      t,
      `the stack is ${r1(at.gap)} px from the Earth's disc (radius ${r1(at.radius)})`,
      size,
    );
    const rest = await stackState(page);
    check(
      rest.visible && !rest.inert,
      "stack-hidden-shut",
      t,
      "the stack is not drawn and reachable while the list is shut",
      size,
    );

    const copy = (await restingBoxes(page)).slice(0, -2);
    const magnifier = page.getByRole("button", { name: "Find a zone" });
    await magnifier.click();
    await page.waitForTimeout(400);
    const open_ = await stackState(page);
    check(
      !open_.visible && open_.inert,
      "stack-shown-open",
      t,
      `with the list open the stack is ${open_.visible ? "drawn" : "hidden"} and ${open_.inert ? "inert" : "not inert"}`,
      size,
    );
    const during = (await restingBoxes(page)).slice(0, -2);
    const shifted = copy.findIndex((box, n) =>
      box.some((v, k) => Math.abs(v - during[n][k]) > 0.5),
    );
    check(
      shifted === -1,
      "copy-moved-open",
      t,
      `part ${shifted} of the copy moved while the list was open`,
      size,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    const covered = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const out = [];
      for (const el of root.querySelectorAll("h1, p, a, button, span")) {
        const r = el.getBoundingClientRect();
        // A 1px box is read aloud, not seen: the carousel's live region.
        if (r.width <= 1 || r.height <= 1) continue;
        // A page the carousel is not showing keeps its box but paints nothing, and a point
        // outside the viewport cannot be tested.
        if (el.closest("[hidden], [data-page]:not([data-shown])")) continue;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (!top || !(el.contains(top) || top.contains(el)))
          out.push(
            `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 24)}"`,
          );
      }
      return out;
    }, COPY);
    check(
      covered.length === 0,
      "copy-covered-open",
      t,
      `the Earth or the list covers the copy: ${covered.join(", ")}`,
      size,
    );

    await page.locator(CLOSE).click();
    await page.waitForTimeout(400);
    const after = await stackState(page);
    check(
      after.visible && !after.inert,
      "stack-hidden-closed",
      t,
      "the stack did not come back when the list shut",
      size,
    );
    check(
      await magnifier.evaluate((el) => el === document.activeElement),
      "stack-focus",
      t,
      "focus did not return to the magnifier when the list shut",
      size,
    );
    await context.close();
    measured++;
  }
}

/** Where the copy, the stack and the Earth's box are, to compare across time. */
function restingBoxes(page) {
  return page.evaluate(
    ({ copy, zoom, hit }) => {
      const rects = [];
      const root = document.querySelector(copy);
      for (const el of [root, ...root.querySelectorAll("*")])
        rects.push(el.getBoundingClientRect());
      rects.push(document.querySelector(zoom).getBoundingClientRect());
      rects.push(document.querySelector(hit).getBoundingClientRect());
      /* In the page's coordinates: opening the list may scroll the page to its sheet. */
      return rects.map((r) =>
        r.width === 0 && r.height === 0
          ? [0, 0, 0, 0]
          : [r.left + scrollX, r.top + scrollY, r.width, r.height],
      );
    },
    { copy: COPY, zoom: ZOOM, hit: HIT },
  );
}

/**
 * Nothing moves unless the reader acts: on a cold cache the layout-shift total over the first
 * five seconds is exactly 0, and the copy, the stack and the Earth's box stand still after.
 */
async function checkShift(browser) {
  const t = "hero › layout shift";
  /* The second pass holds the font back for 900 ms: a late file must not move anything. */
  for (const lateFont of [0, 900])
    for (const size of [WIDE, { width: 1920, height: 1080 }, NARROW]) {
      const started = performance.now();
      const { page, context, problems } = await open(browser, size, {
        lateFont,
      });
      for (const problem of problems) fail("page-error", "page", problem, size);
      const first = await restingBoxes(page);
      await page.waitForTimeout(
        Math.max(0, 5200 - (performance.now() - started)),
      );
      const shift = await page.evaluate(() => window.__shift);
      const how = lateFont
        ? `with the font ${lateFont} ms late`
        : "on a cold cache";
      check(
        shift === 0,
        "load-shift",
        t,
        `the layout shifted ${shift} over the first 5 s ${how}, not 0`,
        size,
      );
      const frames = await page.evaluate(() => window.__frames);
      const sizes = [...new Set(frames.map((f) => f[0]))];
      check(
        frames.length > 0 && sizes.length === 1,
        "title-size-flash",
        t,
        `the title was ${sizes.join(" then ")} across ${frames.length} frames ${how}, not one size`,
        size,
      );
      const boxes = new Set(frames.map((f) => `${f[1]}/${f[2]}`));
      check(
        frames.length > 0 && boxes.size === 1,
        "copy-box-flash",
        t,
        `the copy column took ${boxes.size} different boxes across ${frames.length} frames ${how}, not one`,
        size,
      );
      const later = await restingBoxes(page);
      const moved = first.findIndex((box, i) =>
        box.some((v, k) => Math.abs(v - later[i][k]) > 0.5),
      );
      check(
        moved === -1,
        "post-load-move",
        t,
        `box ${moved} (of the copy, then the stack, then the Earth) moved after load ${how}`,
        size,
      );
      await context.close();
      measured++;
    }
}

/**
 * No invisible box covers the Earth: only the words and the buttons take the pointer. Points
 * across the copy's cell that are not over text or a button must reach the Earth's layers, never
 * a copy wrapper, and a drag that starts on one over the disc must turn the Earth.
 */
async function checkPassThrough(browser) {
  const t = "hero › copy boxes";
  const sizes = [
    WIDE,
    { width: 1920, height: 1080 },
    { width: 1334, height: 902 },
    NARROW,
  ];
  for (const size of sizes) {
    const { page, context } = await open(browser, size, { reduce: true });
    const found = await page.evaluate(
      ({ copy, hit, hero }) => {
        const cell = document.querySelector(copy);
        // The whole hero, so a box that grew past its text (the old column) is caught too.
        const area = document.querySelector(hero).getBoundingClientRect();
        /* The pager is pressed too: its arrows and its row of dots count as ink. Each ink's box and
           its text's own line boxes: with a line height shorter than the font's glyph height, the letters reach a few px past
           the element's box, and a point there is on the text, not a wrapper. */
        const inks = [
          ...cell.querySelectorAll(
            ".gmt-hero-eyebrow, h1, .gmt-hero-tagline, .gmt-hero-actions .sl-link-button, [data-hero-step], [data-hero-step] svg, [data-hero-dots]",
          ),
        ].flatMap((el) => {
          const text = document.createRange();
          text.selectNodeContents(el);
          return [el.getBoundingClientRect(), ...text.getClientRects()];
        });
        const disc = document.querySelector(hit).getBoundingClientRect();
        const r = disc.width / 2;
        const cx = disc.left + r;
        const cy = disc.top + r;
        const wrappers = [];
        const free = [];
        const onDisc = [];
        for (
          let y = Math.max(area.top, 60);
          y < Math.min(area.bottom, innerHeight);
          y += 20
        ) {
          for (
            let x = area.left;
            x < Math.min(area.right, innerWidth);
            x += 20
          ) {
            if (
              inks.some(
                (b) =>
                  x >= b.left - 2 &&
                  x <= b.right + 2 &&
                  y >= b.top - 2 &&
                  y <= b.bottom + 2,
              )
            )
              continue;
            const el = document.elementFromPoint(x, y);
            if (!el) continue;
            free.push([x, y]);
            if (cell.contains(el))
              wrappers.push(`${el.tagName.toLowerCase()}.${el.className}`);
            if (Math.hypot(x - cx, y - cy) < r * 0.85) onDisc.push([x, y]);
          }
        }
        return { free: free.length, wrappers, onDisc };
      },
      { copy: COPY, hit: HIT, hero: HERO },
    );
    check(
      found.wrappers.length === 0,
      "copy-box-blocks",
      t,
      `${found.wrappers.length} of ${found.free} points beside the text land on a copy box (${[...new Set(found.wrappers)].slice(0, 3).join(", ")}), not the Earth`,
      size,
    );
    if (found.onDisc.length > 0) {
      // The point nearest the copy: the one an oversized box would have covered.
      const [x, y] = found.onDisc.reduce((a, b) => (b[0] < a[0] ? b : a));
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 120, y + 10, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      check(
        await regionOpen(page),
        "copy-box-drag",
        t,
        `a drag that starts beside the text, over the Earth (${Math.round(x)}, ${Math.round(y)}), did nothing`,
        size,
      );
    }
    await context.close();
    measured++;
  }
}

// --- the landing carousel ---------------------------------------------------

const PAGES = `${COPY} > [data-page]`;
const NEXT = '[data-hero-step="1"]';
const PREV = '[data-hero-step="-1"]';
const NAV = "[data-hero-nav]";
const SELECTED_DOT = '[data-hero-dots] [role="tab"][aria-selected="true"]';

/** Locked: the landing never scrolls, and the wheel turns the pages. */
const LOCKED_SIZES = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
];
/** Not locked (narrower than 64rem, or portrait): the stage stacks and the page scrolls. */
const STACKED_SIZES = [
  { width: 1000, height: 700 },
  { width: 900, height: 1200 },
  { width: 390, height: 844 },
];

/** What the landing shows at one moment. */
function carouselState(page) {
  return page.evaluate(
    ({ pages, nav, hit, dot, copy }) => {
      const root = document.documentElement;
      const all = [...document.querySelectorAll(pages)];
      const box = (el) => {
        const r = el?.getBoundingClientRect();
        return r ? [r.x, r.y, r.width, r.height].map(Math.round) : null;
      };
      const visible = (el) => getComputedStyle(el).visibility !== "hidden";
      const shown = all.filter(
        (el) => el.hasAttribute("data-shown") && !el.inert,
      );
      return {
        mark: root.dataset.homeCarousel ?? null,
        scrollY: window.scrollY,
        docH: root.scrollHeight,
        docW: root.scrollWidth,
        innerH: window.innerHeight,
        innerW: window.innerWidth,
        names: all.map((el) => el.dataset.page),
        shown: shown.map((el) => el.dataset.page),
        visible: all.filter(visible).map((el) => el.dataset.page),
        dot: document.querySelector(dot)?.getAttribute("aria-label") ?? null,
        shownHeight: shown[0]
          ? Math.round(shown[0].getBoundingClientRect().height)
          : 0,
        shownScrolls: shown[0]
          ? shown[0].scrollHeight > shown[0].clientHeight + 1
          : false,
        columnHeight: Math.round(
          document.querySelector(copy)?.getBoundingClientRect().height ?? 0,
        ),
        earth: box(document.querySelector(hit)),
        nav: box(document.querySelector(nav)),
        shift: window.__shift ?? 0,
        motion: all.map((el) => el.dataset.motion ?? null),
      };
    },
    { pages: PAGES, nav: NAV, hit: HIT, dot: SELECTED_DOT, copy: COPY },
  );
}

/** Waits until no page is fading and returns the state. */
async function settledState(page) {
  await page.waitForFunction(
    (pages) =>
      [...document.querySelectorAll(pages)].every((el) => !el.dataset.motion),
    PAGES,
    { timeout: 5000 },
  );
  return carouselState(page);
}

/** The next and previous arrows as a reader meets them. */
async function arrowState(page) {
  return page.evaluate(
    ({ next, prev }) =>
      [next, prev].map((sel) => {
        const b = document.querySelector(sel);
        const c = getComputedStyle(b);
        const r = b.getBoundingClientRect();
        return {
          name: b.getAttribute("aria-label"),
          visible: c.visibility !== "hidden" && Number(c.opacity) > 0,
          tabIndex: b.tabIndex,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }),
    { next: NEXT, prev: PREV },
  );
}

async function checkCarousel(browser) {
  for (const size of LOCKED_SIZES) {
    const t = "carousel";
    const { page, context, problems } = await open(browser, size);
    const first = await carouselState(page);
    const [name0, name1, name2] = first.names;
    check(
      first.mark === "on",
      "carousel-mode",
      t,
      `data-home-carousel is ${first.mark}, not on`,
      size,
    );
    check(
      first.names.length >= 3,
      "carousel-pages",
      t,
      `the landing has ${first.names.length} pages`,
      size,
    );
    check(
      first.docH <= first.innerH && first.docW <= first.innerW,
      "carousel-no-scroll",
      t,
      `the page is ${first.docW}×${first.docH} in a ${first.innerW}×${first.innerH} window`,
      size,
    );
    check(
      first.shown.join() === name0 &&
        first.visible.join() === name0 &&
        first.dot === name0,
      "carousel-start",
      t,
      `on load the shown pages are [${first.shown}], the visible [${first.visible}] and the dot ${first.dot}; only ${name0} should be`,
      size,
    );
    // The arrows: 24 px targets named after the page they open; the one with nowhere to go is
    // hidden and out of the tab order.
    const [next0, prev0] = await arrowState(page);
    check(
      next0.w >= 24 && next0.h >= 24,
      "carousel-target",
      t,
      `the next arrow is ${next0.w}×${next0.h}, under 24×24`,
      size,
    );
    check(
      next0.name === `Next: ${name1}` && next0.visible && next0.tabIndex === 0,
      "carousel-next-named",
      t,
      `on the first page the next arrow reads "${next0.name}", shown ${next0.visible}, tabindex ${next0.tabIndex}`,
      size,
    );
    check(
      !prev0.visible && prev0.tabIndex === -1,
      "carousel-prev-off",
      t,
      `on the first page the previous arrow is shown ${prev0.visible} with tabindex ${prev0.tabIndex}`,
      size,
    );

    // The wheel over the words turns one page per gesture, and nothing else moves. Over the
    // words: the gaps between them belong to the Earth.
    const title = await page.locator("h1[data-page-title]").boundingBox();
    await page.mouse.move(
      title.x + title.width / 2,
      title.y + title.height / 2,
    );
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(40);
    }
    const wheeled = await settledState(page);
    check(
      wheeled.shown.join() === name1,
      "carousel-wheel",
      t,
      `one downward gesture over the intro left [${wheeled.shown}] shown, not ${name1}`,
      size,
    );
    check(
      wheeled.scrollY === 0 && wheeled.docH <= wheeled.innerH,
      "carousel-wheel-scroll",
      t,
      `the page scrolled to ${wheeled.scrollY}`,
      size,
    );
    check(
      JSON.stringify(wheeled.earth) === JSON.stringify(first.earth),
      "carousel-earth-still",
      t,
      `the Earth moved from ${first.earth} to ${wheeled.earth} when the page turned`,
      size,
    );
    check(
      wheeled.shownHeight <= wheeled.columnHeight,
      "carousel-page-fits",
      t,
      `${name1} is ${wheeled.shownHeight}px tall in a ${wheeled.columnHeight}px column`,
      size,
    );

    // The arrows step both ways; the buttons and the pager never move.
    const navs = new Set([
      JSON.stringify(first.nav),
      JSON.stringify(wheeled.nav),
    ]);
    await page.locator(NEXT).click();
    const stepped = await settledState(page);
    navs.add(JSON.stringify(stepped.nav));
    check(
      stepped.shown.join() === name2 && stepped.dot === name2,
      "carousel-next",
      t,
      `the next arrow left [${stepped.shown}] shown and the dot on ${stepped.dot}, not ${name2}`,
      size,
    );
    await page.locator(PREV).click();
    const back = await settledState(page);
    check(
      back.shown.join() === name1,
      "carousel-prev",
      t,
      `the previous arrow left [${back.shown}] shown, not ${name1}`,
      size,
    );
    // The arrow keys inside the column, as a keyboard reader would.
    await page.locator(PAGES).nth(1).focus();
    await page.keyboard.press("ArrowLeft");
    const keyed = await settledState(page);
    check(
      keyed.shown.join() === name0,
      "carousel-keys",
      t,
      `ArrowLeft on ${name1} left [${keyed.shown}] shown, not ${name0}`,
      size,
    );
    // Every page through its dot, the last one last: then the next arrow is off.
    for (const name of first.names) {
      await page.getByRole("tab", { name, exact: true }).click();
      const s = await settledState(page);
      navs.add(JSON.stringify(s.nav));
      check(
        s.shown.join() === name && s.scrollY === 0,
        "carousel-dot",
        t,
        `the dot for ${name} left [${s.shown}] shown and the page at ${s.scrollY}`,
        size,
      );
      check(
        s.shownHeight <= s.columnHeight,
        "carousel-page-fits",
        t,
        `${name} is ${s.shownHeight}px tall in a ${s.columnHeight}px column`,
        size,
      );
    }
    const [nextEnd, prevEnd] = await arrowState(page);
    check(
      !nextEnd.visible && nextEnd.tabIndex === -1 && prevEnd.visible,
      "carousel-next-off",
      t,
      `on the last page the next arrow is shown ${nextEnd.visible} (tabindex ${nextEnd.tabIndex}), the previous ${prevEnd.visible}`,
      size,
    );
    check(
      navs.size === 1,
      "carousel-nav-still",
      t,
      `the buttons and the pager moved between pages: ${[...navs].join(" / ")}`,
      size,
    );
    // Escape and a press on the Earth are not the carousel's: the page stays.
    const last = first.names.at(-1);
    await page.keyboard.press("Escape");
    const shift = (await carouselState(page)).shift;
    const hit = await page.locator(HIT).boundingBox();
    await page.mouse.click(hit.x + hit.width * 0.75, hit.y + hit.height * 0.5);
    await page.waitForTimeout(700);
    const kept = await settledState(page);
    check(
      kept.shown.join() === last,
      "carousel-stays",
      t,
      `Escape and a press on the Earth left [${kept.shown}] shown, not ${last}`,
      size,
    );
    check(
      shift === 0,
      "carousel-cls",
      t,
      `the layout shifted by ${shift}`,
      size,
    );
    check(
      kept.motion.every((m) => m === null),
      "carousel-motion-done",
      t,
      `a motion attribute is left set: ${kept.motion}`,
      size,
    );
    check(
      problems.length === 0,
      "carousel-console",
      t,
      problems.join("; "),
      size,
    );
    await context.close();
    measured++;
  }

  // A link to a place on a later page opens that page on load; leaving it clears the address.
  {
    const size = { width: 1440, height: 900 };
    const { page, context } = await open(browser, size, {
      query: "#tested-and-precise",
    });
    // The linked page freezes in with the entrance and then drops its motion mark.
    const landed = await page
      .waitForFunction(
        (pages) =>
          [...document.querySelectorAll(pages)].every(
            (el) => !el.dataset.motion,
          ),
        PAGES,
        { timeout: 5000 },
      )
      .then(() => true)
      .catch(() => false);
    check(
      landed,
      "carousel-motion-done",
      "carousel",
      "the page a link opened on load still has its motion mark 5 s later",
      size,
    );
    const s = await carouselState(page);
    const host = await page.evaluate(
      () =>
        document.getElementById("tested-and-precise")?.closest("[data-page]")
          ?.dataset.page ?? null,
    );
    check(
      host !== null && s.shown.join() === host && s.scrollY === 0,
      "carousel-deep-link",
      "carousel",
      `a link to a place on ${host} left [${s.shown}] shown and the page at ${s.scrollY}`,
      size,
    );
    const inView = await page.evaluate(() => {
      const r = document
        .getElementById("tested-and-precise")
        .getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    check(
      inView,
      "carousel-deep-link-view",
      "carousel",
      "the linked section is out of view",
      size,
    );
    await page.locator(PREV).click();
    await settledState(page);
    const hash = await page.evaluate(() => location.hash);
    check(
      hash === "",
      "carousel-hash-cleared",
      "carousel",
      `after leaving the page it names the address still reads ${hash}`,
      size,
    );
    // An address that is not valid percent-encoding is no address: the landing still starts.
    const {
      page: bad,
      context: badContext,
      problems,
    } = await open(browser, size, {
      query: "#100%",
    });
    const b = await settledState(bad);
    check(
      b.mark === "on" && b.shown.join() === b.names[0] && problems.length === 0,
      "carousel-bad-hash",
      "carousel",
      `with #100% the mark is ${b.mark}, [${b.shown}] is shown and the console has ${problems.join("; ") || "nothing"}`,
      size,
    );
    await badContext.close();
    await context.close();
    measured++;
  }

  // Narrower or portrait: the carousel still pages, the page scrolls and the wheel scrolls it.
  for (const size of STACKED_SIZES) {
    const t = "carousel, stacked";
    const { page, context } = await open(browser, size);
    const s = await carouselState(page);
    check(
      s.mark === "on",
      "carousel-stacked-mark",
      t,
      `data-home-carousel is ${s.mark}`,
      size,
    );
    check(
      s.docH > s.innerH && s.docW <= s.innerW,
      "carousel-stacked-scroll",
      t,
      `the page is ${s.docW}×${s.docH} in a ${s.innerW}×${s.innerH} window: it should scroll down and never sideways`,
      size,
    );
    const title = await page.locator("h1[data-page-title]").boundingBox();
    await page.mouse.move(
      title.x + title.width / 2,
      title.y + title.height / 2,
    );
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(600);
    const w = await carouselState(page);
    check(
      w.scrollY > 0 && w.shown.join() === s.names[0],
      "carousel-stacked-wheel",
      t,
      `the wheel scrolled the page to ${w.scrollY} and left [${w.shown}] shown; it should scroll and not turn`,
      size,
    );
    await page.locator(NEXT).click();
    const n = await settledState(page);
    check(
      n.shown.join() === s.names[1],
      "carousel-stacked-next",
      t,
      `the next arrow left [${n.shown}] shown, not ${s.names[1]}`,
      size,
    );
    await context.close();
    measured++;
  }

  // Without scripts every page reads in order and the pager is not shown.
  {
    const size = { width: 1440, height: 900 };
    const context = await browser.newContext({
      viewport: size,
      javaScriptEnabled: false,
    });
    await blockOffSite(context, base);
    const page = await context.newPage();
    await page.goto(`${base}${ROUTE}`, {
      waitUntil: "load",
      timeout: LOAD_TIMEOUT,
    });
    const plain = await page.evaluate(
      ({ pages, next }) => {
        const all = [...document.querySelectorAll(pages)];
        const pager = document.querySelector(next)?.parentElement;
        return {
          mark: document.documentElement.dataset.homeCarousel ?? null,
          hidden: all.filter(
            (el) => getComputedStyle(el).visibility === "hidden",
          ).length,
          pager: pager ? getComputedStyle(pager).display : null,
          scrolls: document.documentElement.scrollHeight > window.innerHeight,
        };
      },
      { pages: PAGES, next: NEXT },
    );
    check(
      plain.mark === null &&
        plain.hidden === 0 &&
        plain.pager === "none" &&
        plain.scrolls,
      "carousel-no-js",
      "carousel",
      `without scripts the mark is ${plain.mark}, ${plain.hidden} pages are hidden, the pager is ${plain.pager} and the page scrolls ${plain.scrolls}`,
      size,
    );
    await context.close();
    measured++;
  }

  // A page that is not shown draws nothing and takes no input.
  {
    const size = { width: 1440, height: 900 };
    const { page, context } = await open(browser, size);
    const closed = await page.evaluate((pages) => {
      const el = document.querySelectorAll(pages)[1];
      return { visibility: getComputedStyle(el).visibility, inert: el.inert };
    }, PAGES);
    check(
      closed.visibility === "hidden" && closed.inert,
      "carousel-closed-draws",
      "carousel",
      `a page not shown is ${closed.visibility}, inert ${closed.inert}`,
      size,
    );
    await context.close();
    measured++;
  }
}

/** Five quick turns, with a frame log and the number of animations each page runs at once. */
async function switchFrames(page) {
  await page.evaluate(() => {
    window.__frameLog = { deltas: [], most: 0, props: [] };
    let last = performance.now();
    const tick = (t) => {
      window.__frameLog.deltas.push(t - last);
      last = t;
      const per = new Map();
      for (const a of document.getAnimations()) {
        const target = a.effect?.target;
        if (!target || a.playState !== "running") continue;
        // The arrows fade on transitions by design; a page runs one animation.
        if (!target.matches("[data-page]")) continue;
        per.set(target, (per.get(target) ?? 0) + 1);
        if (a instanceof CSSAnimation) {
          for (const frame of a.effect.getKeyframes())
            for (const key of Object.keys(frame))
              if (
                !["offset", "easing", "composite", "computedOffset"].includes(
                  key,
                )
              )
                window.__frameLog.props.push(key);
        }
      }
      for (const n of per.values())
        window.__frameLog.most = Math.max(window.__frameLog.most, n);
      window.__frameLog.raf = requestAnimationFrame(tick);
    };
    window.__frameLog.raf = requestAnimationFrame(tick);
  });
  for (let i = 0; i < 5; i++) {
    await page.locator(i % 2 === 0 ? NEXT : PREV).evaluate((b) => b.click());
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => document.getAnimations().length === 0);
  return page.evaluate(() => {
    cancelAnimationFrame(window.__frameLog.raf);
    const frames = window.__frameLog.deltas.slice(2);
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      median: sorted[sorted.length >> 1],
      worst: sorted[sorted.length - 1],
      most: window.__frameLog.most,
      props: [...new Set(window.__frameLog.props)],
    };
  });
}

async function checkCarouselMotion(browser) {
  const size = { width: 1440, height: 900 };
  for (const theme of ["dark", "light"]) {
    const t = `carousel motion, ${theme}`;
    const { page, context } = await open(browser, size, {
      context: { colorScheme: theme },
      init: `try { localStorage.setItem("starlight-theme", "${theme}"); } catch {}`,
    });
    await page.mouse.move(120, 140);
    const f = await switchFrames(page);
    check(
      f.median <= 17.5,
      "carousel-frame-median",
      t,
      `the median frame is ${r1(f.median)} ms, over 17.5`,
      size,
    );
    check(
      f.worst <= 34,
      "carousel-frame-worst",
      t,
      `the worst frame is ${r1(f.worst)} ms, over 34`,
      size,
    );
    check(
      f.most <= 1,
      "carousel-one-animation",
      t,
      `a page ran ${f.most} animations at once`,
      size,
    );
    check(
      f.props.length > 0,
      "carousel-animates",
      t,
      "no page animated while turning",
      size,
    );
    await context.close();
    measured++;
  }
  // Reduced motion: the pages only fade.
  {
    const t = "carousel motion, reduced";
    const { page, context } = await open(browser, size, { reduce: true });
    await page.mouse.move(120, 140);
    const f = await switchFrames(page);
    const other = f.props.filter((p) => p !== "opacity");
    check(
      other.length === 0,
      "carousel-reduced-opacity-only",
      t,
      `under reduced motion the pages animate ${other.join(", ")}`,
      size,
    );
    await context.close();
    measured++;
  }
}

async function checkCarouselModuleBlocked(browser) {
  const size = { width: 1440, height: 900 };
  const t = "carousel, module blocked";
  const context = await browser.newContext({ viewport: size });
  await blockOffSite(context, base);
  const page = await context.newPage();
  await page.route(/\.js(\?|$)/, (route) =>
    route.request().resourceType() === "script"
      ? route.abort()
      : route.continue(),
  );
  await page.goto(`${base}${ROUTE}?globe=canvas2d`, {
    waitUntil: "domcontentloaded",
  });
  // The page holds still for the failsafe (2.5 s), then lets go.
  await page.waitForTimeout(3500);
  const s = await page.evaluate((pages) => {
    const root = document.documentElement;
    const all = [...document.querySelectorAll(pages)];
    scrollTo(0, 5000);
    return {
      mark: root.dataset.homeCarousel ?? null,
      scrolls: root.scrollHeight > window.innerHeight,
      y: window.scrollY,
      hidden: all.filter((el) => getComputedStyle(el).visibility === "hidden")
        .length,
    };
  }, PAGES);
  check(
    s.mark === null && s.scrolls && s.y > 0 && s.hidden === 0,
    "carousel-module-blocked",
    t,
    `with the module blocked the mark is ${s.mark}, the page scrolls ${s.scrolls} (to ${s.y}), ${s.hidden} pages hidden`,
    size,
  );
  await context.close();
  measured++;
}

async function checkCarouselAxe(browser) {
  const size = { width: 1440, height: 900 };
  const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
  for (const theme of ["dark", "light"]) {
    const { page, context } = await open(browser, size, {
      context: { colorScheme: theme },
      init: `try { localStorage.setItem("starlight-theme", "${theme}"); } catch {}`,
    });
    const { names } = await carouselState(page);
    for (const [i, name] of names.entries()) {
      const t = `carousel axe, ${theme}, ${name}`;
      if (i > 0) await page.getByRole("tab", { name, exact: true }).click();
      await settledState(page);
      await page.waitForTimeout(200);
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const found = results.violations.map(
        (v) => `${v.id} (${v.nodes.length}: ${v.nodes[0].target.join(" ")})`,
      );
      check(
        found.length === 0,
        "carousel-axe",
        t,
        `axe found ${found.join("; ")}`,
        size,
      );
      measured++;
    }
    await context.close();
  }
}

async function main() {
  const browser = await launchShared();
  try {
    if (args.includes("--resolve-only")) {
      process.exitCode = await resolveOnly(browser);
      return;
    }
    const steps = [
      ["no frame", () => checkNoFrame(browser)],
      ["position", () => checkPosition(browser)],
      ["drawer, wide", () => checkDrawer(browser, WIDE)],
      ["drawer, narrow", () => checkDrawer(browser, NARROW)],
      ["close and card", () => checkClose(browser)],
      ["search and popups", () => checkSearch(browser, wanted)],
      ["zoom stack", () => checkStack(browser)],
      ["layout shift", () => checkShift(browser)],
      ["copy boxes", () => checkPassThrough(browser)],
      ["zoom fills the hero", () => checkZoomFills(browser)],
      ["no sideways scroll", () => checkFit(browser)],
      ["frames", () => checkFrames(browser)],
      ["interaction", () => checkInteraction(browser)],
      ["phone menu", () => checkMobileMenu(browser)],
      ["card beside the sheet", () => checkNarrowCard(browser)],
      ["access modes", () => checkAccess(browser)],
      ["touch", () => checkTouch(browser)],
      ["night sky sources", () => checkSkySources()],
      ["night sky", () => checkSky(browser)],
      ["sun and moon", () => checkSkyBodies(browser)],
      ["sun behind the copy", () => checkSkyCopy(browser)],
      ["sky from black", () => checkSkyReveal(browser)],
      ["entrance", () => checkEntrance(browser)],
      ["arrival from northguild.dev", () => checkCrossSite(browser)],
      ["night sky, reduced motion", () => checkSkyReduced(browser)],
      ["zone lists", () => checkZoneLists(browser)],
      ["landing carousel", () => checkCarousel(browser)],
      ["carousel motion", () => checkCarouselMotion(browser)],
      ["carousel, module blocked", () => checkCarouselModuleBlocked(browser)],
      ["carousel axe", () => checkCarouselAxe(browser)],
    ];
    const only = flag("only", "");
    for (const [name, run] of steps) {
      if (only && !name.includes(only)) continue;
      const before = failures.length;
      await run();
      console.log(`${failures.length === before ? "ok  " : "FAIL"} ${name}`);
    }
  } finally {
    await browser.close();
  }
  recordMeasured(GATE, measured);
  if (failures.length) {
    console.error(`\nhero-space: ${failures.length} failure(s)`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nhero-space: all checks passed (${measured} cells)`);
}

await main();
