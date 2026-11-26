/**
 * The Code B Day Ruler, mountable on its tool page and in the chat rail (SPA-52).
 *
 * The reader picks two years and one day number. Two readouts say what the day is in each year
 * (its Code B text, its Code A text and the date in words), a line compares them, and a ruler
 * draws each year's twelve months on one fixed scale of 366 day columns, so a month starts a
 * day further left in a leap year. A cursor marks the day on both lanes.
 *
 * Every figure comes from the library through `createRuler` (code-b-day-ruler.ts): the mount
 * holds no leap-year rule, no month length and no year length, and the drawing only places
 * what those calls returned. A drag step makes four calls and none for the month bands, which
 * are read once for each typed year.
 *
 * Built on the component kit: `renderCodeBDayRulerTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. Every
 * listener is delegated on the widget with the mount's `signal`, and the mount starts no
 * timers, observers or animation frames.
 */
import { defineElements } from "~/widgets/define";
import {
  axis,
  card,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  hold,
  html,
  idScope,
  lane,
  mark,
  section,
  setHtml,
  srOnly,
  tick,
  widget,
  type Ghost,
  type SafeHtml,
} from "~/widgets/builders";
import { callLines } from "~/widgets/families/gnss/call-lines";
import { numberInput } from "~/widgets/families/timescale/number-input";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import { grow } from "~/widgets/primitives/grow/grow";
import styles from "~/widgets/tools/code-b-day-ruler.module.css";
import { loadCcsdsLib } from "./ccsds-lib";
import type { CcsdsLib } from "./ccsds-widgets";
import {
  AXIS_DAYS,
  CODE_A_SAMPLE,
  CODE_B_SAMPLE,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  MAX_CALLS,
  MAX_YEAR,
  MIN_YEAR,
  NEED_TWO_YEARS,
  NO_RESULT_TEXT,
  RULER_PRESETS,
  SCALE_DAYS,
  TYPE_A_YEAR,
  absentCell,
  bandsOf,
  createRuler,
  dayAt,
  fieldDay,
  isSeeded,
  matchPreset,
  noDaySentence,
  permalinkOf,
  presetState,
  readArgs,
  sentenceGhosts,
  type DayRulerArgs,
  type LaneRead,
  type RulerRead,
  type RulerState,
} from "./code-b-day-ruler";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { DayRulerArgs } from "./code-b-day-ruler";

const WIDGET_NAME = "code-b-day-ruler";
/** A no-break space: a plain space would collapse and leave an empty cell with no height. */
const NBSP = "\u00a0";
const NO_SIGNAL_SHORT = "⟨ NO SIGNAL ⟩";
const NONE_TEXT = "none";
/**
 * The widest header the year field can produce. The field takes digits past its `max`, so a
 * five-digit year is held for, in both the read and the no-result form.
 */
const HEADER_SAMPLES = [
  "88888 · 366 days",
  `88888 · ${NO_RESULT_TEXT}`,
  "No year",
];
const CALL_SAMPLE = `parseCcsdsAsciiB("${CODE_B_SAMPLE}")`;
const FORMAT_SAMPLE = `formatCcsdsAsciiA("8888-88-88T88:88:88.888888888Z", 0)`;
/** The widest date line before a library reading: day, then a long month name. */
const FALLBACK_NAME = "September";

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** A mono value in a hold, sized by its widest text. */
function monoHold(
  text: string,
  ghosts: readonly Ghost[],
  lost = false,
): SafeHtml {
  const cls = lost ? `${styles.mono} ${styles.lost}` : styles.mono;
  return hold(
    html`<span class="${cls}">${text === "" ? NBSP : text}</span>`,
    ghosts,
    {
      ghostClass: styles.mono!,
    },
  );
}

function dateGhosts(longestName: string): string[] {
  return [
    `88 ${longestName}`,
    noDaySentence("888", "8888"),
    "The library reads no Code B in year 88888.",
    TYPE_A_YEAR,
  ];
}

function headerOf(text: string, series: 1 | 2): SafeHtml {
  return html`<div class="${styles.head}" data-series="${series}">${hold(
    html`<span>${text}</span>`,
    HEADER_SAMPLES,
  )}</div>`;
}

/**
 * What is inside one year's readout card. `null` draws it with nothing in it, before the library
 * has loaded. The card and its `.readout` wrapper are written once by the template; a redraw
 * only replaces this content, so the card is never re-inserted and its entrance never replays.
 */
function readoutBody(
  lane: LaneRead | null,
  series: 1 | 2,
  longestName: string,
  typed: string,
): SafeHtml {
  const status = lane?.status ?? "empty";
  const lost = status === "none";
  const codeB = lost ? NO_SIGNAL_SHORT : (lane?.codeB ?? "");
  const codeA =
    lane === null || status !== "ok"
      ? lost
        ? NO_SIGNAL_SHORT
        : ""
      : lane.missing
        ? NONE_TEXT
        : lane.codeA;
  const date = lane?.date ?? (typed === "" ? TYPE_A_YEAR : "");
  return html`${headerOf(
    lane?.header ?? (typed === "" ? "No year" : typed),
    series,
  )}<dl class="${styles.facts}"><dt>Code B</dt><dd>${monoHold(
    codeB,
    [CODE_B_SAMPLE, NO_SIGNAL_SHORT],
    lost,
  )}</dd><dt>Code A</dt><dd>${monoHold(
    codeA,
    [CODE_A_SAMPLE, NO_SIGNAL_SHORT, NONE_TEXT],
    lost,
  )}</dd><dt>Date</dt><dd>${hold(
    html`<span class="${styles.date}">${date === "" ? NBSP : date}</span>`,
    dateGhosts(longestName),
    { ghostClass: styles.date! },
  )}</dd></dl>`;
}

/** One year's card: written once, with a wrapper `mount` refills by its id. */
function readoutCard(
  id: (part: string) => string,
  part: string,
  body: SafeHtml,
): SafeHtml {
  return card(
    html`<div class="${styles.readout}" id="${id(part)}">${body}</div>`,
    {
      gate: "hero",
    },
  );
}

function sentenceOf(read: RulerRead | null, longestName: string): SafeHtml {
  return hold(
    html`<p class="${styles.sentence}">${read?.sentence ?? NEED_TWO_YEARS}</p>`,
    sentenceGhosts(longestName),
    { ghostClass: styles.sentence! },
  );
}

/** One lane: the month bands, the absent cell, the month ticks and the cursor. */
function laneOf(
  read: LaneRead | null,
  series: 1 | 2,
  day: number,
  shortNames: readonly string[],
): SafeHtml {
  const label = read?.header ?? "No year";
  if (read === null || read.status !== "ok") {
    return lane({ label, gate: "drawn" }, html``);
  }
  const bands = bandsOf(read, shortNames);
  const absent = absentCell(read);
  const bandMarks = bands.map((b, i) =>
    mark({
      label: `${b.label}, from day ${fieldDay(read.starts[i] ?? 1)}`,
      at: b.at,
      span: b.span,
      series,
      pattern: b.pattern,
    }),
  );
  const absentMark =
    absent === null
      ? ""
      : mark({
          label: `no day ${SCALE_DAYS}`,
          at: absent.at,
          span: absent.span,
          series: 4,
          pattern: "hatch",
        });
  const ticks = bands.map((b) => tick({ at: b.at, label: b.label }));
  const cursor = mark({
    label: read.missing
      ? `Day ${fieldDay(day)}, not in ${read.year}`
      : `Day ${fieldDay(day)}`,
    at: dayAt(day),
    series: 3,
  });
  return lane(
    { label, gate: "drawn" },
    html`${bandMarks}${absentMark}${ticks}${cursor}`,
  );
}

function rulerOf(
  read: RulerRead | null,
  state: RulerState,
  shortNames: readonly string[],
): SafeHtml {
  const day = read?.day ?? state.day;
  return html`<div class="${styles.ruler}">${laneOf(
    read?.lanes[0] ?? null,
    1,
    day,
    shortNames,
  )}${laneOf(read?.lanes[1] ?? null, 2, day, shortNames)}${axis(
    AXIS_DAYS.map((d) => tick({ at: dayAt(d), label: String(d) })),
  )}</div>`;
}

const SIZER_LINES = MAX_CALLS;

function callsOf(read: RulerRead | null): SafeHtml {
  const { code, plain } = callLines(read?.calls ?? []);
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy calls",
    copyText: plain,
    code,
    gate: "codeframe",
    minLines: SIZER_LINES,
    sizer:
      FORMAT_SAMPLE.length > CALL_SAMPLE.length ? FORMAT_SAMPLE : CALL_SAMPLE,
  });
}

function ariaOf(read: RulerRead | null): string {
  return read === null ? "" : read.lanes.map((l) => l.aria).join(". ");
}

/** The fallback month names: the template draws no month before the library loads. */
const TEMPLATE_NAMES: readonly string[] = [];

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The readouts, ruler and calls are drawn by `mount`, because they come from
 * the real library calls.
 */
export function renderCodeBDayRulerTemplate(
  idPrefix: string,
  args: DayRulerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args) ? readArgs(args) : presetState(DEFAULT_PRESET);

  const pick = section(
    { id: id("pick"), heading: "1. Two years and a day", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...RULER_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}</div>${fieldGrid(
      html`${field({
        id: id("year"),
        label: "Year",
        hint: hint(id("year-hint"), "A year from 1 to 9999."),
        control: ({ id: cid, describedBy }) =>
          numberInput({
            id: cid,
            value: state.year,
            min: MIN_YEAR,
            max: MAX_YEAR,
            step: 1,
            ...(describedBy === undefined ? {} : { describedBy }),
          }),
      })}${field({
        id: id("compare"),
        label: "Compare with",
        hint: hint(
          id("compare-hint"),
          "A second year to read the same day in.",
        ),
        control: ({ id: cid, describedBy }) =>
          numberInput({
            id: cid,
            value: state.compare,
            min: MIN_YEAR,
            max: MAX_YEAR,
            step: 1,
            ...(describedBy === undefined ? {} : { describedBy }),
          }),
      })}`,
    )}<div class="${styles.wide}">${range({
      id: id("day"),
      label: "Day of year",
      min: 1,
      max: SCALE_DAYS,
      step: 1,
      value: state.day,
      valueText: `Day ${fieldDay(state.day)}`,
      ends: ["1", String(SCALE_DAYS)],
    })}</div></div>`,
  );

  const reading = section(
    { id: id("read"), heading: "2. The same day in each year", level: 3 },
    html`<div class="${styles.stack}"><div class="${styles.pair}"><div class="${styles.cards}" id="${id("cards")}">${readoutCard(
      id,
      "readout-1",
      readoutBody(null, 1, FALLBACK_NAME, state.year),
    )}${readoutCard(
      id,
      "readout-2",
      readoutBody(null, 2, FALLBACK_NAME, state.compare),
    )}</div></div
      ><div role="status" aria-label="Comparison" id="${id("sentence")}">${sentenceOf(
        null,
        FALLBACK_NAME,
      )}</div
      >${grow(
        html`<div id="${id("ruler")}">${rulerOf(null, state, TEMPLATE_NAMES)}</div>`,
      )}<p id="${id("ruler-text")}">${srOnly("")}</p></div>`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. The calls", level: 3 },
    grow(html`<div id="${id("calls-slot")}">${callsOf(null)}</div>`),
  );

  return widget(
    { name: WIDGET_NAME, label: "Code B Day Ruler", scope: idPrefix },
    html`${pick}${reading}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): RulerState;
  apply(state: RulerState): void;
}

function setupWidget(
  root: HTMLElement,
  lib: CcsdsLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const yearEl = el<HTMLInputElement>("year");
  const compareEl = el<HTMLInputElement>("compare");
  const sliderEl = el("day").closest<GmtRange>("gmt-range")!;
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const ruler = createRuler(lib);

  sliderEl.formatValue = (n) => `Day ${fieldDay(n)}`;

  let state: RulerState = presetState(DEFAULT_PRESET);

  function draw(): void {
    presetEl.value = matchPreset(state);
    const read = ruler.read(state);
    setHtml(
      el("readout-1"),
      readoutBody(read.lanes[0], 1, ruler.longestName, state.year),
    );
    setHtml(
      el("readout-2"),
      readoutBody(read.lanes[1], 2, ruler.longestName, state.compare),
    );
    setHtml(el("sentence"), sentenceOf(read, ruler.longestName));
    setHtml(el("ruler"), rulerOf(read, state, ruler.shortNames));
    setHtml(el("ruler-text"), srOnly(ariaOf(read)));
    setHtml(el("calls-slot"), callsOf(read));
  }

  function syncControls(): void {
    yearEl.value = state.year;
    compareEl.value = state.compare;
    sliderEl.value = state.day;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === yearEl) {
        state = { ...state, year: yearEl.value };
      } else if (target === compareEl) {
        state = { ...state, compare: compareEl.value };
      } else if (target === sliderEl) {
        state = { ...state, day: Number(sliderEl.value) };
      } else {
        return;
      }
      draw();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = RULER_PRESETS.find((p) => p.id === presetEl.value);
      if (chosen) apply(presetState(chosen));
    },
    { signal },
  );

  function apply(next: RulerState): void {
    state = next;
    syncControls();
    draw();
  }

  apply(state);

  return { readState: () => state, apply };
}

export const mountCodeBDayRuler: MountFn<DayRulerArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: CcsdsLib;
  try {
    lib = await loadCcsdsLib();
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
