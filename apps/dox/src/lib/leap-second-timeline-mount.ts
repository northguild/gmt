/**
 * The Leap Second Timeline widget (MAR-16), mountable on its tool page and in
 * the chat rail.
 *
 * Every second UTC has inserted, on one axis, with TAI - UTC as a step line.
 * The reader gives a date (its offset and the next insertion), two dates (the
 * leap seconds between them, lit on the axis and in the table) and a written
 * second 60 (was one really inserted). A native range moves the date by day.
 *
 * Built on the component kit: `renderLeapSecondTimelineTemplate` writes the chrome
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` fills each slot
 * from real library calls with `setHtml`. The staircase is one pure function of a
 * view (`families/timescale/leap-chart`), redrawn whole. Every listener is delegated
 * on the widget with the mount's `signal`. Every printed call and result is the real
 * one; the drawing only places them.
 */
import { getUnixNow } from "@northguild/gmt/unix/get";
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  plates,
  section,
  setHtml,
  srOnly,
  table,
  textInput,
  toolLinks,
  widget,
  type Column,
  type Plate,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  LEAP_FLAG,
  LEAP_PARTS,
  LEAP_TICK,
  insertionCell,
  leapCaption,
  leapChart,
  leapLegend,
  offsetCell,
  type LeapChartView,
  type LeapMark,
  type LeapRiser,
  type LeapSeries,
} from "~/widgets/families/timescale/leap-chart";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/leap-second-timeline.module.css";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { layoutWidth, onWidthChange, thinTickLabels } from "./label-fit";
import {
  CUSTOM_PRESET_ID,
  TIMELINE_LINKS,
  TIMELINE_PRESETS,
  VERDICT_INSERTED,
  VERDICT_NOT_INSERTED,
  axisPercent,
  axisTicks,
  blankPlates,
  continuousPercent,
  drawMs,
  isSeeded,
  matchPreset,
  offsetRange,
  permalinkOf,
  presetState,
  readArgs,
  readTimeline,
  sliderDate,
  sliderMax,
  sliderPosition,
  summaryText,
  timelineHandoffs,
  timelinePlates,
  type LeapSecondTimelineArgs,
  type TimelineRead,
  type TimelineState,
} from "./leap-second-timeline";
import type { TimescaleLib } from "./timescale-lib";
import { loadTimescaleLib } from "./timescale-lib";
import { CONTINUOUS_UTC_FROM, INTEGER_UTC_FROM } from "./timescale-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";

export type { LeapSecondTimelineArgs } from "./leap-second-timeline";

const WIDGET_NAME = "leap-second-timeline";

/** The text of an output with nothing to read: a blank field makes no call. */
const BLANK_TEXT = "Not read: the field is blank.";

/** How many inserted seconds the library lists (`insertions`): the rows the
 *  table holds. The template draws this many blank rows, so the table has its
 *  height from the first paint; a test pins it to the library's own walk. */
export const INSERTION_ROWS = 27;

/** The widest values a plate shows, so the plates keep their width from one reading to the next. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-offset": ["37 s", "10 s"],
  "hero-between": ["-27"],
  "hero-check": [VERDICT_INSERTED, VERDICT_NOT_INSERTED],
};

const GROUPS = [
  {
    id: "offset",
    heading: "Offset on the date",
    calls: "taiMinusUtc, nextLeapSecond",
  },
  {
    id: "between",
    heading: "Between the two dates",
    calls: "leapSecondsBetween",
  },
  {
    id: "check",
    heading: "Your second 60",
    calls: "hasSecond60, isLeapSecond, isValidInstant",
  },
] as const;

const TABLE_COLUMNS: readonly Column<"insertion" | "offset">[] = [
  {
    key: "insertion",
    header: "Inserted second",
    align: "start",
    numeric: false,
  },
  { key: "offset", header: "TAI − UTC after", align: "end", numeric: true },
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateList(specs: ReturnType<typeof timelinePlates>): Plate[] {
  return specs.map((s) => {
    const samples = PLATE_SAMPLES[s.role];
    return {
      caption: s.caption,
      value: s.value,
      lines: s.lines,
      ...(s.series === undefined ? {} : { series: s.series }),
      ...(s.quiet === true ? { quiet: true } : {}),
      ...(s.captions === undefined ? {} : { captions: s.captions }),
      ...(samples === undefined ? {} : { samples }),
    };
  });
}

function linkItem(text: string, href: string | null): ToolLinkItem {
  return href === null ? { text } : { text, href };
}

function linksOf(
  handoffs: ReturnType<typeof timelineHandoffs> | null,
): SafeHtml {
  return toolLinks({
    label: "Other tools",
    links: [
      linkItem(
        TIMELINE_LINKS[0].text,
        handoffs === null ? null : handoffHref(handoffs.elapsed),
      ),
      linkItem(
        TIMELINE_LINKS[1].text,
        handoffs === null ? null : handoffHref(handoffs.clocks),
      ),
    ],
  });
}

function seriesOf(
  read: TimelineRead,
  counted: ReadonlySet<string>,
  insertion: string,
): LeapSeries {
  if (read.check.insertion === insertion) return 3;
  return counted.has(insertion) ? 2 : 0;
}

function tableOf(
  read: TimelineRead | null,
  counted: ReadonlySet<string>,
): SafeHtml {
  const rows =
    read === null
      ? Array.from({ length: INSERTION_ROWS }, () => ({
          insertion: insertionCell("", 0),
          offset: offsetCell(""),
        }))
      : read.steps.map((step) => ({
          insertion: insertionCell(
            step.insertion,
            seriesOf(read, counted, step.insertion),
          ),
          offset: offsetCell(
            step.offset === null ? "no result" : `${step.offset} s`,
          ),
        }));
  return table({
    caption: "Every inserted second",
    columns: TABLE_COLUMNS,
    rows,
    rowHeader: "insertion",
  });
}

/** The chart before anything is read: the axis and the continuous run, no steps. */
function blankView(now: number): LeapChartView {
  return {
    label: "",
    yTicks: [],
    line: "",
    area: "",
    risers: [],
    marks: [],
    years: axisTicks(now),
    chips: [],
    pin: null,
    dot: null,
    pinFlag: null,
    band: null,
    bandFlag: null,
    ghost: null,
    sentinel: false,
    continuousAt: continuousPercent(now),
    continuousText: `continuous UTC from ${CONTINUOUS_UTC_FROM}`,
  };
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, the drawing and the table are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderLeapSecondTimelineTemplate(
  idPrefix: string,
  args: LeapSecondTimelineArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: TimelineState = isSeeded(args)
    ? readArgs(args)
    : presetState(TIMELINE_PRESETS[0]!);

  const wide = (content: SafeHtml): SafeHtml =>
    html`<div class="${styles.wide}">${content}</div>`;
  const text = (local: string, label: string, value: string): SafeHtml =>
    field({
      id: id(local),
      label,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 64,
        }),
    });

  const dates = section(
    {
      id: id("dates"),
      heading: "1. Set a date, a span and a second 60",
      level: 4,
    },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...TIMELINE_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${wide(text("date", "Date", state.date))}${wide(
        html`${range({
          id: id("date-slider"),
          label: "Move the date",
          min: 0,
          max: 1,
          step: 1,
          value: 0,
          valueText: "",
          ends: [INTEGER_UTC_FROM.slice(0, 10), "latest"],
        })}`,
      )}${text("from", "Count from", state.from)}${text("to", "Count to", state.to)}${wide(
        text("check", "A second 60 to check", state.check),
      )}`,
    )}<p class="${styles.hint}">A blank field is left out: its call is not made. The count includes the first date and leaves out the second.</p>`,
  );

  const timeline = section(
    { id: id("timeline"), heading: "2. Every inserted second", level: 4 },
    html`${grow(
      html`<div class="${styles.frame}" id="${id("frame")}" data-gate="frame">${leapCaption()}<div id="${id("chart")}">${leapChart(
        blankView(0),
        id,
      )}</div>${leapLegend()}<div id="${id("plates")}">${plates(plateList(blankPlates()), { gate: "hero" })}</div></div>`,
    )}
      <p role="status" aria-label="Timeline reading" id="${id("summary")}">${srOnly("")}</p>
      ${grow(html`<div id="${id("table")}">${tableOf(null, new Set())}</div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What the library returns", level: 4 },
    html`${GROUPS.map(
      (g) =>
        html`<div class="${styles.group}">
          <p class="${styles.hint}">${g.heading}: <code>${g.calls}</code></p>
          ${grow(
            html`<div id="${id(`${g.id}-calls`)}">${codeFrame({
              label: "Calls made",
              copyLabel: "Copy calls",
              copyText: "",
              gate: "codeframe",
            })}</div>`,
          )}${grow(
            html`<div id="${id(`${g.id}-output`)}">${callOutput({
              label: "What the calls returned",
              state: "empty",
              lines: [],
            })}</div>`,
          )}${grow(html`<div id="${id(`${g.id}-reason`)}"></div>`)}
        </div>`,
    )}${grow(html`<div id="${id("links")}">${linksOf(null)}</div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Leap Second Timeline", scope: idPrefix },
    html`${dates}${timeline}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): TimelineState;
  apply(state: TimelineState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** A TAI - UTC value's height on the plot, as a percentage of its field. */
function levelOf(read: TimelineRead, v: number): number {
  const { low, high } = offsetRange(read);
  return Math.round(((v - low) / (high - low)) * 10000) / 100;
}

/** The offset in force at `ms`, from the library's own steps. */
function offsetAt(read: TimelineRead, ms: number): number | null {
  let level = read.startOffset;
  for (const step of read.steps) {
    if (step.ms !== null && step.offset !== null && step.ms <= ms) {
      level = step.offset;
    }
  }
  return level;
}

/** Gridlines and labels at the first level, each multiple of ten and the last. */
function yTicksOf(read: TimelineRead): LeapChartView["yTicks"] {
  const { low, high } = offsetRange(read);
  const values = new Set<number>();
  const last = read.steps.at(-1)?.offset ?? null;
  if (read.startOffset !== null) values.add(read.startOffset);
  for (let v = Math.ceil((low + 1) / 10) * 10; v < high - 1; v += 10) {
    if (read.startOffset === null || Math.abs(v - read.startOffset) > 3) {
      if (last === null || Math.abs(v - last) > 3) values.add(v);
    }
  }
  if (last !== null) values.add(last);
  return [...values]
    .sort((a, b) => a - b)
    .map((v) => ({ level: levelOf(read, v), text: String(v) }));
}

/** The whole drawing of a reading, as data. */
function viewOf(
  state: TimelineState,
  read: TimelineRead,
  now: number,
  label: string,
): LeapChartView {
  const counted = new Set(read.between.counted);
  const y = (v: number) => Math.round((100 - levelOf(read, v)) * 100) / 100;
  const points: string[] = [];
  const risers: LeapRiser[] = [];
  const marks: LeapMark[] = [];
  const chips: LeapChartView["chips"][number][] = [];
  let level = read.startOffset;
  if (level !== null) points.push(`0,${y(level)}`);
  for (const step of read.steps) {
    if (step.ms === null || step.offset === null) continue;
    const at = axisPercent(step.ms, now).pct;
    const series = seriesOf(read, counted, step.insertion);
    if (level !== null) {
      points.push(`${at},${y(level)}`, `${at},${y(step.offset)}`);
      risers.push({ x: at, y1: y(level), y2: y(step.offset), series });
    }
    marks.push({ at, level: levelOf(read, step.offset), series });
    // Only the lit insertions are lettered: the year axis labels the rest.
    if (series !== 0) {
      chips.push({ at, text: step.insertion.slice(0, 7), series });
    }
    level = step.offset;
  }
  if (level !== null) points.push(`100,${y(level)}`);

  const ms = drawMs(state.date);
  const placed = ms === null ? null : axisPercent(ms, now);
  const offset = read.offset.offset;
  const onPin = placed !== null && offset !== null;
  const day = state.date.trim().slice(0, 10);
  const pinFlag = onPin
    ? {
        at: placed.pct,
        side: placed.pct > 50 ? ("end" as const) : ("start" as const),
        text:
          placed.beyond === null
            ? `${day} · ${offset} s`
            : `${day} (${placed.beyond === "after" ? "past" : "before"} the axis) · ${offset} s`,
      }
    : null;

  const count = read.between.count;
  const a = drawMs(state.from);
  const b = drawMs(state.to);
  let band: LeapChartView["band"] = null;
  let bandFlag: LeapChartView["bandFlag"] = null;
  if (count !== null && a !== null && b !== null) {
    const pa = axisPercent(a, now).pct;
    const pb = axisPercent(b, now).pct;
    band = { from: Math.min(pa, pb), to: Math.max(pa, pb) };
    bandFlag = {
      at: (pa + pb) / 2,
      text: `${count} leap ${Math.abs(count) === 1 ? "second" : "seconds"} counted`,
    };
  }

  // A second 60 that was never inserted: a struck-through ghost riser at its day.
  const cms = drawMs(state.check);
  const base = cms === null ? null : offsetAt(read, cms);
  let ghost: LeapChartView["ghost"] = null;
  if (
    cms !== null &&
    base !== null &&
    read.check.verdict === VERDICT_NOT_INSERTED
  ) {
    const x = axisPercent(cms, now);
    ghost = {
      at: x.pct,
      level: levelOf(read, base),
      side: x.pct > 60 ? "end" : "start",
    };
  }

  // NO SIGNAL: a reading was asked for and the library gave no value.
  const sentinel =
    (read.offset.calls.length > 0 && read.offset.offset === null) ||
    (read.between.calls.length > 0 && read.between.count === null) ||
    (read.check.calls.length > 0 && read.check.verdict === null);

  return {
    label,
    yTicks: yTicksOf(read),
    line: points.join(" "),
    area: points.length === 0 ? "" : `M0,100 L${points.join(" L")} L100,100 Z`,
    risers,
    marks,
    years: axisTicks(now),
    chips,
    pin: placed === null ? null : { at: placed.pct },
    dot: onPin ? { at: placed.pct, level: levelOf(read, offset) } : null,
    pinFlag,
    band,
    bandFlag,
    ghost,
    sentinel,
    continuousAt: continuousPercent(now),
    continuousText: `continuous UTC from ${CONTINUOUS_UTC_FROM}`,
  };
}

function setupWidget(
  root: HTMLElement,
  lib: TimescaleLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const sliderEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const dateEl = el<HTMLInputElement>("date");
  const checkEl = el<HTMLInputElement>("check");
  const fromEl = el<HTMLInputElement>("from");
  const toEl = el<HTMLInputElement>("to");
  const frameEl = el("frame");
  // Every slot the render writes: a missing one throws now, not on the first keystroke.
  const slots = {
    chart: el("chart"),
    summary: el("summary"),
    table: el("table"),
    links: el("links"),
    plates: el("plates"),
  };
  const groups = GROUPS.map((g) => ({
    id: g.id,
    heading: g.heading,
    calls: el(`${g.id}-calls`),
    output: el(`${g.id}-output`),
    reason: el(`${g.id}-reason`),
  }));

  let lastView: LeapChartView | null = null;
  let spoken = "";

  const readState = (): TimelineState => ({
    date: dateEl.value,
    check: checkEl.value,
    from: fromEl.value,
    to: toEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  /** The slider follows the reader's today, so its range is set on each draw. */
  function drawSlider(state: TimelineState, now: number): void {
    const max = sliderMax(now);
    sliderEl.max = max;
    sliderEl.ends = [
      INTEGER_UTC_FROM.slice(0, 10),
      sliderDate(max).slice(0, 10),
    ];
    const position = sliderPosition(state.date, now);
    sliderEl.disabled = position === null;
    if (position === null) {
      sliderEl.formatValue = () => "no date";
      return;
    }
    sliderEl.value = position;
    sliderEl.formatValue = (n) => sliderDate(n).slice(0, 10);
  }

  function drawGroup(
    g: (typeof groups)[number],
    calls: TimelineRead["offset"]["calls"],
    ok: boolean,
    reason: string,
  ): void {
    const { code, plain } = callLines(calls);
    setHtml(
      g.calls,
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: plain,
        code,
        gate: "codeframe",
      }),
    );
    const label = "What the calls returned";
    if (calls.length === 0) {
      setHtml(
        g.output,
        callOutput({
          label,
          state: "empty",
          lines: [{ text: BLANK_TEXT, lost: false }],
        }),
      );
    } else {
      const out = outputOf(ok ? "ok" : "sentinel", calls);
      setHtml(
        g.output,
        callOutput({ label, state: out.state, lines: out.lines }),
      );
    }
    setHtml(
      g.reason,
      calls.length > 0 && !ok && reason !== ""
        ? aside(
            {
              label: `Why there is no result: ${g.heading.toLowerCase()}`,
              tone: "caution",
              title: NO_RESULT_TITLE,
            },
            html`<p>${reason}</p>`,
          )
        : html``,
    );
  }

  /** The chart's parts that the mount measures, found again after each redraw. */
  const chartPart = (local: string): HTMLElement | null =>
    frameEl.querySelector<HTMLElement>(`[id="${CSS.escape(id(local))}"]`);

  /** Chip rows are fitted against the measured width; the drawing is not redrawn. */
  function fit(): void {
    const axis = chartPart(LEAP_PARTS.axis);
    if (axis !== null) thinTickLabels(axis, LEAP_TICK);
    const chips = chartPart(LEAP_PARTS.chips);
    if (chips !== null) thinTickLabels(chips, LEAP_FLAG);
    // The cursor's and the band's readouts stay inside the plot.
    const plot = chartPart(LEAP_PARTS.plot);
    const plotPx = plot?.clientWidth ?? 0;
    const flags: [string, number | null, boolean][] = [
      [LEAP_PARTS.pinFlag, lastView?.pinFlag?.at ?? null, true],
      [LEAP_PARTS.bandFlag, lastView?.bandFlag?.at ?? null, false],
    ];
    for (const [local, at, besidePin] of flags) {
      const tag = chartPart(local);
      if (tag === null || at === null || plotPx === 0) continue;
      const atPx = (at / 100) * plotPx;
      const w = layoutWidth(tag);
      // The cursor's readout sits beside its pin, flipped when it would run
      // out; the band's is centred. Both are clamped inside the plot.
      let left = atPx - w / 2;
      if (besidePin) left = atPx + w + 4 <= plotPx ? atPx + 4 : atPx - w - 4;
      left = Math.min(Math.max(left, 0), Math.max(0, plotPx - w));
      tag.dataset["side"] = "px";
      tag.style.setProperty("--px", `${Math.round(left)}px`);
    }
    const row = chartPart(LEAP_PARTS.continuousRow);
    const flag = chartPart(LEAP_PARTS.continuousFlag);
    const chip = flag?.firstElementChild as HTMLElement | null | undefined;
    if (row !== null && flag !== null && chip != null) {
      flag.dataset["side"] = "start";
      const trackPx = row.clientWidth;
      if (trackPx > 0 && lastView !== null) {
        const atPx = (lastView.continuousAt / 100) * trackPx;
        if (atPx + layoutWidth(chip) > trackPx) flag.dataset["side"] = "end";
      }
    }
  }

  function render(): void {
    const state = readState();
    const now = getUnixNow();
    const read = readTimeline(lib, state);
    const counted = new Set(read.between.counted);
    const text = summaryText(state, read);

    setHtml(
      slots.plates,
      plates(plateList(timelinePlates(read)), { gate: "hero" }),
    );
    drawSlider(state, now);
    lastView = viewOf(state, read, now, text);
    setHtml(slots.chart, leapChart(lastView, id));
    setHtml(slots.table, tableOf(read, counted));

    const [offsetG, betweenG, checkG] = groups as [
      (typeof groups)[number],
      (typeof groups)[number],
      (typeof groups)[number],
    ];
    drawGroup(
      offsetG,
      read.offset.calls,
      read.offset.offset !== null,
      read.offset.reason,
    );
    drawGroup(
      betweenG,
      read.between.calls,
      read.between.count !== null,
      read.between.reason,
    );
    drawGroup(
      checkG,
      read.check.calls,
      read.check.verdict !== null,
      read.check.reason,
    );

    setHtml(slots.links, linksOf(timelineHandoffs(state, read)));
    if (text !== spoken) {
      spoken = text;
      setHtml(slots.summary, srOnly(text));
    }
    fit();
  }

  function apply(state: TimelineState): void {
    dateEl.value = state.date;
    checkEl.value = state.check;
    fromEl.value = state.from;
    toEl.value = state.to;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === sliderEl) {
        dateEl.value = sliderDate(sliderEl.value);
        syncPreset();
        render();
      } else if (
        target === dateEl ||
        target === checkEl ||
        target === fromEl ||
        target === toEl
      ) {
        syncPreset();
        render();
      }
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = TIMELINE_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset();
      render();
    },
    { signal },
  );

  const release = onWidthChange(frameEl, fit);

  sliderEl.min = 0;
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release };
}

export const mountLeapSecondTimeline: MountFn<LeapSecondTimelineArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: TimescaleLib;
  try {
    lib = await loadTimescaleLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  let controller: Controller;
  try {
    controller = setupWidget(root, lib, signal);
    if (isSeeded(args)) {
      controller.apply(readArgs(args));
      controller.syncPreset();
      controller.render();
    }
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }

  return onceDestroy(
    () => controller.release(),
    () => permalinkOf(controller.readState()),
  );
};
