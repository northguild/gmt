/**
 * The Leap-Day Birthday widget (CORE-102), mountable on its tool page and in
 * the chat rail.
 *
 * The reader types a yearly date (a month-day, a date of birth or a date-time),
 * picks a locale and a year, by typing it or by dragging a slider. Three plates
 * read the stored `--MM-DD`, how it reads in the locale and the date it falls on
 * in that year. A table of eight consecutive years sets the library's answer
 * beside two alternatives. Everything on screen is a library call; the widget
 * computes no date (`leap-day-birthday.ts` builds the rows).
 *
 * Built on the component kit: `renderLeapDayBirthdayTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids
 * and delegates every listener on the widget with the mount's `signal`. Dragging the slider
 * redraws the plates and the rows in place, and none of them changes size: every row and
 * cell is laid out in every state, and each date and word reserves its widest text.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  findWidget,
  html,
  idScope,
  section,
  select,
  setHtml,
  srOnly,
  table,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import { reservedText } from "~/widgets/families/holiday/reserved-text";
import { numberInput } from "~/widgets/families/timescale/number-input";
import {
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/leap-day-birthday.module.css";
import { CONVERTER_LOCALES } from "./curated-timezones";
import {
  CUSTOM_PRESET_ID,
  LEAP_PRESETS,
  REASONS,
  ROW_COUNT,
  VERDICT_WORDS,
  buildModel,
  callsSizerText,
  isSeeded,
  longestMonthText,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readersYear,
  sliderRange,
  yearNumber,
  type LeapDayArgs,
  type LeapModel,
  type LeapState,
  type YearRow,
} from "./leap-day-birthday";
import { loadMonthDayLib, type MonthDayLib } from "./month-day-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { LeapDayArgs } from "./leap-day-birthday";

/** What a cell or a plate reads when the library gave nothing. */
export const NO_SIGNAL_SHORT = "⟨ NO SIGNAL ⟩";

/** The longest English month-day, the Reads-as plate's width until a locale is read. */
const FALLBACK_READS = "September 28";
/** The widest date a plate or a cell can show. */
const WIDEST_DATE = "+275760-09-13";
const WIDGET_NAME = "leap-day-birthday";

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function platesOf(
  model: LeapModel,
  state: LeapState,
  readsSamples: readonly string[],
): SafeHtml {
  const first = model.rows[0]!;
  const list: SignalPlate[] = [
    {
      caption: "Stored as",
      value: model.stored,
      line: "the canonical form",
      series: 1,
      samples: [WIDEST_DATE],
    },
    {
      caption: "Reads as",
      value: model.reads,
      line: state.locale,
      series: 2,
      samples: readsSamples,
    },
    {
      caption: first.year === null ? "In that year" : `In ${first.year}`,
      value: first.gmt,
      line: first.verdict,
      series: 3,
      samples: [WIDEST_DATE],
    },
  ];
  return signalPlates(list);
}

/** A date cell: the library's date, or NO SIGNAL (amber, bracketed). */
function dateOf(value: string | null): SafeHtml {
  return html`<span class="${styles.date}"
    >${reservedText({
      text: value ?? NO_SIGNAL_SHORT,
      state: value === null ? "signal" : "live",
      samples: [WIDEST_DATE, NO_SIGNAL_SHORT],
    })}</span
  >`;
}

/** A verdict word in a slot sized by the longest word, hidden when it is blank. */
function wordOf(word: string | null): SafeHtml {
  return html`<span class="${styles.word}"
    >${reservedText({
      text: word ?? "",
      state: word === null ? "off" : "live",
      samples: VERDICT_WORDS,
    })}</span
  >`;
}

function rowOf(row: YearRow): Record<ColumnKey, SafeHtml | string> {
  const moved = row.verdict.startsWith("moved");
  return {
    year: row.year === null ? "-" : String(row.year),
    gmt: dateOf(row.gmt),
    verdict: html`<span class="${moved ? `${styles.verdict} ${styles.moved}` : styles.verdict}"
      >${wordOf(row.verdict)}</span
    >`,
    pasted: dateOf(row.pasted),
    policy: html`<span class="${styles.policy}"
      >${dateOf(row.policy)}${wordOf(row.policyVerdict)}</span
    >`,
  };
}

type ColumnKey = "year" | "gmt" | "verdict" | "pasted" | "policy";

const COLUMNS = [
  { key: "year", header: "Year", align: "start", numeric: true },
  { key: "gmt", header: "gmt", align: "start", numeric: false },
  { key: "verdict", header: "Verdict", align: "start", numeric: false },
  {
    key: "pasted",
    header: "Year pasted on (naive)",
    align: "start",
    numeric: false,
  },
  {
    key: "policy",
    header: "1 March rule (your policy)",
    align: "start",
    numeric: false,
  },
] as const;

function tableOf(rows: readonly YearRow[]): SafeHtml {
  return table<ColumnKey>({
    caption: "The date in eight consecutive years",
    columns: COLUMNS,
    rows: rows.map(rowOf),
    rowHeader: "year",
    layout: "fixed",
    widths: ["10%"],
    gate: "grid",
  });
}

/** Eight rows with no result, so the table is laid out before the library loads. */
function blankRows(): YearRow[] {
  return Array.from({ length: ROW_COUNT }, () => ({
    year: null,
    gmt: null,
    verdict: "no date" as const,
    pasted: null,
    policy: null,
    policyVerdict: null,
    calls: [],
  }));
}

const REASON_SAMPLES = Object.values(REASONS);

function reasonOf(text: string, state: HeldState): SafeHtml {
  return heldText({
    label: "Reason",
    text,
    state,
    sizers: REASON_SAMPLES,
    gate: "hold",
  });
}

function reasonState(model: LeapModel): HeldState {
  return model.reason === "input" ||
    model.reason === "day" ||
    model.reason === "year"
    ? "sentinel"
    : "note";
}

function localeOptions(locale: string): { value: string; label: string }[] {
  const list: readonly string[] = (
    CONVERTER_LOCALES as readonly string[]
  ).includes(locale)
    ? CONVERTER_LOCALES
    : [...CONVERTER_LOCALES, locale];
  return list.map((l) => ({ value: l, label: l }));
}

const SIZER_LINES = callsSizerText().split("\n").length;

function callsOf(text: string): SafeHtml {
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy calls",
    copyText: text,
    code: html`${text}`,
    gate: "codeframe",
    // The widest reading prints every call; the frame holds that many lines.
    minLines: SIZER_LINES,
  });
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The rows are drawn blank here, without
 * the library; `mount` draws every result.
 */
export function renderLeapDayBirthdayTemplate(
  idPrefix: string,
  args: LeapDayArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args) ? readArgs(args) : presetState(LEAP_PRESETS[0]!);
  const presetId = matchPreset(state);
  const bounds = sliderRange(readersYear());
  const typed = yearNumber(state.year);
  const sliderValue = Math.min(
    bounds.max,
    Math.max(bounds.min, Number.isFinite(typed) ? typed : bounds.min),
  );
  const blank: LeapModel = {
    stored: null,
    reads: null,
    rows: blankRows(),
    calls: [],
    reason: "input",
  };

  const inputs = section(
    { id: id("input"), heading: "1. A date with no year", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...LEAP_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}</div>${field({
      id: id("value"),
      label: "Birthday or yearly date",
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value: state.value,
          inputMode: "text",
          autocomplete: "off",
          spellcheck: false,
          maxLength: 64,
        }),
    })}${field({
      id: id("locale"),
      label: "Locale",
      control: ({ id: cid }) =>
        select({
          id: cid,
          value: state.locale,
          options: localeOptions(state.locale),
        }),
    })}${field({
      id: id("year"),
      label: "Year",
      control: ({ id: cid }) =>
        numberInput({
          id: cid,
          value: state.year,
          min: 0,
          max: 9999,
          step: 1,
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
    })}</div></div>${holidayFrame(
      html`<div class="${styles.plates}" aria-hidden="true">${grow(
        html`<div class="${styles.slot}" id="${id("plates")}">${platesOf(blank, state, [FALLBACK_READS])}</div>`,
      )}</div
        ><p role="status" aria-label="Summary" id="${id("sentence")}">${srOnly("")}</p
        ><div class="${styles.rows}" id="${id("rows")}">${tableOf(blank.rows)}</div
        ><div id="${id("reason")}">${reasonOf("", "ok")}</div>`,
      { gate: "frame" },
    )}`,
  );

  const calls = section(
    { id: id("calls"), heading: "2. The calls", level: 3 },
    html`<details class="${styles.calls}"
      ><summary>Every call behind the plates and the first row</summary
      >${grow(
        html`<div class="${styles.slot}" id="${id("calls-slot")}">${callsOf(callsSizerText())}</div>`,
      )}</details
    >`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Leap-Day Birthday", scope: idPrefix },
    html`${inputs}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): LeapState;
  apply(state: LeapState): void;
}

function sentenceOf(model: LeapModel, state: LeapState): string {
  if (model.stored === null) {
    return `${state.value}: NO SIGNAL, no reader accepted this input.`;
  }
  const rows = model.rows
    .map((r) =>
      r.year === null || r.gmt === null
        ? `${r.year ?? "that year"}: NO SIGNAL, no date`
        : `${r.year}: ${r.gmt}, ${r.verdict}`,
    )
    .join("; ");
  return `Stored as ${model.stored}, reads as ${model.reads ?? "not placed"}. ${rows}.`;
}

function setupWidget(
  root: HTMLElement,
  lib: MonthDayLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const valueEl = el<HTMLInputElement>("value");
  const localeEl = el<HTMLSelectElement>("locale");
  const yearEl = el<HTMLInputElement>("year");
  const sliderEl = el("year-slider").closest<GmtRange>("gmt-range")!;
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;

  // The slider spans the reader's year plus or minus a century. The template
  // was rendered at build time, so the bounds are set again from the clock here.
  const bounds = sliderRange(readersYear());
  sliderEl.max = bounds.max;
  sliderEl.min = bounds.min;
  sliderEl.ends = [String(bounds.min), String(bounds.max)];
  sliderEl.formatValue = String;

  let state: LeapState = presetState(LEAP_PRESETS[0]!);
  /** The locale the Reads-as plate's width was last measured for. */
  let sizedLocale = "";
  let readsSamples: string[] = [FALLBACK_READS];

  /** One library call per month, on a locale change only, never during a drag. */
  function sizeReads(): void {
    if (sizedLocale === state.locale) return;
    sizedLocale = state.locale;
    const longest = longestMonthText(lib, state.locale);
    readsSamples = [longest === "" ? FALLBACK_READS : longest];
  }

  function syncControls(): void {
    valueEl.value = state.value;
    yearEl.value = state.year;
    if (![...localeEl.options].some((o) => o.value === state.locale)) {
      const opt = localeEl.ownerDocument.createElement("option");
      opt.value = state.locale;
      opt.textContent = state.locale;
      localeEl.append(opt);
    }
    localeEl.value = state.locale;
  }

  function syncSlider(): void {
    const year = yearNumber(state.year);
    if (Number.isInteger(year)) {
      sliderEl.value = Math.min(bounds.max, Math.max(bounds.min, year));
    }
  }

  function draw(): void {
    presetEl.value = matchPreset(state);
    sizeReads();
    const model = buildModel(lib, state);
    setHtml(el("plates"), platesOf(model, state, readsSamples));
    setHtml(el("rows"), tableOf(model.rows));
    setHtml(el("reason"), reasonOf(REASONS[model.reason], reasonState(model)));
    setHtml(el("sentence"), srOnly(sentenceOf(model, state)));
    setHtml(el("calls-slot"), callsOf(model.calls.join("\n")));
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === valueEl) {
        state.value = valueEl.value;
        draw();
      } else if (target === yearEl) {
        state.year = yearEl.value;
        syncSlider();
        draw();
      } else if (target === sliderEl) {
        state.year = String(sliderEl.value);
        yearEl.value = state.year;
        draw();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === localeEl) {
        state.locale = localeEl.value;
        draw();
      } else if (target === presetEl) {
        const chosen = LEAP_PRESETS.find((p) => p.id === presetEl.value);
        if (chosen) apply(presetState(chosen));
      }
    },
    { signal },
  );

  function apply(next: LeapState): void {
    state = next;
    syncControls();
    syncSlider();
    draw();
  }

  apply(state);

  return { readState: () => state, apply };
}

export const mountLeapDayBirthday: MountFn<LeapDayArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: MonthDayLib;
  try {
    lib = await loadMonthDayLib();
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
