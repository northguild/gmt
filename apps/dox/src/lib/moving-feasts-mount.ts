/**
 * The Moving Feasts widget (CORE-54), mountable on its tool page and in the
 * chat rail.
 *
 * Section 1: a year slider (and a typed year) moves the two Easter Sundays,
 * how far apart they fall and the toggled days counted from each, across the
 * months February to June. Section 2: a month, a weekday and an ordinal give
 * `nthWeekdayOfMonth`'s date, and every occurrence of that weekday in the month
 * carries the ordinals it answers to. Everything on screen is a library call
 * (`easterSunday`, `holidayDates`, `nthWeekdayOfMonth`, `diffDate`,
 * `areDatesEqual`); the widget computes no date.
 *
 * Built on the component kit: `renderMovingFeastsTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids, reads
 * and writes element `value` properties and delegates every listener on the widget with the
 * mount's `signal`. Dragging the slider redraws the plates, the grids and the note in place,
 * and none of them changes size: the plates and notes reserve their longest text, a month
 * grid always draws six week rows, and each region that fills after mount sits in a `grow`.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import {
  holidayLegend,
  kindItems,
} from "~/widgets/families/holiday/holiday-legend";
import {
  monthGrid,
  type MonthGridOptions,
} from "~/widgets/families/holiday/month-grid";
import {
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/moving-feasts.module.css";
import { loadFeastsLib, type FeastsLib } from "./feasts-lib";
import { NO_SIGNAL_TEXT } from "./holiday-rule-builder";
import { monthName, type CellMark } from "./holiday-widgets";
import {
  COMPUTUS_CHOICES,
  COMPUTUS_LABELS,
  CUSTOM_PRESET_ID,
  FEAST_OFFSETS,
  FEAST_PRESETS,
  FEASTS_ZONE,
  ORDINAL_VALUES,
  builderHandoff,
  drawableMonths,
  easterCalls,
  easterPlates,
  feastMarks,
  gridMonths,
  isSeeded,
  matchPreset,
  nthModel,
  nthLineSamples,
  nthNoteSizers,
  nthSentence,
  permalinkOf,
  presetState,
  readArgs,
  readersYear,
  sliderRange,
  undrawnCount,
  weekdayLong,
  yearNote,
  yearNoteSizers,
  yearNumber,
  yearTaken,
  APART_SIDES,
  HINT_NO_OFFSET,
  HINT_NO_YEAR,
  HINT_TOO_MANY,
  HINT_YEAR,
  type ComputusChoice,
  type FeastsState,
  type MovingFeastsArgs,
} from "./moving-feasts";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { setToolLink } from "./widget-ui";

export type { MovingFeastsArgs } from "./moving-feasts";

/** What a plate reads when the library placed nothing. */
export const NO_SIGNAL_SHORT = "⟨ NO SIGNAL ⟩";

const WIDGET_NAME = "moving-feasts";
const GRID_WEEKEND: readonly number[] = [];
const LEGEND_SERIES = [
  { kind: "pick", series: 1, label: "Gregorian series (solid)" },
  { kind: "pick", series: 2, label: "Julian series (hatched)" },
  { kind: "pick", series: 3, label: "Both series (crosshatch)" },
] as const;
const CHIP_HINT =
  "The numbers on a day are its ordinals: 1 is the first such weekday of the month, -1 the last.";

/** The widest a date and a distance read, so the plates keep their width between years. */
const DATE_SAMPLES = ["-271821-04-19", "+275760-04-19"] as const;
const NTH_LINE_SAMPLES = nthLineSamples();
const APART_SAMPLES = ["88 days", "same day"] as const;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The drawn year: the typed one when the grid can draw it, else a year it can. */
function gridYear(year: number, fallback: number): number {
  return Number.isInteger(year) ? year : fallback;
}

/**
 * A month grid, or the same grid of a year the polyfill can draw when the
 * typed year is past the end of its range. The grid never throws into an input
 * handler.
 */
function safeGrid(
  year: number,
  fallback: number,
  months: { from: number; to: number },
  marks: Readonly<Record<string, CellMark | undefined>>,
): SafeHtml {
  const options = (o: MonthGridOptions): SafeHtml => monthGrid(o);
  try {
    return options({
      year: gridYear(year, fallback),
      months,
      marks,
      weekend: GRID_WEEKEND,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return options({
      year: readersYear(),
      months: { from: Math.min(months.from, 12), to: months.to },
      marks: {},
      weekend: GRID_WEEKEND,
    });
  }
}

function easterPlatesOf(plates: ReturnType<typeof easterPlates>): SafeHtml {
  const list: SignalPlate[] = [
    {
      caption: "Gregorian Easter",
      value: plates.gregorian,
      line: "Gregorian computus",
      series: 1,
      samples: DATE_SAMPLES,
    },
    {
      caption: "Julian Easter",
      value: plates.julian,
      line: "Julian computus, Gregorian date",
      series: 2,
      samples: DATE_SAMPLES,
    },
    {
      caption: "Apart",
      value: plates.apart,
      line: plates.side,
      lineSamples: APART_SIDES,
      series: 3,
      samples: APART_SAMPLES,
    },
  ];
  return signalPlates(list);
}

function nthPlateOf(date: string | null, line: string): SafeHtml {
  return signalPlates([
    {
      caption: "Date",
      value: date,
      line,
      lineSamples: NTH_LINE_SAMPLES,
      series: 1,
      samples: DATE_SAMPLES,
    },
  ]);
}

const noteOf = (
  id: string,
  label: string,
  text: string,
  state: HeldState,
  sizers: string[],
): SafeHtml => heldText({ id, label, text, state, sizers, gate: "hold" });

function offsetItems(state: FeastsState): {
  value: string;
  label: string;
  checked: boolean;
}[] {
  return FEAST_OFFSETS.map((o) => ({
    value: String(o.offset),
    label: o.label,
    checked: state.offsets.includes(o.offset),
  }));
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The plates and grids are drawn here without
 * the library (no marks); `mount` draws every result.
 */
export function renderMovingFeastsTemplate(
  idPrefix: string,
  args: MovingFeastsArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(FEAST_PRESETS[0]!);
  const presetId = matchPreset(state);
  const bounds = sliderRange(readersYear());
  const typed = yearNumber(state.year);
  const sliderValue = Math.min(
    bounds.max,
    Math.max(bounds.min, Number.isFinite(typed) ? typed : bounds.min),
  );
  const shown = Number.isInteger(typed) ? typed : bounds.min + 100;
  const blankPlates = easterPlatesOf({
    gregorian: "",
    julian: "",
    apart: "",
    side: "",
  });
  const nthShown = ((): SafeHtml => {
    try {
      return monthGrid({
        year: shown,
        months: { from: Number(state.month), to: Number(state.month) },
        marks: {},
        weekend: GRID_WEEKEND,
      });
    } catch {
      return html``;
    }
  })();

  const easter = section(
    { id: id("easter"), heading: "1. Easter and its offsets", level: 3 },
    html`<div class="${styles.controls}">${field({
      id: id("year"),
      label: "Year",
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value: state.year,
          inputMode: "numeric",
          autocomplete: "off",
          spellcheck: false,
        }),
    })}<div class="${styles.wide}">${range({
      id: id("year-slider"),
      label: "Year slider",
      min: bounds.min,
      max: bounds.max,
      step: 1,
      value: sliderValue,
      valueText: String(sliderValue),
      ends: [String(bounds.min), String(bounds.max)],
    })}</div><div class="${styles.wide}">${chips({
      legend: "Computus",
      kind: "radio",
      name: id("computus"),
      items: COMPUTUS_CHOICES.map((c) => ({
        value: c,
        label: COMPUTUS_LABELS[c],
        checked: state.computus === c,
      })),
    })}</div><div class="${styles.wide}">${chips({
      legend: "Days from Easter",
      kind: "checkbox",
      name: id("offsets"),
      items: offsetItems(state),
    })}</div></div>${holidayFrame(
      html`<div class="${styles.plates}" aria-hidden="true">${grow(
        html`<div class="${styles.slot}" id="${id("plates")}">${blankPlates}</div>`,
      )}</div
        ><p role="status" aria-label="Easter summary" id="${id("year-sentence")}">${srOnly("")}</p
        >${grow(html`<div class="${styles.slot}" id="${id("easter-grid")}">${safeGrid(shown, shown, { from: 2, to: 6 }, {})}</div>`)}${holidayLegend(
          { label: "Series", items: LEGEND_SERIES },
        )}<div id="${id("year-note")}">${noteOf(id("year-note-text"), "Year note", "", "ok", yearNoteSizers())}</div>`,
      { gate: "frame" },
    )}`,
  );

  const nth = section(
    { id: id("nth"), heading: "2. Ordinal weekdays", level: 3 },
    html`<div class="${styles.stack}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...FEAST_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("month"),
        label: "Month",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.month,
            options: Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: monthName(i + 1),
            })),
          }),
      })}${field({
        id: id("weekday"),
        label: "Weekday",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.weekday,
            options: Array.from({ length: 7 }, (_, i) => ({
              value: String(i + 1),
              label: weekdayLong(i + 1),
            })),
          }),
      })}${field({
        id: id("ordinal"),
        label: "Ordinal",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.ordinal,
            options: ORDINAL_VALUES.map((o) => ({ value: o, label: o })),
          }),
      })}`,
    )}${holidayFrame(
      html`<div class="${styles.plates}" aria-hidden="true">${grow(
        html`<div class="${styles.slot}" id="${id("nth-plate")}">${nthPlateOf("", "")}</div>`,
      )}</div
        ><p role="status" aria-label="Date summary" id="${id("nth-sentence")}">${srOnly("")}</p
        >${grow(html`<div class="${styles.slot}" id="${id("nth-grid")}">${nthShown}</div>`)}${holidayLegend(
          { label: "Marks", items: kindItems(["pick"]) },
        )}<p class="${styles.hint}">${CHIP_HINT}</p><div id="${id("nth-note")}">${noteOf(id("nth-note-text"), "Date note", "", "ok", nthNoteSizers())}</div>`,
      { gate: "frame" },
    )}</div>`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. The calls", level: 3 },
    html`<div class="${styles.stack}"><details class="${styles.calls}"
      ><summary>Every call behind the dates above</summary
      >${grow(
        html`<div class="${styles.slot}" id="${id("calls-slot")}">${codeFrame({
          label: "Calls made",
          copyLabel: "Copy calls",
          copyText: "",
          gate: "codeframe",
        })}</div>`,
      )}</details
    >${toolLinks({
      label: "Open this result in another tool",
      links: [{ text: "Build a calendar from these" }],
    })}<div id="${id("hint")}">${noteOf(
      id("hint-text"),
      "Hand-off hint",
      "",
      "ok",
      [HINT_NO_OFFSET, HINT_NO_YEAR, HINT_TOO_MANY, HINT_YEAR],
    )}</div></div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Moving Feasts", scope: idPrefix },
    html`${easter}${nth}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): FeastsState;
  apply(state: FeastsState): void;
}

function setupWidget(
  root: HTMLElement,
  lib: FeastsLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const yearEl = el<HTMLInputElement>("year");
  const sliderEl = el("year-slider").closest<GmtRange>("gmt-range")!;
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const monthEl = el<HTMLSelectElement>("month");
  const weekdayEl = el<HTMLSelectElement>("weekday");
  const ordinalEl = el<HTMLSelectElement>("ordinal");
  const chipGroups = [...widgetEl.querySelectorAll<GmtChips>("gmt-chips")];
  const computusEl = chipGroups[0]!;
  const offsetsEl = chipGroups[1]!;
  const link = widgetEl.querySelector<HTMLElement>("a[aria-disabled], a[href]");

  // The slider spans the reader's year plus or minus a century. The template
  // was rendered at build time, so the bounds are set again from the clock here.
  const bounds = sliderRange(readersYear());
  sliderEl.max = bounds.max;
  sliderEl.min = bounds.min;
  sliderEl.ends = [String(bounds.min), String(bounds.max)];
  sliderEl.formatValue = String;

  let state: FeastsState = presetState(FEAST_PRESETS[0]!);
  /** The last year the grids could draw, kept for a typed year they cannot. */
  let drawnYear = readersYear();

  function syncControls(): void {
    yearEl.value = state.year;
    monthEl.value = state.month;
    weekdayEl.value = state.weekday;
    ordinalEl.value = state.ordinal;
    offsetsEl.value = state.offsets.map(String);
    computusEl.value = state.computus;
  }

  function syncSlider(): void {
    const year = yearNumber(state.year);
    if (Number.isInteger(year)) {
      sliderEl.value = Math.min(bounds.max, Math.max(bounds.min, year));
    }
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(state);
  }

  // The printed calls: the two sections write theirs, and both are shown.
  let easterLines: string[] = [];
  let nthLines: string[] = [];
  function drawCalls(): void {
    const lines = [...easterLines, ...nthLines];
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: lines.join("\n"),
        code: html`${lines.join("\n")}`,
        gate: "codeframe",
      }),
    );
  }

  function drawEaster(): void {
    const year = yearNumber(state.year);
    const taken = yearTaken(year);
    const plates = easterPlates(lib, year);
    setHtml(el("plates"), easterPlatesOf(plates));

    const picked = taken
      ? feastMarks(lib, year, state.offsets, state.computus)
      : { marks: {}, dates: [], calls: [] };
    const months = gridMonths(picked.dates, taken ? year : 0);
    const drawn = taken ? drawableMonths(year, months) : null;
    setHtml(
      el("easter-grid"),
      !taken
        ? safeGrid(readersYear(), readersYear(), months, {})
        : drawn === null
          ? html``
          : safeGrid(year, drawnYear, drawn, picked.marks),
    );
    if (taken && drawn !== null) drawnYear = year;

    const words = yearNote({
      year: state.year,
      taken,
      gregorian: plates.gregorian,
      julian: plates.julian,
      outside: months.outside,
      undrawn: undrawnCount(picked.dates, year, drawn),
    });
    setHtml(
      el("year-note"),
      noteOf(
        el("year-note-text").id,
        "Year note",
        words,
        !taken ? "sentinel" : words === "" ? "ok" : "note",
        yearNoteSizers(),
      ),
    );

    setHtml(
      el("year-sentence"),
      srOnly(
        !taken
          ? `${state.year}: no Easter placed.`
          : `${state.year}: Gregorian Easter ${plates.gregorian ?? "not placed"}, Julian Easter ${plates.julian ?? "not placed"}, ${plates.apart === null ? "distance not placed" : plates.apart === "same day" ? "the same day" : `${plates.apart} apart`}.`,
      ),
    );

    easterLines = taken
      ? [...easterCalls(lib, year), ...picked.calls]
      : [`easterSunday(${state.year}); // ""`];
    drawCalls();
    drawHandoff(plates.gregorian !== null);
  }

  function drawNth(): void {
    const year = yearNumber(state.year);
    const month = Number(state.month);
    const weekday = Number(state.weekday);
    const model = nthModel(lib, year, month, weekday, state.ordinal);
    const placed = model.date !== "";
    const sentence = nthSentence(state.year, month, weekday, state.ordinal);
    setHtml(el("nth-plate"), nthPlateOf(placed ? model.date : null, sentence));

    const shown = yearTaken(year)
      ? drawableMonths(year, { from: month, to: month })
      : null;
    setHtml(
      el("nth-grid"),
      shown === null ? html`` : safeGrid(year, drawnYear, shown, model.marks),
    );

    setHtml(
      el("nth-note"),
      noteOf(
        el("nth-note-text").id,
        "Date note",
        placed ? "" : `${NO_SIGNAL_TEXT}: ${model.reason}`,
        placed ? "ok" : "sentinel",
        nthNoteSizers(),
      ),
    );
    setHtml(
      el("nth-sentence"),
      srOnly(
        placed ? `${sentence}: ${model.date}.` : `${sentence}: ${model.reason}`,
      ),
    );
    nthLines = model.calls;
    drawCalls();
  }

  function drawHandoff(yearIsPlaced: boolean): void {
    const { href, hint } = builderHandoff(state, yearIsPlaced);
    setToolLink(link, href);
    setHtml(
      el("hint"),
      noteOf(
        el("hint-text").id,
        "Hand-off hint",
        hint,
        hint === "" ? "ok" : "note",
        [HINT_NO_OFFSET, HINT_NO_YEAR, HINT_TOO_MANY, HINT_YEAR],
      ),
    );
  }

  function recompute(): void {
    syncPreset();
    drawEaster();
    drawNth();
  }

  function fromControls(): void {
    state.offsets = (offsetsEl.value as string[])
      .map(Number)
      .sort((a, b) => a - b);
    const picked = computusEl.value as ComputusChoice | "";
    if (picked !== "") state.computus = picked;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === yearEl) {
        state.year = yearEl.value;
        syncSlider();
        recompute();
      } else if (target === sliderEl) {
        state.year = String(sliderEl.value);
        yearEl.value = state.year;
        recompute();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === offsetsEl || target === computusEl) {
        fromControls();
        drawEaster();
      } else if (
        target === monthEl ||
        target === weekdayEl ||
        target === ordinalEl
      ) {
        state.month = monthEl.value;
        state.weekday = weekdayEl.value;
        state.ordinal = ordinalEl.value;
        syncPreset();
        drawNth();
      } else if (target === presetEl) {
        const chosen = FEAST_PRESETS.find((p) => p.id === presetEl.value);
        if (chosen) apply(presetState(chosen, state));
      }
    },
    { signal },
  );

  function apply(next: FeastsState): void {
    state = next;
    syncControls();
    syncSlider();
    recompute();
  }

  apply(state);

  return { readState: () => state, apply };
}

export const mountMovingFeasts: MountFn<MovingFeastsArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: FeastsLib;
  try {
    lib = await loadFeastsLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) controller.apply(readArgs(args));

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};

export { FEASTS_ZONE };
