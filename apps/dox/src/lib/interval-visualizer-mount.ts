/**
 * The interval algebra visualizer, mountable on its tool page and in the chat rail.
 *
 * Two intervals go in, dragged on a shared timeline or typed. The four zoned interval
 * operations come out, each drawn as a result lane under the intervals on the same scale and
 * printed as the call made and what it returned:
 *
 * 1. a relationship preset, six lanes on one timeline (A, B, then one for each operation) and
 *    the four typed instants that are the keyboard and typed equivalent of dragging;
 * 2. the four operations, each as its call and its result.
 *
 * Built on the component kit: `renderIntervalTemplate` writes the markup from builders only,
 * with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. Every listener is
 * delegated on the widget with the mount's `signal`.
 *
 * The four handles are `<gmt-handle>`s. Each owns its pointer drag and its keys (arrows, PageUp,
 * PageDown, Home, End) and keeps a start from passing its own end. Their value is a position
 * on the canvas in tenths of a percent; the typed instant is the source of truth, so a handle
 * writes the instant at its position into the typed field and the draw reads the fields back.
 *
 * The library returns `null` / `[]` both for invalid input and for intervals that genuinely do
 * not overlap. The widget validates each interval with the library's own gate first, so a refused
 * interval reads as NO SIGNAL and a correct empty answer reads as `[] — correctly empty`.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  axis,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  lane,
  mark,
  raw,
  section,
  setHtml,
  textInput,
  tick,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callOutput,
  type CallOutputLine,
} from "~/widgets/families/gnss/call-output";
import { intervalBar } from "~/widgets/families/interval/interval-bar";
import { grow } from "~/widgets/primitives/grow/grow";
import { handle, type GmtHandle } from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/interval-visualizer.module.css";
import {
  FIXED_YEAR_SCALE,
  INTERVAL_OPERATIONS,
  RELATIONSHIP_PRESETS,
  buildRelationshipPreset,
  classifyRelationship,
  fitTimelineScale,
  formatInstant,
  formatInterval,
  formatIntervalList,
  type IntervalOperationId,
  type IntervalOperationInfo,
  type RelationshipPreset,
  type TimelineScale,
  type ZonedInterval,
} from "./interval-visualizer";
import { GMT_MODULES } from "./gmt-modules";
import { callArgs } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";
import { normaliseZonedInput } from "./zoned-input";

export interface IntervalArgs {
  aStart?: string;
  aEnd?: string;
  bStart?: string;
  bEnd?: string;
}

const WIDGET_NAME = "interval-visualizer";

/** A handle's value is a position on the canvas, in tenths of a percent. */
const POSITION_MAX = 1000;
/** PageUp and PageDown move this many keyboard steps. */
const BIG_STEP_UNITS = 7;

const NO_SIGNAL_TEXT = "NO SIGNAL";

type Key = "aStart" | "aEnd" | "bStart" | "bEnd";
const KEYS: readonly Key[] = ["aStart", "aEnd", "bStart", "bEnd"];
const LOCAL: Record<Key, string> = {
  aStart: "a-start",
  aEnd: "a-end",
  bStart: "b-start",
  bEnd: "b-end",
};
const HANDLE_NAME: Record<Key, string> = {
  aStart: "Interval A start",
  aEnd: "Interval A end",
  bStart: "Interval B start",
  bEnd: "Interval B end",
};
/** Series 1 to 4 are the timeline's four colours, one for each operation. */
const OP_SERIES = {
  intersection: 1,
  union: 2,
  difference: 3,
  xor: 4,
} as const satisfies Record<IntervalOperationId, 1 | 2 | 3 | 4>;

/** What each geometric relationship means for the four operations. */
const RELATIONSHIP_SENTENCES = {
  invalid: "One of the intervals is reversed (its start is after its end).",
  identical:
    "A and B are exactly the same span — intersection and union both equal A (and B); difference and xor are both empty.",
  disjoint:
    "A and B share no time at all — intersection and union are both empty; difference returns all of A; xor returns both A and B.",
  adjacent:
    "A ends the instant B starts. The *Zoned interval functions are half-open [start, end), so A's end is not inside A and the intervals share no instant: intersection is empty, and union joins them into one span. Difference returns all of A, and xor returns the same single joined span as union.",
  "a-contains-b":
    "B sits entirely inside A — intersection and union both equal A's outer bounds (union) or B (intersection); difference returns the two pieces of A on either side of B; xor returns those same two pieces.",
  "b-contains-a":
    'A sits entirely inside B — mirror image of "A contains B": intersection equals A, union equals B, difference is empty (B fully covers A), xor returns the two pieces of B around A.',
  overlapping:
    "A and B partially overlap — intersection is the shared middle; union is the full merged span; difference is A's outer edge; xor is both outer edges.",
} as const;

const INVALID_SENTENCE =
  "One or both intervals fail validation (unparseable, or start after end) — highlighted below. The four operations can't run on invalid input.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** One keyboard step, in handle units: the canvas's own snap unit. */
function stepOf(scale: TimelineScale): number {
  const span = Math.max(1, scale.endMs - scale.startMs);
  return ((scale.snapMinutes * 60_000) / span) * POSITION_MAX;
}

/** A handle's position for an instant; an unreadable one sits at the start. */
function positionOf(scale: TimelineScale, iso: string): number {
  const pct = scale.toPercent(iso);
  return Number.isNaN(pct) ? 0 : (pct * POSITION_MAX) / 100;
}

/** The instant a handle's position stands for, on the canvas's snap grid. */
function instantAt(scale: TimelineScale, position: number): string {
  return scale.fromPercent((position * 100) / POSITION_MAX);
}

const readable = (iso: string): string => formatInstant(iso) || "no value";

function barOf(
  name: "A" | "B",
  start: string,
  end: string,
  scale: TimelineScale,
  valid: boolean,
): SafeHtml {
  const left = scale.toPercent(start);
  const right = scale.toPercent(end);
  if (Number.isNaN(left) || Number.isNaN(right)) return html``;
  return intervalBar({
    label: valid
      ? `Interval ${name}, ${readable(start)} to ${readable(end)}`
      : `Interval ${name}, not a valid interval`,
    at: left / 100,
    span: (right - left) / 100,
    series: name === "A" ? 1 : 2,
    valid,
  });
}

function segmentsOf(
  op: IntervalOperationInfo,
  result: ZonedInterval | ZonedInterval[] | null,
  scale: TimelineScale,
): SafeHtml {
  if (result === null) return html``;
  const list = Array.isArray(result) ? result : [result];
  return html`${list.map((seg) => {
    const left = scale.toPercent(seg.start);
    const right = scale.toPercent(seg.end);
    if (Number.isNaN(left) || Number.isNaN(right)) return html``;
    return mark({
      label: `${op.label}: ${formatInterval(seg)}`,
      at: left / 100,
      span: Math.max(0.005, (right - left) / 100),
      series: OP_SERIES[op.id],
    });
  })}`;
}

function axisOf(scale: TimelineScale): SafeHtml {
  return axis(
    scale
      .labels()
      .map((label, i, all) => tick({ at: i / (all.length - 1), label })),
  );
}

function relationshipOf(
  valid: boolean,
  a: ZonedInterval,
  b: ZonedInterval,
): SafeHtml {
  if (!valid) {
    return aside(
      {
        label: "Relationship of A and B",
        tone: "caution",
        title: "Invalid input",
      },
      html`<p>${INVALID_SENTENCE}</p>`,
    );
  }
  const kind = classifyRelationship(a, b);
  return aside(
    {
      label: "Relationship of A and B",
      tone: kind === "invalid" ? "caution" : "note",
      title: kind === "invalid" ? "Invalid input" : "Note",
    },
    html`<p>${RELATIONSHIP_SENTENCES[kind]}</p>`,
  );
}

function callFrameOf(
  op: IntervalOperationInfo,
  values: readonly [string, string, string, string],
): SafeHtml {
  const [argsHtml, plain] = callArgs(values);
  return codeFrame({
    label: `${op.label} call`,
    copyLabel: `Copy ${op.fnName} call`,
    copyText: `${op.fnName}(${plain})`,
    code: raw(`${codeSpan("fn", op.fnName)}(${argsHtml})`),
    gate: "codeframe",
  });
}

function outputOf(
  op: IntervalOperationInfo,
  state: "live" | "sentinel" | "empty",
  lines: readonly CallOutputLine[],
): SafeHtml {
  return callOutput({ label: `${op.label} result`, state, lines });
}

/** What an operation returned, as the lines its output shows. */
function resultLines(
  op: IntervalOperationInfo,
  result: ZonedInterval | ZonedInterval[] | null,
): CallOutputLine[] {
  const isEmpty =
    result === null || (Array.isArray(result) && result.length === 0);
  if (isEmpty) {
    return [
      {
        text: op.isArray ? "[] — correctly empty" : "null — correctly empty",
        lost: false,
      },
    ];
  }
  return [
    {
      text: Array.isArray(result)
        ? formatIntervalList(result)
        : formatInterval(result),
      lost: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The widget's chrome. The preset's values fill the fields; `mount` draws what the calls return. */
export function renderIntervalTemplate(idPrefix: string): string {
  const id = idScope(idPrefix);
  const first = RELATIONSHIP_PRESETS[0]!;
  const initial = buildRelationshipPreset(first.type);
  const scale = FIXED_YEAR_SCALE;
  const step = stepOf(scale);

  const handleOf = (key: Key, pair: "start" | "end"): SafeHtml =>
    handle({
      id: id(`handle-${LOCAL[key]}`),
      label: HANDLE_NAME[key],
      min: 0,
      max: POSITION_MAX,
      step,
      largeStep: step * BIG_STEP_UNITS,
      value: positionOf(scale, initial[key]),
      valueText: readable(initial[key]),
      pair,
    });

  const intervalLane = (name: "A" | "B", s: Key, e: Key): SafeHtml =>
    lane(
      { label: `Interval ${name}` },
      html`<span class="${styles.slot}" id="${id(`bar-${name.toLowerCase()}`)}"
        >${barOf(name, initial[s], initial[e], scale, true)}</span
      >${handleOf(s, "start")}${handleOf(e, "end")}`,
    );

  const resultLane = (op: IntervalOperationInfo): SafeHtml =>
    lane(
      { label: op.label },
      html`<span class="${styles.slot}" id="${id(`marks-${op.id}`)}"></span>`,
    );

  const typed = (key: Key, label: string): SafeHtml =>
    field({
      id: id(LOCAL[key]),
      label,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value: initial[key],
          autocomplete: "off",
          spellcheck: false,
        }),
    });

  const place = section(
    { id: id("place"), heading: "1. Place two intervals", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Relationship preset",
      value: first.type,
      options: RELATIONSHIP_PRESETS.map((p) => ({
        value: p.type,
        label: p.label,
        description: p.description,
      })),
    })}
      <div class="${styles.timeline}">
        ${intervalLane("A", "aStart", "aEnd")}${intervalLane("B", "bStart", "bEnd")}${INTERVAL_OPERATIONS.map(resultLane)}
        <div id="${id("axis")}">${axisOf(scale)}</div>
      </div>
      ${fieldGrid(html`${typed("aStart", "A start")}${typed("aEnd", "A end")}`)}
      ${fieldGrid(html`${typed("bStart", "B start")}${typed("bEnd", "B end")}`)}
      ${grow(html`<div id="${id("relationship")}"></div>`)}`,
  );

  const compare = section(
    { id: id("compare"), heading: "2. Compare the four operations", level: 4 },
    html`<div class="${styles.ops}"
      >${INTERVAL_OPERATIONS.map(
        (op) => html`<div class="${styles.op}">
          <h5 class="${styles.opLabel}">${op.label}</h5>
          ${grow(
            html`<div id="${id(`call-${op.id}`)}">${callFrameOf(op, ["", "", "", ""])}</div>`,
          )}
          ${grow(
            html`<div id="${id(`out-${op.id}`)}">${outputOf(op, "empty", [])}</div>`,
          )}
        </div>`,
      )}</div
    >`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Interval Visualizer", scope: idPrefix },
    html`${place}${compare}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// The library
// ---------------------------------------------------------------------------

type IntervalFn = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => ZonedInterval | ZonedInterval[] | null;

interface Modules {
  fns: Record<IntervalOperationId, IntervalFn>;
  isValidZonedDateTime(v: string): boolean;
  isValidZonedRange(args: {
    value1: string;
    value2: string;
    options?: { allowEqual?: boolean };
  }): boolean;
}

async function loadModules(): Promise<Modules> {
  const [intervalMod, validateMod] = await Promise.all([
    GMT_MODULES["zoned/interval"](),
    GMT_MODULES["zoned/validate"](),
  ]);
  const fns = {} as Record<IntervalOperationId, IntervalFn>;
  for (const op of INTERVAL_OPERATIONS) {
    fns[op.id] = intervalMod[op.fnName] as IntervalFn;
  }
  return {
    fns,
    isValidZonedDateTime: validateMod[
      "isValidZonedDateTime"
    ] as Modules["isValidZonedDateTime"],
    isValidZonedRange: validateMod[
      "isValidZonedRange"
    ] as Modules["isValidZonedRange"],
  };
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  /** Refit the canvas to whatever the four fields hold, then redraw. */
  refit(): void;
  /** The four typed instants. */
  values(): IntervalArgs;
  /** Write one typed instant. */
  write(key: Key, value: string): void;
}

function setupWidget(
  root: HTMLElement,
  modules: Modules,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const inputs = Object.fromEntries(
    KEYS.map((k) => [k, el<HTMLInputElement>(LOCAL[k])]),
  ) as Record<Key, HTMLInputElement>;
  const handles = Object.fromEntries(
    KEYS.map((k) => [k, el<GmtHandle>(`handle-${LOCAL[k]}`)]),
  ) as Record<Key, GmtHandle>;

  /* The presets' canvas is the default; seeded or typed values fit their own.
     See `TimelineScale` in interval-visualizer.ts for why this is a value. */
  let scale: TimelineScale = FIXED_YEAR_SCALE;

  const read = (): Record<Key, string> => ({
    aStart: inputs.aStart.value,
    aEnd: inputs.aEnd.value,
    bStart: inputs.bStart.value,
    bEnd: inputs.bEnd.value,
  });

  function isIntervalValid(start: string, end: string): boolean {
    return (
      modules.isValidZonedDateTime(start) &&
      modules.isValidZonedDateTime(end) &&
      modules.isValidZonedRange({
        value1: start,
        value2: end,
        options: { allowEqual: true },
      })
    );
  }

  /** Move the handles to the typed instants. The end goes first and last, so the start is never held back by the old end. */
  function placeHandles(v: Record<Key, string>): void {
    const step = stepOf(scale);
    for (const key of KEYS) {
      handles[key].setAttribute("step", String(step));
      handles[key].setAttribute("large-step", String(step * BIG_STEP_UNITS));
    }
    for (const [s, e] of [
      ["aStart", "aEnd"],
      ["bStart", "bEnd"],
    ] as const) {
      handles[e].value = positionOf(scale, v[e]);
      handles[s].value = positionOf(scale, v[s]);
      handles[e].value = positionOf(scale, v[e]);
    }
    for (const key of KEYS) {
      handles[key].setAttribute("aria-valuetext", readable(v[key]));
    }
  }

  function render(): void {
    const v = read();
    const aValid = isIntervalValid(v.aStart, v.aEnd);
    const bValid = isIntervalValid(v.bStart, v.bEnd);
    const valid = aValid && bValid;

    setHtml(el("bar-a"), barOf("A", v.aStart, v.aEnd, scale, aValid));
    setHtml(el("bar-b"), barOf("B", v.bStart, v.bEnd, scale, bValid));
    setHtml(el("axis"), axisOf(scale));
    placeHandles(v);
    setHtml(
      el("relationship"),
      relationshipOf(
        valid,
        { start: v.aStart, end: v.aEnd },
        { start: v.bStart, end: v.bEnd },
      ),
    );

    for (const op of INTERVAL_OPERATIONS) {
      setHtml(
        el(`call-${op.id}`),
        callFrameOf(op, [v.aStart, v.aEnd, v.bStart, v.bEnd]),
      );
      if (!valid) {
        setHtml(el(`marks-${op.id}`), html``);
        setHtml(
          el(`out-${op.id}`),
          outputOf(op, "sentinel", [{ text: NO_SIGNAL_TEXT, lost: true }]),
        );
        continue;
      }
      const result = modules.fns[op.id](v.aStart, v.aEnd, v.bStart, v.bEnd);
      setHtml(el(`marks-${op.id}`), segmentsOf(op, result, scale));
      setHtml(
        el(`out-${op.id}`),
        outputOf(op, "live", resultLines(op, result)),
      );
    }
  }

  function refit(): void {
    const v = read();
    const fitted = fitTimelineScale([v.aStart, v.aEnd, v.bStart, v.bEnd]);
    if (fitted) scale = fitted;
    render();
  }

  function applyPreset(): void {
    const values = buildRelationshipPreset(
      presetEl.value as RelationshipPreset,
    );
    for (const key of KEYS) inputs[key].value = values[key];
    /* Presets are composed against the fixed year: `disjoint` filling only the
       left two-thirds is the point, so this must not refit. */
    scale = FIXED_YEAR_SCALE;
    render();
  }

  const typedFields: readonly EventTarget[] = KEYS.map((k) => inputs[k]);

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      const moved = KEYS.find((k) => handles[k] === target);
      if (moved !== undefined) {
        // A handle moved: its instant goes into the field, and the draw follows the fields.
        inputs[moved].value = instantAt(scale, handles[moved].value);
        render();
        return;
      }
      if (target !== null && typedFields.includes(target)) render();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        applyPreset();
        return;
      }
      /* Refit on commit rather than per keystroke: rescaling the canvas under a
         half-typed date is disorienting, and it would fight the caret. */
      if (target !== null && typedFields.includes(target)) refit();
    },
    { signal },
  );

  applyPreset();

  return {
    refit,
    values: () => read(),
    write(key, value) {
      inputs[key].value = value;
    },
  };
}

export const mountIntervalVisualizer: MountFn<IntervalArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let modules: Modules;
  try {
    modules = await loadModules();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, modules, signal);

  /* Seeded after `setupWidget`, because it ends by drawing the preset and would
     otherwise overwrite these. Written into the typed fields and drawn through the
     same path a reader's typing takes, so a seeded interval and a typed one cannot
     diverge. */
  const seeded = KEYS.filter((key) => args[key]);
  if (seeded.length > 0) {
    /* Normalised, because this widget is the *zoned* one and a model answering
       "9am to 11am" has no zone to give (see zoned-input.ts). */
    for (const key of seeded) {
      controller.write(key, normaliseZonedInput(args[key] as string));
    }
    /* `refit()`, not a bare redraw: seeded values are almost never on the presets'
       calendar-2024 canvas, and a three-hour meeting drawn on a one-year axis is a
       0.02%-wide bar with all four handles on one pixel. */
    controller.refit();
  }

  return onceDestroy(
    () => {
      // Every listener is delegated on the widget with `signal`; the host drops the subtree.
    },
    () => controller.values() as Record<string, string>,
  );
};
