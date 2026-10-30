#!/usr/bin/env node
/**
 * Readouts-hold-still gate (context/dox/reference/visual-design.md, "Layout stability",
 * and the Timetable Reader's rules in context/dox/built.md).
 *
 * Dragging a handle must move nothing except the values themselves. For each of
 * the seven tool pages (Departure Board, Punctuality Board, ETA Drift Chart,
 * Timetable Reader, Free Time Ledger, Dwell Ledger, B/L Date Stamp), every
 * preset, and each of these widths, the script takes every control the reader
 * drags:
 *
 *   Departure Board     handle-after
 *   Punctuality Board   handle-late, handle-early, handle-compare (the ones the
 *                       preset shows)
 *   ETA Drift Chart     tolerance-slider
 *   Timetable Reader    handle-1 to handle-4 (the ones the preset shows)
 *   Free Time Ledger    handle-start, handle-end
 *   Dwell Ledger        handle-entry, handle-exit
 *   B/L Date Stamp      moment-slider (a native range)
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
 *   - every hero plate (`data-gate="hero"`);
 *   - the chart frame (`data-gate="frame"`);
 *   - the dragged control;
 *   - every element in the control's section that comes before the control in
 *     the document, except the insides of the drawn parts (`data-gate="drawn"`
 *     and the tool's other drawn parts), whose marks move with the value by
 *     design (their containers are still measured).
 *
 * Controls are found by ARIA role and accessible name inside the widget root
 * (`lib/locate.mjs`), never by a style class or a role attribute. The structural parts
 * that have no role or name are `data-gate` hooks, listed in `context/dox/built.md`,
 * "Gate hooks".
 *
 * A `TOOLS` entry may carry optional fields:
 *
 *   presetName    the accessible name of the preset select (default "Preset");
 *   drawn         the parts whose insides move by design (default `["drawn"]`).
 *                 `"hold"` stands for the first child of a hold (the kit's hold
 *                 writes the live wrapper first), `"grid"` for a month grid;
 *   track         the part a pointer drag runs along (a `data-gate` value), or
 *                 null to drag along the control itself;
 *   scope         `"above"` (default) records what comes before the control in
 *                 its section; `"widget"` records every element in the widget
 *                 root, in every section, before and after the control, and the
 *                 control's ancestors too. The Timetable Reader needs it: a
 *                 handle in section 1 must not move the table or the output in
 *                 sections 2 and 3;
 *   riders        true: the range field's value chip follows the thumb. Its left
 *                 moves; its top, width and height are still compared, like a
 *                 handle's;
 *   textBoxes     the parts whose inline text boxes are as wide as their text:
 *                 `"codeframe"` (the call frame's `<code>` and its coloured
 *                 spans) and `"instant"` (an instant's unbreakable pieces).
 *                 The frame and its `<pre>` are still measured, so a line added
 *                 or a frame resized is a move; only a span's own width is not;
 *   pointerSteps  steps in each pointer sweep (default 20). 48 steps are 30
 *                 minutes each on the Timetable Reader's day, so every sweep
 *                 enters a 60-minute band;
 *   maxKeys       the most key presses in each direction of the keyboard sweep
 *                 (default 400). A ledger handle has no far end: the canvas
 *                 widens when a handle reaches its edge, so its value never stops
 *                 changing and the sweep ends here;
 *   step          per control, a number: the control is a number field the
 *                 reader steps with the arrow keys, not a handle. The script
 *                 presses ArrowUp that many times, then ArrowDown back, and
 *                 compares after each press. There is no pointer pass;
 *   value         per control, the role and name of the field the handle edits.
 *                 A ledger handle's `aria-valuenow` is its place on a canvas that
 *                 is refitted after each key, so the same number can mean
 *                 different times; the value it edits is its typed field, and
 *                 `valueOf` reads that.
 *
 * Rects are measured from the widget root's corner, so the page scrolling to
 * keep a focused handle in view is not a move. Every rect is rounded to the
 * whole pixel and compared with the first recording (the control at its minimum). The script exits non-zero if any
 * differs, and prints the element, the step and the two rects.
 *
 * A pass must also have checked something. The script fails when:
 *   - the page does not answer HTTP 200 or the widget root is missing;
 *   - a drawn part or text box the row names matches nothing in the widget
 *     (checked on the first preset), since a stale name exempts nothing;
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
 *   pnpm exec astro build --outDir /tmp/dist-x/gmt
 *   node scripts/lib/static-server.mjs /tmp/dist-x 4351
 *
 * Usage:
 *   node scripts/readout-still.mjs --base http://127.0.0.1:4351/gmt
 *     [--browsers chromium,webkit] [--widths 1440,390] [--only <slug,...>]
 *     [--keyboard-only] [--all]
 *
 * `--all` prints every distinct problem element once, instead of the first few.
 * `--keyboard-only` skips the pointer drags (WebKit's synthetic pointer events
 * are flaky). `--browsers` also takes `firefox`, which does not launch under the
 * sandbox on the author's machine.
 *
 * The runner's contract (`pnpm --filter dox gates`, `scripts/gates/`): `--list-pages` prints the
 * tool pages and exits; `--pages /tools/<slug>/,...` runs only those (an unknown path exits 2); with
 * `GATE_REPORT` set, every failure is also a finding and the run ends with its measured count.
 */

import { chromium, firefox, webkit } from "@playwright/test";
import {
  blockOffSite,
  controlPresence,
  emptyRunProblem,
  keyboardMoveProblems,
  pointerMoveProblems,
} from "./gate-checks.mjs";
import { applyPageContract } from "./gates/contract.mjs";
import { recordFinding, recordMeasured } from "./gates/findings.mjs";
import { identityScript } from "./lib/element-identity.mjs";
import { control, controlLabel, gate, resolveMisses } from "./lib/locate.mjs";

const GATE = "readout-still";
const ENGINES = { chromium, webkit, firefox };
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = opt("base", "http://127.0.0.1:48291/gmt").replace(/\/$/, "");
const BROWSERS = opt("browsers", "chromium,webkit").split(",");
const WIDTHS = opt("widths", "1440,390").split(",").map(Number);
const ONLY = opt("only", "").split(",").filter(Boolean);
const KEYBOARD_ONLY = args.includes("--keyboard-only");
/** `--resolve-only` loads each page once and checks that every locator finds what it names. */
const RESOLVE_ONLY = args.includes("--resolve-only");
/** `--all` prints every problem, one line per element, instead of the first six. */
const ALL = args.includes("--all");
if (!BROWSERS.every((b) => b in ENGINES)) {
  console.error(
    `Unsupported --browsers "${BROWSERS.join(",")}": chromium, webkit and firefox run here.`,
  );
  process.exit(2);
}
if (!WIDTHS.length || WIDTHS.some((w) => !Number.isFinite(w) || w <= 0)) {
  console.error("--widths needs positive numbers, e.g. 1440,390");
  process.exit(2);
}
const FORCED_ROOTS = [360, 300];
const POINTER_STEPS = 20;
const MAX_KEYS = 400;

/** The selector of each drawn part a tool names. `hold` is the live wrapper a hold writes
 *  first; the others are marked where the mount draws them. */
const DRAWN_PART = {
  drawn: gate("drawn"),
  grid: gate("grid"),
  hold: `${gate("hold")} > :first-child`,
};
/** The selector of each kind of text box a tool names. */
const TEXT_PART = {
  codeframe: `${gate("codeframe")} code, ${gate("codeframe")} code *`,
  instant: gate("instant"),
};
const PRESET = { role: "combobox", name: "Preset" };

const TOOLS = [
  {
    slug: "departure-board",
    root: '[data-widget="departure-board"]',
    presets: [
      "shuttle-headway",
      "ferry-list",
      "arrival-at-to",
      "fall-back-hourly",
    ],
    controls: [
      {
        role: "slider",
        name: "Arrival",
        value: { role: "textbox", name: "Arrival" },
      },
    ],
    track: "track",
  },
  {
    slug: "punctuality-board",
    root: '[data-widget="punctuality-board"]',
    presets: ["fifteen-minute", "sixty-and-120", "day-based", "fall-back"],
    // The early and second-late handles appear only in presets that use them;
    // where a preset is known to show one (`requiredIn`) it is required.
    controls: [
      { role: "slider", name: "Late tolerance" },
      {
        role: "slider",
        name: "Early tolerance",
        optional: true,
        requiredIn: ["day-based"],
      },
      {
        role: "slider",
        name: "Second late tolerance",
        optional: true,
        requiredIn: ["sixty-and-120"],
      },
    ],
    track: "track",
  },
  {
    slug: "eta-drift",
    root: '[data-widget="eta-drift"]',
    presets: ["vessel-slide", "est-after-act", "req-beats-est", "one-estimate"],
    controls: [{ role: "slider", name: "Drag the tolerance" }],
    track: null,
  },
  {
    slug: "timetable-reader",
    root: '[data-widget="timetable-reader"]',
    presets: [
      "fall-back",
      "offset-picks",
      "spring-forward",
      "published-local",
      "berlin-fall-back",
    ],
    controls: [
      { role: "slider", name: "Row 1 printed time" },
      {
        role: "slider",
        name: "Row 2 printed time",
        optional: true,
        requiredIn: ["fall-back", "offset-picks", "spring-forward"],
      },
      {
        role: "slider",
        name: "Row 3 printed time",
        optional: true,
        requiredIn: ["fall-back", "spring-forward"],
      },
      { role: "slider", name: "Row 4 printed time", optional: true },
    ],
    track: "track",
    // The two-column band starts at a 1220px section (a 1902px viewport): 1920
    // is its lower edge, 2000 the middle.
    extraWidths: [1920, 2000],
    scope: "widget",
    pointerSteps: 48,
  },
  {
    slug: "free-time-ledger",
    root: '[data-widget="free-time-ledger"]',
    presets: [
      "friday-three-days",
      "read-as-next-day",
      "out-at-expiry",
      "working-days",
      "terminal-holiday",
      "tiers",
      "no-free-time",
    ],
    controls: [
      {
        role: "slider",
        name: "Clock start",
        value: { role: "textbox", name: "Clock start" },
      },
      {
        role: "slider",
        name: "Clock end",
        value: { role: "textbox", name: "Clock end" },
      },
    ],
    track: "track",
    drawn: ["drawn"],
    maxKeys: 60,
  },
  {
    slug: "dwell-ledger",
    root: '[data-widget="dwell-ledger"]',
    // "no-zone" returns null, so it is left out; every other preset returns a
    // value.
    presets: [
      "two-hours-two-days",
      "exit-at-midnight",
      "spring-forward",
      "london-vs-amsterdam",
    ],
    controls: [
      {
        role: "slider",
        name: "Entry",
        value: { role: "textbox", name: "Entry" },
      },
      {
        role: "slider",
        name: "Exit",
        value: { role: "textbox", name: "Exit" },
      },
    ],
    track: "track",
    drawn: ["drawn"],
    maxKeys: 60,
  },
  {
    slug: "bl-date-stamp",
    root: '[data-widget="bl-date-stamp"]',
    // "no-zone" returns no date, so it is left out; every other preset returns
    // a value.
    presets: [
      "sao-paulo-evening",
      "shanghai-morning",
      "rotterdam-fall-back",
      "apia-deleted-day",
      "fixed-offset",
    ],
    controls: [{ role: "slider", name: "Move the moment" }],
    track: null,
    // The lanes' day columns and the gate move with the moment by design; the
    // plot is measured, and so is every plate above it.
  },
  /* The GNSS and leap-second tools (MAR-16). Their frame is the `frame` part;
     what moves with the value by design is what they draw: the lanes, the
     bars, the strip, the timeline and the rulers, and a hold's live wrapper.
     The ring's laps, hand and hub are drawn (they sit in `lanes`); the plates,
     the legend, the tables and the call frame are measured. */
  {
    slug: "gnss-week-decoder",
    root: '[data-widget="gnss-week-decoder"]',
    presets: ["galileo-2019", "lnav-2024", "same-reading-two-dates"],
    controls: [
      { role: "slider", name: "Slide the week", optional: true },
      { role: "slider", name: "Slide the time of week", optional: true },
    ],
    track: null,
    scope: "widget",
    drawn: ["drawn"],
    riders: true,
    textBoxes: ["codeframe"],
  },
  {
    slug: "satellite-clock-converter",
    root: '[data-widget="satellite-clock-converter"]',
    presets: ["utc-2024", "galileo-first-instant", "beidou-reading"],
    controls: [{ role: "slider", name: "Step through the leap seconds" }],
    track: null,
    scope: "widget",
    drawn: ["drawn"],
    riders: true,
    textBoxes: ["codeframe"],
  },
  {
    slug: "gnss-rollover-checker",
    root: '[data-widget="gnss-rollover-checker"]',
    // The presets that check on a stated date: the slider is live only there.
    presets: ["navic-built-2020", "navic-fixed-era", "galileo-built-2024"],
    controls: [
      { role: "slider", name: "Slide the date through the firmware's window" },
    ],
    track: null,
    scope: "widget",
    drawn: ["drawn"],
    riders: true,
    textBoxes: ["codeframe"],
  },
  {
    slug: "leap-second-timeline",
    root: '[data-widget="leap-second-timeline"]',
    presets: ["from-2000", "last-insertion", "after-the-table"],
    controls: [{ role: "slider", name: "Move the date" }],
    track: null,
    scope: "widget",
    drawn: [],
    riders: true,
    textBoxes: ["codeframe"],
  },
  {
    slug: "elapsed-vs-clock-difference",
    root: '[data-widget="elapsed-vs-clock"]',
    presets: ["across-2016", "twenty-four-years", "no-insertions"],
    controls: [{ role: "slider", name: "Move the end" }],
    track: null,
    scope: "widget",
    drawn: ["drawn"],
    riders: true,
    textBoxes: ["codeframe"],
  },
  {
    slug: "holiday-rule-builder",
    root: '[data-widget="holiday-rule-builder"]',
    presets: [
      "chain",
      "closing",
      "friday-monday",
      "fri-sat",
      "midweek",
      "lunisolar",
    ],
    // The year field, stepped 20 times each way. The twelve month grids hold
    // six week rows, so no year changes a box; the calendar output and the
    // year sentence hold the height of their longest text.
    controls: [{ role: "spinbutton", name: "Year", step: 20 }],
    track: null,
    scope: "widget",
    drawn: ["drawn", "grid", "hold"],
    textBoxes: ["codeframe"],
  },
  {
    slug: "observance-comparator",
    root: '[data-widget="observance-comparator"]',
    presets: ["adjacent"],
    // The last year, stepped ten times each way: the plates and the table
    // header hold still. The table body reserves its rows, so its box holds
    // too; only the cells' text moves.
    controls: [{ role: "spinbutton", name: "Last year", step: 10 }],
    track: null,
    scope: "widget",
    drawn: ["hold"],
    textBoxes: ["codeframe"],
  },
  {
    slug: "moving-feasts",
    root: '[data-widget="moving-feasts"]',
    presets: ["third-wednesday", "last-sunday-march", "fifth-friday"],
    controls: [{ role: "slider", name: "Year slider" }],
    track: null,
    scope: "widget",
    drawn: ["grid", "hold"],
    riders: true,
    textBoxes: ["codeframe"],
  },
  {
    slug: "cron-in-a-zone",
    root: '[data-widget="cron-in-a-zone"]',
    presets: ["london-spring", "sydney-every-five"],
    // The year field, stepped three times each way. Every row, plate and tick
    // is laid out in every state and hidden with `data-off`, so no year changes
    // a box; the marks and the axis labels move inside their fixed lanes.
    presetName: "Try",
    controls: [{ role: "spinbutton", name: "Year", step: 3 }],
    track: null,
    scope: "widget",
    drawn: [],
    textBoxes: ["codeframe"],
  },
  {
    slug: "leap-day-birthday",
    root: '[data-widget="leap-day-birthday"]',
    presets: [
      "leap-day-birth",
      "century",
      "short-form",
      "from-date-time",
      "not-a-day",
    ],
    // The year slider by keyboard and by pointer, and the typed year stepped
    // three times each way. Eight rows are laid out in every state and every
    // slot that comes and goes is hidden with `data-off`, so no year changes a
    // box; only the range chip rides its track.
    controls: [
      { role: "slider", name: "Year slider" },
      { role: "spinbutton", name: "Year", step: 3 },
    ],
    track: null,
    scope: "widget",
    drawn: ["hold"],
    riders: true,
    textBoxes: ["codeframe"],
  },
];

/**
 * Wait until the widget has stopped easing to the height of its new content.
 * A forced narrow root re-wraps every section after load, and a tall tool needs
 * more than the fixed wait to catch up; the drag is measured from rest, so a
 * settling ease is never read as a readout that moved. A readout that moves
 * during the drag still fails, because the base is taken after this.
 */
/** The pages this gate checks, as site paths. */
const SITE_PAGES = TOOLS.map((t) => `/tools/${t.slug}/`);
const PAGES_ARG = applyPageContract({ gate: GATE, pages: SITE_PAGES });
/** The page, browser and width the measurement in progress belongs to, for its findings. */
let current = { page: null, browser: null, width: null };
/** The widget the measurement in progress belongs to, as a finding target when nothing finer is. */
let currentWidget = "page";
/** Page x browser x width cells the run reached and measured. */
let cells = 0;

/** One finding, tagged with the page, browser and width in progress. */
function finding(rule, message, selector = null, target = currentWidget) {
  recordFinding({ gate: GATE, rule, target, selector, message, ...current });
}

/**
 * One drag problem as `{ key, message }`. A moved element reads
 * `<step> (value <v>): <element>: {before} -> {after}`; the key is the element, so a drag that
 * moves it on every step is one finding, and the message names the first step that moved it.
 */
function dragProblem(problem) {
  const body = problem.split(": {")[0];
  const at = body.lastIndexOf("): ");
  if (at === -1) return { key: body, message: problem };
  const element = body.slice(at + 3);
  return {
    key: element,
    message: `${element} moved at ${body.slice(0, at + 1)}`,
  };
}

/** Findings already written, so a repeat drag of the same handle adds nothing. */
const reported = new Set();

/**
 * A drag's problems as findings: one per page, browser, width, handle and element, however many
 * steps or drags moved it.
 */
function recordDragFindings(result, selector) {
  for (const p of result.problems) {
    const { key, message } = dragProblem(p);
    const id = [
      current.page,
      current.browser,
      current.width,
      selector,
      key,
    ].join("|");
    if (reported.has(id)) continue;
    reported.add(id);
    const stuck = /never moved|exposes no value/.test(p);
    finding(
      stuck ? "value-not-moved" : "readout-moved",
      message,
      selector,
      stuck ? currentWidget : key.replace(/^[a-z]+:/, ""),
    );
  }
}

async function settled(page, root) {
  let last = -1;
  let same = 0;
  for (let i = 0; i < 60 && same < 3; i++) {
    const h = await page.evaluate(
      (r) => document.querySelector(r)?.getBoundingClientRect().height ?? 0,
      root,
    );
    same = h === last ? same + 1 : 0;
    last = h;
    await page.waitForTimeout(150);
  }
}

const rounded = (r) => ({
  left: Math.round(r.left),
  top: Math.round(r.top),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

/** Runs in the page: the named rects, in document order. */
function snapshotInPage(
  control,
  { hero, frame, drawn, scope, riders, textBoxes },
) {
  const widget = control.closest("[data-widget]");
  // The section is the control's ancestor two levels below the widget root (root > card >
  // section), which is how every mount lays it out; no class names it.
  let section = control;
  while (
    section.parentElement?.parentElement &&
    section.parentElement.parentElement !== widget
  ) {
    section = section.parentElement;
  }
  const out = [];
  // The name a problem carries is the element's identity (what a reader reads); the key two
  // snapshots are matched by is its tag and role attribute, which an element that comes
  // or goes elsewhere in the widget does not renumber (a nameless `generic[n]` would).
  const label = (el) => window.__gmtIdentity(el);
  const matchKey = (el) =>
    `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""}`;
  // Rects are taken from the widget root's corner, so the page scrolling to
  // keep a focused handle in view is not counted as a move.
  const origin = widget.getBoundingClientRect();
  const add = (kind, el) => {
    const r = el.getBoundingClientRect();
    out.push({
      kind,
      key: `${kind}:${matchKey(el)}`,
      name: `${kind}:${label(el)}`,
      left: r.left - origin.left,
      top: r.top - origin.top,
      width: r.width,
      height: r.height,
    });
  };
  widget.querySelectorAll(hero).forEach((el) => add("hero", el));
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
    // The text inside a value chip rides the thumb with the chip, so only the chip is compared.
    if (el.parentElement?.closest('[data-gate~="rider"]')) continue;
    if (el.getClientRects().length === 0) continue;
    if (el.closest("svg")) continue;
    if (textBoxes && el.matches(textBoxes)) continue;
    add(riders && el.matches(riders) ? "rider" : "above", el);
  }
  // Every table cell of the widget, whatever its scope or whether it is a drawn chart's: a
  // column that is narrower on one frame than the next shifts the readouts beside it, and the
  // cell width is where that shows first. Compared by width on its own (see `diffCells`).
  const tables = [...widget.querySelectorAll("table")];
  for (const el of widget.querySelectorAll("th, td")) {
    if (el.getClientRects().length === 0) continue;
    const r = el.getBoundingClientRect();
    const row = el.parentElement;
    const table = el.closest("table");
    out.push({
      kind: "cell",
      key: `cell:t${tables.indexOf(table)}r${row.rowIndex}c${[...row.children].indexOf(el)}`,
      name: `cell:${label(el)}`,
      left: r.left - origin.left,
      top: r.top - origin.top,
      width: r.width,
      height: r.height,
    });
  }
  return out;
}

/** Cell widths that differ from the baseline by more than half a pixel. */
function diffCells(base, now) {
  const problems = [];
  const later = new Map(now.map((c) => [c.key, c]));
  for (const a of base) {
    const b = later.get(a.key);
    if (b && Math.abs(a.width - b.width) > 0.5) {
      problems.push(
        `${a.name}: {"width":${a.width.toFixed(1)}} -> {"width":${b.width.toFixed(1)}}`,
      );
    }
  }
  return problems;
}

async function snapshot(page, ctl, tool) {
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  return ctl.evaluate(snapshotInPage, {
    hero: gate("hero"),
    frame: gate("frame"),
    // A row with no drawn part matches nothing, and `:not(*)` is a selector that cannot match.
    drawn:
      (tool.drawn ?? ["drawn"]).map((p) => DRAWN_PART[p]).join(", ") ||
      ":not(*)",
    scope: tool.scope ?? "above",
    riders: tool.riders ? gate("rider") : null,
    textBoxes: tool.textBoxes
      ? tool.textBoxes.map((p) => TEXT_PART[p]).join(", ")
      : null,
  });
}

/** The drawn and text parts a tool's row names that match nothing in its widget. A part
 *  that matches nothing exempts nothing, so a stale name would hide a gap in the row. */
async function namedPartsAbsent(page, tool) {
  const named = [
    ...(tool.drawn ?? ["drawn"]).map((p) => [`drawn:${p}`, DRAWN_PART[p]]),
    ...(tool.textBoxes ?? []).map((p) => [`text:${p}`, TEXT_PART[p]]),
  ];
  const root = page.locator(tool.root).first();
  const absent = [];
  for (const [name, selector] of named) {
    if (!selector) absent.push(`${name} (unknown part)`);
    else if (!(await root.locator(selector).count())) absent.push(name);
  }
  return absent;
}

/** The differences between the baseline and a later snapshot, as strings. */
function diffSnapshots(allBase, allNow, isHandle, pressed = false) {
  const problems = diffCells(
    allBase.filter((e) => e.kind === "cell"),
    allNow.filter((e) => e.kind === "cell"),
  );
  const base = allBase.filter((e) => e.kind !== "cell");
  const now = allNow.filter((e) => e.kind !== "cell");
  if (base.length !== now.length) {
    problems.push(`element count ${base.length} -> ${now.length}`);
    return problems;
  }
  base.forEach((a, i) => {
    const b = now[i];
    if (a.key !== b.key) {
      problems.push(`element ${i}: ${a.name} -> ${b.name}`);
      return;
    }
    // A pressed handle grows 8% (its `:active` scale): its own box is skipped
    // while the pointer is down. Everything else is still compared.
    if (a.kind === "control" && isHandle && pressed) return;
    const ra = rounded(a);
    const rb = rounded(b);
    const keys =
      (a.kind === "control" && isHandle) || a.kind === "rider"
        ? ["top", "width", "height"]
        : ["left", "top", "width", "height"];
    if (keys.some((k) => ra[k] !== rb[k])) {
      problems.push(
        `${a.name}: ${JSON.stringify(ra)} -> ${JSON.stringify(rb)}`,
      );
    }
  });
  return problems;
}

async function valueOf(page, root, ctl, field) {
  /* A control may name the field it edits (a ledger handle: its typed field, the Departure
     Board's arrival field), because its own `aria-valuenow` is a place on a canvas that is
     refitted after each key. */
  if (field) return control(page, root, field).inputValue();
  return ctl.evaluate((el) => el.getAttribute("aria-valuenow") ?? el.value);
}

async function run() {
  const unknown = ONLY.filter((slug) => !TOOLS.some((t) => t.slug === slug));
  const tools = TOOLS.filter(
    (t) =>
      (!ONLY.length || ONLY.includes(t.slug)) &&
      (!PAGES_ARG || PAGES_ARG.includes(`/tools/${t.slug}/`)),
  );
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
    finding(
      /required control/.test(message) ? "control-missing" : "page-error",
      message,
    );
    console.log(`FAIL ${id}: ${message}`);
  };
  if (RESOLVE_ONLY) {
    const browser = await ENGINES.chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
    });
    await blockOffSite(context, BASE);
    await context.addInitScript({ content: identityScript() });
    const page = await context.newPage();
    let missed = 0;
    for (const tool of tools) {
      const response = await page.goto(`${BASE}/tools/${tool.slug}/`, {
        waitUntil: "networkidle",
      });
      const miss = [];
      if (!response || response.status() !== 200)
        miss.push(`the page answered HTTP ${response?.status() ?? "none"}`);
      const asks = [
        { name: `widget root ${tool.root}`, sel: tool.root, min: 1, max: 1 },
        {
          name: "preset select",
          loc: control(
            page,
            tool.root,
            tool.presetName
              ? { role: "combobox", name: tool.presetName }
              : PRESET,
          ),
          min: 1,
          max: 1,
        },
        ...tool.controls.map((c) => ({
          name: `control ${controlLabel(c)}`,
          loc: control(page, tool.root, c),
          min: c.optional ? 0 : 1,
          max: 1,
        })),
        { name: "frame part", sel: gate("frame"), min: 1 },
        ...(tool.track
          ? [{ name: "track part", sel: gate(tool.track), min: 1 }]
          : []),
      ];
      miss.push(...(await resolveMisses(page, asks)));
      missed += miss.length;
      console.log(
        `${miss.length ? "FAIL" : "ok  "} resolve /tools/${tool.slug}/`,
      );
      for (const m of miss) console.log(`       ${m}`);
    }
    await browser.close();
    process.exit(missed ? 1 : 0);
  }
  for (const name of BROWSERS) {
    const browser = await ENGINES[name].launch();
    const variants = [
      ...WIDTHS.map((w) => ({ viewport: w, root: null })),
      ...EXTRA_WIDTHS.map((w) => ({ viewport: w, root: null, extra: true })),
      ...FORCED_ROOTS.map((w) => ({ viewport: 1440, root: w })),
    ];
    for (const v of variants) {
      const context = await browser.newContext({
        viewport: { width: v.viewport, height: 900 },
      });
      await blockOffSite(context, BASE);
      await context.addInitScript({ content: identityScript() });
      const page = await context.newPage();
      for (const tool of tools) {
        if (v.extra && !tool.extraWidths?.includes(v.viewport)) continue;
        const where = `${name} ${v.root ? `root${v.root}` : v.viewport} ${tool.slug}`;
        currentWidget = `widget:${/data-widget="([^"]+)"/.exec(tool.root)?.[1] ?? tool.slug}`;
        current = {
          page: `/tools/${tool.slug}/`,
          browser: name,
          width: v.root ?? v.viewport,
        };
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
        cells++;
        await page.addStyleTag({
          content:
            "header, .header, starlight-menu-button, .sl-banner, mobile-starlight-toc { display: none !important; }" +
            (v.root
              ? `${tool.root}{width:${v.root}px!important;max-width:${v.root}px!important}`
              : ""),
        });
        for (const preset of tool.presets) {
          await control(
            page,
            tool.root,
            tool.presetName
              ? { role: "combobox", name: tool.presetName }
              : PRESET,
          ).selectOption(preset);
          await page.waitForTimeout(1500);
          await settled(page, tool.root);
          if (preset === tool.presets[0]) {
            const absent = await namedPartsAbsent(page, tool);
            if (absent.length) {
              fail(
                where,
                `the row names parts the widget does not draw: ${absent.join(", ")}`,
              );
            }
          }
          for (const spec of tool.controls) {
            const { optional, requiredIn, step, value: field } = spec;
            const ctl = control(page, tool.root, spec);
            // A hidden control is not in the accessibility tree, so it does not match.
            const visible =
              (await ctl.count()) > 0 && (await ctl.first().isVisible());
            const isHandle = visible
              ? await ctl.evaluate((el) => el.tagName !== "INPUT")
              : false;
            const id = `${where} ${preset} ${controlLabel(spec)}`;
            const presence = controlPresence({
              visible,
              optional: optional && !requiredIn?.includes(preset),
              id,
            });
            for (const message of presence.problems) fail(id, message);
            if (!presence.proceed) continue;
            const result = { keyboard: 0, pointer: 0, problems: [] };
            const check = async (step, base, pressed = false) => {
              const now = await snapshot(page, ctl, tool);
              for (const p of diffSnapshots(base, now, isHandle, pressed)) {
                result.problems.push(`${step}: ${p}`);
              }
            };

            if (step) {
              // A number field: step it up and back down, one key at a time.
              await ctl.focus();
              const base = await snapshot(page, ctl, tool);
              const start = await valueOf(page, tool.root, ctl, field);
              const seen = { up: [], down: [] };
              for (const key of ["ArrowUp", "ArrowDown"]) {
                for (let i = 0; i < step; i++) {
                  await page.keyboard.press(key);
                  await page.waitForTimeout(40);
                  const value = await valueOf(page, tool.root, ctl, field);
                  const now = await snapshot(page, ctl, tool);
                  for (const p of diffSnapshots(base, now, false)) {
                    result.problems.push(
                      `${key} #${i + 1} (value ${value}): ${p}`,
                    );
                  }
                  result.keyboard++;
                  seen[key === "ArrowUp" ? "up" : "down"].push(value);
                }
              }
              if (!seen.up.some((v) => v !== start)) {
                result.problems.push(
                  `ArrowUp never moved the value off ${start}`,
                );
              }
              const end = seen.up[seen.up.length - 1];
              if (!seen.down.some((v) => v !== end)) {
                result.problems.push(
                  `ArrowDown never moved the value off ${end}`,
                );
              }
              const ok = result.problems.length === 0;
              if (!ok) failures++;
              summary.push({ id, ...result, ok });
              recordDragFindings(result, controlLabel(spec));
              console.log(
                `${ok ? "ok  " : "FAIL"} ${id}: ${result.keyboard} keyboard steps, ${result.pointer} pointer steps` +
                  (ok ? "" : `, ${result.problems.length} problem(s)`),
              );
              for (const p of result.problems.slice(0, ALL ? undefined : 6)) {
                console.log(`       ${p}`);
              }
              continue;
            }

            const maxKeys = tool.maxKeys ?? MAX_KEYS;

            // Keyboard: the whole range, there and back.
            await ctl.focus();
            await page.keyboard.press("Home");
            const base = await snapshot(page, ctl, tool);
            const homeValue = await valueOf(page, tool.root, ctl, field);
            const seen = { up: [], down: [] };
            for (const key of ["PageUp", "PageDown"]) {
              let last = await valueOf(page, tool.root, ctl, field);
              for (let i = 0; i < maxKeys; i++) {
                await page.keyboard.press(key);
                const value = await valueOf(page, tool.root, ctl, field);
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
              const box = await ctl.evaluate(
                (el, t) => {
                  const c = el.getBoundingClientRect();
                  const tr = (
                    t ? el.closest("[data-widget]").querySelector(t) : el
                  ).getBoundingClientRect();
                  return {
                    x: c.left + c.width / 2,
                    y: c.top + c.height / 2,
                    left: tr.left,
                    right: tr.right,
                  };
                },
                tool.track ? gate(tool.track) : null,
              );
              const startX = isHandle ? box.x : box.left + 8;
              const pointerStart = await valueOf(page, tool.root, ctl, field);
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
                far: await valueOf(page, tool.root, ctl, field),
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
            recordDragFindings(result, controlLabel(spec));
            console.log(
              `${ok ? "ok  " : "FAIL"} ${id}: ${result.keyboard} keyboard steps, ${result.pointer} pointer steps` +
                (ok ? "" : `, ${result.problems.length} problem(s)`),
            );
            if (ALL) {
              const seen = new Set();
              for (const p of result.problems) {
                const key = p.replace(/^[^:]*: /, "").split(": {")[0];
                if (seen.has(key)) continue;
                seen.add(key);
                console.log(`       ${p}`);
              }
            } else {
              for (const p of result.problems.slice(0, 6))
                console.log(`       ${p}`);
            }
            if (!ALL && result.problems.length > 6) {
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
  recordMeasured(GATE, cells);
  process.exit(failures === 0 && !empty ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
