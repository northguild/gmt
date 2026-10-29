#!/usr/bin/env node
/**
 * Muted-text contrast gate (context/dox/reference/design-system.md § Verifying,
 * "Measure text contrast against the worst pixel behind the glyph box").
 *
 * The site's text floor is 7:1. `--gmt-ice-dim` is the muted tier, and it is
 * the one text token that is easy to leave short, because a caption sits on
 * whatever surface its widget paints under it (a tinted chip, a glass panel, a
 * gradient), not on a flat page. This script measures it where it is used.
 *
 * For each page and theme it:
 *
 *   1. finds every text node (HTML or SVG) and every input, select and
 *      textarea whose computed colour is `--gmt-ice-dim` in that theme,
 *      with its glyph rects, clipped to every scroll container around it;
 *   2. screenshots the page twice, as it is and with every glyph transparent
 *      (`-webkit-text-fill-color`, which leaves borders, icons and every
 *      `currentColor` surface alone). The pixels that differ are the glyphs.
 *      For each rect it composes the text colour (alpha and ancestors' opacity
 *      included) over the hidden-glyph pixel at every glyph pixel and the two
 *      pixels around it, and reports the lowest ratio. That is the worst pixel
 *      the text is really drawn on, gradients, hatches and glows included;
 *      the same figure over the whole glyph box is printed beside it as `box`,
 *      and reaches a neighbouring 1px border or chip edge the glyphs never touch;
 *   3. keeps the lowest ratio per element kind and surface.
 *
 * Fixed and sticky chrome (the header, the sidebar) is measured in a first
 * pass at scroll 0 with everything visible. Everything else is measured with
 * the chrome hidden, because a fixed element lands in every clip screenshot.
 * Text in a visually hidden box (1px or smaller) is skipped: a text range
 * reports its full glyph rect even when an ancestor clips it.
 *
 * It also measures the dashed border of every disabled field against its
 * surface (3:1, the non-text bar).
 *
 * The place labels of the zone maps (the `map-label` part) are measured on the
 * same footing, against their own bar of 4.5:1: the text colour over the pixels
 * the halo leaves behind the glyphs. The halo is a text-shadow, so the
 * hidden-glyph pass keeps it for labels and drops it everywhere else.
 * `--canada-fixture` and `--morocco-fixture` serve a Worker answer (a .json
 * file) to a check page, so its labels show an offset; without one the labels
 * carry the NO SIGNAL mark. Both states belong in a run.
 *
 * Usage (serve a built `dist` first; `astro preview` or any static server):
 *
 *   pnpm run contrast:measure -- --base http://127.0.0.1:4381/gmt
 *   pnpm run contrast:measure -- --base http://127.0.0.1:4381/gmt --only tools/timetable --theme dark
 *   pnpm run contrast:measure -- --base http://127.0.0.1:4381/gmt --json out.json --verbose
 *
 * `--only` takes one substring or a comma list of them (a page id or path matches any).
 *
 * The runner's contract (`pnpm --filter dox gates`, `scripts/gates/`): `--list-pages` prints the
 * pages and exits; `--pages /path/,...` runs only those (an unknown path exits 2); with
 * `GATE_REPORT` set, every failure is also a finding and the run ends with its measured count.
 *
 * Exit 1 if any `--gmt-ice-dim` text is under 7:1, any disabled border is under
 * 3:1, or the run measured nothing.
 */
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  blockOffSite,
  staleRectMessage,
  staleRectProblem,
} from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { identityScript } from "./lib/element-identity.mjs";
import { gate, presetSelect } from "./lib/locate.mjs";

const GATE = "contrast-measure";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const BASE = opt("base", "http://127.0.0.1:4381/gmt").replace(/\/$/, "");
const ONLY = opt("only", "").split(",").filter(Boolean);
const THEME = opt("theme", "");
const JSON_OUT = opt("json", "");
const WIDTH = Number(opt("width", "1440"));
const FLOOR = 7;
const FIXTURES = {
  canada: opt("canada-fixture", ""),
  morocco: opt("morocco-fixture", ""),
};
const BORDER_FLOOR = 3;
const VERBOSE = flag("verbose");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const toolSlugs = readdirSync(path.join(HERE, "../src/content/docs/tools"))
  .filter((f) => f.endsWith(".mdx") && f !== "index.mdx")
  .map((f) => f.replace(/\.mdx$/, ""))
  .sort();

/** Pages that are not tool pages. The tool pages are added below, one per slug. */
const ALL_PAGES = [
  { id: "home", path: "/" },
  { id: "why-gmt", path: "/why-gmt/" },
  { id: "guide-standards", path: "/guides/concepts/standards/" },
  {
    id: "guide-industry",
    path: "/guides/industries/intermodal-edi-timestamps/",
  },
  { id: "scenario", path: "/scenarios/a-203-read-as-utc/" },
  { id: "mistake", path: "/mistakes/intermodal/" },
  {
    id: "reference-playground",
    path: "/reference/zoned/convert/convertZonedToZoned/",
  },
  { id: "reference-dst", path: "/reference/zoned/get/getDstTransitions/" },
  {
    id: "guide-business-calendars",
    path: "/guides/core-date-operations/business-calendars/",
  },
  { id: "tools-index", path: "/tools/" },
  { id: "industries-maritime", path: "/industries/maritime/" },
  { id: "dox-chat", path: "/dox/" },
  { id: "dox-chat+timetable", path: "/dox/", open: "showTimetableReader" },
  { id: "dox-chat+x12", path: "/dox/", open: "showX12TimeReader" },
  {
    id: "check:canada-2026-clock-change",
    path: "/check/canada-2026-clock-change/",
  },
  {
    id: "check:morocco-2026-clock-change",
    path: "/check/morocco-2026-clock-change/",
  },
  ...toolSlugs.map((slug) => ({
    id: `tool:${slug}`,
    path: `/tools/${slug}/`,
    tool: true,
  })),
];

const PAGES_ARG = applyPageContract({
  gate: GATE,
  pages: [...new Set(ALL_PAGES.map((p) => p.path))],
});
const PAGES = ALL_PAGES.filter(
  (p) =>
    (!ONLY.length ||
      ONLY.some((word) => p.id.includes(word) || p.path.includes(word))) &&
    (!PAGES_ARG || PAGES_ARG.includes(p.path)),
);
/** A page id's site path, for findings. */
const PATH_OF = new Map(ALL_PAGES.map((p) => [p.id, p.path]));

const lin = (v) => {
  v /= 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const l1 = lum(...a);
  const l2 = lum(...b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const hex = (c) =>
  "#" +
  c
    .slice(0, 3)
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("");

/** Runs in the page. Returns what to measure; touches nothing. */
function collect() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const g = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#000";
    g.fillStyle = c;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const probe = document.createElement("span");
  probe.style.color = "var(--gmt-ice-dim)";
  document.body.append(probe);
  const token = rgba(getComputedStyle(probe).color);
  const iceProbe = document.createElement("span");
  iceProbe.style.color = "var(--gmt-ice)";
  document.body.append(iceProbe);
  const ice = rgba(getComputedStyle(iceProbe).color);
  probe.remove();
  iceProbe.remove();
  const same = (c) => {
    const x = rgba(c);
    return x[0] === token[0] && x[1] === token[1] && x[2] === token[2];
  };

  const hiddenChain = (e) => {
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (
        cs.visibility === "hidden" ||
        cs.display === "none" ||
        cs.contentVisibility === "hidden"
      )
        return true;
      // A closed <details> keeps its geometry but paints only its <summary>.
      if (p.tagName === "DETAILS" && !p.open && !e.closest("summary"))
        return true;
    }
    return false;
  };
  const tiny = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).display === "contents") continue; // an island wrapper has no box
      const b = p.getBoundingClientRect();
      if (b.width <= 2 && b.height <= 2) return true;
    }
    return false;
  };
  const opacityOf = (e) => {
    let o = 1;
    for (let p = e; p; p = p.parentElement)
      o *= parseFloat(getComputedStyle(p).opacity);
    return o;
  };
  const isChrome = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === "fixed" || pos === "sticky") return true;
    }
    return false;
  };
  /** Rect clipped to every scrolling or clipping ancestor. */
  const clip = (e, r) => {
    let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom];
    for (
      let p = e.parentElement;
      p && p !== document.documentElement;
      p = p.parentElement
    ) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      if (p === document.body) continue;
      const pb = p.getBoundingClientRect();
      if (cs.overflowX !== "visible") {
        l = Math.max(l, pb.left);
        rr = Math.min(rr, pb.right);
      }
      if (cs.overflowY !== "visible") {
        t = Math.max(t, pb.top);
        b = Math.min(b, pb.bottom);
      }
    }
    return rr - l > 1 && b - t > 1 ? [l, t, rr - l, b - t] : null;
  };
  /** The identity key of an element (`lib/element-identity.mjs`), the name a finding carries. */
  const label = (e) => window.__gmtIdentity(e);
  /** Nearest ancestor that paints a background or blurs what is behind it. */
  const surface = (e) => {
    for (let p = e; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const bg = rgba(cs.backgroundColor);
      if (
        bg[3] > 0.02 ||
        cs.backgroundImage !== "none" ||
        (cs.backdropFilter && cs.backdropFilter !== "none")
      ) {
        return label(p);
      }
    }
    return "page";
  };
  const items = [];
  const base = { x: scrollX, y: scrollY };
  const add = (e, kind, color, rects, extra = {}) => {
    const clipped = rects.map((r) => clip(e, r)).filter(Boolean);
    if (!clipped.length) return;
    items.push({
      kind: `${kind} ${label(e)}`,
      target: label(e),
      selector: window.__gmtCssPath(e),
      surface: surface(e),
      text: (extra.text ?? "").trim().slice(0, 30),
      color,
      op: opacityOf(e),
      size: parseFloat(getComputedStyle(e).fontSize),
      chrome: isChrome(e),
      disabled: !!extra.disabled,
      floor: extra.floor,
      rects: clipped,
    });
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    if (!n.textContent.trim()) continue;
    const e = n.parentElement;
    if (!e || e.closest("script, style, noscript, option, [hidden], template"))
      continue;
    if (hiddenChain(e) || tiny(e)) continue;
    const cs = getComputedStyle(e);
    const svg = e instanceof SVGElement;
    const fill = svg
      ? cs.fill
      : cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color
        ? cs.webkitTextFillColor
        : cs.color;
    if (!fill || fill === "none" || !same(fill)) continue;
    // The glyph box runs from the first to the last visible character: a
    // leading or trailing space is not ink, and in a line with an inline chip
    // it can reach into the chip's border.
    const raw = n.textContent;
    const from = raw.length - raw.trimStart().length;
    const to = raw.trimEnd().length;
    const r = document.createRange();
    r.setStart(n, from);
    r.setEnd(n, to);
    const rects = [...r.getClientRects()].filter(
      (x) => x.width > 1 && x.height > 1,
    );
    add(e, svg ? "svg" : "text", rgba(fill), rects, { text: n.textContent });
  }
  // The place labels: ice, cyan or the amber mark, on the sea halo. Their bar is 4.5:1.
  const labelWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
  );
  for (let n; (n = labelWalker.nextNode());) {
    if (!n.textContent.trim()) continue;
    const e = n.parentElement;
    if (
      !e ||
      !e.closest('[data-gate~="map-label"]') ||
      hiddenChain(e) ||
      tiny(e)
    )
      continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(
      (x) => x.width > 1 && x.height > 1,
    );
    add(e, "label", rgba(getComputedStyle(e).color), rects, {
      text: n.textContent,
      floor: 4.5,
    });
  }
  for (const e of document.querySelectorAll("input, select, textarea")) {
    if (
      e.type === "hidden" ||
      e.type === "range" ||
      e.type === "checkbox" ||
      e.type === "radio"
    )
      continue;
    if (hiddenChain(e) || tiny(e)) continue;
    const cs = getComputedStyle(e);
    if (!same(cs.color)) continue;
    const b = e.getBoundingClientRect();
    if (b.width < 2) continue;
    const text = e.value || e.options?.[e.selectedIndex]?.text || "";
    if (!text) continue;
    const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
    const lh = Math.min(b.height - 6, parseFloat(cs.fontSize) * 1.4);
    add(
      e,
      e.disabled ? "control:disabled" : "control",
      rgba(cs.color),
      [
        {
          left: b.left + pl,
          top: b.top + (b.height - lh) / 2,
          right: b.right - pr - (e.tagName === "SELECT" ? 24 : 0),
          bottom: b.top + (b.height + lh) / 2,
        },
      ],
      { text, disabled: e.disabled },
    );
  }
  // Disabled fields: the dashed border, measured on its own box edges.
  const borders = [];
  for (const e of document.querySelectorAll(
    "input:disabled:not([type=range]), select:disabled, textarea:disabled",
  )) {
    if (hiddenChain(e) || tiny(e)) continue;
    const b = e.getBoundingClientRect();
    if (b.width < 2) continue;
    const cs = getComputedStyle(e);
    const w = parseFloat(cs.borderTopWidth) || 1;
    borders.push({
      kind: `border ${label(e)}`,
      target: label(e),
      selector: window.__gmtCssPath(e),
      color: rgba(cs.borderTopColor),
      style: cs.borderTopStyle,
      chrome: isChrome(e),
      rects: [
        [b.left, b.top, b.width, w],
        [b.left, b.bottom - w, b.width, w],
      ],
      box: [b.left, b.top, b.width, b.height],
      op: opacityOf(e),
    });
  }
  return {
    token,
    ice,
    items,
    borders,
    scroll: base,
    height: document.documentElement.scrollHeight,
  };
}

const HIDE_TEXT = `*, *::before, *::after { -webkit-text-fill-color: transparent !important; text-decoration: none !important; caret-color: transparent !important; -webkit-text-stroke: 0 !important; }
*:not(${gate("map-label")}, ${gate("map-label")} *), *::before, *::after { text-shadow: none !important; }
svg text, svg tspan { fill: transparent !important; stroke: none !important; }
::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }`;

async function setup(page, theme, p) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("starlight-theme", t);
    } catch {}
  }, theme);
  await page.addInitScript({ content: identityScript() });
  await serveFixture(page, p);
  const res = await page.goto(BASE + p.path, { waitUntil: "networkidle" });
  if (!res || res.status() !== 200)
    throw new Error(`${p.path} answered ${res?.status()}`);
  await page.evaluate(
    (t) => document.documentElement.setAttribute("data-theme", t),
    theme,
  );
  await drawMap(page);
  await page.waitForTimeout(500);
}

/** A check page may be given a Worker answer, so its labels show an offset. */
async function serveFixture(page, p) {
  const word = p.id.includes("morocco") ? "morocco" : "canada";
  const file = p.id.startsWith("check:") ? FIXTURES[word] : "";
  if (!file) return;
  const body = readFileSync(file, "utf8");
  await page.route(`**/api/${word}-clock-change`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body,
    }),
  );
}

/** The zone map draws when it scrolls into view: bring it there, wait for it, and go back to the top. */
async function drawMap(page) {
  const section = page.locator(gate("map-section"));
  if ((await section.count()) === 0) return;
  await section.scrollIntoViewIfNeeded();
  await page
    .waitForSelector(gate("map-svg"), { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** States to measure for a page: the default, plus every preset and a sentinel pass for tools. */
async function statesFor(page, p) {
  if (!p.tool) return [{ name: "default" }];
  const select = presetSelect(page);
  const presets = (await select.count())
    ? await select.evaluate((s) => [...s.options].map((o) => o.value))
    : [];
  const states = [{ name: "default" }];
  for (const v of presets.slice(1))
    states.push({ name: `preset:${v}`, preset: v });
  states.push({ name: "sentinel", garbage: true });
  return states;
}

async function applyState(page, st) {
  if (st.preset)
    await presetSelect(page)
      .selectOption(st.preset)
      .catch(() => {});
  if (st.garbage) {
    await page.evaluate(() => {
      for (const e of document.querySelectorAll(
        "main textarea, main input[type=text], main input:not([type])",
      )) {
        if (e.disabled || e.readOnly) continue;
        e.value = "%%% not a value";
        e.dispatchEvent(new Event("input", { bubbles: true }));
        e.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }
  await page.waitForTimeout(400);
}

/**
 * Two screenshots of each region: the page as it is, and the page with every
 * glyph transparent. The glyphs' own pixels are the ones that differ.
 */
async function shoot(page, data, withChrome) {
  const vp = page.viewportSize();
  const out = { chrome: null, slices: [] };
  if (withChrome) {
    await page.evaluate(() => window.scrollTo(0, 0));
    out.chrome = PNG.sync.read(await page.screenshot());
  }
  await page
    .addStyleTag({ content: "[data-cm]{visibility:hidden !important}" })
    .then(async (h) => {
      const H = data.height;
      const SLICE = 4000;
      for (let y0 = 0; y0 < H; y0 += SLICE) {
        const h2 = Math.min(SLICE, H - y0);
        out.slices.push({
          y0,
          h: h2,
          png: PNG.sync.read(
            await page.screenshot({
              fullPage: true,
              clip: { x: 0, y: y0, width: vp.width, height: h2 },
            }),
          ),
        });
      }
      await h.evaluate((el) => el.remove());
    });
  return out;
}

async function measureState(page, rows, ctx) {
  const data = await page.evaluate(collect);
  const vp = page.viewportSize();
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("body *")) {
      const pos = getComputedStyle(e).position;
      if (pos === "fixed" || pos === "sticky") e.dataset.cm = "1";
    }
    window.scrollTo(0, 0);
  });
  const chrome = {
    items: data.items.filter((i) => i.chrome),
    borders: data.borders.filter((i) => i.chrome),
  };
  const body = {
    items: data.items.filter((i) => !i.chrome),
    borders: data.borders.filter((i) => !i.chrome),
  };
  const wantChrome = chrome.items.length > 0 || chrome.borders.length > 0;
  const vis = await shoot(page, data, wantChrome);
  const hideStyle = await page.addStyleTag({ content: HIDE_TEXT });
  await page.waitForTimeout(150);
  const hid = await shoot(page, data, wantChrome);

  // The rects were read before the first screenshot. If the layout moved while the two
  // screenshots were taken, they no longer describe the page: fail the cell, never score it.
  // The glyphs come back first: `collect` skips text whose fill is transparent, so a read taken
  // under the hiding style would count fewer elements than the first read for that reason alone.
  await hideStyle.evaluate((el) => el.remove());
  const moved = await page.evaluate(collect);
  const spots = (d) =>
    d.items.map((i, n) => ({
      key: `${i.kind}#${n}`,
      target: i.target,
      top: i.rects[0][1] + d.scroll.y,
      height: i.rects[0][3],
    }));
  const stale = staleRectProblem(spots(data), spots(moved));
  if (stale) {
    const named = spots(data).find((s) => s.key === stale.moved);
    const err = new Error(
      staleRectMessage({
        ...stale,
        moved: named?.target ?? stale.moved,
        cause:
          spots(data).find((s) => s.key === stale.cause)?.target ?? stale.cause,
      }),
    );
    err.rule = "layout-moved-during-measure";
    err.target = named?.target ?? "page";
    throw err;
  }

  const INK = 40; // summed channel difference that counts as a glyph pixel
  const HALO = Number(opt("halo", "1")); // pixels around a glyph pixel that still count as behind it

  /** Lowest contrast over the whole box, and over the glyphs' pixels and their halo. */
  const score = (visPng, hidPng, it, offY) => {
    const a = it.color[3] * it.op;
    const w = hidPng.width;
    const hgt = hidPng.height;
    let box = 99;
    let boxBg = null;
    let ink = 99;
    let inkBg = null;
    const isInk = (px, py) => {
      if (px < 0 || py < 0 || px >= w || py >= hgt) return false;
      const o = (py * w + px) * 4;
      return (
        Math.abs(visPng.data[o] - hidPng.data[o]) +
          Math.abs(visPng.data[o + 1] - hidPng.data[o + 1]) +
          Math.abs(visPng.data[o + 2] - hidPng.data[o + 2]) >
        INK
      );
    };
    for (const [x, y, rw, rh] of it.rects) {
      // Whole pixels inside the rect only: a half-covered edge pixel is the neighbour's.
      for (
        let py = Math.max(0, Math.ceil(y + offY));
        py < Math.min(hgt, Math.floor(y + rh + offY));
        py++
      ) {
        for (
          let px = Math.max(0, Math.ceil(x));
          px < Math.min(w, Math.floor(x + rw));
          px++
        ) {
          const o = (py * w + px) * 4;
          const bg = [hidPng.data[o], hidPng.data[o + 1], hidPng.data[o + 2]];
          const fg = [0, 1, 2].map((k) => it.color[k] * a + bg[k] * (1 - a));
          const c = ratio(fg, bg);
          if (c < box) {
            box = c;
            boxBg = bg;
          }
          if (c < ink) {
            let near = false;
            for (let dy = -HALO; dy <= HALO && !near; dy++)
              for (let dx = -HALO; dx <= HALO && !near; dx++)
                near = isInk(px + dx, py + dy);
            if (near) {
              ink = c;
              inkBg = bg;
            }
          }
        }
      }
    }
    return { box, boxBg, ink, inkBg };
  };
  const record = (it, r) => {
    if (r.box === 99) return;
    rows.push({
      page: ctx.page,
      theme: ctx.theme,
      state: ctx.state,
      kind: it.kind,
      target: it.target,
      selector: it.selector,
      surface: it.surface ?? "",
      text: it.text ?? "",
      size: it.size,
      disabled: it.disabled,
      floor: it.floor ?? FLOOR,
      ratio: r.ink === 99 ? r.box : r.ink,
      box: r.box,
      bg: r.inkBg ? hex(r.inkBg) : r.boxBg ? hex(r.boxBg) : "",
      boxBg: r.boxBg ? hex(r.boxBg) : "",
    });
  };
  const recordBorder = (b, png, offY) => {
    // The border colour against every pixel in a 3px ring just outside the
    // straight edges of the box (the corners are bevelled, so skip them).
    let worst = 99;
    const a = b.color[3] * b.op;
    const [bx, by, bw, bh] = b.box;
    for (
      let py = Math.max(0, Math.floor(by - 4 + offY));
      py < Math.min(png.height, Math.ceil(by + bh + 4 + offY));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(bx - 4));
        px < Math.min(png.width, Math.ceil(bx + bw + 4));
        px++
      ) {
        // Skip the box and the 1.5px around it: a fractional edge puts the border itself in the pixel.
        if (
          px + 1 > bx - 1.5 &&
          px < bx + bw + 1.5 &&
          py + 1 > by + offY - 1.5 &&
          py < by + bh + offY + 1.5
        )
          continue;
        const dx = Math.min(Math.abs(px - bx), Math.abs(px - (bx + bw)));
        const dy = Math.min(
          Math.abs(py - (by + offY)),
          Math.abs(py - (by + bh + offY)),
        );
        if (dx > 4 && dy > 4) continue;
        if (px < bx + 6 || px > bx + bw - 6) {
          if (py < by + offY + 6 || py > by + bh + offY - 6) continue;
        }
        const o = (py * png.width + px) * 4;
        const bg = [png.data[o], png.data[o + 1], png.data[o + 2]];
        const fg = [0, 1, 2].map((k) => b.color[k] * a + bg[k] * (1 - a));
        const rr = ratio(fg, bg);
        worst = Math.min(worst, rr);
      }
    }
    if (worst === 99) return;
    rows.push({
      page: ctx.page,
      theme: ctx.theme,
      state: ctx.state,
      kind: b.kind,
      target: b.target,
      selector: b.selector,
      surface: "outside the box",
      text: b.style,
      size: 0,
      disabled: true,
      ratio: worst,
      border: true,
    });
  };

  if (wantChrome) {
    for (const it of chrome.items) {
      // Only what is in the first viewport can be measured at scroll 0.
      if (it.rects.every(([, y, , h]) => y + h > 0 && y < vp.height))
        record(it, score(vis.chrome, hid.chrome, it, 0));
    }
    for (const b of chrome.borders) recordBorder(b, hid.chrome, 0);
  }
  for (let i = 0; i < hid.slices.length; i++) {
    const { y0, h, png } = hid.slices[i];
    const vpng = vis.slices[i].png;
    const inSlice = (y) =>
      y + data.scroll.y >= y0 && y + data.scroll.y < y0 + h;
    for (const it of body.items) {
      const rects = it.rects.filter(([, y]) => inSlice(y));
      if (rects.length)
        record(it, score(vpng, png, { ...it, rects }, data.scroll.y - y0));
    }
    for (const b of body.borders)
      if (inSlice(b.rects[0][1])) recordBorder(b, png, data.scroll.y - y0);
  }
  return { token: data.token, ice: data.ice };
}

const browser = await chromium.launch();
const rows = [];
const tokens = {};
const themes = THEME ? [THEME] : ["dark", "light"];
for (const p of PAGES) {
  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: 900 },
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    await blockOffSite(context, BASE);
    const page = await context.newPage();
    try {
      await setup(page, theme, p);
      if (p.open) {
        await page.click(`[data-starter="${p.open}"]`);
        await page.waitForTimeout(1500);
      }
      const states = await statesFor(page, p);
      for (const st of states) {
        // Fresh load per state: the transparent-text style and hidden chrome are one-way.
        if (st.name !== "default" || states.indexOf(st) !== 0) {
          await page.goto(BASE + p.path, { waitUntil: "networkidle" });
          await page.evaluate(
            (t) => document.documentElement.setAttribute("data-theme", t),
            theme,
          );
          await drawMap(page);
          await page.waitForTimeout(400);
        }
        await applyState(page, st);
        const t = await measureState(page, rows, {
          page: p.id,
          theme,
          state: st.name,
        });
        tokens[theme] = t;
      }
    } catch (err) {
      console.error(`FAIL ${p.id} ${theme}: ${err.message}`);
      rows.push({
        page: p.id,
        theme,
        state: "error",
        kind: "error",
        surface: err.message,
        rule: err.rule,
        target: err.target,
        ratio: 0,
      });
    }
    await context.close();
  }
}
await browser.close();

if (JSON_OUT)
  writeFileSync(JSON_OUT, JSON.stringify({ tokens, rows }, null, 1));

const text = rows.filter((r) => !r.border && r.kind !== "error");
const borders = rows.filter((r) => r.border);
const errors = rows.filter((r) => r.kind === "error");
const group = (list, perPage = false) => {
  const m = new Map();
  for (const r of list) {
    const k = `${perPage ? `${r.page} | ` : ""}${r.theme} | ${r.kind} | ${r.surface}`;
    const prev = m.get(k);
    if (!prev) m.set(k, { ...r, pages: new Set([r.page]), n: 1 });
    else {
      prev.pages.add(r.page);
      prev.n++;
      if (r.ratio < prev.ratio)
        Object.assign(prev, {
          ratio: r.ratio,
          box: r.box,
          text: r.text,
          size: r.size,
          bg: r.bg,
          state: r.state,
          page: r.page,
          target: r.target,
          selector: r.selector,
        });
    }
  }
  return [...m.values()].sort((a, b) => a.ratio - b.ratio);
};
for (const theme of themes) {
  const t = tokens[theme];
  if (t)
    console.log(
      `# ${theme}: --gmt-ice-dim rgb(${t.token.slice(0, 3).join(",")}) ${hex(t.token)}, --gmt-ice ${hex(t.ice)}`,
    );
}
const tg = group(text);
const boxFails = new Set(
  text
    .filter((r) => r.box !== undefined && r.box < r.floor - 0.005)
    .map((r) => `${r.theme} | ${r.kind} | ${r.surface}`),
);
const fails = tg.filter((g) => g.ratio < g.floor - 0.005);
console.log(
  `\n${boxFails.size} kind/surface groups are also under ${FLOOR}:1 over the whole glyph box (listed with --verbose).`,
);
console.log(
  `${text.length} measurements, ${tg.length} kind/surface groups, ${fails.length} under ${FLOOR}:1`,
);
const show = VERBOSE ? tg : fails;
for (const g of show) {
  console.log(
    `${g.ratio.toFixed(2)} (box ${g.box?.toFixed(2)}) ${g.theme.padEnd(5)} ${g.kind} | ${g.surface} | "${g.text}" ${g.size}px bg ${g.bg} | worst on ${g.page} [${g.state}] (${g.n} hits, ${g.pages.size} pages)`,
  );
}
const bg = group(borders);
const bfails = bg.filter((g) => g.ratio < BORDER_FLOOR - 0.005);
console.log(
  `\n${borders.length} disabled-field borders, ${bfails.length} under ${BORDER_FLOOR}:1`,
);
for (const g of VERBOSE ? bg : bfails)
  console.log(
    `${g.ratio.toFixed(2)}  ${g.theme.padEnd(5)} ${g.kind} ${g.text} | worst on ${g.page} [${g.state}]`,
  );
for (const e of errors) console.log(`ERROR ${e.page} ${e.theme}: ${e.surface}`);
// A finding is one element on one page, so its key does not depend on which page was worst.
const perPage = (list, floor) =>
  group(list, true).filter((g) => g.ratio < floor(g) - 0.005);
for (const g of perPage(text, (r) => r.floor)) {
  recordFinding({
    gate: GATE,
    rule: "contrast-below-7",
    page: PATH_OF.get(g.page) ?? null,
    target: g.target,
    selector: g.selector,
    browser: "chromium",
    width: WIDTH,
    theme: g.theme,
    message: `${g.ratio.toFixed(2)}:1 under ${FLOOR}:1 for "${g.text}" (${g.size}px, bg ${g.bg}) [${g.state}]`,
  });
}
for (const g of perPage(borders, () => BORDER_FLOOR)) {
  recordFinding({
    gate: GATE,
    rule: "border-below-3",
    page: PATH_OF.get(g.page) ?? null,
    target: g.target,
    selector: g.selector,
    browser: "chromium",
    width: WIDTH,
    theme: g.theme,
    message: `disabled border ${g.ratio.toFixed(2)}:1 under ${BORDER_FLOOR}:1 [${g.state}]`,
  });
}
for (const e of errors) {
  recordFinding({
    gate: GATE,
    rule: e.rule ?? "page-error",
    page: PATH_OF.get(e.page) ?? null,
    target: e.target ?? "page",
    browser: "chromium",
    width: WIDTH,
    theme: e.theme,
    message: e.surface,
  });
}
recordMeasured(GATE, PAGES.length * themes.length - errors.length);
const failed = fails.length || bfails.length || errors.length || !text.length;
console.log(failed ? "\nFAIL" : "\nPASS");
process.exit(failed ? 1 : 0);
