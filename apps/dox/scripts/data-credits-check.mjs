#!/usr/bin/env node
/**
 * Data-credits gate (CORE-88): the info button sits on the drawing it credits, must be reachable,
 * must open and close from the keyboard, must fit a phone, and must never sit over anything a
 * reader can use or read.
 *
 * Placements, per page:
 *   - `/` and `/tools/zoned-earth/`: the fourth button of the globe's control stack;
 *   - `/why-gmt/`: a glass square in the time-zone map's corner;
 *   - `/check/canada-2026-clock-change/`: a glass square in the Canada map's corner, added by the client
 *     when the map is drawn (the Worker is stubbed). Below 520 px of section width the map is not
 *     drawn, so the 375 px run asserts there is no button at all.
 *
 * WebKit presses Option+Tab where Chromium presses Tab: Safari on macOS leaves buttons out of the
 * plain Tab order for every site, so plain Tab there tests a browser setting, not this page.
 *
 * For each, at 1280x800 and 375x812, at scroll top, middle and bottom:
 *   - the button's rect intersects no other focusable element's rect (the globe's canvas, which the
 *     button is drawn on, aside) and no text node's client rect;
 * and per page and width:
 *   - Tab reaches the button (a stack's from its first sibling in three presses, inside the group
 *     named "Globe controls"), Enter opens the popover, the accessibility tree shows it expanded
 *     (read from the AX tree over CDP, or `ariaSnapshot()`; a native popover button has no
 *     `aria-expanded` attribute), Escape closes it and focus is back on the button;
 *   - the open panel sits inside the viewport and covers none of the control buttons.
 *
 * Serve a build statically first (never `astro preview`, never the owner's dev server), for example:
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory /tmp/dist-x
 *
 * Usage: node scripts/data-credits-check.mjs --base http://127.0.0.1:4351/gmt [--browsers chromium,webkit] [--shots DIR]
 * `--shots` saves a screenshot of each drawing with its panel open. Exits non-zero on any failure.
 */
import { mkdirSync } from "node:fs";
import { chromium, webkit } from "@playwright/test";
import { blockOffSite } from "./gate-checks.mjs";

const GLOBE = { stack: true, frame: ".gmt-globe-stage", id: "globe-data-credits" };
const TARGETS = [
  { path: "/", slug: "home-globe", ...GLOBE },
  { path: "/tools/zoned-earth/", slug: "zoned-earth", ...GLOBE },
  {
    path: "/why-gmt/",
    slug: "why-gmt-map",
    frame: ".gmt-credited-frame",
    id: "tz-map-data-credits",
    // What the drawing paints: land, and the zone dots.
    drawn: ".gmt-credited-frame svg path, .gmt-credited-frame svg circle",
  },
  {
    path: "/check/canada-2026-clock-change/",
    slug: "canada-map",
    frame: ".gmt-canada-map",
    id: "canada-data-credits",
    drawn: ".gmt-canada-shape",
    // Drawn by the client from a width of 520 px of section; narrower, there is no map to credit.
    absentBelow: 520,
    stubWorker: true,
  },
];
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = flag("base", "http://127.0.0.1:4351/gmt").replace(/\/$/, "");
const engines = { chromium, webkit };
const browsers = flag("browsers", "chromium").split(",");
const shots = flag("shots", "");
if (shots) mkdirSync(shots, { recursive: true });

// Safari on macOS, and so Playwright's WebKit, leaves buttons out of the Tab order unless the
// reader turns on "Press Tab to highlight each item" (or presses Option+Tab, which walks every
// control). Plain Tab there reaches only links and fields, for every button on every site, so
// WebKit's run presses Option+Tab. Chromium's Tab walks buttons.
const TAB = (name) => (name === "webkit" ? "Alt+Tab" : "Tab");

const failures = [];
const fail = (msg) => failures.push(msg);

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
async function accessibleExpanded(page, button, engine) {
  if (engine === "chromium") {
    const session = await page.context().newCDPSession(page);
    const { nodes } = await session.send("Accessibility.getFullAXTree");
    await session.detach();
    const node = nodes.find(
      (n) => !n.ignored && n.role?.value === "button" && n.name?.value === "Data credits",
    );
    const prop = node?.properties?.find((p) => p.name === "expanded");
    return { snapshot: JSON.stringify(node?.properties ?? null), expanded: prop?.value?.value === true };
  }
  const snapshot = await button.ariaSnapshot();
  return { snapshot, expanded: /\[expanded\]/.test(snapshot) };
}

/** Runs in the page: the panel's and every control button's rects, and what holds focus. */
function geometry({ id, stack }) {
  const button = document.querySelector(`[popovertarget="${id}"]`);
  const panel = document.getElementById(id);
  const group = button.closest(".gmt-globe-zoom");
  const controls = stack && group ? [...group.querySelectorAll("button")] : [button];
  return {
    panel: panel.getBoundingClientRect().toJSON(),
    button: button.getBoundingClientRect().toJSON(),
    controls: controls.map((c) => c.getBoundingClientRect().toJSON()),
    w: innerWidth,
    h: innerHeight,
    groupLabel: group?.getAttribute("aria-label") ?? null,
    groupRole: group?.getAttribute("role") ?? null,
    order: group ? [...group.querySelectorAll("button")].map((b) => b.getAttribute("aria-label")) : [],
  };
}

/** Runs in the page: the drawn shapes (paths, circles) whose painted area lies under the button. */
function paintedUnder({ id, drawn }) {
  const b = document.querySelector(`[popovertarget="${id}"]`).getBoundingClientRect();
  const hits = new Set();
  for (const el of document.querySelectorAll(drawn)) {
    if (el.closest("[popover]") || !el.ownerSVGElement) continue;
    const ctm = el.getScreenCTM();
    if (!ctm) continue;
    const inv = ctm.inverse();
    for (let i = 0; i <= 8; i += 1) {
      for (let j = 0; j <= 8; j += 1) {
        const pt = new DOMPoint(b.left + (b.width * i) / 8, b.top + (b.height * j) / 8).matrixTransform(inv);
        const fill = getComputedStyle(el).fill;
        if (el.isPointInFill?.(pt) && fill !== "none") hits.add(el.getAttribute("data-tz-id") ?? el.localName);
      }
    }
  }
  return [...hits];
}

const intersects = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const name of browsers) {
  const browser = await engines[name].launch();
  for (const viewport of VIEWPORTS) {
    for (const target of TARGETS) {
      const label = `${name} ${viewport.width}px ${target.path}`;
      const context = await browser.newContext({ viewport });
      await blockOffSite(context, base);
      const page = await context.newPage();
      if (target.stubWorker) {
        await page.route("**/api/canada-clock-change", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "cache-control": "no-store" },
            body: JSON.stringify(STUB),
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
        // The map is drawn lazily, when it nears the viewport, and only from 520 px of section.
        await page.locator(".gmt-canada-mapsec").scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000);
        const width = await page.evaluate(
          () => document.querySelector(".gmt-canada-mapsec").getBoundingClientRect().width,
        );
        const found = await button.count();
        if (width < target.absentBelow) {
          if (found !== 0)
            fail(`${label}: the map is not drawn at ${width}px of section, yet a credits button exists`);
          else console.log(`checked ${label}: no map, no button (${Math.round(width)}px)`);
          await context.close();
          continue;
        }
      }
      if ((await button.count()) !== 1) {
        fail(`${label}: expected one data-credits button, found ${await button.count()}`);
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
        if (under.length) fail(`${label}: the button covers the drawing at ${under.join(", ")}`);
      }

      // Keyboard path.
      await button.scrollIntoViewIfNeeded();
      if (target.stack) {
        // Inside the control stack: Tab from the first sibling reaches the button on the third press.
        await page.locator('[data-globe-zoom="in"]').first().focus();
        for (let i = 0; i < 3; i += 1) await page.keyboard.press(TAB(name));
        const reached = await page.evaluate(
          (id) => document.activeElement?.getAttribute("popovertarget") === id,
          target.id,
        );
        if (!reached) fail(`${label}: Tab from Zoom in does not reach the button in three presses`);
      } else {
        // Tab reachability: tab forward until the button is focused (bounded).
        await page.evaluate(() => document.activeElement?.blur());
        let reached = false;
        for (let i = 0; i < 600 && !reached; i += 1) {
          await page.keyboard.press(TAB(name));
          reached = await page.evaluate(
            (id) => document.activeElement?.getAttribute("popovertarget") === id,
            target.id,
          );
        }
        if (!reached) fail(`${label}: Tab never reaches the button`);
      }
      await page.keyboard.press("Enter");
      // A native `popovertarget` button exposes its expanded state in the accessibility tree
      // (HTML-AAM), not as a DOM attribute, so read it there.
      const { snapshot, expanded } = await accessibleExpanded(page, button, name);
      const shown = await page.evaluate(
        (id) => document.getElementById(id)?.matches(":popover-open"),
        target.id,
      );
      if (!shown) fail(`${label}: Enter did not open the panel`);
      if (!expanded)
        fail(`${label}: the accessibility tree does not show the button as expanded: ${snapshot}`);

      await page.waitForTimeout(500); // the stack's fade-in and the panel's own transition settle
      const g = await page.evaluate(geometry, target);
      if (target.stack) {
        if (g.groupLabel !== "Globe controls" || g.groupRole !== "group")
          fail(`${label}: the control stack is not a group named "Globe controls" (${g.groupRole}, ${g.groupLabel})`);
        if (g.order.join("|") !== "Zoom in|Zoom out|Reset zoom|Data credits")
          fail(`${label}: the stack's order is ${g.order.join(", ")}`);
        if (g.panel.right > g.button.left + 0.5)
          fail(`${label}: the open panel is not beside the stack ${JSON.stringify(g.panel)}`);
      } else if (g.panel.bottom > g.button.top + 1 && g.panel.top < g.button.bottom - 1) {
        fail(`${label}: the open panel covers the button`);
      }
      if (g.panel.left < 0 || g.panel.right > g.w || g.panel.top < 0 || g.panel.bottom > g.h)
        fail(`${label}: the open panel leaves the viewport ${JSON.stringify(g.panel)}`);
      for (const c of g.controls)
        if (intersects(g.panel, c))
          fail(`${label}: the open panel covers a control button ${JSON.stringify(c)}`);
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
          await page.screenshot({
            path: `${shots}/${target.slug}-${viewport.width}-${suffix}.png`,
            clip: {
              x: Math.max(0, box.x - pad),
              y: Math.max(0, box.y - pad),
              width: Math.min(viewport.width, box.width + 2 * pad),
              height: box.height + 2 * pad,
            },
          }).catch(() => {});
        }
      };
      await shoot("open");

      await page.keyboard.press("Escape");
      const closed = await page.evaluate((id) => ({
        shown: document.getElementById(id)?.matches(":popover-open"),
        back: document.activeElement?.getAttribute("popovertarget"),
      }), target.id);
      if (closed.shown) fail(`${label}: Escape did not close the panel`);
      if (closed.back !== target.id) fail(`${label}: focus did not return to the button`);
      await frame.hover();
      await page.waitForTimeout(400);
      await shoot("closed");
      console.log(`checked ${label}`);
      await context.close();
    }
  }
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\ndata credits: all checks passed");
