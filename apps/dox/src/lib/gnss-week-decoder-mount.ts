/**
 * The GNSS Week Decoder, mountable on its tool page and in the chat rail.
 *
 * A broadcast week number, a RINEX week or a UTC instant goes in. Out come the
 * UTC instant, the reading's era and the same moment on every counter:
 *
 * 1. the controls (a mode, a counter or system, the week, time of week and era);
 * 2. three plates (UTC, the system's own clock and its lead, the RINEX week)
 *    over an odometer ring: the counter's weeks round a circle, one lap for
 *    each era it has had, a hand at the reading's week and each lap's date in
 *    the legend beside it. A RINEX week does not wrap, so it is drawn as an
 *    unwrapped track of rows instead;
 * 3. two tables, the moment on every broadcast counter and every RINEX system;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant, week, era and lead comes from
 * `readGnss` (gnss-week-decoder.ts), which calls the library; the lanes only
 * place what those calls returned.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown apart from the width observer. There is no drag handle: the
 * controls are typed fields, selects and two ranges (the week and the time of
 * week), each tied two ways to its typed field, and the plates, the lanes (four
 * slots) and both tables keep their boxes from one reading to the next.
 */
import { Temporal } from "@js-temporal/polyfill";
import { codeFrameHtml } from "./code-frame";
import {
  asideSizer,
  callSizer,
  holdHtml,
  outputSizer,
  textSizers,
} from "./edi-picture";
import { renderCallResults, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import {
  GNSS_DECODER_MODES,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
  type GnssDecoderMode,
  type GnssWeekCounter,
  type RinexWeekSystem,
} from "./gnss-names";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import {
  BEFORE_FIRST_WEEK_NOTE,
  CUSTOM_PRESET_ID,
  DECODER_LINKS,
  ERA_MODES,
  ERA_MODE_LABELS,
  GNSS_PRESETS,
  GNSS_SENTENCES,
  MODE_LABELS,
  NO_RESULT_TEXT,
  decoderHandoffs,
  SECONDS_PER_WEEK,
  isSeeded,
  LANE_WINDOW,
  lanesAria,
  lastWeekOf,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readGnss,
  summaryText,
  type EraMode,
  type GnssDecoderState,
  type GnssRead,
  type GnssWeekDecoderArgs,
  type Lane,
} from "./gnss-week-decoder";
import { beforeFirstWeekText, counterSystem } from "./gnss-widgets";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
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

export type { GnssWeekDecoderArgs } from "./gnss-week-decoder";

/** Era lanes the frame reserves. `readGnss` never draws more, and cuts a longer
 *  list to a window that holds the reading's era, so the frame keeps one height. */
const LANE_SLOTS = LANE_WINDOW;

const NBSP = "&nbsp;";

/** The most lines the call frame and its result ever print: one call per counter
 *  step, per RINEX system and the reading's own, measured over every preset and
 *  mode. Both regions reserve it, so they hold one height from the first paint. */
const CALL_LINES = 24;

const CALL_SIZER = Array.from(
  { length: CALL_LINES },
  () => 'utcToGnssWeek("GPS-LNAV", "2024-01-01T00:00:00.123456789Z")',
).join("\n");

/** The widest result line is the decoded counter object, which wraps in a
 *  narrow frame; the twin wraps the same way, so it is as tall. */
const OUTPUT_SIZER = Array.from(
  { length: CALL_LINES },
  () => "{ week: 392, timeOfWeekSeconds: 510281.370063161, era: 2 }",
).join("\n");

/** The longest footnote: a reading before the system's first week. */
const FOOTNOTE_SIZERS = [`No reading: ${BEFORE_FIRST_WEEK_NOTE}.`];

/** Every sentence the reason aside can show. */
const REASON_SIZERS = [
  ...Object.values(GNSS_SENTENCES),
  beforeFirstWeekText("1999-08-22T00:00:00Z"),
];

/** The ordinal a radio group's `name` takes, so two decoders on one page never share it. */
let instances = 0;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    GNSS_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function optionsHtml(
  values: readonly string[],
  selected: string,
  label: (v: string) => string = (v) => v,
): string {
  return values
    .map(
      (v) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(label(v))}</option>`,
    )
    .join("");
}

const COUNTER_COLUMNS = ["Counter", "Week", "Time of week (s)", "Era"] as const;
const RINEX_COLUMNS = ["System", "Week", "Time of week (s)"] as const;

function blankCells(columns: readonly string[]): string {
  return columns
    .map((c) => `<td role="cell" data-label="${escapeAttr(c)}">&nbsp;</td>`)
    .join("");
}

// ---------------------------------------------------------------------------
// The odometer ring
// ---------------------------------------------------------------------------

/** The ring's drawing space: a square, centre `RING_C`. Lap radii run outside
 *  in, so era 0 is the outer lap; the tick ring and its labels sit outside them. */
const RING_C = 170;
const RING_RADII = [112, 94, 76, 58] as const;
/** The plate under a lap's era label: room for the longest label at 13px mono. */
const ERA_PLATE_W = 52;
const TICK_FROM = 122;
const LABEL_AT = 151;
/** Ticks round the ring: a minor tick every 1/32 of the modulus, a labelled one every 1/8. */
const RING_TICKS = 32;
const RING_LABEL_EVERY = 4;

const at = (turns: number, r: number): [number, number] => [
  RING_C + r * Math.sin(turns * 2 * Math.PI),
  RING_C - r * Math.cos(turns * 2 * Math.PI),
];
const f1 = (n: number) => n.toFixed(1);

/** The tick marks and week labels for a counter of `modulus` weeks. The labels
 *  are the modulus divided evenly, a drawing and not a library calculation. */
function ringTicksHtml(modulus: number): string {
  let out = "";
  for (let k = 0; k < RING_TICKS; k++) {
    const major = k % RING_LABEL_EVERY === 0;
    const [x1, y1] = at(k / RING_TICKS, TICK_FROM);
    const [x2, y2] = at(k / RING_TICKS, TICK_FROM + (major ? 9 : 5));
    out += `<line class="gmt-ring-tick"${major ? " data-major" : ""} x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`;
    if (major) {
      const [lx, ly] = at(k / RING_TICKS, LABEL_AT);
      out += `<text class="gmt-ring-tick-label" x="${f1(lx)}" y="${f1(ly + 3.5)}" text-anchor="middle">${Math.round((k / RING_TICKS) * modulus)}</text>`;
    }
  }
  return out;
}

function ringHtml(): string {
  const c = RING_C;
  const laps = RING_RADII.map(
    (r, i) =>
      `<g class="gmt-ring-lap" data-role="ring-lap" data-slot="${i}" hidden>` +
      `<circle class="gmt-ring-track" cx="${c}" cy="${c}" r="${r}"/>` +
      `<circle class="gmt-ring-fill" cx="${c}" cy="${c}" r="${r}" pathLength="100" transform="rotate(-90 ${c} ${c})"/>` +
      `<g class="gmt-ring-spin" data-role="ring-today" hidden><line class="gmt-ring-today" x1="${c}" y1="${c - r - 8}" x2="${c}" y2="${c - r + 8}"/></g>` +
      `<g class="gmt-ring-spin" data-role="ring-dot"><circle class="gmt-ring-dot" cx="${c}" cy="${c - r}" r="5.5"/></g>` +
      // The label sits on a plate of the card's own surface, so its pixels are
      // read against one flat colour and never against the lap's stroke.
      `<rect class="gmt-ring-era-plate" data-role="ring-era-plate" x="${c - 8 - ERA_PLATE_W}" y="${c - r - 9}" width="${ERA_PLATE_W + 4}" height="18" rx="3" hidden/>` +
      `<text class="gmt-ring-era" data-role="ring-era" x="${c - 8}" y="${c - r + 4.5}" text-anchor="end"> </text>` +
      `</g>`,
  ).join("");
  return (
    `<div class="gmt-gnss-ring" data-role="ring" data-state="idle" aria-hidden="true">` +
    `<svg viewBox="0 0 ${2 * c} ${2 * c}" focusable="false">` +
    `<g data-role="ring-ticks">${ringTicksHtml(1024)}</g>` +
    `<g class="gmt-ring-spin gmt-ring-hand" data-role="ring-hand" data-series="1"><line x1="${c}" y1="${c - 50}" x2="${c}" y2="${c - RING_RADII[0] - 9}"/></g>` +
    laps +
    `<g class="gmt-ring-hub">` +
    `<text class="gmt-ring-cap" data-role="ring-cap" x="${c}" y="${c - 16}" text-anchor="middle">WEEK</text>` +
    `<text class="gmt-ring-week" data-role="ring-week" x="${c}" y="${c + 10}" text-anchor="middle">-</text>` +
    `<text class="gmt-ring-sub" data-role="ring-sub" x="${c}" y="${c + 28}" text-anchor="middle"> </text>` +
    `</g>` +
    `</svg></div>`
  );
}

function laneSlotHtml(index: number): string {
  return (
    `<div class="gmt-gnss-laneset" data-role="laneset" data-slot="${index}" data-blank>` +
    `<div class="gmt-gnss-lane" data-role="lane" data-empty>` +
    `<span class="gmt-gnss-label" data-role="lane-label">&nbsp;</span>` +
    `<div class="gmt-gnss-track" data-role="lane-track">` +
    `<i class="gmt-gnss-today" data-role="lane-today" hidden></i>` +
    `<i class="gmt-cutoff-mark" data-role="lane-pin"></i>` +
    `</div>` +
    `<span class="gmt-cutoff-chip gmt-gnss-value" data-role="lane-value">&nbsp;</span>` +
    `</div>` +
    `<div class="gmt-gnss-flags" data-role="lane-flags"></div>` +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, lanes, tables and outputs are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderGnssWeekDecoderTemplate(
  args: GnssWeekDecoderArgs = {},
): string {
  const state: GnssDecoderState = isSeeded(args)
    ? readArgs(args)
    : presetState(GNSS_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = GNSS_PRESETS.find((p) => p.id === presetId);
  const group = `gnss-decoder-mode-${++instances}`;
  const shown = shownFields(state.mode, state.eraMode);

  return (
    `<div class="gmt-gnss-week-decoder gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The reading
    `<div class="gmt-widget-section">` +
    `<h4>1. Say which week you have</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      GNSS_PRESETS.map((p) => p.description),
    ) +
    `<fieldset class="gmt-chip-group" data-role="mode-group"><legend class="gmt-label-text">What you have</legend>` +
    GNSS_DECODER_MODES.map((m) =>
      chipToggleHtml({
        type: "radio",
        name: group,
        role: `mode-${m}`,
        value: m,
        label: MODE_LABELS[m],
        checked: m === state.mode,
      }),
    ).join("") +
    `</fieldset>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label" data-field="counter"${hiddenAttr(shown, "counter")}>${labelTextHtml("Counter")}` +
    `<select class="gmt-select" data-role="counter">` +
    `<option value=""${state.counter === "" ? " selected" : ""}>(none)</option>` +
    optionsHtml(GNSS_WEEK_COUNTERS, state.counter) +
    `</select></label>` +
    `<label class="gmt-label" data-field="system"${hiddenAttr(shown, "system")}>${labelTextHtml("RINEX system")}` +
    `<select class="gmt-select" data-role="system">${optionsHtml(RINEX_WEEK_SYSTEMS, state.system)}</select></label>` +
    `<label class="gmt-label" data-field="week"${hiddenAttr(shown, "week")}>${labelTextHtml("Week")}` +
    `<input class="gmt-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-role="week" value="${escapeAttr(state.week)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="week-slider"${hiddenAttr(shown, "week-slider")}>${labelTextHtml("Slide the week")}` +
    rangeFieldHtml({
      role: "week-slider",
      chipRole: "week-value",
      min: 0,
      max: 0,
      step: 1,
      value: 0,
      valueText: "week 0",
      ends: ["0", " "],
    }) +
    `</label>` +
    `<label class="gmt-label" data-field="tow"${hiddenAttr(shown, "tow")}>${labelTextHtml("Time of week (seconds)")}` +
    `<input class="gmt-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-role="tow" value="${escapeAttr(state.timeOfWeekSeconds)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="tow-slider"${hiddenAttr(shown, "tow-slider")}>${labelTextHtml("Slide the time of week")}` +
    rangeFieldHtml({
      role: "tow-slider",
      chipRole: "tow-value",
      min: 0,
      max: SECONDS_PER_WEEK - 1,
      step: 1,
      value: 0,
      valueText: "0 s",
      ends: ["0", String(SECONDS_PER_WEEK - 1)],
    }) +
    `</label>` +
    `<label class="gmt-label" data-field="era-mode"${hiddenAttr(shown, "era-mode")}>${labelTextHtml("Which era")}` +
    `<select class="gmt-select" data-role="era-mode">${optionsHtml(ERA_MODES, state.eraMode, (v) => ERA_MODE_LABELS[v as EraMode])}</select></label>` +
    `<label class="gmt-label" data-field="era"${hiddenAttr(shown, "era")}>${labelTextHtml("Era number")}` +
    `<input class="gmt-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-role="era" value="${escapeAttr(state.era)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="pivot"${hiddenAttr(shown, "pivot")}>${labelTextHtml("On or after (UTC instant)")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" data-role="pivot" value="${escapeAttr(state.pivot)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="utc"${hiddenAttr(shown, "utc")}>${labelTextHtml("UTC instant")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" data-role="utc" value="${escapeAttr(state.utc)}"></label>` +
    `</div>` +
    `</div>` +
    // 2. The reading, on a lane for each era
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Read it</h4>` +
    `<div class="gmt-gnss-frame" data-role="frame">` +
    platesHtml("heroes", platesOf(null)) +
    `<div class="gmt-gnss-lanes" data-role="lanes" data-form="ring" role="img" aria-label="No counter to draw">` +
    ringHtml() +
    `<div class="gmt-gnss-legend" data-role="legend">` +
    Array.from({ length: LANE_SLOTS }, (_, i) => laneSlotHtml(i)).join("") +
    `<p class="gmt-widget-hint gmt-gnss-lanes-empty" data-role="lanes-empty" hidden></p>` +
    `</div>` +
    `<ul class="gmt-gnss-visually-hidden" data-role="lane-list"></ul>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    holdHtml(
      `<div data-role="reason-aside" data-grow="slot"></div>`,
      REASON_SIZERS.map((t) => asideSizer(NO_RESULT_TITLE, [t])),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    // 3. The same moment on every counter
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The same moment on every counter</h4>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="counter-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${COUNTER_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="counter-body">${GNSS_WEEK_COUNTERS.map(
      (c) =>
        `<tr role="row" data-row="${escapeAttr(c)}"><th role="rowheader" data-label="Counter">${escapeHtml(c)}</th>${blankCells(COUNTER_COLUMNS.slice(1))}</tr>`,
    ).join("")}</tbody>` +
    `</table></div>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="rinex-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${RINEX_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="rinex-body">${RINEX_WEEK_SYSTEMS.map(
      (s) =>
        `<tr role="row" data-row="${escapeAttr(s)}"><th role="rowheader" data-label="System">${escapeHtml(s)}</th>${blankCells(RINEX_COLUMNS.slice(1))}</tr>`,
    ).join("")}</tbody>` +
    `</table></div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="footnote" data-grow="slot">${NBSP}</p>`,
      textSizers("p", "gmt-widget-hint", FOOTNOTE_SIZERS),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section">` +
    `<h4>4. What the library returns</h4>` +
    holdHtml(
      codeFrameHtml("decoder"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="decoder-output">${NBSP}</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(DECODER_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): GnssDecoderState;
  apply(state: GnssDecoderState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** The fields each mode shows. */
const FIELDS: Record<GnssDecoderMode, readonly string[]> = {
  broadcast: [
    "counter",
    "week",
    "week-slider",
    "tow",
    "tow-slider",
    "era-mode",
    "era",
    "pivot",
  ],
  rinex: ["system", "week", "tow", "tow-slider"],
  utc: ["counter", "utc"],
};

/** The fields a state shows: the mode's, less the era number and the date it
 *  counts from, which follow the era choice. The server-rendered form uses the
 *  same set, so mounting hides nothing and the form keeps its height. */
function hiddenAttr(shown: Set<string>, name: string): string {
  return shown.has(name) ? "" : " hidden";
}

function shownFields(mode: GnssDecoderMode, eraMode: EraMode): Set<string> {
  const shown = new Set(FIELDS[mode]);
  if (mode === "broadcast") {
    if (eraMode !== "number") shown.delete("era");
    if (eraMode !== "notBefore") shown.delete("pivot");
  }
  return shown;
}

function setupWidget(root: HTMLElement, lib: GnssLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];
  const field = (name: string) =>
    root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const presetEl = q<HTMLSelectElement>("preset")!;
  const counterEl = q<HTMLSelectElement>("counter")!;
  const systemEl = q<HTMLSelectElement>("system")!;
  const weekEl = q<HTMLInputElement>("week")!;
  const towEl = q<HTMLInputElement>("tow")!;
  const weekSliderEl = q<HTMLInputElement>("week-slider")!;
  const towSliderEl = q<HTMLInputElement>("tow-slider")!;
  const eraModeEl = q<HTMLSelectElement>("era-mode")!;
  const eraEl = q<HTMLInputElement>("era")!;
  const pivotEl = q<HTMLInputElement>("pivot")!;
  const utcEl = q<HTMLInputElement>("utc")!;
  const modeEls = () => [
    ...root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  ];

  let last: GnssRead | null = null;

  function mode(): GnssDecoderMode {
    return (modeEls().find((e) => e.checked)?.value ??
      "broadcast") as GnssDecoderMode;
  }

  function readState(): GnssDecoderState {
    return {
      mode: mode(),
      counter: counterEl.value as GnssWeekCounter | "",
      system: systemEl.value as RinexWeekSystem,
      week: weekEl.value,
      timeOfWeekSeconds: towEl.value,
      eraMode: eraModeEl.value as EraMode,
      era: eraEl.value,
      pivot: pivotEl.value,
      utc: utcEl.value,
    };
  }

  /** Show the fields the mode reads; the era number and date follow the era choice. */
  function showFields(): void {
    const m = mode();
    const eraMode = eraModeEl.value as EraMode;
    const shown = shownFields(m, eraMode);
    for (const name of [
      "counter",
      "system",
      "week",
      "week-slider",
      "tow",
      "tow-slider",
      "era-mode",
      "era",
      "pivot",
      "utc",
    ]) {
      const el = field(name);
      if (el) el.hidden = !shown.has(name);
    }
  }

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        GNSS_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function apply(state: GnssDecoderState): void {
    for (const e of modeEls()) e.checked = e.value === state.mode;
    setControlValue(counterEl, state.counter);
    setControlValue(systemEl, state.system);
    setControlValue(weekEl, state.week);
    setControlValue(towEl, state.timeOfWeekSeconds);
    setControlValue(eraModeEl, state.eraMode);
    setControlValue(eraEl, state.era);
    setControlValue(pivotEl, state.pivot);
    setControlValue(utcEl, state.utc);
    showFields();
  }

  /** A whole number from 0 in the typed text, else `null`. */
  const whole = (text: string): number | null =>
    /^\d+$/.test(text.trim()) && Number.isSafeInteger(Number(text))
      ? Number(text)
      : null;

  /** Put a range's last-value label under its right end. */
  function setEnd(slider: HTMLInputElement, text: string): void {
    const ends = slider
      .closest(".gmt-range-field")
      ?.querySelector<HTMLElement>(".gmt-range-ends");
    if (ends?.lastElementChild) ends.lastElementChild.textContent = text;
  }

  /**
   * The ranges follow the typed fields. The week range ends at the counter's
   * last week (a library probe) and is live only in broadcast mode with a
   * counter; the time-of-week range is live whenever the mode reads one. A
   * typed value that is not a stop (a fraction, a blank, a week past the end)
   * leaves the range where it was.
   */
  function drawSliders(): void {
    const m = mode();
    const counter = counterEl.value as GnssWeekCounter | "";
    const last =
      m === "broadcast" && counter !== "" ? lastWeekOf(lib, counter) : null;
    weekSliderEl.disabled = last === null;
    weekSliderEl.max = String(last ?? 0);
    setEnd(weekSliderEl, last === null ? " " : String(last));
    const week = whole(weekEl.value);
    if (week !== null && last !== null && week <= last) {
      weekSliderEl.value = String(week);
    }
    syncRange(weekSliderEl, `week ${weekSliderEl.value}`);

    towSliderEl.disabled = m === "utc";
    const tow = Number(towEl.value);
    if (
      towEl.value.trim() !== "" &&
      Number.isFinite(tow) &&
      tow >= 0 &&
      tow < SECONDS_PER_WEEK
    ) {
      towSliderEl.value = String(Math.floor(tow));
    }
    syncRange(towSliderEl, `${towSliderEl.value} s`);
  }

  function drawPlates(read: GnssRead): void {
    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = read.plates.map(plateHtml).join("");
    if (heroes) wrapInstantsAtT(heroes);
  }

  function drawLane(slot: HTMLElement, lane: Lane | undefined): void {
    const set = (role: string) =>
      slot.querySelector<HTMLElement>(`[data-role="${role}"]`)!;
    slot.toggleAttribute("data-blank", lane === undefined);
    const row = set("lane");
    row.toggleAttribute("data-empty", lane === undefined || lane.pin === null);
    if (lane?.chosen === true) row.setAttribute("data-series", "1");
    else row.removeAttribute("data-series");
    row.toggleAttribute("data-gap", lane?.gapBefore === true);
    set("lane-label").textContent = lane?.label ?? " ";
    const pin = set("lane-pin");
    pin.style.setProperty("--at", `${lane?.pin ?? 0}%`);
    if (lane?.chosen === true) pin.setAttribute("data-series", "1");
    else pin.removeAttribute("data-series");
    const today = set("lane-today");
    today.hidden = lane?.today == null;
    if (lane?.today != null) today.style.setProperty("--at", `${lane.today}%`);
    set("lane-value").textContent =
      lane === undefined
        ? " "
        : lane.result === ""
          ? NO_RESULT_TEXT
          : lane.result;
    const tags = lane
      ? [
          lane.chosen ? "your reading" : "",
          lane.nearest ? "nearest today" : "",
          lane.differs ? "a different instant" : "",
          lane.today !== null ? "today" : "",
          lane.gapBefore ? "eras between are not drawn" : "",
        ].filter(Boolean)
      : [];
    set("lane-flags").innerHTML = tags
      .map((t) => `<span class="gmt-cutoff-chip">${escapeHtml(t)}</span>`)
      .join("");
  }

  /** One ring lap: its track, the lit arc and dot on the reading's lap, and
   *  the era's number at the seam. The hand and every dot sit at one angle. */
  function drawRing(read: GnssRead, state: "live" | "lost" | "idle"): void {
    const ring = q("ring");
    if (!ring) return;
    ring.dataset["state"] = state;
    const modulus = read.modulus ?? 1024;
    const ticks = q("ring-ticks");
    if (ticks && ticks.dataset["modulus"] !== String(modulus)) {
      ticks.innerHTML = ringTicksHtml(modulus);
      ticks.dataset["modulus"] = String(modulus);
    }
    const lit = state === "live" ? read.lanes : [];
    const angle = lit.find((l) => l.pin !== null)?.pin ?? 0;
    const hand = q("ring-hand");
    hand?.style.setProperty("--turn", `${(angle * 3.6).toFixed(2)}deg`);
    if (hand) hand.toggleAttribute("hidden", state !== "live");
    const laps = qa<HTMLElement>("ring-lap");
    laps.forEach((lap, i) => {
      const lane = lit[i];
      // A lost or idle ring still shows three faint laps; a live one, one per era.
      lap.toggleAttribute(
        "hidden",
        lane === undefined && (state === "live" || i > 2),
      );
      lap.toggleAttribute("data-chosen", lane?.chosen === true);
      lap.toggleAttribute("data-gap", lane?.gapBefore === true);
      lap.toggleAttribute(
        "data-empty",
        lane === undefined || lane.pin === null,
      );
      if (lane?.chosen === true) lap.setAttribute("data-series", "1");
      else lap.removeAttribute("data-series");
      const lapAngle = (lane?.pin ?? 0) * 3.6;
      lap
        .querySelector<SVGGElement>('[data-role="ring-dot"]')
        ?.style.setProperty("--turn", `${lapAngle.toFixed(2)}deg`);
      const fill = lap.querySelector<SVGCircleElement>(".gmt-ring-fill");
      const share = lane?.chosen === true && lane.pin !== null ? lane.pin : 0;
      fill?.style.setProperty("stroke-dasharray", `${share} ${100 - share}`);
      const today = lap.querySelector<SVGGElement>('[data-role="ring-today"]');
      if (today) {
        today.toggleAttribute("hidden", lane?.today == null);
        if (lane?.today != null)
          today.style.setProperty(
            "--turn",
            `${(lane.today * 3.6).toFixed(2)}deg`,
          );
      }
      const era = lap.querySelector('[data-role="ring-era"]');
      if (era) era.textContent = lane?.label ?? " ";
      lap
        .querySelector('[data-role="ring-era-plate"]')
        ?.toggleAttribute("hidden", lane?.label === undefined);
    });
    const set = (role: string, text: string) => {
      const el = q(role);
      if (el) el.textContent = text;
    };
    if (state === "live") {
      const own = lit.find((l) => l.chosen);
      set("ring-cap", own === undefined ? "WEEK" : own.label);
      set("ring-week", String(read.week ?? "-"));
      set("ring-sub", `of ${modulus}`);
    } else if (state === "lost") {
      // The signal-lost state, in words, never a blank hub.
      set("ring-cap", "\u27e8 NO SIGNAL \u27e9");
      set("ring-week", " ");
      set("ring-sub", " ");
    } else {
      set("ring-cap", "WEEK");
      set("ring-week", "-");
      set("ring-sub", "no reading");
    }
  }

  function drawLanes(read: GnssRead): void {
    const slots = qa<HTMLElement>("laneset");
    slots.forEach((slot, i) => drawLane(slot, read.lanes[i]));
    const rinex = read.state.mode === "rinex";
    const state =
      read.status === "sentinel"
        ? "lost"
        : read.lanes.length > 0
          ? "live"
          : "idle";
    const lanes = q("lanes");
    if (lanes) lanes.dataset["form"] = rinex ? "track" : "ring";
    drawRing(read, rinex ? "idle" : state);
    const empty = q("lanes-empty");
    if (empty) {
      // The hub has room for the short form; the whole sentinel sentence goes here.
      const lostTrack = state === "lost";
      const text = lostTrack
        ? "\u27e8 NO SIGNAL \u2014 invalid input \u27e9"
        : (read.lanesEmpty ?? "");
      empty.hidden = text === "";
      empty.classList.toggle("gmt-gnss-lost", lostTrack);
      empty.textContent = text;
    }
    q("lanes")?.setAttribute("aria-label", lanesAria(read));
    const list = q("lane-list");
    if (list) {
      list.innerHTML = read.lanes
        .map((l) => `<li>${escapeHtml(l.sentence)}</li>`)
        .join("");
    }
  }

  function drawTables(read: GnssRead): void {
    const cell = (text: string, label: string) =>
      `<td role="cell" data-label="${escapeAttr(label)}">${text === "" ? "&nbsp;" : escapeHtml(text)}</td>`;
    const body = q("counter-body");
    if (body) {
      body.innerHTML = read.counters
        .map((c) => {
          const none = c.none ? NO_RESULT_TEXT : "";
          return (
            `<tr role="row" data-row="${escapeAttr(c.counter)}"${c.yours ? ' data-reading data-series="1"' : ""}>` +
            `<th role="rowheader" data-label="Counter">${escapeHtml(c.counter)}${c.yours ? " (your reading)" : ""}</th>` +
            cell(none || c.week, "Week") +
            cell(none ? "" : c.timeOfWeek, "Time of week (s)") +
            cell(none ? "" : c.era, "Era") +
            `</tr>`
          );
        })
        .join("");
    }
    const rinex = q("rinex-body");
    if (rinex) {
      rinex.innerHTML = read.rinexRows
        .map((r) => {
          const none = r.none ? NO_RESULT_TEXT : "";
          return (
            `<tr role="row" data-row="${escapeAttr(r.system)}"${r.yours ? ' data-reading data-series="1"' : ""}>` +
            `<th role="rowheader" data-label="System">${escapeHtml(r.system)}${r.yours ? " (your reading)" : ""}</th>` +
            cell(none || r.week, "Week") +
            cell(none ? "" : r.timeOfWeek, "Time of week (s)") +
            `</tr>`
          );
        })
        .join("");
    }
    const note = q("footnote");
    if (note) note.textContent = read.footnote === "" ? " " : read.footnote;
  }

  function render(): void {
    showFields();
    drawSliders();
    const state = readState();
    const read = readGnss(lib, state, Temporal.Now.instant().toString());
    last = read;

    drawPlates(read);
    drawLanes(read);
    drawTables(read);

    const calls = [
      ...read.calls.reading,
      ...read.calls.counters,
      ...read.calls.rinex,
    ];
    renderCalls(q("call-decoder"), calls);
    const out = q("decoder-output");
    if (out) {
      if (read.status === "empty") renderWidgetOutput(out, " ", "empty");
      else renderCallResults(out, calls, read.status === "sentinel");
    }

    const summary = q("summary");
    if (summary) summary.textContent = summaryText(read);
    const handoffs = decoderHandoffs(read);
    setToolLink(q("link-clocks"), handoffHref(handoffs.clocks));
    setToolLink(q("link-rollover"), handoffHref(handoffs.rollover));
    const aside = q("reason-aside");
    if (aside) {
      if (read.status === "sentinel") {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(read.failure ?? "")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  /** A change of mode carries the moment across: the last good reading's own
   *  numbers fill the fields the new mode reads. */
  function carryOver(from: GnssDecoderMode, to: GnssDecoderMode): void {
    const carry = last?.status === "ok" ? last.carry : null;
    if (carry === null || from === to) return;
    if (to === "utc" && carry.utc !== null) setControlValue(utcEl, carry.utc);
    if (to === "rinex" && carry.utc !== null) {
      // RINEX reads one continuous week, not the broadcast counter's: ask the
      // library for the instant's week on the record's system.
      const system = carry.system ?? (systemEl.value as RinexWeekSystem);
      const r = lib.utcToRinexWeek(system, carry.utc);
      setControlValue(systemEl, system);
      if (r !== null) {
        setControlValue(weekEl, String(r.week));
        setControlValue(towEl, String(r.timeOfWeekSeconds));
      }
    }
    if (to === "broadcast" && carry.utc !== null) {
      // Back to the counter's own week, time of week and era for the instant.
      const counter = counterEl.value as GnssWeekCounter | "";
      const own = counter === "" ? null : lib.utcToGnssWeek(counter, carry.utc);
      if (own !== null) {
        setControlValue(weekEl, String(own.week));
        setControlValue(towEl, String(own.timeOfWeekSeconds));
        setControlValue(eraModeEl, "number");
        setControlValue(eraEl, String(own.era));
      }
    }
  }

  let shownMode: GnssDecoderMode = mode();

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    // A range writes its stop into the typed field; the field is the state.
    if (target === weekSliderEl || target === towSliderEl) {
      setControlValue(
        target === weekSliderEl ? weekEl : towEl,
        (target as HTMLInputElement).value,
      );
      syncPreset();
      render();
      return;
    }
    const role = target.dataset?.["role"] ?? "";
    if (!/^(week|tow|era|pivot|utc)$/.test(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      const preset = GNSS_PRESETS.find((p) => p.id === presetEl.value);
      if (!preset) return;
      apply(presetState(preset));
      shownMode = mode();
      syncPreset();
      render();
      return;
    }
    if (target instanceof HTMLInputElement && target.type === "radio") {
      carryOver(shownMode, mode());
      shownMode = mode();
      syncPreset();
      render();
      return;
    }
    if (target === counterEl) {
      if (counterEl.value !== "") {
        setControlValue(
          systemEl,
          counterSystem(counterEl.value as GnssWeekCounter),
        );
      }
      syncPreset();
      render();
      return;
    }
    if (target === systemEl) {
      // The reading's counter follows its system, or the table would still
      // mark the old system's counter as "your reading".
      const counter = counterEl.value as GnssWeekCounter | "";
      if (counter === "" || counterSystem(counter) !== systemEl.value) {
        const own = GNSS_WEEK_COUNTERS.find(
          (c) => counterSystem(c) === systemEl.value,
        );
        if (own !== undefined) setControlValue(counterEl, own);
      }
      syncPreset();
      render();
      return;
    }
    if (target === eraModeEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  showFields();
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: () => {} };
}

export const mountGnssWeekDecoder: MountFn<GnssWeekDecoderArgs> = async (
  root,
  args,
  signal,
) => {
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
