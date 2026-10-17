/**
 * The GNSS Rollover Checker, mountable on its tool page and in the chat rail.
 *
 * A week counter wraps, and a receiver whose firmware fixes the era (or counts
 * from a build date) starts reporting a date one counter period early once the
 * real clock passes the end of its window. Out come the date the receiver
 * reports, the date it goes wrong from, the time left, and the next wrap of
 * every counter:
 *
 * 1. the controls (the counter, how the firmware counts, today or a date);
 * 2. three plates over the firmware's window, drawn as a fuse timeline with the
 *    check date, the wraps and the date it goes wrong marked on it;
 * 3. the table of every counter's next wrap, always eight rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant and duration comes from
 * `readRollover` (gnss-rollover-checker.ts), which calls the library; the fuse
 * timeline only places what those calls returned. The one clock the mount reads
 * is the reader's own, once a second and only in Today mode, after mount.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root. The one drag handle is a native range, and
 * the date field is its typed equivalent.
 */
import { Temporal } from "@js-temporal/polyfill";
import { codeFrameHtml } from "./code-frame";
import { renderCallResults, renderCalls } from "./edi-render";
import {
  asideSizer,
  callSizer,
  holdHtml,
  outputSizer,
  textSizers,
} from "./edi-picture";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { GNSS_WEEK_COUNTERS, type GnssWeekCounter } from "./gnss-names";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  FIRMWARE_MODELS,
  FIRMWARE_MODEL_LABELS,
  MAX_VALUE_LENGTH,
  NOW_MODE_LABELS,
  NO_RESULT_TEXT,
  EMPTY_TEXTS,
  RIGHT_DATE_TEXT,
  ROLLING_DATE_TEXT,
  ROLLOVER_LINKS,
  ROLLOVER_SENTENCES,
  ROLLOVER_NOW_MODES,
  ROLLOVER_PRESETS,
  dateOfDay,
  dayOfDate,
  fuseYears,
  isSeeded,
  markSentence,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readRollover,
  rolloverHandoffs,
  stripAria,
  summaryText,
  verdictBadgeText,
  windowDays,
  type Countdown,
  type FirmwareModel,
  type Fuse,
  type GnssRolloverCheckerArgs,
  type Mark,
  type RolloverRead,
  type RolloverState,
  type WrapRow,
} from "./gnss-rollover-checker";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { heroLinesHtml, setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  setToolLink,
  syncRange,
  toolLinksHtml,
  wireCopyButtons,
  wrapInstantsAtT,
} from "./widget-ui";

export type { GnssRolloverCheckerArgs } from "./gnss-rollover-checker";

const NBSP = "&nbsp;";

/** The most lines the call frame and its result ever print: the most calls any
 *  firmware, counter and date makes (one per counter-step plus the reading's
 *  own), measured over every preset and every stop of the date slider. Both
 *  regions reserve it, so the frame holds one height from the first paint. */
const CALL_LINES = 34;

const CALL_SIZER = Array.from(
  { length: CALL_LINES },
  () =>
    'gnssWeekToUtc("galileo", 1024, 0, { notBefore: "2024-01-01T00:00:00Z" })',
).join("\n");

/** The widest line a result prints is the decoded counter object, which wraps in
 *  a narrow frame; the twin wraps the same way, so it is as tall. */
const OUTPUT_SIZER = Array.from(
  { length: CALL_LINES },
  () => "{ week: 1023, timeOfWeekSeconds: 604799, era: 3 }",
).join("\n");

/** The longest sentences the rolling-row hint and the reason aside can show. */
const ROLLING_SIZERS = [
  "rolling reads 2007-03-01T00:00:04Z, a date 7167 days 23 h 59 min 56 s early",
  ROLLING_DATE_TEXT,
  NO_RESULT_TEXT,
  RIGHT_DATE_TEXT,
];

const REASON_SIZERS = Object.values(ROLLOVER_SENTENCES);

const TABLE_COLUMNS = ["Counter", "Width", "Next wrap", "Time left"] as const;

/** The chips under the fuse timeline: a build date or era start, up to two wraps, the
 *  date it goes wrong, and the check date. The slots are always drawn. */
const CHIP_SLOTS = 5;

/** The ordinal a radio group's `name` takes, so two checkers on one page never share it. */
let instances = 0;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    ROLLOVER_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function radiosHtml<T extends string>(
  group: string,
  prefix: string,
  values: readonly T[],
  labels: Record<T, string>,
  checked: T,
): string {
  return values
    .map((v) =>
      chipToggleHtml({
        type: "radio",
        name: `${group}-${prefix}`,
        role: `${prefix}-${v}`,
        value: v,
        label: labels[v],
        checked: v === checked,
      }),
    )
    .join("");
}

/** A cell's two lines, text escaped; an empty line keeps its height. */
function linesHtml(first: string, second: string): string {
  const line = (text: string, sub: boolean) =>
    `<span class="gmt-clock-line${sub ? " gmt-clock-sub" : ""}">${text === "" ? NBSP : escapeHtml(text)}</span>`;
  return line(first, false) + line(second, true);
}

/** One table row, empty. Every cell holds two lines so a row never changes height. */
function blankRowHtml(counter: GnssWeekCounter): string {
  return (
    `<tr role="row" data-row="${escapeAttr(counter)}">` +
    `<th role="rowheader" data-label="Counter">${linesHtml(counter, "")}</th>` +
    TABLE_COLUMNS.slice(1)
      .map(
        (c) =>
          `<td role="cell" data-label="${escapeAttr(c)}">${linesHtml("", "")}</td>`,
      )
      .join("") +
    `</tr>`
  );
}

function rowHtml(row: WrapRow): string {
  const tags = [
    ...(row.yours ? ["your receiver"] : []),
    ...(row.soonest ? ["next to wrap"] : []),
  ];
  return (
    `<tr role="row" data-row="${escapeAttr(row.counter)}"${row.yours ? ' data-reading data-series="1"' : ""}>` +
    `<th role="rowheader" data-label="Counter">${linesHtml(row.counter, tags.join(" · "))}</th>` +
    `<td role="cell" data-label="Width">${linesHtml(row.none ? "" : row.width, "")}</td>` +
    `<td role="cell" data-label="Next wrap">${linesHtml(row.none ? NO_RESULT_TEXT : row.nextWrap, "")}</td>` +
    `<td role="cell" data-label="Time left">${linesHtml(row.none ? "" : row.left, "")}</td>` +
    `</tr>`
  );
}

/** How many counters each width group holds in the server-rendered skeleton:
 *  the 10-bit, the 12-bit and the 13-bit counters. The mount replaces the
 *  skeleton with the library's own grouping, so the page keeps its height. */
const SKELETON_ROWS = [3, 1, 4] as const;

const pad2 = (n: number): string => String(n).padStart(2, "0");

const clampPct = (n: number): number => Math.min(100, Math.max(0, n));

/** One track: the stretch before the counter's first week, then its wraps. */
function trackHtml(counter: string, born: number, ticksHtml: string): string {
  return (
    `<div class="gmt-fuse-row" data-counter="${escapeAttr(counter)}">` +
    `<span class="gmt-gnss-label gmt-fuse-name">${counter === "" ? NBSP : escapeHtml(counter)}</span>` +
    `<div class="gmt-fuse-track" data-role="strip-track">` +
    `<i class="gmt-fuse-pre" style="--to:${born}%"></i>` +
    `<span class="gmt-fuse-ticks">${ticksHtml}</span>` +
    `</div></div>`
  );
}

function ticksOf(track: Fuse["groups"][number]["tracks"][number]): string {
  return track.wraps
    .map(
      (w) =>
        `<i class="gmt-fuse-tick" data-state="${w.state}" style="--at:${w.pos}%"></i>`,
    )
    .join("");
}

/** The rows of the board, from the library's grouping, or the skeleton. */
function boardRowsHtml(fuse: Fuse | null): string {
  if (fuse === null) {
    return SKELETON_ROWS.map(
      (n) =>
        `<div class="gmt-fuse-head">${NBSP}</div>` +
        Array.from({ length: n }, () => trackHtml("", 0, "")).join(""),
    ).join("");
  }
  return fuse.groups
    .map(
      (g) =>
        `<div class="gmt-fuse-head">${escapeHtml(g.label)}</div>` +
        g.tracks.map((t) => trackHtml(t.counter, t.born, ticksOf(t))).join(""),
    )
    .join("");
}

function axisHtml(): string {
  return fuseYears()
    .map(
      (y) =>
        `<span class="gmt-fuse-year"${y.major ? " data-major" : ""} style="--at:${y.pos}%">${y.year}</span>`,
    )
    .join("");
}

function gridHtml(): string {
  return fuseYears()
    .map((y) => `<i class="gmt-fuse-gridline" style="--at:${y.pos}%"></i>`)
    .join("");
}

/** The large countdown: days, hours, minutes and seconds as fixed cells, with
 *  the library's own words kept as text for a reader who cannot see them. */
function countdownHtml(read: RolloverRead | null): string {
  const c: Countdown | null = read?.countdown ?? null;
  const empty = c === null || read === null;
  const cell = (value: string, unit: string) =>
    `<span class="gmt-fuse-cell" data-unit="${unit}"><b>${value}</b><i>${unit}</i></span>`;
  const digits = empty
    ? ""
    : `<span class="gmt-fuse-digits">` +
      cell(String(c.days), "days") +
      cell(pad2(c.hours), "h") +
      cell(pad2(c.minutes), "min") +
      cell(pad2(c.seconds), "s") +
      `</span>`;
  const line = read?.plates[2]?.lines[0] ?? "";
  return (
    `<div class="gmt-punct-hero gmt-fuse-count" data-role="hero-left" data-series="1"` +
    `${empty ? " data-empty" : ""}${c?.past ? " data-past" : ""} aria-hidden="true">` +
    `<span class="gmt-punct-hero-cap">${c?.past ? "Past by" : "Time left"}</span>` +
    `<span class="gmt-punct-hero-value">${empty ? `<span class="gmt-punct-hero-none">${escapeHtml(NO_RESULT_TEXT)}</span>` : escapeHtml(read.left ?? "")}</span>` +
    digits +
    heroLinesHtml([{ text: empty ? "" : line }]) +
    `</div>`
  );
}

const BADGE_ICONS =
  `<svg class="gmt-fuse-icon" data-for="right" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>` +
  `<svg class="gmt-fuse-icon" data-for="early" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3 3 8l5 5M13 3 8 8l5 5"/></svg>` +
  `<svg class="gmt-fuse-icon" data-for="late" viewBox="0 0 16 16" aria-hidden="true"><path d="m8 3 5 5-5 5M3 3l5 5-5 5"/></svg>`;

function chipSlotHtml(): string {
  return `<span class="gmt-cutoff-chip gmt-rollover-chip" data-role="strip-chip" data-blank>${NBSP}</span>`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, fuse timeline, rows and outputs are drawn
 * by `mount`, because they come from the real library calls.
 */
export function renderGnssRolloverCheckerTemplate(
  args: GnssRolloverCheckerArgs = {},
): string {
  const state: RolloverState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const presetId = matchPreset(state);
  const preset = ROLLOVER_PRESETS.find((p) => p.id === presetId);
  const group = `gnss-rollover-${++instances}`;
  // The fields the state shows, as `showFields` will decide: the server-rendered
  // form hides the rest, so mounting hides nothing and the form keeps its height.
  const date = state.nowMode === "date";
  const hid = (shown: boolean): string => (shown ? "" : " hidden");

  return (
    `<div class="gmt-gnss-rollover-checker gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The receiver
    `<div class="gmt-widget-section">` +
    `<h4>1. Describe the receiver</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      ROLLOVER_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Counter")}` +
    `<select class="gmt-select" data-role="counter">` +
    GNSS_WEEK_COUNTERS.map(
      (c) =>
        `<option value="${escapeAttr(c)}"${c === state.counter ? " selected" : ""}>${escapeHtml(c)}</option>`,
    ).join("") +
    `</select></label>` +
    `<fieldset class="gmt-chip-group gmt-field-wide" data-role="model-group"><legend class="gmt-label-text">How the firmware counts</legend>` +
    radiosHtml(
      group,
      "model",
      FIRMWARE_MODELS,
      FIRMWARE_MODEL_LABELS,
      state.model,
    ) +
    `</fieldset>` +
    `<label class="gmt-label gmt-field-wide" data-field="pivot"${hid(state.model === "pivot")}>${labelTextHtml("Built on or after (UTC instant)")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="pivot" value="${escapeAttr(state.pivot)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="era"${hid(state.model === "era")}>${labelTextHtml("Era the firmware assumes")}` +
    `<input class="gmt-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="era" value="${escapeAttr(state.era)}"></label>` +
    `<fieldset class="gmt-chip-group gmt-field-wide" data-role="now-group"><legend class="gmt-label-text">Check it on</legend>` +
    radiosHtml(
      group,
      "now",
      ROLLOVER_NOW_MODES,
      NOW_MODE_LABELS,
      state.nowMode,
    ) +
    `</fieldset>` +
    `<label class="gmt-label gmt-field-wide" data-field="date"${hid(date)}>${labelTextHtml("Date to check (UTC instant)")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="date" value="${escapeAttr(state.date)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="date-slider"${hid(date)}>${labelTextHtml("Slide the date through the firmware's window")}` +
    rangeFieldHtml({
      role: "date-slider",
      chipRole: "date-value",
      min: 0,
      max: 0,
      step: 1,
      value: 0,
      valueText: "2026-10-15T00:00:00Z",
      ends: [" ", " "],
    }) +
    `</label>` +
    `</div>` +
    `</div>` +
    // 2. The receiver's window
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Where the firmware goes wrong</h4>` +
    `<div class="gmt-gnss-frame gmt-fuse-frame" data-role="frame">` +
    `<div class="gmt-fuse-layout">` +
    `<div class="gmt-fuse-aside">` +
    countdownHtml(null) +
    `<p class="gmt-fuse-badge" data-role="verdict" data-verdict="none">${BADGE_ICONS}<span class="gmt-fuse-badge-text" data-role="verdict-text">${NBSP}</span></p>` +
    platesHtml("heroes", platesOf(null).slice(0, 2)) +
    `</div>` +
    `<div class="gmt-fuse" data-role="strip" role="img" aria-label="No window to draw">` +
    `<div class="gmt-fuse-axis">${axisHtml()}</div>` +
    `<div class="gmt-fuse-board" data-role="strip-board">` +
    `<div class="gmt-fuse-grid">${gridHtml()}</div>` +
    `<div class="gmt-fuse-rows" data-role="strip-rows">${boardRowsHtml(null)}</div>` +
    `<div class="gmt-fuse-pins">` +
    `<i class="gmt-gnss-today" data-role="strip-today" hidden></i>` +
    `<i class="gmt-fuse-pin" data-role="strip-pin" hidden><b class="gmt-cutoff-mark"></b></i>` +
    `</div>` +
    `<div class="gmt-fuse-park" data-role="strip-park" hidden>` +
    `<i class="gmt-gnss-span gmt-fuse-lit" data-role="strip-lit" hidden></i>` +
    `<i class="gmt-gnss-span gmt-gnss-hatch gmt-fuse-hatch" data-role="strip-hatch" hidden></i>` +
    `<i class="gmt-fuse-burn" data-role="strip-fuse" hidden></i>` +
    `<i class="gmt-fuse-spark" data-role="strip-spark" hidden><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2Z"/><circle r="2.2"/></svg></i>` +
    `</div>` +
    `</div>` +
    `<ul class="gmt-gnss-visually-hidden" data-role="strip-list"></ul>` +
    `</div>` +
    `<div class="gmt-rollover-key" data-role="strip-key">` +
    `<span data-role="strip-key-lit" hidden><i class="gmt-fuse-swatch" data-kind="lit"></i>reads the right date</span>` +
    `<span data-role="strip-key-hatch" hidden><i class="gmt-fuse-swatch" data-kind="hatch"></i>reports one counter period early</span>` +
    `<span><svg class="gmt-fuse-swatch" data-kind="spark" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2Z"/></svg>wrong from</span>` +
    `<span><i class="gmt-fuse-swatch" data-kind="next"></i>next wrap</span>` +
    `<span><i class="gmt-fuse-swatch" data-kind="pin"></i>check date</span>` +
    `<span><i class="gmt-fuse-swatch" data-kind="today"></i>today</span>` +
    `</div>` +
    `<div class="gmt-rollover-chips" data-role="strip-chips">${Array.from({ length: CHIP_SLOTS }, chipSlotHtml).join("")}</div>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    holdHtml(
      `<div data-role="reason-aside" data-grow="slot"></div>`,
      [
        ...REASON_SIZERS.map((t) => asideSizer(NO_RESULT_TITLE, [t])),
        ...textSizers("p", "gmt-widget-hint", Object.values(EMPTY_TEXTS)),
      ],
      "gmt-ledger-hold",
    ) +
    `</div>` +
    // 3. Every counter's next wrap
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. When each counter next wraps</h4>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="counters-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${TABLE_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="counters-body">${GNSS_WEEK_COUNTERS.map(blankRowHtml).join("")}</tbody>` +
    `</table></div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="rolling-row" data-grow="slot">${NBSP}</p>`,
      textSizers("p", "gmt-widget-hint", ROLLING_SIZERS),
      "gmt-ledger-hold",
    ) +
    `<p class="gmt-widget-hint">Time left is counted in whole days from the check date to each counter's next wrap.</p>` +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section">` +
    `<h4>4. What the library returns</h4>` +
    holdHtml(
      codeFrameHtml("rollover"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="rollover-output">${NBSP}</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(ROLLOVER_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): RolloverState;
  apply(state: RolloverState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** The reader's clock as a UTC instant to the second. */
const nowIso = (): string =>
  Temporal.Now.instant().toString({ smallestUnit: "second" });

function setupWidget(root: HTMLElement, lib: GnssLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];
  const field = (name: string) =>
    root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const presetEl = q<HTMLSelectElement>("preset")!;
  const counterEl = q<HTMLSelectElement>("counter")!;
  const pivotEl = q<HTMLInputElement>("pivot")!;
  const eraEl = q<HTMLInputElement>("era")!;
  const dateEl = q<HTMLInputElement>("date")!;
  const sliderEl = q<HTMLInputElement>("date-slider")!;
  const radios = (prefix: string) => [
    ...root.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][data-role^="${prefix}-"]`,
    ),
  ];

  let last: RolloverRead | null = null;
  let lastNow = "";
  let ticker: ReturnType<typeof setInterval> | null = null;

  const model = (): FirmwareModel =>
    (radios("model").find((e) => e.checked)?.value ?? "pivot") as FirmwareModel;
  const nowMode = (): RolloverState["nowMode"] =>
    (radios("now").find((e) => e.checked)?.value ??
      "today") as RolloverState["nowMode"];

  function readState(): RolloverState {
    return {
      counter: counterEl.value as GnssWeekCounter,
      model: model(),
      pivot: pivotEl.value,
      era: eraEl.value,
      nowMode: nowMode(),
      date: dateEl.value,
    };
  }

  function showFields(): void {
    const m = model();
    const date = nowMode() === "date";
    const shown: Record<string, boolean> = {
      pivot: m === "pivot",
      era: m === "era",
      date,
      "date-slider": date,
    };
    for (const [name, on] of Object.entries(shown)) {
      const el = field(name);
      if (el) el.hidden = !on;
    }
  }

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        ROLLOVER_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function apply(state: RolloverState): void {
    for (const e of radios("model")) e.checked = e.value === state.model;
    for (const e of radios("now")) e.checked = e.value === state.nowMode;
    setControlValue(counterEl, state.counter);
    setControlValue(pivotEl, state.pivot);
    setControlValue(eraEl, state.era);
    setControlValue(dateEl, state.date);
    showFields();
    syncTicker();
  }

  function drawPlates(read: RolloverRead): void {
    const heroes = q("heroes");
    if (heroes) {
      heroes.innerHTML = read.plates.slice(0, 2).map(plateHtml).join("");
      wrapInstantsAtT(heroes);
    }
    const count = q("hero-left");
    if (count)
      count.outerHTML = countdownHtml(read.status === "ok" ? read : null);

    const badge = q("verdict");
    const text = q("verdict-text");
    if (badge && text) {
      const words = verdictBadgeText(read);
      badge.setAttribute(
        "data-verdict",
        words === "" ? "none" : (read.verdict ?? "none"),
      );
      text.textContent =
        words !== ""
          ? words
          : read.status === "sentinel"
            ? NO_RESULT_TEXT
            : " ";
    }
  }

  let rowsKey = "";

  /** Builds the tracks once from the library's grouping, then only relabels
   *  the wraps (past, next, later) and the receiver's own track. */
  function drawFuse(read: RolloverRead): void {
    const fuse = read.fuse;
    const rowsEl = q("strip-rows");
    const park = q("strip-park");
    if (rowsEl === null || fuse === null) return;
    const key = fuse.groups
      .map((g) => g.tracks.map((t) => t.counter).join())
      .join("|");
    if (key !== rowsKey) {
      // The window's nodes live inside a track; park them before it is rebuilt.
      for (const role of [
        "strip-lit",
        "strip-hatch",
        "strip-fuse",
        "strip-spark",
      ]) {
        const node = q(role);
        if (node && park) park.append(node);
      }
      rowsEl.innerHTML = boardRowsHtml(fuse);
      rowsKey = key;
    }
    const rows = [...rowsEl.querySelectorAll<HTMLElement>(".gmt-fuse-row")];
    for (const track of fuse.groups.flatMap((g) => g.tracks)) {
      const row = rows.find((r) => r.dataset["counter"] === track.counter);
      if (!row) continue;
      row.toggleAttribute("data-yours", track.yours);
      const ticks = row.querySelector<HTMLElement>(".gmt-fuse-ticks");
      const html = ticksOf(track);
      if (ticks && ticks.dataset["sig"] !== html) {
        ticks.innerHTML = html;
        ticks.dataset["sig"] = html;
      }
    }
  }

  function drawStrip(read: RolloverRead): void {
    const strip = read.strip;
    const hide = (el: HTMLElement | null | undefined, hidden: boolean) => {
      if (el) el.hidden = hidden;
    };
    const lit = q("strip-lit");
    const hatch = q("strip-hatch");
    const burn = q("strip-fuse");
    const spark = q("strip-spark");
    const pin = q("strip-pin");
    const today = q("strip-today");
    const chips = qa("strip-chip");
    const list = q("strip-list");

    drawFuse(read);

    hide(pin, true);
    // The reader's clock is a mark of its own: in a date mode it shows where
    // now sits against the window, in Today mode it is the check itself.
    const todayAt = read.fuse?.today ?? null;
    hide(today, todayAt === null);
    if (today && todayAt !== null)
      today.style.setProperty("--at", `${todayAt}%`);
    for (const chip of chips) {
      chip.textContent = " ";
      chip.setAttribute("data-blank", "");
    }
    hide(q("strip-key-lit"), strip === null);
    hide(q("strip-key-hatch"), strip === null);

    const park = q("strip-park");
    if (strip === null) {
      for (const node of [lit, hatch, burn, spark]) {
        if (node && park) park.append(node);
        hide(node, true);
      }
      q("strip")?.setAttribute("aria-label", stripAria(read));
      if (list) list.innerHTML = "";
      return;
    }

    // The window lives on the receiver's own track.
    const track = [...root.querySelectorAll<HTMLElement>(".gmt-fuse-row")]
      .find((r) => r.dataset["counter"] === read.state.counter)
      ?.querySelector<HTMLElement>(".gmt-fuse-track");
    for (const node of [lit, hatch, burn, spark]) {
      if (node && track && node.parentElement !== track) track.append(node);
    }
    const { from, wrong, end } = strip.span;
    if (lit) {
      lit.hidden = wrong <= 0 || from >= 100;
      lit.style.setProperty("--from", `${clampPct(from)}%`);
      lit.style.setProperty("--to", `${clampPct(wrong)}%`);
    }
    if (hatch) {
      hatch.hidden = wrong >= 100 || end <= 0 || end <= wrong;
      hatch.style.setProperty("--from", `${clampPct(wrong)}%`);
      hatch.style.setProperty("--to", `${clampPct(end)}%`);
    }
    if (burn) {
      const f = strip.fuse;
      burn.hidden = f === null || f.to <= 0 || f.from >= 100;
      if (f) {
        burn.style.setProperty("--from", `${clampPct(f.from)}%`);
        burn.style.setProperty("--to", `${clampPct(f.to)}%`);
      }
    }
    if (spark) {
      spark.hidden = wrong < 0 || wrong > 100;
      spark.style.setProperty("--at", `${clampPct(wrong)}%`);
    }

    strip.marks.forEach((m: Mark, i) => {
      if (m.pos !== null && m.key === "check" && m.label !== "today" && pin) {
        pin.hidden = false;
        pin.style.setProperty("--at", `${m.pos}%`);
      }
      const chip = chips[i];
      if (chip) {
        chip.textContent = `${m.label} ${m.at}${m.pos === null ? " (outside)" : ""}`;
        chip.removeAttribute("data-blank");
      }
    });

    q("strip")?.setAttribute("aria-label", stripAria(read));
    if (list) {
      list.innerHTML = strip.marks
        .map((m) => `<li>${escapeHtml(markSentence(m))}</li>`)
        .join("");
    }
  }

  function drawTable(read: RolloverRead): void {
    const body = q("counters-body");
    if (body) {
      body.innerHTML =
        read.at === null
          ? GNSS_WEEK_COUNTERS.map(blankRowHtml).join("")
          : read.rows.map(rowHtml).join("");
    }
    const rolling = q("rolling-row");
    if (rolling) rolling.textContent = read.rolling === "" ? " " : read.rolling;
  }

  /** The slider spans the firmware's window by day, and is live only when a
   *  date is being checked. It follows the date only when it is a whole-day stop. */
  function drawSlider(read: RolloverRead): void {
    const days = windowDays(lib, read);
    const usable = nowMode() === "date" && days !== null && days > 0;
    sliderEl.disabled = !usable;
    sliderEl.max = String(days ?? 0);
    const ends = root.querySelector<HTMLElement>(".gmt-range-ends");
    if (ends?.firstElementChild && ends.lastElementChild) {
      ends.firstElementChild.textContent =
        read.strip?.start.slice(0, 10) ?? " ";
      ends.lastElementChild.textContent = read.strip?.end.slice(0, 10) ?? " ";
    }
    const day = dayOfDate(lib, read, dateEl.value);
    if (day !== null && days !== null && day <= days) {
      sliderEl.value = String(day);
    }
    syncRange(sliderEl, dateEl.value.trim() || (read.strip?.start ?? ""));
  }

  function render(): void {
    showFields();
    const state = readState();
    lastNow = nowIso();
    const read = readRollover(lib, state, lastNow);
    last = read;

    drawPlates(read);
    drawStrip(read);
    drawTable(read);
    drawSlider(read);

    const calls = [...read.calls.reading, ...read.calls.counters];
    renderCalls(q("call-rollover"), calls);
    const out = q("rollover-output");
    if (out) {
      if (read.status === "empty") renderWidgetOutput(out, " ", "empty");
      else renderCallResults(out, calls, read.status === "sentinel");
    }

    const summary = q("summary");
    if (summary) {
      // Today mode ticks every second: the live region holds only what stays
      // true between ticks, and is written only when that sentence changes, so
      // a screen reader is not read the clock once a second.
      const spoken =
        read.status === "ok" && read.reported !== null && todayMode()
          ? `Today, a ${read.state.counter} receiver reports ${read.verdictText}. It goes wrong from ${read.wrongFrom}.`
          : summaryText(read);
      if (summary.textContent !== spoken) summary.textContent = spoken;
    }
    setToolLink(q("link-eras"), handoffHref(rolloverHandoffs(read).eras));
    const aside = q("reason-aside");
    if (aside) {
      if (read.status === "sentinel") {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(read.failure ?? "")}</p>`,
        );
      } else if (read.status === "empty") {
        aside.innerHTML = `<p class="gmt-widget-hint">${escapeHtml(read.emptyText ?? "")}</p>`;
      } else {
        aside.innerHTML = "";
      }
    }
  }

  const todayMode = () => nowMode() === "today";

  /** The clock runs only in Today mode; in a date mode nothing ticks. */
  function syncTicker(): void {
    const today = nowMode() === "today";
    if (today && ticker === null) {
      ticker = setInterval(() => {
        if (nowIso() !== lastNow) render();
      }, 1000);
    } else if (!today && ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  let shownNow = nowMode();

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target === sliderEl) {
      if (last !== null) {
        const date = dateOfDay(lib, last, Number(sliderEl.value));
        if (date !== "") setControlValue(dateEl, date);
      }
      syncPreset();
      render();
      return;
    }
    if (target === pivotEl || target === eraEl || target === dateEl) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      const preset = ROLLOVER_PRESETS.find((p) => p.id === presetEl.value);
      if (!preset) return;
      apply(presetState(preset));
      shownNow = nowMode();
      syncPreset();
      render();
      return;
    }
    if (target instanceof HTMLInputElement && target.type === "radio") {
      // Switching to a date carries the moment being watched into the field.
      if (
        shownNow === "today" &&
        nowMode() === "date" &&
        last?.at != null &&
        last.state.nowMode === "today"
      ) {
        setControlValue(dateEl, last.at);
      }
      shownNow = nowMode();
      showFields();
      syncTicker();
      syncPreset();
      render();
      return;
    }
    if (target === counterEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  showFields();
  syncTicker();
  syncPreset();
  render();

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: () => {
      if (ticker !== null) clearInterval(ticker);
      ticker = null;
    },
  };
}

export const mountGnssRolloverChecker: MountFn<
  GnssRolloverCheckerArgs
> = async (root, args, signal) => {
  let lib: GnssLib;
  try {
    lib = await loadGnssLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
