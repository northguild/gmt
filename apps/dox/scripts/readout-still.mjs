#!/usr/bin/env node
/**
 * Readouts-hold-still gate (context/dox/specs/tran-57-charts-restyle.md § 9.1).
 *
 * Dragging a handle must move nothing except the values themselves. For each of
 * the three TRAN-57 tool pages (Departure Board, Punctuality Board, ETA Drift
 * Chart), every preset, and each of these widths, the script takes every
 * control the reader drags:
 *
 *   Departure Board     handle-after
 *   Punctuality Board   handle-late, handle-early, handle-compare (the ones the
 *                       preset shows)
 *   ETA Drift Chart     tolerance-slider
 *
 * and does two things with it:
 *
 *   keyboard   Home, then PageUp until the value stops changing, then PageDown
 *              back to the start: the whole range, there and back;
 *   pointer    press the control at its minimum, drag it to the far end of its
 *              track in 20 steps, and back, then release.
 *
 * After the reset and after every step it records `getBoundingClientRect()` of:
 *
 *   - every `.gmt-punct-hero`;
 *   - the `.gmt-punct-frame`;
 *   - the dragged control;
 *   - every element in the control's section that comes before the control in
 *     the document, except the insides of the drawn charts (`.gmt-dep-stage`,
 *     `.gmt-eta-plot`, `.gmt-punct-rows`, `.gmt-punct-lane`), whose marks move
 *     with the value by design (their containers are still measured).
 *
 * Rects are measured from the widget root's corner, so the page scrolling to
 * keep a focused handle in view is not a move. Every rect is rounded to the
 * whole pixel and compared with the first recording (the control at its minimum). The script exits non-zero if any
 * differs, and prints the element, the step and the two rects. A custom
 * `role="slider"` handle slides along its track by design, so for a handle only
 * the top, width and height are compared, and not at all while the pointer
 * holds it (it grows 8% when pressed); a native range is compared whole.
 *
 * Widths: each `--widths` entry is a viewport width (default 1440,390). Each
 * widget root is also forced to 360 and 300 px wide at a 1440 viewport, the
 * widths of the /dox rail.
 *
 * Serve a build statically first (never `astro dev` on 4321, never the owner's
 * dev server), for example:
 *   pnpm exec astro build --outDir /tmp/dist-x
 *   python3 -m http.server 4351 --bind 127.0.0.1 --directory /tmp/dist-x
 *
 * Usage:
 *   node scripts/readout-still.mjs --base http://127.0.0.1:4351
 *     [--browsers chromium,webkit] [--widths 1440,390] [--only <slug,...>]
 *     [--keyboard-only]
 *
 * `--keyboard-only` skips the pointer drags (WebKit's synthetic pointer events
 * are flaky). Chromium and WebKit only: Firefox is blocked by the sandbox on
 * this machine.
 */

import { chromium, webkit } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = opt("base", "http://127.0.0.1:48291").replace(/\/$/, "");
const BROWSERS = opt("browsers", "chromium").split(",");
const WIDTHS = opt("widths", "1440,390").split(",").map(Number);
const ONLY = opt("only", "").split(",").filter(Boolean);
const KEYBOARD_ONLY = args.includes("--keyboard-only");
const FORCED_ROOTS = [360, 300];
const POINTER_STEPS = 20;
const MAX_KEYS = 400;

const TOOLS = [
  {
    slug: "departure-board",
    root: ".gmt-departure-board",
    presets: [
      "shuttle-headway",
      "ferry-list",
      "arrival-at-to",
      "fall-back-hourly",
    ],
    controls: ['[data-role="handle-after"]'],
    track: '[data-role="rail-stage"]',
  },
  {
    slug: "punctuality-board",
    root: ".gmt-punctuality-board",
    presets: ["fifteen-minute", "sixty-and-120", "day-based", "fall-back"],
    controls: [
      '[data-role="handle-late"]',
      '[data-role="handle-early"]',
      '[data-role="handle-compare"]',
    ],
    track: '[data-role="tolerance-track"]',
  },
  {
    slug: "eta-drift",
    root: ".gmt-eta-drift",
    presets: ["vessel-slide", "est-after-act", "req-beats-est", "one-estimate"],
    controls: ['[data-role="tolerance-slider"]'],
    track: null,
  },
];

const rounded = (r) => ({
  left: Math.round(r.left),
  top: Math.round(r.top),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

/** Runs in the page: the named rects, in document order. */
function snapshotInPage(controlSel) {
  const control = document.querySelector(controlSel);
  const section = control.closest(".gmt-widget-section");
  const out = [];
  const label = (el) =>
    `${el.tagName.toLowerCase()}${el.dataset.role ? `[${el.dataset.role}]` : ""}${
      typeof el.className === "string" && el.className
        ? "." + el.className.split(/\s+/).slice(0, 2).join(".")
        : ""
    }`;
  // Rects are taken from the widget root's corner, so the page scrolling to
  // keep a focused handle in view is not counted as a move.
  const origin = control.closest(".gmt-widget").getBoundingClientRect();
  const add = (kind, el) => {
    const r = el.getBoundingClientRect();
    out.push({
      kind,
      key: `${kind}:${label(el)}`,
      left: r.left - origin.left,
      top: r.top - origin.top,
      width: r.width,
      height: r.height,
    });
  };
  const widget = control.closest(".gmt-widget");
  widget.querySelectorAll(".gmt-punct-hero").forEach((el) => add("hero", el));
  add("frame", widget.querySelector(".gmt-punct-frame"));
  add("control", control);
  const drawn =
    ".gmt-dep-stage, .gmt-eta-plot, .gmt-punct-rows, .gmt-punct-lane";
  for (const el of section.querySelectorAll("*")) {
    if (el === control || el.contains(control)) continue;
    if (
      !(control.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
    ) {
      continue;
    }
    const parent = el.parentElement?.closest(drawn);
    if (parent && section.contains(parent)) continue;
    if (el.getClientRects().length === 0) continue;
    if (el.closest("svg")) continue;
    add("above", el);
  }
  return out;
}

async function snapshot(page, controlSel) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.evaluate(snapshotInPage, controlSel);
}

/** The differences between the baseline and a later snapshot, as strings. */
function diffSnapshots(base, now, isHandle, pressed = false) {
  const problems = [];
  if (base.length !== now.length) {
    problems.push(`element count ${base.length} -> ${now.length}`);
    return problems;
  }
  base.forEach((a, i) => {
    const b = now[i];
    if (a.key !== b.key) {
      problems.push(`element ${i}: ${a.key} -> ${b.key}`);
      return;
    }
    // A pressed handle grows 8% (its `:active` scale): its own box is skipped
    // while the pointer is down. Everything else is still compared.
    if (a.kind === "control" && isHandle && pressed) return;
    const ra = rounded(a);
    const rb = rounded(b);
    const keys =
      a.kind === "control" && isHandle
        ? ["top", "width", "height"]
        : ["left", "top", "width", "height"];
    if (keys.some((k) => ra[k] !== rb[k])) {
      problems.push(`${a.key}: ${JSON.stringify(ra)} -> ${JSON.stringify(rb)}`);
    }
  });
  return problems;
}

async function valueOf(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el.getAttribute("aria-valuenow") ?? el.value;
  }, sel);
}

async function run() {
  let failures = 0;
  const summary = [];
  for (const name of BROWSERS) {
    const browser = await (name === "webkit" ? webkit : chromium).launch();
    const variants = [
      ...WIDTHS.map((w) => ({ viewport: w, root: null })),
      ...FORCED_ROOTS.map((w) => ({ viewport: 1440, root: w })),
    ];
    for (const v of variants) {
      const context = await browser.newContext({
        viewport: { width: v.viewport, height: 900 },
      });
      const page = await context.newPage();
      for (const tool of TOOLS) {
        if (ONLY.length && !ONLY.includes(tool.slug)) continue;
        await page.goto(`${BASE}/tools/${tool.slug}/`, {
          waitUntil: "networkidle",
        });
        await page.addStyleTag({
          content:
            "header, .header, starlight-menu-button, .sl-banner, mobile-starlight-toc { display: none !important; }" +
            (v.root
              ? `${tool.root}{width:${v.root}px!important;max-width:${v.root}px!important}`
              : ""),
        });
        for (const preset of tool.presets) {
          await page.selectOption('[data-role="preset"]', preset);
          await page.waitForTimeout(1500);
          for (const sel of tool.controls) {
            const visible = await page.evaluate((s) => {
              const el = document.querySelector(s);
              return (
                !!el && !el.closest("[hidden]") && el.offsetParent !== null
              );
            }, sel);
            if (!visible) continue;
            const isHandle = !sel.includes("slider");
            const id = `${name} ${v.root ? `root${v.root}` : v.viewport} ${tool.slug} ${preset} ${sel.match(/"(.+)"/)[1]}`;
            const result = { keyboard: 0, pointer: 0, problems: [] };
            const check = async (step, base, pressed = false) => {
              const now = await snapshot(page, sel);
              for (const p of diffSnapshots(base, now, isHandle, pressed)) {
                result.problems.push(`${step}: ${p}`);
              }
            };

            // Keyboard: the whole range, there and back.
            await page.locator(sel).focus();
            await page.keyboard.press("Home");
            const base = await snapshot(page, sel);
            for (const key of ["PageUp", "PageDown"]) {
              let last = await valueOf(page, sel);
              for (let i = 0; i < MAX_KEYS; i++) {
                await page.keyboard.press(key);
                const value = await valueOf(page, sel);
                await check(`${key} #${i + 1} (value ${value})`, base);
                result.keyboard++;
                if (value === last) break;
                last = value;
              }
            }
            await page.keyboard.press("Home");

            // Pointer: out to the far end of the track in 20 steps, and back.
            if (!KEYBOARD_ONLY) {
              const box = await page.evaluate(
                ({ s, t }) => {
                  const c = document.querySelector(s).getBoundingClientRect();
                  const tr = (
                    t ? document.querySelector(t) : document.querySelector(s)
                  ).getBoundingClientRect();
                  return {
                    x: c.left + c.width / 2,
                    y: c.top + c.height / 2,
                    left: tr.left,
                    right: tr.right,
                  };
                },
                { s: sel, t: tool.track },
              );
              const startX = isHandle ? box.x : box.left + 8;
              await page.mouse.move(startX, box.y);
              await page.mouse.down();
              const far = box.right - 2;
              const near = box.left + 2;
              for (let i = 1; i <= POINTER_STEPS; i++) {
                await page.mouse.move(
                  startX + ((far - startX) * i) / POINTER_STEPS,
                  box.y,
                );
                await check(`drag out ${i}/${POINTER_STEPS}`, base, true);
                result.pointer++;
              }
              for (let i = 1; i <= POINTER_STEPS; i++) {
                await page.mouse.move(
                  far + ((near - far) * i) / POINTER_STEPS,
                  box.y,
                );
                await check(`drag back ${i}/${POINTER_STEPS}`, base, true);
                result.pointer++;
              }
              await page.mouse.up();
            }

            const ok = result.problems.length === 0;
            if (!ok) failures++;
            summary.push({ id, ...result, ok });
            console.log(
              `${ok ? "ok  " : "FAIL"} ${id}: ${result.keyboard} keyboard steps, ${result.pointer} pointer steps` +
                (ok ? "" : `, ${result.problems.length} moved`),
            );
            for (const p of result.problems.slice(0, 6))
              console.log(`       ${p}`);
            if (result.problems.length > 6) {
              console.log(`       ... and ${result.problems.length - 6} more`);
            }
          }
        }
      }
      await context.close();
    }
    await browser.close();
  }
  const bad = summary.filter((s) => !s.ok).length;
  console.log(
    `\nreadout-still: ${summary.length} drags checked, ${bad} moved something.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
