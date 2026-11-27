#!/usr/bin/env node
/**
 * Data-credits gate (CORE-88): the info button sits on the drawing it credits, must be reachable,
 * must open and close from the keyboard, must fit a phone, and must never sit over anything a
 * reader can use or read.
 *
 * Placements, per page:
 *   - `/` and `/tools/zoned-earth/`: the last button of the globe's control stack (the seventh on `/`,
 *     where the zone finder's magnifier, Locate and Look at come before it; the fifth on the tool
 *     page, after Locate). The browser's zone is pinned (`ZONE`), so Locate always has a zone to
 *     go to and shows;
 *   - `/why-gmt/`: a glass square in the time-zone map's corner;
 *   - `/check/canada-2026-clock-change/`: a glass square in the Canada map's corner, added by the client
 *     when the map is drawn (the Worker is stubbed), at every width;
 *   - `/check/morocco-2026-clock-change/`: the same square in the Morocco map's top-start corner
 *     (`corner-start`), since Algeria fills the bottom-end one.
 *
 * WebKit presses Option+Tab where Chromium presses Tab: Safari on macOS leaves buttons out of the
 * plain Tab order for every site, so plain Tab there tests a browser setting, not this page.
 *
 * For each, at 1280x800 and 375x812, at scroll top, middle and bottom:
 *   - the button's rect intersects no other focusable element's rect (the globe's canvas, which the
 *     button is drawn on, aside) and no text node's client rect;
 * and per page and width:
 *   - Tab reaches the button (a stack's by ArrowUp from Zoom in, wrapping round the toolbar named
 *     "Globe controls", which one Tab leaves), Enter opens the popover, the accessibility tree shows it expanded
 *     (read from the AX tree over CDP, or `ariaSnapshot()`; a native popover button has no
 *     `aria-expanded` attribute), Escape closes it and focus is back on the button;
 *   - the open panel sits inside the viewport and covers none of the control buttons: beside a
 *     column stack, above a row one.
 *
 * On `/` it also reads the info popover's "Coming up in the sky" list at two pinned instants
 * (`events-ahead`, `events-now`).
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server), for example:
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage: node scripts/data-credits-check.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit] [--shots DIR]
 * `--shots` saves a screenshot of each drawing with its panel open. Exits non-zero on any failure.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { launchBrowser, tabKey } from "./lib/browser-launch.mjs";
import { blockOffSite } from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { gate, resolveMisses } from "./lib/locate.mjs";

const GATE = "data-credits-check";

const ZOOM_STACK = ["Zoom in", "Zoom out", "Reset zoom"];
const LOCATE = "Go to my time zone";
/* A zone the globe places, so the stack's Locate shows (it hides without one). */
const ZONE = "Europe/London";
const GLOBE = {
  stack: true,
  frame: gate("globe-stage"),
  id: "globe-data-credits",
  order: [...ZOOM_STACK, LOCATE, "Data credits"],
};
const TARGETS = [
  {
    path: "/",
    slug: "home-globe",
    ...GLOBE,
    name: "About this sky",
    order: [...ZOOM_STACK, "Find a zone", LOCATE, "Look at", "About this sky"],
    // The landing alone carries the night sky, so alone it credits the star catalogue, and alone
    // it holds the licence note instead of the page footer.
    labels: [
      "Time zone boundaries",
      "Earth imagery",
      "Stars",
      "Milky Way",
      "Sun",
      "Moon",
      "Planets",
      "Vesta",
      "Pluto",
      "Close approaches",
      "Licence",
    ],
  },
  { path: "/tools/zoned-earth/", slug: "zoned-earth", ...GLOBE },
  {
    path: "/why-gmt/",
    slug: "why-gmt-map",
    frame: gate("credited-frame"),
    id: "tz-map-data-credits",
    // What the drawing paints: land, and the zone dots.
    drawn: `${gate("credited-frame")} svg path, ${gate("credited-frame")} svg circle`,
  },
  {
    path: "/check/canada-2026-clock-change/",
    slug: "canada-map",
    frame: gate("map-frame"),
    id: "canada-data-credits",
    drawn: gate("map-shape"),
    labels: ["Time zone boundaries", "Coastlines"],
    stubWorker: true,
  },
  {
    path: "/check/morocco-2026-clock-change/",
    slug: "morocco-map",
    frame: `[data-widget="morocco-clock-change"] ${gate("map-frame")}`,
    id: "morocco-data-credits",
    drawn: `[data-widget="morocco-clock-change"] ${gate("map-shape")}`,
    labels: ["Time zone boundaries", "Coastlines"],
    stubWorker: true,
    api: "morocco",
    stub: {
      now: "2026-10-25T12:00:00Z",
      probe: [],
      changes: [],
      transitions: [],
      zones: [],
    },
  },
  {
    // The Today view is the one shown on load; the Proposals map has its own credits square.
    path: "/check/us-sunshine-protection-act/",
    slug: "us-map",
    frame: '[id="sunshine-today-map"]',
    id: "sunshine-today-data-credits",
    drawn: `[id="sunshine-today-map"] ${gate("map-shape")}`,
    labels: ["Time zone boundaries", "Coastlines"],
    stubWorker: true,
    // The US page's sections are `us-section`, one for each view; the first is Today's.
    section: "us-section",
    apiPath: "**/api/sunshine-protection-act",
    stub: { now: "2026-11-13T12:00:00Z", zones: [] },
  },
];
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];

// The runner's page contract (`scripts/gates/`).
const PAGES_ARG = await applyPageContract({
  gate: GATE,
  pages: TARGETS.map((target) => target.path),
});
const SELECTED = PAGES_ARG
  ? TARGETS.filter((target) => PAGES_ARG.includes(target.path))
  : TARGETS;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const engines = { chromium: true, firefox: true, webkit: true };
const browsers = flag("browsers", "chromium").split(",");
for (const name of browsers) {
  if (!engines[name]) {
    console.error(`data-credits-check: unknown browser "${name}"`);
    process.exit(2);
  }
}
const shots = flag("shots", "");
if (shots) mkdirSync(shots, { recursive: true });

const failures = [];
let measured = 0;
/** Every message starts "<browser> <width>px <path>: ", which is the finding's cell. */
const fail = (msg) => {
  failures.push(msg);
  const cell = /^(\w+) (\d+)px (\S+?)(?: @\S+)?: (.*)$/s.exec(msg);
  recordFinding({
    gate: GATE,
    rule: (cell?.[4] ?? "").startsWith("HTTP")
      ? "http-status"
      : /overlaps|covers/.test(msg)
        ? "overlap"
        : "credits-check",
    page: cell?.[3] ?? null,
    target: "page",
    browser: cell?.[1] ?? null,
    width: cell ? Number(cell[2]) : null,
    message: cell?.[4] ?? msg,
  });
};

const STUB = {
  now: "2026-10-22T12:00:00Z",
  probe: [],
  transitions: [],
  zones: [],
};

/** Runs in the page: what the button overlaps at the current scroll position. */
function overlaps(id) {
  const button = document.querySelector(`[popovertarget="${id}"]`);
  if (!button) return { missing: true };
  const b = button.getBoundingClientRect();
  const hit = (r) =>
    r.width > 0 &&
    r.height > 0 &&
    r.left < b.right &&
    r.right > b.left &&
    r.top < b.bottom &&
    r.bottom > b.top;
  const found = [];
  // What a reader can actually see or reach: a rect is cut down by every ancestor that clips
  // (the globe's clock list scrolls inside a clipped box and keeps its off-screen rows in the DOM).
  const visible = (el, r) => {
    let box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const c = a.getBoundingClientRect();
      if (s.overflowX !== "visible") {
        box.left = Math.max(box.left, c.left);
        box.right = Math.min(box.right, c.right);
      }
      if (s.overflowY !== "visible") {
        box.top = Math.max(box.top, c.top);
        box.bottom = Math.min(box.bottom, c.bottom);
      }
    }
    return box.right > box.left && box.bottom > box.top ? box : null;
  };
  const focusable = document.querySelectorAll(
    'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
  );
  for (const el of focusable) {
    if (el === button || button.contains(el)) continue;
    if (el.closest("[popover]")) continue;
    // The globe's canvas is the drawing the button is on.
    if (el.localName === "canvas") continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const seen = visible(el, el.getBoundingClientRect());
    if (seen && hit(seen))
      found.push(
        `focusable <${el.localName}> ${el.className || el.textContent?.trim().slice(0, 30)}`,
      );
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    const parent = n.parentElement;
    if (!parent || parent.closest("[popover], script, style, noscript"))
      continue;
    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || style.display === "none") continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      const seen = visible(parent, r);
      if (seen && hit(seen)) {
        found.push(`text "${n.textContent.trim().slice(0, 30)}"`);
        break;
      }
    }
  }
  return { found };
}

/**
 * The button's expanded state from the accessibility tree. Chromium: the AX tree over CDP
 * (`expanded` property). Elsewhere: Playwright's `ariaSnapshot()` (`[expanded]`).
 */
async function accessibleExpanded(page, button, engine, name) {
  if (engine === "chromium") {
    const session = await page.context().newCDPSession(page);
    const { nodes } = await session.send("Accessibility.getFullAXTree");
    await session.detach();
    const node = nodes.find(
      (n) => !n.ignored && n.role?.value === "button" && n.name?.value === name,
    );
    const prop = node?.properties?.find((p) => p.name === "expanded");
    return {
      snapshot: JSON.stringify(node?.properties ?? null),
      expanded: prop?.value?.value === true,
    };
  }
  const snapshot = await button.ariaSnapshot();
  return { snapshot, expanded: /\[expanded\]/.test(snapshot) };
}

/** Runs in the page: the panel's and every control button's rects, and what holds focus. */
function geometry({ id, stack, zoom }) {
  const button = document.querySelector(`[popovertarget="${id}"]`);
  const panel = document.getElementById(id);
  const group = button.closest(zoom);
  const controls =
    stack && group ? [...group.querySelectorAll("button")] : [button];
  return {
    panel: panel.getBoundingClientRect().toJSON(),
    button: button.getBoundingClientRect().toJSON(),
    controls: controls.map((c) => c.getBoundingClientRect().toJSON()),
    w: innerWidth,
    h: innerHeight,
    groupLabel: group?.getAttribute("aria-label") ?? null,
    groupRole: group?.getAttribute("role") ?? null,
    row: group?.getAttribute("aria-orientation") === "horizontal",
    order: group
      ? /* The shut Look at bar's buttons sit in a hidden panel: not the stack's own controls. */
        [...group.querySelectorAll("button")]
          .filter((b) => b.closest("[hidden]") === null)
          .map(
            /* An icon-only kit button names itself with hidden text, not aria-label. */
            (b) => b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "",
          )
      : [],
  };
}

/** Runs in the page: the drawn shapes (paths, circles) whose painted area lies under the button. */
function paintedUnder({ id, drawn }) {
  const b = document
    .querySelector(`[popovertarget="${id}"]`)
    .getBoundingClientRect();
  const hits = new Set();
  for (const el of document.querySelectorAll(drawn)) {
    if (el.closest("[popover]") || !el.ownerSVGElement) continue;
    const ctm = el.getScreenCTM();
    if (!ctm) continue;
    const inv = ctm.inverse();
    for (let i = 0; i <= 8; i += 1) {
      for (let j = 0; j <= 8; j += 1) {
        const pt = new DOMPoint(
          b.left + (b.width * i) / 8,
          b.top + (b.height * j) / 8,
        ).matrixTransform(inv);
        const fill = getComputedStyle(el).fill;
        if (el.isPointInFill?.(pt) && fill !== "none")
          hits.add(el.getAttribute("data-tz-id") ?? el.localName);
      }
    }
  }
  return [...hits];
}

const intersects = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/* `--resolve-only`: load each page once and check that every hook this gate measures by is on it. */
if (args.includes("--resolve-only")) {
  const browser = await chromium.launch();
  let missed = 0;
  for (const target of SELECTED) {
    const context = await browser.newContext({
      viewport: VIEWPORTS[0],
      timezoneId: ZONE,
    });
    await blockOffSite(context, base);
    const page = await context.newPage();
    if (target.stubWorker) {
      await page.route(
        target.apiPath ?? `**/api/${target.api ?? "canada"}-clock-change`,
        (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "cache-control": "no-store" },
            body: JSON.stringify(target.stub ?? STUB),
          }),
      );
    }
    const res = await page.goto(base + target.path, { waitUntil: "load" });
    const miss = [];
    if (!res || res.status() !== 200) {
      miss.push(`the page answered HTTP ${res?.status() ?? "none"}`);
    } else {
      if (target.stubWorker) {
        const section = gate(target.section ?? "map-section");
        await page.locator(section).first().scrollIntoViewIfNeeded();
        // Wait for the drawing's button itself, not a fixed time: a busy machine draws it late.
        await page
          .locator(`[popovertarget="${target.id}"]`)
          .first()
          .waitFor({ state: "attached", timeout: 15_000 })
          .catch(() => {});
      }
      miss.push(
        ...(await resolveMisses(page, [
          { name: "frame", sel: target.frame, min: 1, max: 1 },
          {
            name: "credits button",
            sel: `[popovertarget="${target.id}"]`,
            min: 1,
            max: 1,
          },
          ...(target.drawn
            ? [{ name: "drawn shapes", sel: target.drawn, min: 1 }]
            : []),
          ...(target.stack
            ? [{ name: "zoom group", sel: gate("globe-zoom"), min: 1, max: 1 }]
            : []),
        ])),
      );
    }
    missed += miss.length;
    console.log(`${miss.length ? "FAIL" : "ok  "} resolve ${target.path}`);
    for (const m of miss) console.log(`       ${m}`);
    await context.close();
  }
  await browser.close();
  process.exit(missed ? 1 : 0);
}

for (const name of browsers) {
  const browser = await launchBrowser(name);
  for (const viewport of VIEWPORTS) {
    for (const target of SELECTED) {
      const label = `${name} ${viewport.width}px ${target.path}`;
      const context = await browser.newContext({ viewport, timezoneId: ZONE });
      await blockOffSite(context, base);
      const page = await context.newPage();
      if (target.stubWorker) {
        await page.route(
          target.apiPath ?? `**/api/${target.api ?? "canada"}-clock-change`,
          (route) =>
            route.fulfill({
              status: 200,
              contentType: "application/json",
              headers: { "cache-control": "no-store" },
              body: JSON.stringify(target.stub ?? STUB),
            }),
        );
      }
      const res = await page.goto(base + target.path, { waitUntil: "load" });
      if (!res || res.status() !== 200) {
        fail(`${label}: HTTP ${res?.status()}`);
        await context.close();
        continue;
      }
      const button = page.locator(`[popovertarget="${target.id}"]`);
      if (target.stubWorker) {
        // The map is drawn lazily, when it nears the viewport.
        const section = gate(target.section ?? "map-section");
        await page.locator(section).first().scrollIntoViewIfNeeded();
        // Wait for the drawing's button itself, not a fixed time: a busy machine draws it late.
        await button
          .first()
          .waitFor({ state: "attached", timeout: 15_000 })
          .catch(() => {});
      }
      if ((await button.count()) !== 1) {
        fail(
          `${label}: expected one data-credits button, found ${await button.count()}`,
        );
        await context.close();
        continue;
      }
      await page.waitForTimeout(1500); // let the globe / map mount
      const frame = page.locator(target.frame).first();

      // Collision, at scroll top, middle and bottom.
      const max = await page.evaluate(
        () => document.documentElement.scrollHeight - innerHeight,
      );
      for (const [where, y] of [
        ["top", 0],
        ["middle", max / 2],
        ["bottom", max],
      ]) {
        await page.evaluate((top) => scrollTo(0, top), y);
        await page.waitForTimeout(150);
        const r = await page.evaluate(overlaps, target.id);
        for (const hit of r.found ?? [])
          fail(`${label} @${where}: button overlaps ${hit}`);
      }

      // The drawing's own paint (land, shapes, dots) must not lie under the button.
      if (target.drawn) {
        await button.scrollIntoViewIfNeeded();
        const under = await page.evaluate(paintedUnder, target);
        if (under.length)
          fail(
            `${label}: the button covers the drawing at ${under.join(", ")}`,
          );
      }

      // Keyboard path.
      await button.scrollIntoViewIfNeeded();
      if (target.stack) {
        // The control stack is one toolbar: one Tab from Zoom in leaves it, and ArrowUp from
        // Zoom in wraps round to the button, the stack's last.
        const zoomIn = page.locator('[data-globe-zoom="in"]').first();
        await zoomIn.focus();
        await page.keyboard.press(tabKey(name));
        const left = await page.evaluate(
          (zoom) => !document.activeElement?.closest(zoom),
          gate("globe-zoom"),
        );
        if (!left) fail(`${label}: one Tab from Zoom in stays in the stack`);
        await zoomIn.focus();
        await page.keyboard.press("ArrowUp");
        const reached = await page.evaluate(
          (id) => document.activeElement?.getAttribute("popovertarget") === id,
          target.id,
        );
        if (!reached)
          fail(
            `${label}: ArrowUp from Zoom in does not wrap round to the button`,
          );
      } else {
        // Tab reachability: tab forward until the button is focused (bounded).
        await page.evaluate(() => document.activeElement?.blur());
        let reached = false;
        for (let i = 0; i < 600 && !reached; i += 1) {
          await page.keyboard.press(tabKey(name));
          reached = await page.evaluate(
            (id) =>
              document.activeElement?.getAttribute("popovertarget") === id,
            target.id,
          );
        }
        if (!reached) fail(`${label}: Tab never reaches the button`);
      }
      await page.keyboard.press("Enter");
      // A native `popovertarget` button exposes its expanded state in the accessibility tree
      // (HTML-AAM), not as a DOM attribute, so read it there.
      const { snapshot, expanded } = await accessibleExpanded(
        page,
        button,
        name,
        target.name ?? "Data credits",
      );
      const shown = await page.evaluate(
        (id) => document.getElementById(id)?.matches(":popover-open"),
        target.id,
      );
      if (!shown) fail(`${label}: Enter did not open the panel`);
      if (target.labels) {
        const listed = await page.evaluate(
          (id) =>
            [...document.querySelectorAll(`#${id} dt`)].map(
              (n) => n.textContent,
            ),
          target.id,
        );
        if (listed.join("|") !== target.labels.join("|"))
          fail(
            `${label}: the credits list ${listed.join(", ")}, not ${target.labels.join(", ")}`,
          );
      }
      if (!expanded)
        fail(
          `${label}: the accessibility tree does not show the button as expanded: ${snapshot}`,
        );

      await page.waitForTimeout(500); // the stack's fade-in and the panel's own transition settle
      const g = await page.evaluate(geometry, {
        ...target,
        zoom: gate("globe-zoom"),
      });
      if (target.stack) {
        if (g.groupLabel !== "Globe controls" || g.groupRole !== "toolbar")
          fail(
            `${label}: the control stack is not a toolbar named "Globe controls" (${g.groupRole}, ${g.groupLabel})`,
          );
        if (g.order.join("|") !== target.order.join("|"))
          fail(`${label}: the stack's order is ${g.order.join(", ")}`);
        // Beside a column stack; above a row, which leaves no room beside its last button.
        if (
          g.row
            ? g.panel.bottom > g.button.top + 0.5
            : g.panel.right > g.button.left + 0.5
        )
          fail(
            `${label}: the open panel is not ${g.row ? "above" : "beside"} the stack ${JSON.stringify(g.panel)}`,
          );
      } else if (
        g.panel.bottom > g.button.top + 1 &&
        g.panel.top < g.button.bottom - 1
      ) {
        fail(`${label}: the open panel covers the button`);
      }
      if (
        g.panel.left < 0 ||
        g.panel.right > g.w ||
        g.panel.top < 0 ||
        g.panel.bottom > g.h
      )
        fail(
          `${label}: the open panel leaves the viewport ${JSON.stringify(g.panel)}`,
        );
      for (const c of g.controls)
        if (intersects(g.panel, c))
          fail(
            `${label}: the open panel covers a control button ${JSON.stringify(c)}`,
          );
      const faded = await page.evaluate((id) => {
        for (let e = document.getElementById(id); e; e = e.parentElement)
          if (Number(getComputedStyle(e).opacity) < 0.99) return true;
        return false;
      }, target.id);
      if (faded) fail(`${label}: the open panel is faded by an ancestor`);

      const shoot = async (suffix) => {
        if (!shots) return;
        await frame.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(250);
        const box = await frame.boundingBox();
        if (box) {
          const pad = 8;
          await page
            .screenshot({
              path: `${shots}/${target.slug}-${viewport.width}-${suffix}.png`,
              clip: {
                x: Math.max(0, box.x - pad),
                y: Math.max(0, box.y - pad),
                width: Math.min(viewport.width, box.width + 2 * pad),
                height: box.height + 2 * pad,
              },
            })
            .catch(() => {});
        }
      };
      await shoot("open");

      await page.keyboard.press("Escape");
      const closed = await page.evaluate(
        (id) => ({
          shown: document.getElementById(id)?.matches(":popover-open"),
          back: document.activeElement?.getAttribute("popovertarget"),
        }),
        target.id,
      );
      if (closed.shown) fail(`${label}: Escape did not close the panel`);
      if (closed.back !== target.id)
        fail(`${label}: focus did not return to the button`);
      // Forced: on `/` the globe's hit area lies over the stage and takes the pointer, which is
      // where a reader's pointer is when the drawing is in use.
      await frame.hover({ force: true });
      await page.waitForTimeout(400);
      await shoot("closed");
      measured += 1;
      console.log(`checked ${label}`);
      await context.close();
    }
  }
  await browser.close();
}

/*
 * The landing's "Coming up in the sky" list, at two pinned instants, in the Helsinki zone and the
 * en-GB locale. The expected words are `sky-events.ts`'s for the shipped data
 * (`src/assets/sky-events.json`), golden here because this script cannot import the TypeScript:
 * they change only when the generator's events do, and then this check says so.
 */
const EVENTS_ZONE = "Europe/Helsinki";
const EVENTS_NOTE = `Times in your time zone (${EVENTS_ZONE}).`;
const VESTA_ROW = "Vesta · Asteroid · 5 July – 14 July 2029";
const EVENT_PINS = [
  {
    rule: "events-ahead",
    at: 1_798_761_600_000, // 2027-01-01T00:00Z
    rows: [
      "Apophis · Asteroid · 13 April 2029, 16:03 – 14 April 2029, 01:33 · closest 00:46",
      VESTA_ROW,
    ],
  },
  {
    rule: "events-now",
    at: 1_870_804_800_000, // 2029-04-13T20:00Z, inside the pass
    rows: [
      "Apophis · Asteroid · In view now, until 14 April 2029, 01:33 · closest 00:46",
      VESTA_ROW,
    ],
  },
];

async function checkEvents(browser, name, viewport) {
  for (const pin of EVENT_PINS) {
    const label = `${name} ${viewport.width}px / @${pin.rule}`;
    const context = await browser.newContext({
      viewport,
      timezoneId: EVENTS_ZONE,
      locale: "en-GB",
    });
    await blockOffSite(context, base);
    await context.clock.setFixedTime(pin.at);
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const button = page.getByRole("button", { name: "About this sky" });
    if ((await button.count()) !== 1) {
      fail(`${label}: the button named About this sky is not there`);
      await context.close();
      continue;
    }
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const heading = page.getByRole("heading", { name: "Coming up in the sky" });
    await heading
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    const read = await page.evaluate(() => {
      const list = document.querySelector("[data-sky-events]");
      return {
        rows: [...(list?.querySelectorAll("li") ?? [])].map((li) => ({
          text: li.textContent,
          clips: li.scrollWidth > li.clientWidth + 1,
        })),
        note: list?.querySelector("p")?.textContent ?? null,
        panel: document
          .querySelector("#globe-data-credits")
          ?.getBoundingClientRect(),
        width: innerWidth,
      };
    });
    if (read.rows.map((r) => r.text).join("|") !== pin.rows.join("|"))
      fail(
        `${label}: the rows read ${read.rows.map((r) => `"${r.text}"`).join(", ")}`,
      );
    if (read.note !== EVENTS_NOTE)
      fail(`${label}: the note reads "${read.note}"`);
    if (read.rows.some((r) => r.clips))
      fail(`${label}: a row overflows the popover`);
    if (read.panel && (read.panel.left < 0 || read.panel.right > read.width))
      fail(`${label}: the popover leaves the window`);
    measured += 1;
    console.log(`checked ${label}`);
    await context.close();
  }
}

if (SELECTED.some((target) => target.path === "/"))
  for (const name of browsers) {
    const browser = await launchBrowser(name);
    for (const viewport of VIEWPORTS)
      await checkEvents(browser, name, viewport);
    await browser.close();
  }

recordMeasured(GATE, measured);
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\ndata credits: all checks passed");
