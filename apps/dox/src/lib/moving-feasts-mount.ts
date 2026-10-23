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
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root. Dragging the slider redraws the plates,
 * the grids and the note in place, and none of them changes size: the plates
 * reserve their widest value, and a month grid always draws six week rows.
 */
import { loadFeastsLib, type FeastsLib } from "./feasts-lib";
import { NO_SIGNAL_TEXT } from "./holiday-rule-builder";
import {
  legendHtml,
  monthGridHtml,
  monthName,
  type CellMark,
} from "./holiday-widgets";
import {
  COMPUTUS_CHOICES,
  COMPUTUS_LABELS,
  CUSTOM_PRESET_ID,
  FEAST_OFFSETS,
  FEAST_PRESETS,
  FEASTS_ZONE,
  ORDINAL_VALUES,
  builderHandoff,
  easterCalls,
  easterPlates,
  feastMarks,
  gridMonths,
  isSeeded,
  matchPreset,
  nthModel,
  nthSentence,
  permalinkOf,
  presetState,
  readArgs,
  readersYear,
  sliderRange,
  weekdayLong,
  yearNumber,
  yearTaken,
  drawableMonths,
  undrawnCount,
  yearNote,
  yearNoteSizers,
  callsSizerText,
  nthNoteSizers,
  HINT_NO_OFFSET,
  HINT_NO_YEAR,
  HINT_TOO_MANY,
  HINT_YEAR,
  type ComputusChoice,
  type FeastsState,
  type MovingFeastsArgs,
} from "./moving-feasts";
import { descriptionHoldHtml, plateHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { holdHtml, textSizers } from "./edi-picture";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  setToolLink,
  syncRange,
  toolLinksHtml,
} from "./widget-ui";

export type { MovingFeastsArgs } from "./moving-feasts";

/** What a plate reads when the library placed nothing. */
export const NO_SIGNAL_SHORT = "⟨ NO SIGNAL ⟩";

const CAPTION_NTH = "Date";
const GRID_WEEKEND: readonly number[] = [];
const LEGEND_SERIES = [
  { series: 1, label: "Gregorian series (solid)" },
  { series: 2, label: "Julian series (hatched)" },
  { series: 3, label: "Both series (crosshatch)" },
] as const;

const BUILDER_LINKS = [
  { role: "link-builder", text: "Build a calendar from these" },
];

let counter = 0;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** A plate whose value is the library's date, or NO SIGNAL (amber) when it
 *  returned nothing. */
function plateOf(
  role: string,
  caption: string,
  value: string | null,
  line: string,
  series: 1 | 2 | 3,
): string {
  const html = plateHtml({
    role,
    caption,
    value: value ?? NO_SIGNAL_SHORT,
    lines: [value === null ? "" : line],
    series,
  });
  return value === null
    ? html.replace(`data-role="${role}"`, `data-role="${role}" data-signal`)
    : html;
}

function easterPlatesHtml(plates: ReturnType<typeof easterPlates>): string {
  return (
    plateOf(
      "hero-gregorian",
      "Gregorian Easter",
      plates.gregorian,
      "Gregorian computus",
      1,
    ) +
    plateOf(
      "hero-julian",
      "Julian Easter",
      plates.julian,
      "Julian computus, Gregorian date",
      2,
    ) +
    plateOf("hero-apart", "Apart", plates.apart, plates.side, 3)
  );
}

function legendSeriesHtml(): string {
  return (
    `<ul class="gmt-holiday-legend gmt-feasts-legend">` +
    LEGEND_SERIES.map(
      (l) =>
        `<li data-series="${l.series}"><span class="gmt-holiday-swatch" data-kind="pick" data-series="${l.series}" aria-hidden="true"></span>${escapeHtml(l.label)}</li>`,
    ).join("") +
    `</ul>`
  );
}

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
): string {
  try {
    return monthGridHtml({
      year: gridYear(year, fallback),
      months,
      marks,
      weekend: GRID_WEEKEND,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return monthGridHtml({
      year: readersYear(),
      months: { from: Math.min(months.from, 12), to: months.to },
      marks: {},
      weekend: GRID_WEEKEND,
    });
  }
}

function presetOptionsHtml(id: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${id === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    FEAST_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === id ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

const MONTH_OPTIONS = (selected: string): string =>
  Array.from({ length: 12 }, (_, i) => i + 1)
    .map(
      (m) =>
        `<option value="${m}"${String(m) === selected ? " selected" : ""}>${monthName(m)}</option>`,
    )
    .join("");

const WEEKDAY_OPTIONS = (selected: string): string =>
  Array.from({ length: 7 }, (_, i) => i + 1)
    .map(
      (d) =>
        `<option value="${d}"${String(d) === selected ? " selected" : ""}>${weekdayLong(d)}</option>`,
    )
    .join("");

const ORDINAL_OPTIONS = (selected: string): string =>
  ORDINAL_VALUES.map(
    (o) =>
      `<option value="${o}"${o === selected ? " selected" : ""}>${o === "last" ? "last" : o}</option>`,
  ).join("");

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The grids are drawn here without the
 * library (no marks); `mount` draws every result.
 */
export function renderMovingFeastsTemplate(
  args: MovingFeastsArgs = {},
): string {
  const uid = `gmt-feasts-${++counter}`;
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(FEAST_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = FEAST_PRESETS.find((p) => p.id === presetId);
  const range = sliderRange(readersYear());
  const typed = yearNumber(state.year);
  const sliderValue = Math.min(
    range.max,
    Math.max(range.min, Number.isFinite(typed) ? typed : range.min),
  );
  const shown = Number.isInteger(typed) ? typed : range.min + 100;
  const offsetBoxes = FEAST_OFFSETS.map((o) =>
    chipToggleHtml({
      type: "checkbox",
      role: "offset",
      value: String(o.offset),
      label: o.label,
      checked: state.offsets.includes(o.offset),
    }),
  ).join("");
  const computusBoxes = COMPUTUS_CHOICES.map((c) =>
    chipToggleHtml({
      type: "radio",
      role: "computus",
      name: `${uid}-computus`,
      value: c,
      label: COMPUTUS_LABELS[c],
      checked: state.computus === c,
    }),
  ).join("");
  const nthShown = (() => {
    try {
      return monthGridHtml({
        year: shown,
        months: { from: Number(state.month), to: Number(state.month) },
        marks: {},
        weekend: GRID_WEEKEND,
      });
    } catch {
      return "";
    }
  })();

  return (
    `<div class="gmt-moving-feasts gmt-widget not-content" data-uid="${uid}">` +
    `<div class="gmt-widget-card">` +
    // 1. Easter
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Easter and its offsets</h4>` +
    `<div class="gmt-field-grid">` +
    `<div class="gmt-label gmt-feasts-year">` +
    `<label class="gmt-label-text" for="${uid}-year">Year</label>` +
    `<input class="gmt-input" id="${uid}-year" data-role="year" type="number" step="1" inputmode="numeric" value="${escapeAttr(state.year)}">` +
    `</div>` +
    `<div class="gmt-label gmt-field-wide gmt-feasts-slider">` +
    `<span class="gmt-label-text">Drag the year</span>` +
    rangeFieldHtml({
      role: "year-slider",
      min: range.min,
      max: range.max,
      step: 1,
      value: sliderValue,
      valueText: String(sliderValue),
      ends: [String(range.min), String(range.max)],
      label: "Year slider",
    }) +
    `</div>` +
    `<fieldset class="gmt-chip-group gmt-field-wide"><legend>Computus</legend>${computusBoxes}</fieldset>` +
    `<fieldset class="gmt-chip-group gmt-field-wide"><legend>Days from Easter</legend>${offsetBoxes}</fieldset>` +
    `</div>` +
    `<div class="gmt-holiday-frame">` +
    `<div class="gmt-punct-heroes gmt-feasts-heroes" data-role="heroes" aria-hidden="true">${easterPlatesHtml({ gregorian: "", julian: "", apart: "", side: "" })}</div>` +
    `<p class="gmt-ledger-sr" data-role="year-sentence" aria-live="polite"></p>` +
    `<div data-role="easter-grid">${safeGrid(shown, shown, { from: 2, to: 6 }, {})}</div>` +
    legendSeriesHtml() +
    holdHtml(
      `<p class="gmt-feasts-note" data-role="year-note"></p>`,
      textSizers("p", "gmt-feasts-note", yearNoteSizers()),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    `</div>` +
    // 2. Ordinal weekdays
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Ordinal weekdays</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      FEAST_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Month")}` +
    `<select class="gmt-select" data-role="month">${MONTH_OPTIONS(state.month)}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Weekday")}` +
    `<select class="gmt-select" data-role="weekday">${WEEKDAY_OPTIONS(state.weekday)}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Ordinal")}` +
    `<select class="gmt-select" data-role="ordinal">${ORDINAL_OPTIONS(state.ordinal)}</select></label>` +
    `</div>` +
    `<div class="gmt-holiday-frame">` +
    `<div class="gmt-punct-heroes gmt-feasts-heroes" data-role="nth-heroes" aria-hidden="true">${plateOf("nth-hero", CAPTION_NTH, "", "", 1)}</div>` +
    `<p class="gmt-ledger-sr" data-role="nth-sentence" aria-live="polite"></p>` +
    `<div data-role="nth-grid">${nthShown}</div>` +
    legendHtml(["pick"]) +
    `<p class="gmt-widget-hint gmt-feasts-chiphint">The numbers on a day are its ordinals: 1 is the first such weekday of the month, -1 the last.</p>` +
    // The note holds its own sizers (hidden spans stacked on its text) so the
    // paragraph itself is as tall as the worst reason at this width, in every
    // engine, whether or not it speaks.
    `<p class="gmt-feasts-note gmt-feasts-note--held" data-role="nth-note"><span data-role="nth-note-text"></span>` +
    nthNoteSizers()
      .map(
        (t) =>
          `<span class="gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore>${escapeHtml(t)}</span>`,
      )
      .join("") +
    `</p>` +
    `</div>` +
    `</div>` +
    // 3. The calls
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The calls</h4>` +
    `<details class="gmt-feasts-calls"><summary>Every call behind the dates above</summary>` +
    // The pre sits in a hold: its hidden twin prints the widest calls
    // (`callsSizerText`), so no year wraps a line the frame has no room for.
    `<div class="gmt-ledger-hold">` +
    `<pre class="gmt-codeframe-pre"><code data-role="calls"></code></pre>` +
    `<pre class="gmt-codeframe-pre gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore><code data-role="calls-sizer"></code></pre>` +
    `</div></details>` +
    toolLinksHtml(BUILDER_LINKS) +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="handoff-hint"></p>`,
      textSizers("p", "gmt-widget-hint", [
        HINT_NO_OFFSET,
        HINT_NO_YEAR,
        HINT_TOO_MANY,
        HINT_YEAR,
      ]),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): FeastsState;
  apply(state: FeastsState): void;
}

function setupWidget(root: HTMLElement, lib: FeastsLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const yearEl = q<HTMLInputElement>("year")!;
  const sliderEl = q<HTMLInputElement>("year-slider")!;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const monthEl = q<HTMLSelectElement>("month")!;
  const weekdayEl = q<HTMLSelectElement>("weekday")!;
  const ordinalEl = q<HTMLSelectElement>("ordinal")!;
  const offsetEls = [
    ...root.querySelectorAll<HTMLInputElement>('[data-role="offset"]'),
  ];
  const computusEls = [
    ...root.querySelectorAll<HTMLInputElement>('[data-role="computus"]'),
  ];

  // The slider spans the reader's year plus or minus a century. The template
  // was rendered at build time, so the ends are set again from the clock here.
  const range = sliderRange(readersYear());
  sliderEl.min = String(range.min);
  sliderEl.max = String(range.max);
  const ends = sliderEl
    .closest(".gmt-range-field")
    ?.querySelectorAll<HTMLElement>(".gmt-range-ends > span");
  if (ends && ends.length === 2) {
    ends[0]!.textContent = String(range.min);
    ends[1]!.textContent = String(range.max);
  }

  let state: FeastsState = presetState(FEAST_PRESETS[0]!);
  /** The last year the grids could draw, kept for a typed year they cannot. */
  let drawnYear = readersYear();

  function syncControls(): void {
    yearEl.value = state.year;
    monthEl.value = state.month;
    weekdayEl.value = state.weekday;
    ordinalEl.value = state.ordinal;
    for (const el of offsetEls) {
      el.checked = state.offsets.includes(Number(el.value));
    }
    for (const el of computusEls) el.checked = el.value === state.computus;
  }

  function syncSlider(): void {
    const year = yearNumber(state.year);
    if (Number.isInteger(year)) {
      const clamped = Math.min(range.max, Math.max(range.min, year));
      sliderEl.value = String(clamped);
      syncRange(sliderEl, String(clamped));
    }
  }

  function syncPreset(): void {
    const id = matchPreset(state);
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        FEAST_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  // The printed calls: the two sections write theirs, and both are shown.
  let easterLines: string[] = [];
  let nthLines: string[] = [];
  function drawCalls(): void {
    const code = q("calls");
    if (code) code.textContent = [...easterLines, ...nthLines].join("\n");
    const twin = q("calls-sizer");
    if (twin) {
      twin.textContent = callsSizerText({
        offsets: state.offsets,
        computus: state.computus,
        month: Number(state.month),
        weekday: Number(state.weekday),
        ordinal: state.ordinal,
      });
    }
  }

  function drawEaster(): void {
    const year = yearNumber(state.year);
    const taken = yearTaken(year);
    const plates = easterPlates(lib, year);
    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = easterPlatesHtml(plates);

    const picked = taken
      ? feastMarks(lib, year, state.offsets, state.computus)
      : { marks: {}, dates: [], calls: [] };
    const months = gridMonths(picked.dates, taken ? year : 0);
    const drawn = taken ? drawableMonths(year, months) : null;
    const grid = q("easter-grid");
    if (grid) {
      grid.innerHTML = !taken
        ? safeGrid(readersYear(), readersYear(), months, {})
        : drawn === null
          ? ""
          : safeGrid(year, drawnYear, drawn, picked.marks);
      if (taken && drawn !== null) drawnYear = year;
    }

    const note = q("year-note");
    if (note) {
      const words = yearNote({
        year: state.year,
        taken,
        gregorian: plates.gregorian,
        julian: plates.julian,
        outside: months.outside,
        undrawn: undrawnCount(picked.dates, year, drawn),
      });
      note.textContent = words;
      note.dataset["state"] = !taken
        ? "sentinel"
        : words === ""
          ? "ok"
          : "note";
    }

    const sentence = q("year-sentence");
    if (sentence) {
      sentence.textContent = !taken
        ? `${state.year}: no Easter placed.`
        : `${state.year}: Gregorian Easter ${plates.gregorian ?? "not placed"}, Julian Easter ${plates.julian ?? "not placed"}, ${plates.apart === null ? "distance not placed" : plates.apart === "same day" ? "the same day" : `${plates.apart} apart`}.`;
    }

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
    const plate = q("nth-heroes");
    if (plate) {
      plate.innerHTML = plateOf(
        "nth-hero",
        CAPTION_NTH,
        placed ? model.date : null,
        nthSentence(state.year, month, weekday, state.ordinal),
        1,
      );
    }
    const grid = q("nth-grid");
    if (grid) {
      const shown = yearTaken(year)
        ? drawableMonths(year, { from: month, to: month })
        : null;
      grid.innerHTML =
        shown === null ? "" : safeGrid(year, drawnYear, shown, model.marks);
    }
    const note = q("nth-note");
    const noteText = q("nth-note-text");
    if (note && noteText) {
      if (placed) {
        noteText.textContent = "";
        note.dataset["state"] = "ok";
      } else {
        noteText.textContent = `${NO_SIGNAL_TEXT}: ${model.reason}`;
        note.dataset["state"] = "sentinel";
      }
    }
    const sentence = q("nth-sentence");
    if (sentence) {
      sentence.textContent = placed
        ? `${nthSentence(state.year, month, weekday, state.ordinal)}: ${model.date}.`
        : `${nthSentence(state.year, month, weekday, state.ordinal)}: ${model.reason}`;
    }
    nthLines = model.calls;
    drawCalls();
  }

  function drawHandoff(yearIsPlaced: boolean): void {
    const { href, hint } = builderHandoff(state, yearIsPlaced);
    setToolLink(q("link-builder"), href);
    const slot = q("handoff-hint");
    if (slot) slot.textContent = hint;
  }

  function recompute(): void {
    syncPreset();
    drawEaster();
    drawNth();
  }

  function fromControls(): void {
    state.offsets = offsetEls
      .filter((el) => el.checked)
      .map((el) => Number(el.value))
      .sort((a, b) => a - b);
    const picked = computusEls.find((el) => el.checked);
    if (picked) state.computus = picked.value as ComputusChoice;
  }

  function onField(e: Event): void {
    const el = e.target as HTMLElement;
    const role = el.dataset?.["role"];
    switch (role) {
      case "year":
        state.year = (el as HTMLInputElement).value;
        syncSlider();
        recompute();
        break;
      case "year-slider": {
        const slider = el as HTMLInputElement;
        state.year = slider.value;
        yearEl.value = slider.value;
        syncRange(slider, slider.value);
        recompute();
        break;
      }
      case "offset":
      case "computus":
        fromControls();
        drawEaster();
        break;
      case "month":
      case "weekday":
      case "ordinal":
        state[role] = (el as HTMLSelectElement).value;
        syncPreset();
        drawNth();
        break;
      case "preset": {
        if (e.type !== "change") return;
        const preset = FEAST_PRESETS.find(
          (p) => p.id === (el as HTMLSelectElement).value,
        );
        if (!preset) return;
        apply(presetState(preset, state));
        break;
      }
    }
  }

  root.addEventListener("input", onField);
  root.addEventListener("change", onField);

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
  let lib: FeastsLib;
  try {
    lib = await loadFeastsLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) widget.apply(readArgs(args));

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};

export { FEASTS_ZONE };
