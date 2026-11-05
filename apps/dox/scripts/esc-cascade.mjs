#!/usr/bin/env node
/**
 * Escape-cascade gate: one Escape order for the whole site, and the zone drawer's light dismiss.
 *
 * Per page, browser and width it opens every layer a keyboard reader can open, in a realistic
 * order, then presses Escape until nothing is left and asserts, for each press:
 *   - exactly one layer closed and none opened;
 *   - focus is on the control that opened that layer (never `<body>`);
 *   - the press after the last layer changes nothing.
 *
 *   `/` first turns the landing's carousel to its second page with the next arrow, then opens
 *   the data-credits popover, the zone drawer by its magnifier, the Settings disclosure and the
 *   Find a zone list, and walks the keyboard path magnifier -> Settings -> Enter to prove the
 *   gear opens once the drawer is open. The zone card is the drawer's selection, not a layer.
 *   The carousel is not a layer either (the WAI-ARIA carousel pattern gives Escape no part): the
 *   cascade closes every layer and leaves the page the reader turned to.
 *   `/tools/zoned-earth/`: a framed globe with no drawer. The start zone's card is not a layer;
 *   once a click on the Earth chooses a zone, its card is one. A tool page with disclosures,
 *   `/dox/` and a docs page: their disclosures, the menu and the search dialog.
 *
 * On the two globe pages it also checks the drawer:
 *   - a press outside the Earth closes it and does not move focus; a press inside it, on its
 *     Settings or on its open list does not;
 *   - a click on a list button and a click on a region of the Earth both select (card, list mark)
 *     and centre the globe on the zone;
 *   - Escape closes the drawer and leaves the zone card, which is the drawer's selection and not a
 *     layer of its own; the next press changes nothing.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server), for example:
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage: node scripts/esc-cascade.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit]
 * Exits non-zero on any failure.
 */
import { launchBrowser } from "./lib/browser-launch.mjs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";

const GATE = "esc-cascade";

const PAGES = [
  "/",
  "/tools/zoned-earth/",
  "/tools/dwell-ledger/",
  "/dox/",
  "/guides/concepts/standards/",
];
const GLOBE_PAGES = new Set(["/", "/tools/zoned-earth/"]);
const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

const PAGES_ARG = applyPageContract({ gate: GATE, pages: PAGES });
const SELECTED = PAGES_ARG ?? PAGES;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const ENGINES = ["chromium", "firefox", "webkit"];
const browsers = flag("browsers", "chromium,webkit").split(",");
for (const name of browsers) {
  if (!ENGINES.includes(name)) {
    console.error(`${GATE}: unknown browser "${name}"`);
    process.exit(2);
  }
}

const failures = [];
let measured = 0;
const fail = (rule, browser, width, path, message) => {
  const text = `${browser} ${width}px ${path}: ${message}`;
  failures.push(text);
  console.error(`  ! ${rule} · ${text}`);
  recordFinding({
    gate: GATE,
    rule,
    page: path,
    target: "page",
    browser,
    width,
    message,
  });
};

/** Runs in the page: the open layers, one stable key each, and which control opened each. */
function probe() {
  const keys = [];
  const doc = document;
  if (doc.querySelector('[data-drawer][data-open="true"]')) keys.push("drawer");
  /* Where a drawer exists the zone card is its selection, not a layer of its own. Without one
     it is a layer only once the reader has chosen a zone (the gate marks when it has): the zone
     the globe starts on is shown, not opened. */
  if (
    window.__escChoseZone === true &&
    !doc.querySelector("[data-drawer]") &&
    doc.querySelector('[data-gate="globe-tooltip"]:not([hidden])')
  )
    keys.push("card");
  /* A manual popover is not something Escape closes (esc-native.ts skips it): the zone card stays
     open in the top layer only to draw above the header, and is counted above when it is a layer. */
  for (const el of doc.querySelectorAll('[popover]:not([popover="manual"])'))
    if (el.matches(":popover-open")) keys.push(`pop:${el.id}`);
  [...doc.querySelectorAll("dialog[open]")].forEach((_, i) =>
    keys.push(`dialog:${i}`),
  );
  [...doc.querySelectorAll("details[open]")]
    .filter((d) => !d.closest("nav"))
    .forEach((_, i) => keys.push(`details:${i}`));
  if (doc.querySelector('starlight-menu-button button[aria-expanded="true"]'))
    keys.push("menu");
  for (const b of doc.querySelectorAll(
    'button[aria-expanded="true"][aria-controls]',
  )) {
    if (b.closest("nav") || b.matches("[data-globe-search], [popovertarget]"))
      continue;
    keys.push(`disc:${b.getAttribute("aria-controls")}`);
  }
  [...doc.querySelectorAll('[role="combobox"][aria-expanded="true"]')].forEach(
    (_, i) => keys.push(`list:${i}`),
  );
  return keys;
}

/** Runs in the page: the name of the carousel's selected dot, or null without a carousel. */
function carouselPage() {
  if (document.documentElement.dataset.homeCarousel !== "on") return null;
  return (
    document
      .querySelector('[data-hero-dots] [role="tab"][aria-selected="true"]')
      ?.getAttribute("aria-label") ?? null
  );
}

/** Runs in the page: is focus on the control that opened `key`? Returns null when it has none. */
function focusOn(key) {
  const doc = document;
  const active = doc.activeElement;
  let opener = null;
  if (key === "drawer") opener = doc.querySelector("[data-globe-search]");
  else if (key === "menu")
    opener = doc.querySelector("starlight-menu-button button");
  else if (key.startsWith("pop:"))
    opener = doc.querySelector(`[popovertarget="${CSS.escape(key.slice(4))}"]`);
  else if (key.startsWith("dialog:"))
    opener = doc.querySelector("site-search [data-open-modal]");
  else if (key.startsWith("disc:"))
    opener = doc.querySelector(
      `button[aria-controls="${CSS.escape(key.slice(5))}"]`,
    );
  else if (key.startsWith("details:")) {
    const open = [...doc.querySelectorAll("details")].filter(
      (d) => !d.closest("nav"),
    );
    const i = Number(key.slice(8));
    opener = open[i]?.querySelector(":scope > summary") ?? null;
  } else if (key.startsWith("list:"))
    opener = doc.querySelector('[role="combobox"]');
  /* An inert opener (the zoom stack while the drawer is open) cannot take focus back; the press
     only has to leave focus somewhere in the page. */
  if (!opener || opener.closest("[inert]")) return null;
  return active === opener;
}

async function openByKeyboard(page, selector) {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0) return false;
  if (!(await target.isVisible())) return false;
  await target.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  return true;
}

async function pressEscape(page) {
  const before = await page.evaluate(probe);
  /* A disclosure the reader is reading holds focus; put it there as a reader would have. */
  if (before.length > 0 && before.every((k) => k.startsWith("details:")))
    await page.evaluate((key) => {
      const open = [...document.querySelectorAll("details[open]")].filter(
        (d) => !d.closest("nav"),
      );
      open[Number(key.slice(8))]?.querySelector(":scope > summary")?.focus();
    }, before.at(-1));
  await page.keyboard.press("Escape");
  // Layers animate out (the drawer): wait for the set to settle.
  let after = before;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(60);
    after = await page.evaluate(probe);
    if (after.length !== before.length) break;
  }
  await page.waitForTimeout(80);
  after = await page.evaluate(probe);
  return { before, after };
}

/** Presses Escape down to nothing and asserts the cascade rules. */
async function cascade(page, ctx, opened) {
  const { browser, width, path } = ctx;
  const order = [];
  let guard = 0;
  while (guard++ < 14) {
    const { before, after } = await pressEscape(page);
    if (before.length === 0) {
      if (after.length !== 0)
        fail(
          "opened-on-escape",
          browser,
          width,
          path,
          `Escape with nothing open opened ${after.join(", ")}`,
        );
      break;
    }
    const gone = before.filter((k) => !after.includes(k));
    const added = after.filter((k) => !before.includes(k));
    if (gone.length !== 1 || added.length > 0) {
      fail(
        "not-one-layer",
        browser,
        width,
        path,
        `one Escape took [${before.join(", ")}] to [${after.join(", ")}]; exactly one layer should close`,
      );
      break;
    }
    order.push(gone[0]);
    const onOpener = await page.evaluate(focusOn, gone[0]);
    const onBody = await page.evaluate(
      () => !document.activeElement || document.activeElement === document.body,
    );
    if (onOpener === false || (onBody && onOpener !== null))
      fail(
        "focus-not-returned",
        browser,
        width,
        path,
        `closing ${gone[0]} left focus ${onBody ? "on the page" : "off its opener"}`,
      );
    if (after.length === 0) break;
  }
  const left = await page.evaluate(probe);
  if (left.length)
    fail(
      "left-open",
      browser,
      width,
      path,
      `after the cascade ${left.join(", ")} is still open`,
    );
  // One more press with nothing open does nothing.
  const focusBefore = await page.evaluate(
    () => document.activeElement?.outerHTML.slice(0, 80) ?? "",
  );
  const extra = await pressEscape(page);
  const focusAfter = await page.evaluate(
    () => document.activeElement?.outerHTML.slice(0, 80) ?? "",
  );
  if (extra.after.length || focusBefore !== focusAfter)
    fail(
      "escape-not-idle",
      browser,
      width,
      path,
      "Escape with nothing open changed the page",
    );
  for (const key of opened)
    if (!order.includes(key))
      fail(
        "never-closed",
        browser,
        width,
        path,
        `${key} was opened and Escape never closed it`,
      );
  return order;
}

/** The first viewport point on plain page (no control, not in the Earth's disc or the drawer). */
function findOutsidePoint() {
  const hit = document.querySelector('[data-gate="globe-hit"]');
  const box = hit?.getBoundingClientRect();
  const cx = box ? box.left + box.width / 2 : -9999;
  const cy = box ? box.top + box.height / 2 : -9999;
  const reach = box ? (box.width / 2) * 1.12 : 0;
  for (let y = 12; y < innerHeight - 12; y += 24) {
    for (let x = 12; x < innerWidth - 12; x += 24) {
      if (Math.hypot(x - cx, y - cy) <= reach) continue;
      const el = document.elementFromPoint(x, y);
      if (!el) continue;
      if (
        el.closest(
          'a, button, input, summary, select, textarea, [role="button"], [data-drawer], [data-gate="globe-zoom"], [data-gate="globe-tooltip"], [popover], dialog, header, nav',
        )
      )
        continue;
      return { x, y };
    }
  }
  return null;
}

/** Where the Earth's disc is, in viewport pixels (the hit area is the disc's square). */
function discOf() {
  const hit = document.querySelector('[data-gate="globe-hit"]');
  if (!hit) return null;
  const b = hit.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 };
}

const drawerOpen = (page) =>
  page.evaluate(
    () => document.querySelector("[data-drawer]")?.dataset.open === "true",
  );

async function openDrawer(page) {
  if (await drawerOpen(page)) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("[data-globe-search]").click();
  await page.waitForTimeout(500);
}

/** A mouse press that is not a click: down, then up elsewhere. Returns after the pointerdown settles. */
async function pressOnly(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.move(2, 2);
  await page.mouse.up();
}

async function drawerChecks(page, ctx) {
  const { browser, width, path } = ctx;
  await page.evaluate(() => window.scrollTo(0, 0));
  await openDrawer(page);
  if (!(await drawerOpen(page))) {
    fail(
      "drawer-not-open",
      browser,
      width,
      path,
      "the magnifier did not open the zone drawer",
    );
    return;
  }
  // Inside: the drawer's own content, and Find a zone's open list.
  const panel = await page.locator("[data-drawer]").boundingBox();
  if (panel) {
    await page.mouse.click(
      panel.x + panel.width / 2,
      Math.min(
        panel.y + panel.height - 12,
        (page.viewportSize()?.height ?? 0) - 12,
      ),
    );
    await page.waitForTimeout(250);
    if (!(await drawerOpen(page)))
      fail(
        "closed-by-inside-press",
        browser,
        width,
        path,
        "a press inside the drawer closed it",
      );
  }
  const input = page.locator('[data-drawer] [role="combobox"]').first();
  if ((await input.count()) && (await input.isVisible())) {
    await input.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    const listOpen = await page.evaluate(
      () =>
        document.querySelector('[role="combobox"][aria-expanded="true"]') !==
        null,
    );
    if (listOpen) {
      const list = page.locator('[data-drawer] [role="listbox"]').first();
      /* A bottom sheet's list can sit below the fold; a reader scrolls to it before pressing. */
      await list.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      const b = await list.boundingBox();
      const vh = page.viewportSize()?.height ?? 0;
      if (b && b.y >= 0 && b.y + 12 < vh) {
        await page.mouse.move(b.x + b.width / 2, b.y + 6);
        await page.mouse.down();
        await page.waitForTimeout(200);
        const stays = await drawerOpen(page);
        await page.mouse.up();
        if (!stays)
          fail(
            "closed-by-list-press",
            browser,
            width,
            path,
            "a press on Find a zone's open list closed the drawer",
          );
      }
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  await openDrawer(page);

  // Outside: the sky and the page.
  const point = await page.evaluate(findOutsidePoint);
  if (!point) {
    fail(
      "no-outside-point",
      browser,
      width,
      path,
      "found no plain page point outside the Earth to press",
    );
  } else {
    await page.evaluate(() =>
      document.querySelector("[data-drawer] input")?.focus(),
    );
    await pressOnly(page, point.x, point.y);
    if (await drawerOpen(page))
      fail(
        "outside-press-kept-open",
        browser,
        width,
        path,
        `a press at ${Math.round(point.x)},${Math.round(point.y)} outside the Earth left the drawer open`,
      );
    const focus = await page.evaluate(
      () => document.activeElement?.closest("[data-globe-search]") !== null,
    );
    if (focus)
      fail(
        "focus-yanked",
        browser,
        width,
        path,
        "an outside press sent focus back to the magnifier",
      );
  }

  // The Earth's disc is not outside.
  await openDrawer(page);
  const disc = await page.evaluate(discOf);
  if (disc) {
    await page.mouse.move(disc.x, disc.y);
    await page.mouse.down();
    await page.waitForTimeout(200);
    const stays = await drawerOpen(page);
    await page.mouse.up();
    if (!stays)
      fail(
        "disc-press-closed",
        browser,
        width,
        path,
        "a press on the Earth's disc closed the drawer",
      );
  }
}

/** The zone the card names (its clock changes every second, so the text is cut at the time). */
const cardText = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('[data-gate="globe-tooltip"]');
    if (!card || card.hidden) return "";
    return (
      card.textContent
        .trim()
        .replace(/\s+/g, " ")
        .match(/^[^\d]+/)?.[0] ?? ""
    );
  });
/**
 * The height of the point the card hangs from, in the pixels it is placed in (the page's, in the
 * top layer): the zone's place on the Earth, only ever compared with itself on one page. Its
 * left edge is clamped to fit the stage, so only the height tells where the zone is drawn.
 */
const cardAnchor = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('[data-gate="globe-tooltip"]');
    if (!card || card.hidden) return null;
    const top = Number.parseFloat(card.style.top);
    if (!Number.isFinite(top)) return null;
    return top - (card.hasAttribute("data-below") ? 12 : 0);
  });
const marked = (page) =>
  page.evaluate(
    () =>
      document
        .querySelector('[data-drawer] [role="option"][aria-selected="true"]')
        ?.textContent?.trim()
        .replace(/\s+/g, " ") ?? "",
  );

async function selectionChecks(page, ctx) {
  const { browser, width, path } = ctx;
  await page.evaluate(() => window.scrollTo(0, 0));
  await openDrawer(page);
  // A list button: selects and centres.
  const options = page.locator('[data-drawer] [role="option"]');
  const count = await options.count();
  if (count < 3) {
    fail(
      "no-list",
      browser,
      width,
      path,
      "the zone list has fewer than three zones",
    );
    return;
  }
  await options.nth(2).click();
  await page.waitForTimeout(2200);
  /* Pressing a row of a bottom sheet scrolls the page, and on a narrow screen the Earth sits
     under the copy: bring the Earth into view before measuring it. */
  await page.evaluate(() =>
    document
      .querySelector('[data-gate="globe-hit"]')
      ?.scrollIntoView({ block: "center" }),
  );
  await page.waitForTimeout(400);
  const viaList = {
    text: await cardText(page),
    at: await cardAnchor(page),
    mark: await marked(page),
  };
  if (!viaList.text)
    fail(
      "list-click-no-card",
      browser,
      width,
      path,
      "a list click showed no card",
    );
  if (!viaList.mark)
    fail(
      "list-click-no-mark",
      browser,
      width,
      path,
      "a list click marked no zone in the list",
    );
  const disc = await page.evaluate(discOf);
  if (!disc || viaList.at === null) return;

  // A region of the Earth: selects and centres the same way.
  const spots = [
    [0.55, 0.1],
    [-0.55, 0.15],
    [0.3, -0.5],
    [-0.3, 0.55],
    [0.25, 0.3],
    [-0.2, -0.15],
    [0.6, 0.4],
    [-0.6, -0.1],
    [0.1, 0.65],
  ];
  let moved = false;
  let offCentre = 0;
  for (const [dx, dy] of spots) {
    const x = disc.x + dx * disc.r;
    const y = disc.y + dy * disc.r;
    const was = await cardText(page);
    /* A spot under the card would press the card, not the Earth. */
    const underCard = await page.evaluate(
      ([px, py]) =>
        document
          .elementFromPoint(px, py)
          ?.closest('[data-gate="globe-tooltip"]') !== null,
      [x, y],
    );
    if (underCard) continue;
    await page.mouse.click(x, y);
    await page.waitForTimeout(1200);
    const text = await cardText(page);
    if (!text || text === was) continue;
    const at = await cardAnchor(page);
    const mark = await marked(page);
    if (!mark)
      fail(
        "globe-click-no-mark",
        browser,
        width,
        path,
        "a click on a region marked no zone in the list",
      );
    /* Centred, the zone is drawn where the list's zone was: the card hangs from the same height. */
    if (at === null || Math.abs(at - viaList.at) > disc.r * 0.04) offCentre++;
    moved = true;
  }
  if (offCentre > 0)
    fail(
      "globe-click-not-centred",
      browser,
      width,
      path,
      `${offCentre} click(s) on a region of the Earth left the zone off the centre a list click brings it to`,
    );
  if (!moved)
    fail(
      "globe-click-no-card",
      browser,
      width,
      path,
      "no click on a region of the Earth showed a different card",
    );

  // Escape closes the drawer; the card is its selection and stays.
  await openDrawer(page);
  /* A click on open sea clears the card; a list row brings one back. */
  if (!(await cardText(page))) {
    await options.nth(2).click();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.evaluate(() => document.activeElement?.blur?.());
  const order = [];
  for (let i = 0; i < 2; i++) {
    const { before, after } = await pressEscape(page);
    order.push(before.filter((k) => !after.includes(k)).join(","));
  }
  const kept = await cardText(page);
  if (order[0] !== "drawer" || order[1] !== "" || !kept)
    fail(
      "drawer-keeps-card",
      browser,
      width,
      path,
      `Escape closed [${order.join("] then [")}] and ${kept ? "kept" : "dropped"} the card; it should close the drawer, then nothing, and keep the card`,
    );
}

async function runGlobe(page, ctx) {
  const { browser, width, path } = ctx;
  const opened = [];
  // The landing's carousel, on at every width: the next arrow turns it to the second page.
  let turnedTo = null;
  if (path === "/") {
    const before = await page.evaluate(carouselPage);
    await openByKeyboard(page, '[data-hero-step="1"]');
    turnedTo = await page.evaluate(carouselPage);
    if (before === null || turnedTo === null || turnedTo === before) {
      fail(
        "carousel-not-turned",
        browser,
        width,
        path,
        `Enter on the next arrow left the carousel on ${turnedTo ?? "no page"}`,
      );
      turnedTo = null;
    }
  }
  const credits = page
    .locator('[popovertarget$="data-credits"], [popovertarget*="credits"]')
    .first();
  if (await credits.count()) {
    const id = await credits.getAttribute("popovertarget");
    await credits.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    opened.push(`pop:${id}`);
  }
  // Keyboard path: magnifier, then (the drawer open) Settings, then Enter.
  await page.locator("[data-globe-search]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  if (!(await drawerOpen(page)))
    fail(
      "drawer-not-open",
      browser,
      width,
      path,
      "Enter on the magnifier did not open the drawer",
    );
  else opened.push("drawer");
  const settings = page.getByRole("button", { name: "Settings" });
  if (await settings.count()) {
    await settings.first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    const expanded = await settings.first().getAttribute("aria-expanded");
    if (expanded !== "true")
      fail(
        "settings-unreachable",
        browser,
        width,
        path,
        "Enter on the Settings button did not open it",
      );
    else opened.push("disc:settings");
  }
  const input = page.locator('[data-drawer] [role="combobox"]').first();
  if (await input.count()) {
    await input.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
  }
  const live = await page.evaluate(probe);
  if (live.includes("card")) opened.push("card");
  const expectFirst = live.some((k) => k.startsWith("list:")) ? "list:0" : null;
  const order = await cascade(
    page,
    ctx,
    opened.filter((k) => live.includes(k)),
  );
  if (expectFirst && order[0] !== expectFirst)
    fail(
      "wrong-first-layer",
      browser,
      width,
      path,
      `the first Escape closed ${order[0]}; the open list holds focus and goes first`,
    );
  if (turnedTo !== null) {
    const after = await page.evaluate(carouselPage);
    if (after !== turnedTo)
      fail(
        "carousel-closed-by-escape",
        browser,
        width,
        path,
        `the cascade moved the carousel from ${turnedTo} to ${after ?? "no page"}; Escape is not the carousel's`,
      );
  }
}

/**
 * A framed globe (no drawer): a click on the Earth chooses a zone, which makes its card a layer.
 * The start zone's card is shown from load and must not count, so it is checked first.
 */
async function chooseZone(page, ctx) {
  const { browser, width, path } = ctx;
  const seeded = await page.evaluate(probe);
  if (seeded.includes("card"))
    fail(
      "start-card-a-layer",
      browser,
      width,
      path,
      "the card counted as a layer before any zone was chosen",
    );
  const disc = await page.evaluate(discOf);
  if (!disc) return;
  await page.locator('[data-gate="globe-hit"]').scrollIntoViewIfNeeded();
  const was = await cardText(page);
  for (const [dx, dy] of [
    [0.3, -0.2],
    [-0.3, 0.2],
    [0.2, 0.4],
    [-0.4, -0.3],
  ]) {
    const box = await page.evaluate(discOf);
    if (!box) return;
    await page.mouse.click(box.x + dx * box.r, box.y + dy * box.r);
    await page.waitForTimeout(800);
    const text = await cardText(page);
    if (text && text !== was) {
      await page.evaluate(() => {
        window.__escChoseZone = true;
      });
      return;
    }
  }
  fail(
    "framed-click-no-card",
    browser,
    width,
    path,
    "no click on the framed Earth chose a zone",
  );
}

async function runGeneric(page, ctx) {
  const opened = [];
  if (GLOBE_PAGES.has(ctx.path)) await chooseZone(page, ctx);
  // Page disclosures first, the modal search last (it makes the page inert).
  const toggles = page.locator(
    'main button[aria-expanded="false"][aria-controls], main summary',
  );
  const n = Math.min(await toggles.count(), 3);
  for (let i = 0; i < n; i++) {
    const t = toggles.nth(i);
    if (!(await t.isVisible())) continue;
    await t.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
  }
  const footer = page.locator("footer summary").first();
  const footerOpen = await footer
    .evaluate((el) => el.parentElement?.hasAttribute("open") ?? false)
    .catch(() => true);
  if ((await footer.count()) && !footerOpen) {
    if (await footer.isVisible().catch(() => false)) {
      await footer.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await footer.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
    }
  }
  const menu = page.locator("starlight-menu-button button").first();
  if ((await menu.count()) && (await menu.isVisible())) {
    await menu.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  const search = page.locator("site-search [data-open-modal]").first();
  if (
    (await search.count()) &&
    (await search.isVisible()) &&
    !(await menu.isVisible().catch(() => false))
  ) {
    await search.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  const live = await page.evaluate(probe);
  opened.push(...live);
  if (live.length === 0) {
    // A page with nothing to open still must ignore Escape.
    await cascade(page, ctx, []);
    return;
  }
  await cascade(page, ctx, opened);
}

for (const name of browsers) {
  const browser = await launchBrowser(name);
  for (const size of WIDTHS) {
    for (const path of SELECTED) {
      const ctx = { browser: name, width: size.width, path };
      const context = await browser.newContext({
        viewport: size,
        reducedMotion: "reduce",
      });
      await blockOffSite(context, base);
      const page = await context.newPage();
      try {
        const response = await page.goto(`${base}${path}`, {
          waitUntil: "load",
        });
        if (!response || response.status() >= 400) {
          fail(
            "http-status",
            name,
            size.width,
            path,
            `HTTP ${response?.status()}`,
          );
          continue;
        }
        await page.waitForTimeout(GLOBE_PAGES.has(path) ? 3500 : 1200);
        if (
          GLOBE_PAGES.has(path) &&
          !(await page.locator("[data-globe-search]").count())
        ) {
          /* A framed globe has no drawer: a zone the reader chose is a plain layer. */
          await runGeneric(page, ctx);
        } else if (GLOBE_PAGES.has(path)) {
          {
            await selectionChecks(page, ctx);
            await drawerChecks(page, ctx);
            await page.reload({ waitUntil: "load" });
            await page.waitForTimeout(3500);
            await runGlobe(page, ctx);
          }
        } else {
          await runGeneric(page, ctx);
        }
        measured++;
      } catch (error) {
        fail(
          "gate-error",
          name,
          size.width,
          path,
          String(error?.message ?? error).split("\n")[0],
        );
      } finally {
        await context.close();
      }
    }
  }
  await browser.close();
}

recordMeasured(GATE, measured);
if (failures.length) {
  console.error(
    `${GATE}: ${failures.length} failure(s) across ${measured} cell(s)`,
  );
  process.exit(1);
}
console.log(`${GATE}: ${measured} cell(s) pass`);
