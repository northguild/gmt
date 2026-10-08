#!/usr/bin/env node
/**
 * Readouts-hold-still gate (context/dox/specs/tran-57-charts-restyle.md § 9.1,
 * and context/dox/specs/timetable-reader.md § F9).
 *
 * Dragging a handle must move nothing except the values themselves. For each of
 * the four tool pages (Departure Board, Punctuality Board, ETA Drift Chart,
 * Timetable Reader), every preset, and each of these widths, the script takes
 * every control the reader drags:
 *
 *   Departure Board     handle-after
 *   Punctuality Board   handle-late, handle-early, handle-compare (the ones the
 *                       preset shows)
 *   ETA Drift Chart     tolerance-slider
 *   Timetable Reader    handle-1 to handle-4 (the ones the preset shows)
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
 *   - the chart frame (`.gmt-punct-frame`, or the tool's own `frame`);
 *   - the dragged control;
 *   - every element in the control's section that comes before the control in
 *     the document, except the insides of the drawn charts (`.gmt-dep-stage`,
 *     `.gmt-eta-plot`, `.gmt-punct-rows`, `.gmt-punct-lane`, or the tool's own
 *     `drawn` list), whose marks move with the value by design (their
 *     containers are still measured).
 *
 * A `TOOLS` entry may carry four optional fields; the three older entries keep
 * today's behaviour by default:
 *
 *   frame         the chart frame to record (default `.gmt-punct-frame`);
 *   drawn         the containers whose insides move by design (default: the
 *                 list above);
 *   scope         `"above"` (default) records what comes before the control in
 *                 its section; `"widget"` records every element in the widget
 *                 root, in every section, before and after the control, and the
 *                 control's ancestors too. The Timetable Reader needs it: a
 *                 handle in section 1 must not move the table or the output in
 *                 sections 2 and 3;
 *   pointerSteps  steps in each pointer sweep (default 20). 48 steps are 30
 *                 minutes each on the Timetable Reader's day, so every sweep
 *                 enters a 60-minute band.
 *
 * Rects are measured from the widget root's corner, so the page scrolling to
 * keep a focused handle in view is not a move. Every rect is rounded to the
 * whole pixel and compared with the first recording (the control at its minimum). The script exits non-zero if any
 * differs, and prints the element, the step and the two rects.
 *
 * A pass must also have checked something. The script fails when:
 *   - the page does not answer HTTP 200 or the widget root is missing;
 *   - a required control is missing or hidden (`handle-early` and
 *     `handle-compare` are optional: a preset may not show them);
 *   - a keyboard sweep or a pointer drag leaves the control's value where it
 *     started, since identical snapshots prove nothing about a handle that did
 *     not move;
 *   - no drag was checked at all (an `--only` typo exits 2). A custom
 * `role="slider"` handle slides along its track by design, so for a handle only
 * the top, width and height are compared, and not at all while the pointer
 * holds it (it grows 8% when pressed); a native range is compared whole.
 *
 * `extraWidths` on a TOOLS entry adds viewports for that tool alone: the Timetable
 * Reader's two-column band (1920 and 2000) is checked there and nowhere else.
 *
 * Widths: each `--widths` entry is a viewport width (default 1440,390). Each
 * widget root is also forced to 360 and 300 px wide at a 1440 viewport, the
 * widths of the /dox rail. With the default browsers (Chromium and WebKit) that
 * is the documented gate in context/dox/built.md: 1440, 390, 360 and 300 px.
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
import {
  controlPresence,
  emptyRunProblem,
  keyboardMoveProblems,
  pointerMoveProblems,
} from "./gate-checks.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = opt("base", "http://127.0.0.1:48291").replace(/\/$/, "");
const BROWSERS = opt("browsers", "chromium,webkit").split(",");
const WIDTHS = opt("widths", "1440,390").split(",").map(Number);
const ONLY = opt("only", "").split(",").filter(Boolean);
const KEYBOARD_ONLY = args.includes("--keyboard-only");
if (!BROWSERS.every((b) => b === "chromium" || b === "webkit")) {
  console.error(
    `Unsupported --browsers "${BROWSERS.join(",")}": only chromium and webkit run here.`,
  );
  process.exit(2);
}
if (!WIDTHS.length || WIDTHS.some((w) => !Number.isFinite(w) || w <= 0)) {
  console.error("--widths needs positive numbers, e.g. 1440,390");
  process.exit(2);
}
const FORCED_ROOTS = [360, 300];
const POINTER_STEPS = 20;
const DEFAULT_FRAME = ".gmt-punct-frame";
const DEFAULT_DRAWN =
  ".gmt-dep-stage, .gmt-eta-plot, .gmt-punct-rows, .gmt-punct-lane";
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
    controls: [{ sel: '[data-role="handle-after"]' }],
    track: '[data-role="rail-stage"]',
  },
  {
    slug: "punctuality-board",
    root: ".gmt-punctuality-board",
    presets: ["fifteen-minute", "sixty-and-120", "day-based", "fall-back"],
    // The early and second-late handles appear only in presets that use them;
    // where a preset is known to show one (`requiredIn`) it is required.
    controls: [
      { sel: '[data-role="handle-late"]' },
      {
        sel: '[data-role="handle-early"]',
        optional: true,
        requiredIn: ["day-based"],
      },
      {
        sel: '[data-role="handle-compare"]',
        optional: true,
        requiredIn: ["sixty-and-120"],
      },
    ],
    track: '[data-role="tolerance-track"]',
  },
  {
    slug: "eta-drift",
    root: ".gmt-eta-drift",
    presets: ["vessel-slide", "est-after-act", "req-beats-est", "one-estimate"],
    controls: [{ sel: '[data-role="tolerance-slider"]' }],
    track: null,
  },
  {
    slug: "timetable-reader",
    root: ".gmt-timetable",
    presets: [
      "fall-back",
      "offset-picks",
      "spring-forward",
      "published-local",
      "berlin-fall-back",
    ],
    controls: [
      { sel: '[data-role="handle-1"]' },
      {
        sel: '[data-role="handle-2"]',
        optional: true,
        requiredIn: ["fall-back", "offset-picks", "spring-forward"],
      },
      {
        sel: '[data-role="handle-3"]',
        optional: true,
        requiredIn: ["fall-back", "spring-forward"],
      },
      { sel: '[data-role="handle-4"]', optional: true },
    ],
    track: '[data-role="day-track"]',
    // The two-column band starts at a 1220px section (a 1902px viewport): 1920
    // is its lower edge, 2000 the middle.
    extraWidths: [1920, 2000],
    frame: '[data-role="two-clocks"]',
    scope: "widget",
    drawn: '[data-role="day-track"], [data-role="plot"], .gmt-timetable-live',
    pointerSteps: 48,
  },
];

const rounded = (r) => ({
  left: Math.round(r.left),
  top: Math.round(r.top),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

/** Runs in the page: the named rects, in document order. */
function snapshotInPage({ controlSel, frame, drawn, scope }) {
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
  add("frame", widget.querySelector(frame));
  add("control", control);
  const everything = scope === "widget";
  const within = everything ? widget : section;
  for (const el of within.querySelectorAll("*")) {
    if (el === control) continue;
    if (!everything) {
      if (el.contains(control)) continue;
      if (
        !(
          control.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING
        )
      ) {
        continue;
      }
    }
    const parent = el.parentElement?.closest(drawn);
    if (parent && within.contains(parent)) continue;
    if (el.getClientRects().length === 0) continue;
    if (el.closest("svg")) continue;
    add("above", el);
  }
  return out;
}

async function snapshot(page, controlSel, tool) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return page.evaluate(snapshotInPage, {
    controlSel,
    frame: tool.frame ?? DEFAULT_FRAME,
    drawn: tool.drawn ?? DEFAULT_DRAWN,
    scope: tool.scope ?? "above",
  });
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
    /* The Departure Board's handle reports its position on a rail that is
       refitted after each key, so the same aria-valuenow can mean different
       arrivals; the value it edits is the arrival field. */
    if (el.getAttribute("data-role") === "handle-after") {
      const field = document.querySelector('[data-role="after"]');
      if (field) return field.value;
    }
    return el.getAttribute("aria-valuenow") ?? el.value;
  }, sel);
}

async function run() {
  const unknown = ONLY.filter((slug) => !TOOLS.some((t) => t.slug === slug));
  const tools = TOOLS.filter((t) => !ONLY.length || ONLY.includes(t.slug));
  if (unknown.length || !tools.length) {
    console.error(
      `--only ${unknown.length ? `"${unknown.join(",")}" matches no tool` : "matched no tool"}; known: ${TOOLS.map((t) => t.slug).join(", ")}`,
    );
    process.exit(2);
  }
  /** Viewports the selected tools ask for on top of `--widths`. */
  const EXTRA_WIDTHS = [
    ...new Set(tools.flatMap((t) => t.extraWidths ?? [])),
  ].filter((w) => !WIDTHS.includes(w));
  let failures = 0;
  const summary = [];
  /** A failure that is not a measured move: the page or a control was not there. */
  const fail = (id, message) => {
    failures++;
    summary.push({ id, ok: false, problems: [message] });
    console.log(`FAIL ${id}: ${message}`);
  };
  for (const name of BROWSERS) {
    const browser = await (name === "webkit" ? webkit : chromium).launch();
    const variants = [
      ...WIDTHS.map((w) => ({ viewport: w, root: null })),
      ...EXTRA_WIDTHS.map((w) => ({ viewport: w, root: null, extra: true })),
      ...FORCED_ROOTS.map((w) => ({ viewport: 1440, root: w })),
    ];
    for (const v of variants) {
      const context = await browser.newContext({
        viewport: { width: v.viewport, height: 900 },
      });
      const page = await context.newPage();
      for (const tool of tools) {
        if (v.extra && !tool.extraWidths?.includes(v.viewport)) continue;
        const where = `${name} ${v.root ? `root${v.root}` : v.viewport} ${tool.slug}`;
        const response = await page.goto(`${BASE}/tools/${tool.slug}/`, {
          waitUntil: "networkidle",
        });
        const status = response ? response.status() : null;
        if (status !== 200) {
          fail(
            where,
            status == null
              ? "no HTTP response for the page"
              : `the page answered HTTP ${status}, not 200 (wrong --base?)`,
          );
          continue;
        }
        if (!(await page.locator(tool.root).count())) {
          fail(where, `widget root ${tool.root} matched nothing on the page`);
          continue;
        }
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
          for (const { sel, optional, requiredIn } of tool.controls) {
            const visible = await page.evaluate((s) => {
              const el = document.querySelector(s);
              return (
                !!el && !el.closest("[hidden]") && el.offsetParent !== null
              );
            }, sel);
            const isHandle = !sel.includes("slider");
            const id = `${where} ${preset} ${sel.match(/"(.+)"/)[1]}`;
            const presence = controlPresence({
              visible,
              optional: optional && !requiredIn?.includes(preset),
              id,
            });
            for (const message of presence.problems) fail(id, message);
            if (!presence.proceed) continue;
            const result = { keyboard: 0, pointer: 0, problems: [] };
            const check = async (step, base, pressed = false) => {
              const now = await snapshot(page, sel, tool);
              for (const p of diffSnapshots(base, now, isHandle, pressed)) {
                result.problems.push(`${step}: ${p}`);
              }
            };

            // Keyboard: the whole range, there and back.
            await page.locator(sel).focus();
            await page.keyboard.press("Home");
            const base = await snapshot(page, sel, tool);
            const homeValue = await valueOf(page, sel);
            const seen = { up: [], down: [] };
            for (const key of ["PageUp", "PageDown"]) {
              let last = await valueOf(page, sel);
              for (let i = 0; i < MAX_KEYS; i++) {
                await page.keyboard.press(key);
                const value = await valueOf(page, sel);
                await check(`${key} #${i + 1} (value ${value})`, base);
                result.keyboard++;
                seen[key === "PageUp" ? "up" : "down"].push(value);
                if (value === last) break;
                last = value;
              }
            }
            // Identical snapshots prove nothing if the handle never moved.
            for (const p of keyboardMoveProblems({
              home: homeValue,
              ...seen,
            })) {
              result.problems.push(`keyboard: ${p}`);
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
              const pointerStart = await valueOf(page, sel);
              await page.mouse.move(startX, box.y);
              await page.mouse.down();
              const far = box.right - 2;
              const near = box.left + 2;
              const steps = tool.pointerSteps ?? POINTER_STEPS;
              for (let i = 1; i <= steps; i++) {
                await page.mouse.move(
                  startX + ((far - startX) * i) / steps,
                  box.y,
                );
                await check(`drag out ${i}/${steps}`, base, true);
                result.pointer++;
              }
              for (const p of pointerMoveProblems({
                start: pointerStart,
                far: await valueOf(page, sel),
              })) {
                result.problems.push(`pointer: ${p}`);
              }
              for (let i = 1; i <= steps; i++) {
                await page.mouse.move(far + ((near - far) * i) / steps, box.y);
                await check(`drag back ${i}/${steps}`, base, true);
                result.pointer++;
              }
              await page.mouse.up();
            }

            const ok = result.problems.length === 0;
            if (!ok) failures++;
            summary.push({ id, ...result, ok });
            console.log(
              `${ok ? "ok  " : "FAIL"} ${id}: ${result.keyboard} keyboard steps, ${result.pointer} pointer steps` +
                (ok ? "" : `, ${result.problems.length} problem(s)`),
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
    `\nreadout-still: ${summary.length} drags checked, ${bad} failed.`,
  );
  const empty = emptyRunProblem(summary.length, "drags");
  if (empty) console.error(empty);
  process.exit(failures === 0 && !empty ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
