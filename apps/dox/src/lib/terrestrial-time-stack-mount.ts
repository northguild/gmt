/**
 * The Terrestrial Time Stack, mountable on its tool page and in the chat rail.
 *
 * A time on UTC, TAI, TT or TCG goes in. Out come the same instant on all four scales and
 * the three pieces that make TT − UTC (TAI − UTC, TT − TAI and TCG − TT):
 *
 * 1. the controls (the value, a slider through the years, a preset);
 * 2. the reading: four plates, the bar and the drift lane, and the NO SIGNAL slot;
 * 3. the table of the four scales, always four rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every label and number comes from `readStack`
 * (terrestrial-time-stack.ts), which calls the library; the drawing only places what those
 * calls returned.
 *
 * Built on the component kit: `renderTerrestrialTimeStackTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids.
 * Every listener is delegated on the widget with the mount's `signal`, and the mount starts no
 * timers, observers or animation frames. The one drag handle is a native range, and the value
 * field is its typed equivalent.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  hold,
  html,
  idScope,
  instant,
  NO_RESULT,
  plates,
  section,
  setHtml,
  srOnly,
  table,
  textInput,
  widget,
  type Ghost,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  scaleStack,
  type PatternIds,
  type StackView,
} from "~/widgets/families/timescale/scale-stack";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/terrestrial-time-stack.module.css";
import type { EdiCall } from "./edi-widgets";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  INSIDE_FOOTNOTE,
  INSIDE_SECOND_TEXT,
  MAX_VALUE_LENGTH,
  NO_RESULT_TEXT,
  SEGMENT_KEYS,
  SEGMENT_NAMES,
  SEGMENT_WORDS,
  SENTENCES,
  SLIDER_MAX,
  SLIDER_MIN,
  STACK_PRESETS,
  driftSeries,
  driftYears,
  emptyRead,
  isSeeded,
  laneAria,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readStack,
  secondsText,
  stackAria,
  stackReach,
  summaryText,
  yearInstant,
  yearOf,
  type DriftPoint,
  type ScaleRow,
  type StackRead,
  type StackState,
  type TerrestrialTimeStackArgs,
} from "./terrestrial-time-stack";
import { loadTimescaleLib, type TimescaleLib } from "./timescale-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { TerrestrialTimeStackArgs } from "./terrestrial-time-stack";

const WIDGET_NAME = "terrestrial-time-stack";

/**
 * The most calls one reading makes: the token's `from` call, `toTAI`, `toTT`, `toTCG`, the three
 * `from` calls back, `taiMinusUtc`, the constant piece, `tcgMinusTt` and the whole gap.
 */
const MAX_CALLS = 11;

const NBSP = " ";
const NO_SIGNAL_PILL = "⟨ NO SIGNAL — invalid input ⟩";

const TABLE_CAPTION = "The same instant on every scale";
const TABLE_COLUMNS = ["Scale", "Call", "Label", "Back to UTC"] as const;

// ---------------------------------------------------------------------------
// What the markup holds still for
// ---------------------------------------------------------------------------

/** The widest label and seconds a reading prints, so the template holds its boxes before the library is loaded. */
const SAMPLE_LABEL = "8888-88-88T88:88:88.888888888 TCG";
/** A label with no fraction: its last piece (`T00:00:37 TAI`) is wider in a narrow cell than the fraction's. */
const SAMPLE_LABEL_WHOLE = "8888-88-88T88:88:88 TAI";
const SAMPLE_UTC = "8888-88-88T88:88:88Z";
/** Until the library is read: the width of a TT − UTC value, and of the widest seconds a plate prints. */
const SAMPLE_GAP_SECONDS = "88.888 s";
const SAMPLE_SECONDS = "888.888888888 s";
const SAMPLE_CALL = `toTCG("${SAMPLE_UTC}")`;
/**
 * The widest line the code frame can hold. The frame scrolls sideways when a line is wider than
 * the pane, and a scroll bar that takes room only after the library loads would move the page, so
 * the template reserves the library's widest line (a monospace face: only its length counts).
 */
const SAMPLE_WIDEST_LINE =
  'diffUtcAsDuration("2026-01-01T00:00:37Z", "2026-01-01T00:01:09.184Z", "seconds")';

/** What the mount learns from the library about the widest things a reading prints. */
interface Samples {
  labels: readonly string[];
  backs: readonly string[];
  calls: readonly string[];
  /** Every line the code frame can hold. */
  lines: readonly string[];
  values: Readonly<Record<string, readonly string[]>>;
}

const TEMPLATE_SAMPLES: Samples = {
  labels: [SAMPLE_LABEL, SAMPLE_LABEL_WHOLE],
  backs: [SAMPLE_UTC],
  calls: [SAMPLE_CALL],
  lines: [SAMPLE_CALL, SAMPLE_WIDEST_LINE],
  values: {},
};

const PLATE_ROLES = ["hero-gap", ...SEGMENT_KEYS.map((k) => `hero-${k}`)];

/** The values a plate can show, widest first in no order: the constants, then the library's. */
function plateSamples(role: string, samples: Samples): string[] {
  // Once the library is read, a plate holds the widest value it wrote and no wider: a generic
  // nine-digit sample would reserve a wrap no reading takes.
  const read = samples.values[role] ?? [];
  // A plate with no reading says `no result`, which can wrap where a short value does not.
  return [
    NO_RESULT,
    ...(read.length > 0
      ? read
      : [role === "hero-gap" ? SAMPLE_GAP_SECONDS : SAMPLE_SECONDS]),
    ...(role === "hero-gap" ? [INSIDE_SECOND_TEXT] : []),
  ];
}

/** Every sentence a stack can say in place of an answer. */
function sentenceGhosts(): string[] {
  return [...Object.values(SENTENCES), emptyRead().emptyText ?? ""];
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** A value and its unit are one unit: no-break space, so the unit never wraps onto a line of its own. */
function unbroken(text: string | null): string | null {
  return text === null ? null : text.replace(/ (?=s$)/, NBSP);
}

function plateList(read: StackRead | null, samples: Samples): Plate[] {
  return (read?.plates ?? emptyRead().plates).map((s) => ({
    caption: s.caption,
    value: unbroken(s.value),
    lines: s.lines,
    unbroken: true,
    // A plate's lines are fixed words that wrap in a narrow plate; an empty plate keeps their room.
    lineSamples: s.lines.map((line) => [line]),
    ...(s.series === undefined ? {} : { series: s.series }),
    ...(s.quiet === true ? { quiet: true } : {}),
    samples: plateSamples(s.role, samples).map((t) => unbroken(t) ?? t),
    ...(s.role === "hero-gap" ? { words: [INSIDE_SECOND_TEXT] } : {}),
  }));
}

function patternIds(id: (local: string) => string): PatternIds {
  return {
    solid: id("pat-solid"),
    hatch: id("pat-hatch"),
    dots: id("pat-dots"),
  };
}

interface DrawingContext {
  reach: number;
  series: readonly DriftPoint[];
}

/** The drawing of a reading: the bar and the lane. */
function drawingOf(
  read: StackRead | null,
  ctx: DrawingContext,
  ids: PatternIds,
): SafeHtml {
  const ok = read !== null && read.status === "ok";
  const piece = (key: (typeof SEGMENT_KEYS)[number]): number | null =>
    ok ? read.segments[key].seconds : null;
  const view: StackView = {
    label: read === null ? "No stack to draw" : stackAria(read),
    laneLabel:
      read === null
        ? `${SEGMENT_NAMES.drift} against the year`
        : laneAria(ctx.series, read),
    reach: ctx.reach,
    values: {
      steps: piece("steps"),
      constant: piece("constant"),
      drift: piece("drift"),
    },
    chips: SEGMENT_KEYS.map((key) => ({
      key,
      name: SEGMENT_NAMES[key],
      value: ok ? read.segments[key].text : NO_RESULT_TEXT,
      words: SEGMENT_WORDS[key],
    })),
    lane: {
      points: ctx.series,
      cursor:
        ok && read.utc !== null
          ? { year: yearOf(read.utc), value: read.segments.drift.seconds }
          : null,
      yearMin: SLIDER_MIN,
      yearMax: SLIDER_MAX,
    },
    axisName: "seconds ahead of UTC",
    laneName: `${SEGMENT_NAMES.drift}, seconds`,
    format: (s) => `${secondsText(s)} s`,
    keyWords: SEGMENT_WORDS,
  };
  return scaleStack(view, ids);
}

/** A cell that keeps the room of its widest text: the live content and its ghosts. */
function heldInstant(text: string, ghosts: readonly string[]): SafeHtml {
  const live = text === "" ? html`${NBSP}` : instant(text);
  const sized: Ghost[] = [...new Set(ghosts)].map((g) => instant(g));
  return hold(html`<span class="${styles.mono}">${live}</span>`, sized, {
    ghostClass: styles.mono!,
  });
}

function callCell(row: ScaleRow, samples: Samples): SafeHtml {
  const call: EdiCall | null = row.call;
  const live = call === null ? html`${NBSP}` : callLines([call]).code;
  const ghosts: Ghost[] = [...new Set(samples.calls)];
  // The call's tokens are text boxes as wide as their text, so a row with a call and a row
  // without one still count the same elements: the wrapper names them for the gates.
  return hold(
    html`<span class="${styles.wrap}" data-gate="codeframe"><code class="${styles.cell}">${live}</code></span>`,
    ghosts,
    { ghostClass: styles.cell! },
  );
}

function scaleCell(row: ScaleRow): SafeHtml {
  // The tag is always in the row and only shows on the scale the reader gave, so a new reading
  // never adds an element or a line to the row.
  return html`<span class="${styles.scale}">${row.scale}</span> <span class="${styles.tag}" data-state="${row.yours ? "on" : "off"}" ${row.yours ? "" : html`aria-hidden="true"`}>your value</span>`;
}

interface ScaleCells extends Record<(typeof TABLE_COLUMNS)[number], SafeHtml> {}

function tableOf(read: StackRead | null, samples: Samples): SafeHtml {
  const rows = (read?.rows ?? emptyRead().rows).map((row): ScaleCells => {
    const lost = read === null || read.status !== "ok";
    return {
      Scale: scaleCell(row),
      Call: callCell(row, samples),
      Label: heldInstant(lost ? NO_RESULT_TEXT : row.label, samples.labels),
      "Back to UTC": heldInstant(
        lost ? NO_RESULT_TEXT : row.back,
        samples.backs,
      ),
    };
  });
  return table({
    caption: TABLE_CAPTION,
    columns: TABLE_COLUMNS.map((header) => ({
      key: header,
      header,
      align: "start" as const,
      numeric: false,
    })),
    rows,
    rowHeader: "Scale",
    layout: "fixed",
    widths: ["15%", "30%", "35%", "20%"],
    labelCells: true,
    roles: true,
  });
}

function signalOf(read: StackRead | null): SafeHtml {
  const lost = read !== null && read.status === "sentinel";
  const sentence = read?.failure ?? read?.emptyText ?? "";
  return html`<span class="${styles.signal}" data-state="${lost ? "on" : "off"}" ${lost ? "" : html`aria-hidden="true"`}>${NO_SIGNAL_PILL}</span>${hold(
    html`<p class="${styles.sentence}">${sentence === "" ? NBSP : sentence}</p>`,
    sentenceGhosts(),
    { ghostClass: styles.sentence! },
  )}`;
}

function footnoteOf(read: StackRead | null): SafeHtml {
  const text = read?.footnote ?? "";
  return hold(
    html`<span>${text === "" ? NBSP : text}</span>`,
    [INSIDE_FOOTNOTE],
    {
      ghostClass: styles.note!,
    },
  );
}

function codeOf(read: StackRead | null, samples: Samples): SafeHtml {
  const { code, plain } = callLines(read?.calls ?? []);
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy calls",
    copyText: plain,
    code,
    gate: "codeframe",
    minLines: MAX_CALLS,
    sizer: samples.lines.reduce((a, c) => (c.length > a.length ? c : a), ""),
  });
}

function outputPane(read: StackRead | null): SafeHtml {
  const out = outputOf(read?.status ?? "empty", read?.calls ?? []);
  // A NO SIGNAL line is a span the other readings do not have; the wrapper names the output's
  // text as code text, whose boxes are as wide as their text, for the gates.
  return html`<div class="${styles.wrap}" data-gate="codeframe"><code class="${styles.contents}">${callOutput(
    {
      label: "What the calls returned",
      state: out.state,
      lines: out.lines,
      minLines: MAX_CALLS,
    },
  )}</code></div>`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The plates, drawing, rows and outputs are drawn by `mount`, because they come
 * from the real library calls.
 */
export function renderTerrestrialTimeStackTemplate(
  idPrefix: string,
  args: TerrestrialTimeStackArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: StackState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const ids = patternIds(id);
  const empty: DrawingContext = { reach: 1, series: [] };

  const pick = section(
    { id: id("pick"), heading: "1. Say what a clock reads", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...STACK_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.wide}">${field({
        id: id("value"),
        label: "A time on UTC, TAI, TT or TCG",
        hint: hint(
          id("value-hint"),
          "A UTC instant such as 2026-01-01T00:00:00Z, or a label followed by a space and TAI, TT or TCG.",
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
        value: yearOf(state.value) || SLIDER_MIN,
        valueText: String(yearOf(state.value) || SLIDER_MIN),
        ends: [String(SLIDER_MIN), String(SLIDER_MAX)],
      })}</div>`,
    )}</div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. How far TT is from UTC", level: 4 },
    html`${grow(
      html`<div class="${styles.stage}">
        <div class="${styles.platesSlot}" id="${id("plates")}">${plates(plateList(null, TEMPLATE_SAMPLES), { gate: "hero" })}</div>
        <div class="${styles.drawingSlot}" id="${id("drawing")}">${drawingOf(null, empty, ids)}</div>
        <div class="${styles.signalSlot}" id="${id("signal")}">${signalOf(null)}</div>
      </div>`,
    )}
      <p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>`,
  );

  const every = section(
    {
      id: id("every"),
      heading: "3. The same instant on every scale",
      level: 4,
    },
    html`${grow(
      html`<div class="${styles.scales}" id="${id("table")}">${tableOf(null, TEMPLATE_SAMPLES)}</div>`,
    )}
      ${grow(html`<div class="${styles.note}" id="${id("footnote")}">${footnoteOf(null)}</div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "4. What the library returns", level: 4 },
    html`${grow(html`<div id="${id("calls-slot")}">${codeOf(null, TEMPLATE_SAMPLES)}</div>`)}${grow(
      html`<div id="${id("output-slot")}">${outputPane(null)}</div>`,
    )}`,
  );

  return widget(
    {
      name: WIDGET_NAME,
      label: "Terrestrial Time Stack",
      scope: idPrefix,
    },
    html`${pick}${read}${every}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** The widest texts the library writes at the presets and at both ends of the slider. */
function samplesOf(lib: TimescaleLib): Samples {
  const states: StackState[] = [
    ...STACK_PRESETS.map((p) => p.state),
    { value: yearInstant(SLIDER_MIN) },
    { value: yearInstant(SLIDER_MAX) },
  ];
  const labels = new Set<string>();
  const backs = new Set<string>();
  const calls = new Set<string>();
  const lines = new Set<string>();
  const values: Record<string, Set<string>> = {};
  for (const state of states) {
    const read = readStack(lib, state);
    if (read.status !== "ok") continue;
    for (const row of read.rows) {
      labels.add(row.label);
      backs.add(row.back);
      if (row.call !== null) {
        calls.add(callLines([row.call]).plain);
      }
    }
    callLines(read.calls)
      .plain.split("\n")
      .forEach((line) => lines.add(line));
    for (const plate of read.plates) {
      if (plate.value === null) continue;
      (values[plate.role] ??= new Set()).add(plate.value);
    }
  }
  return {
    labels: [SAMPLE_LABEL, SAMPLE_LABEL_WHOLE, ...labels],
    backs: [SAMPLE_UTC, ...backs],
    calls: [SAMPLE_CALL, ...calls],
    lines: [SAMPLE_CALL, ...lines],
    values: Object.fromEntries(
      PLATE_ROLES.map((role) => [role, [...(values[role] ?? [])]]),
    ),
  };
}

interface Controller {
  readState(): StackState;
  apply(state: StackState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: TimescaleLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const sliderEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const valueEl = el<HTMLInputElement>("value");
  const ids = patternIds(idScope(el("plates").id.replace(/-plates$/, "")));

  // Read once: the bar never rescales and the lane never redraws while the reader drags.
  const ctx: DrawingContext = {
    reach: stackReach(lib),
    series: driftSeries(lib, driftYears()),
  };
  const samples = samplesOf(lib);

  // The bounds are set on the live range, in this order: max, ends, then the value.
  sliderEl.min = SLIDER_MIN;
  sliderEl.max = SLIDER_MAX;
  sliderEl.ends = [String(SLIDER_MIN), String(SLIDER_MAX)];
  sliderEl.formatValue = (n) => String(n);

  function readState(): StackState {
    return { value: valueEl.value };
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function apply(state: StackState): void {
    valueEl.value = state.value;
  }

  /** The slider follows a value that reads; a value that does not leaves it where it is. */
  function followRead(read: StackRead): void {
    if (read.status === "ok" && read.utc !== null) {
      sliderEl.value = Math.min(
        SLIDER_MAX,
        Math.max(SLIDER_MIN, yearOf(read.utc)),
      );
    }
  }

  function render(): StackRead {
    const read = readStack(lib, readState());
    setHtml(el("plates"), plates(plateList(read, samples), { gate: "hero" }));
    setHtml(el("drawing"), drawingOf(read, ctx, ids));
    setHtml(el("signal"), signalOf(read));
    setHtml(el("table"), tableOf(read, samples));
    setHtml(el("footnote"), footnoteOf(read));
    setHtml(el("calls-slot"), codeOf(read, samples));
    setHtml(el("output-slot"), outputPane(read));
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
        valueEl.value = yearInstant(Number(sliderEl.value));
        presetEl.value = CUSTOM_PRESET_ID;
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = STACK_PRESETS.find((p) => p.id === presetEl.value);
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

export const mountTerrestrialTimeStack: MountFn<
  TerrestrialTimeStackArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: TimescaleLib;
  try {
    lib = await loadTimescaleLib();
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
