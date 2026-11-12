/**
 * The Double Precision Meter, mountable on its tool page and in the chat rail.
 *
 * An instant goes in on a scale the reader picks, and a slider moves its year from 1972 to
 * 9999. Out come how far a single Julian Date, a Modified Julian Date and seconds since J2000.0
 * drift from the instant, set against the two-part Julian Date, which does not:
 *
 * 1. the controls (the instant, the year, the scale, a preset);
 * 2. the reading: four plates and the NO SIGNAL slot;
 * 3. the drift measured across the years, on a log axis, with every sample in a table.
 *
 * The mount never computes a drift. Every number comes from `readMeter` and `meterSamples`
 * (double-precision-meter.ts), which call the library; the drawing only places what they
 * returned. The samples of a scale are measured once and kept for the life of the mount.
 *
 * Built on the component kit: `renderDoublePrecisionMeterTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids.
 * Every listener is delegated on the widget with the mount's `signal`, and the mount starts no
 * timers, observers or animation frames. The one drag handle is a native range, and the typed
 * instant is its keyboard and typed equivalent.
 */
import { withBase } from "./site";
import { defineElements } from "~/widgets/define";
import {
  disclosure,
  field,
  fieldGrid,
  findWidget,
  hint,
  hold,
  html,
  idScope,
  NO_RESULT,
  plates,
  section,
  setHtml,
  srOnly,
  table,
  textInput,
  widget,
  wireDisclosure,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { driftLanes } from "~/widgets/families/timescale/drift-lanes";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/double-precision-meter.module.css";
import { LAST_INSTANT, SCALES, type Scale } from "./day-count-widgets";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  EMPTY_TEXT,
  FOOTNOTES,
  MAX_VALUE_LENGTH,
  METER_FORMS,
  METER_NAMES,
  METER_PRESETS,
  METER_SERIES,
  SENTENCES,
  SLIDER_MAX,
  SLIDER_MIN,
  callLine,
  driftText,
  isSeeded,
  lanesLabel,
  matchPreset,
  missingDate,
  permalinkOf,
  presetState,
  readArgs,
  readMeter,
  sampleCache,
  summaryText,
  yearAt,
  yearOf,
  type DoublePrecisionMeterArgs,
  type MeterRead,
  type MeterSamples,
  type MeterState,
} from "./double-precision-meter";
import { INTEGER_UTC_FROM } from "./timescale-widgets";
import { loadDayCountLib, type DayCountLib } from "./timescale-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { DoublePrecisionMeterArgs } from "./double-precision-meter";

const WIDGET_NAME = "double-precision-meter";

const NBSP = "\u00a0";
const NO_SIGNAL_PILL = "⟨ NO SIGNAL — invalid input ⟩";

const TABLE_CAPTION = "Worst measured drift in each sampled year";
const TABLE_COLUMNS = [
  "Year",
  ...METER_FORMS.map((f) => METER_NAMES[f]),
] as const;
type Column = (typeof TABLE_COLUMNS)[number];

const NOTE_LINK = "/reference/timescale/convert/toJulianDate/";

// ---------------------------------------------------------------------------
// What the markup holds still for
// ---------------------------------------------------------------------------

/** The widest drift a plate can show, signed, and its value and call lines. */
const DRIFT_SAMPLES = ["−88.888 µs", "+88.888 µs", "0 µs"];
const SAMPLE_VALUES: Record<string, string> = {
  "hero-jd": "value 8888888.888888888",
  "hero-mjd": "value 8888888.888888888",
  "hero-j2000": "value 888888888888.8888",
  "hero-parts": "value 8888888 + 0.8888888888888888",
};

/** The longest call line each plate can show: the longest function name, the widest scale. */
const callSamples = (form: (typeof METER_FORMS)[number]): string[] =>
  SCALES.map((s) => callLine(form, s));

const ROLES = METER_FORMS.map((f) => `hero-${f}`);

/** What the mount learns from the library about the widest values a reading prints. */
interface Samples {
  values: Readonly<Record<string, readonly string[]>>;
}

const TEMPLATE_SAMPLES: Samples = { values: {} };

function plateList(read: MeterRead | null, samples: Samples): Plate[] {
  const sources = read?.plates ?? [];
  return METER_FORMS.map((form, i): Plate => {
    const s = sources[i];
    const role = ROLES[i]!;
    const live = samples.values[role] ?? [];
    return {
      caption: METER_NAMES[form],
      value: s?.value ?? null,
      // An empty plate keeps its two lines, so its height is the live one's.
      lines: s !== undefined && s.lines.length > 0 ? s.lines : ["", ""],
      unbroken: true,
      lineSamples: [
        [SAMPLE_VALUES[role]!, ...live.map((v) => `value ${v}`)],
        callSamples(form),
      ],
      series: METER_SERIES[form],
      samples: [NO_RESULT, ...DRIFT_SAMPLES],
    };
  });
}

/** Every sentence the tool can say in place of an answer. */
function sentenceGhosts(): string[] {
  return [...Object.values(SENTENCES), missingDate(SLIDER_MAX), EMPTY_TEXT];
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function signalOf(read: MeterRead | null): SafeHtml {
  const lost = read !== null && read.status === "sentinel";
  const sentence = read?.failure ?? read?.emptyText ?? "";
  return html`<span class="${styles.signal}" data-state="${lost ? "on" : "off"}" ${lost ? "" : html`aria-hidden="true"`}>${NO_SIGNAL_PILL}</span>${hold(
    html`<p class="${styles.sentence}">${sentence === "" ? NBSP : sentence}</p>`,
    sentenceGhosts(),
    { ghostClass: styles.sentence! },
  )}`;
}

function footnoteOf(read: MeterRead | null): SafeHtml {
  const text = read?.footnote ?? "";
  return hold(html`<span>${text === "" ? NBSP : text}</span>`, [...FOOTNOTES], {
    ghostClass: styles.note!,
  });
}

/** The lanes for `data`, with the reader's year marked. `null` draws the axes with no lines. */
function lanesOf(data: MeterSamples | null, year: number | null): SafeHtml {
  const cursorYear =
    year !== null && year >= SLIDER_MIN && year <= SLIDER_MAX ? year : null;
  return driftLanes({
    // The key and the end labels stand before the samples arrive, so the drawing keeps its size.
    lines: METER_FORMS.map((form) => ({
      key: form,
      name: METER_NAMES[form],
      series: METER_SERIES[form],
      points:
        data === null
          ? []
          : data.samples.map((s) => ({ year: s.year, ns: s.ns[form] })),
    })),
    cursorYear,
    yearMin: SLIDER_MIN,
    yearMax: SLIDER_MAX,
    label:
      data === null
        ? "Drift across the years, being measured."
        : lanesLabel(data),
  });
}

function samplesTable(data: MeterSamples | null): SafeHtml {
  const rows = (data?.samples ?? []).map((s): Record<Column, SafeHtml> => ({
    Year: html`<span class="${styles.year}">${s.year}</span>`,
    "Single JD": html`<span class="${styles.mono}">${driftText(s.ns.jd)}</span>`,
    MJD: html`<span class="${styles.mono}">${driftText(s.ns.mjd)}</span>`,
    "J2000 seconds": html`<span class="${styles.mono}">${driftText(s.ns.j2000)}</span>`,
    "Two-part JD": html`<span class="${styles.mono}">${driftText(s.ns.parts)}</span>`,
  }));
  return table({
    caption: TABLE_CAPTION,
    columns: TABLE_COLUMNS.map((header) => ({
      key: header,
      header,
      align: "start" as const,
      numeric: false,
    })),
    rows,
    rowHeader: "Year",
    layout: "fixed",
    widths: ["16%", "21%", "21%", "21%", "21%"],
    labelCells: true,
    roles: true,
  });
}

function stepSentence(scale: string, step: number): string {
  return `On ${scale} the JD passes 2²² days between 15 June ${step - 1} and 15 June ${step}. Past it the spacing between doubles doubles, and so does the drift.`;
}

/** The step note, held to the longest sentence it can say so the line count never changes. */
function stepNoteOf(data: MeterSamples | null): SafeHtml {
  const text =
    data?.stepYear == null ? "" : stepSentence(data.scale, data.stepYear);
  return hold(
    html`<span>${text === "" ? NBSP : text}</span>`,
    [stepSentence("TCG", 8888)],
    {
      ghostClass: styles.note!,
    },
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The plates, the lanes and the samples are drawn by `mount`, because they
 * come from the real library calls.
 */
export function renderDoublePrecisionMeterTemplate(
  idPrefix: string,
  args: DoublePrecisionMeterArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: MeterState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const year = yearOf(state.value);
  const at = Number.isFinite(year)
    ? Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, year))
    : SLIDER_MIN;

  const pick = section(
    { id: id("pick"), heading: "1. Give an instant", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...METER_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.wide}">${field({
        id: id("value"),
        label: "Instant",
        hint: hint(
          id("value-hint"),
          "A UTC instant such as 2026-06-15T13:47:12.345678912Z. The slider rewrites only its year.",
        ),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.value,
            autocomplete: "off",
            spellcheck: false,
            maxLength: MAX_VALUE_LENGTH,
            ...(describedBy === undefined ? {} : { describedBy }),
          }),
      })}</div
      ><div class="${styles.wide}">${range({
        id: id("year-slider"),
        label: "Move the year",
        min: SLIDER_MIN,
        max: SLIDER_MAX,
        step: 1,
        value: at,
        valueText: String(at),
        ends: [String(SLIDER_MIN), String(SLIDER_MAX)],
      })}</div
      ><div class="${styles.wide}">${chips({
        legend: "Scale",
        kind: "radio",
        name: id("scale"),
        items: SCALES.map((s) => ({
          value: s,
          label: s,
          checked: s === state.scale,
        })),
      })}</div>`,
    )}</div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. How far each number drifts", level: 4 },
    html`${grow(
      html`<div class="${styles.stage}">
        <div class="${styles.platesSlot}" id="${id("plates")}">${plates(plateList(null, TEMPLATE_SAMPLES), { gate: "hero" })}</div>
        <div class="${styles.signalSlot}" id="${id("signal")}">${signalOf(null)}</div>
        <div class="${styles.note}" id="${id("footnote")}">${footnoteOf(null)}</div>
      </div>`,
    )}
      <p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>`,
  );

  const across = section(
    { id: id("across"), heading: "3. Drift across the years", level: 4 },
    html`${grow(
      html`<div class="${styles.drawingSlot}" id="${id("drawing")}">${lanesOf(null, null)}</div>`,
    )}
      <div class="${styles.note}" id="${id("step-note")}">${stepNoteOf(null)}</div>
      ${disclosure({
        id: id("samples"),
        label: "Show the samples",
        children: html`<div class="${styles.forms}" id="${id("table")}">${samplesTable(null)}</div>`,
      })}
      <p class="${styles.note}">Measured: the worst of four fixed times of day in each sampled year. A value you type can drift more or less, but never more than the bound in <a href="${withBase(NOTE_LINK)}">the function's documentation</a>.</p>`,
  );

  return widget(
    {
      name: WIDGET_NAME,
      label: "Double Precision Meter",
      scope: idPrefix,
    },
    html`${pick}${read}${across}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** The widest values the library writes at the presets and at both ends of the range. */
function samplesOf(lib: DayCountLib): Samples {
  const states: MeterState[] = [
    ...METER_PRESETS.map((p) => p.state),
    ...SCALES.flatMap((scale): MeterState[] => [
      { value: INTEGER_UTC_FROM, scale },
      { value: LAST_INSTANT, scale },
    ]),
  ];
  const values: Record<string, Set<string>> = {};
  for (const state of states) {
    const read = readMeter(lib, state);
    if (read.status !== "ok") continue;
    for (const plate of read.plates) {
      const first = plate.lines[0];
      if (first !== undefined)
        (values[plate.role] ??= new Set()).add(first.replace(/^value /, ""));
    }
  }
  return {
    values: Object.fromEntries(
      ROLES.map((role) => [role, [...(values[role] ?? [])]]),
    ),
  };
}

interface Controller {
  readState(): MeterState;
  apply(state: MeterState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: DayCountLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const sliderEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const scaleEl = widgetEl.querySelector<GmtChips>("gmt-chips")!;
  const valueEl = el<HTMLInputElement>("value");
  const samples = samplesOf(lib);
  const cache = sampleCache(lib);

  // The bounds are set on the live range, in this order: max, ends, then the value.
  sliderEl.min = SLIDER_MIN;
  sliderEl.max = SLIDER_MAX;
  sliderEl.ends = [String(SLIDER_MIN), String(SLIDER_MAX)];
  sliderEl.formatValue = (n) => String(n);

  /** The scale the table was last written for, or `null` while it holds nothing. */
  let tabled: Scale | null = null;
  let opened = false;

  /** Writes the samples table when it is open and out of date. A closed one costs nothing. */
  function fillTable(scale: Scale): void {
    if (!opened || tabled === scale) return;
    tabled = scale;
    setHtml(el("table"), samplesTable(cache.get(scale)));
  }

  wireDisclosure(widgetEl.querySelector<HTMLElement>("[data-disclosure]")!, {
    signal,
    onToggle: (open) => {
      opened = open;
      if (open) fillTable(scaleEl.value as Scale);
    },
  });

  function readState(): MeterState {
    return { value: valueEl.value, scale: scaleEl.value as Scale };
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function apply(state: MeterState): void {
    valueEl.value = state.value;
    scaleEl.value = state.scale;
  }

  /** The slider follows a value that reads; a value that does not leaves it where it is. */
  function followRead(read: MeterRead): void {
    if (read.status === "ok" && read.year !== null) {
      sliderEl.value = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, read.year));
    }
  }

  function render(): MeterRead {
    const state = readState();
    const read = readMeter(lib, state);
    const data = cache.get(state.scale);
    setHtml(el("plates"), plates(plateList(read, samples), { gate: "hero" }));
    setHtml(el("signal"), signalOf(read));
    setHtml(el("footnote"), footnoteOf(read));
    setHtml(
      el("drawing"),
      lanesOf(data, read.status === "ok" ? read.year : yearOf(state.value)),
    );
    fillTable(state.scale);
    setHtml(el("step-note"), stepNoteOf(data));
    setHtml(el("summary"), srOnly(summaryText(read)));
    return read;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === valueEl) {
        syncPreset();
        followRead(render());
        return;
      }
      if (target === sliderEl) {
        valueEl.value = yearAt(valueEl.value, Number(sliderEl.value));
        presetEl.value = CUSTOM_PRESET_ID;
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === scaleEl) {
        syncPreset();
        followRead(render());
        return;
      }
      if (e.target !== presetEl) return;
      const chosen = METER_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset();
      followRead(render());
    },
    { signal },
  );

  syncPreset();
  followRead(render());

  return {
    readState,
    apply,
    render: () => followRead(render()),
    syncPreset,
  };
}

export const mountDoublePrecisionMeter: MountFn<
  DoublePrecisionMeterArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: DayCountLib;
  try {
    lib = await loadDayCountLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPreset();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
