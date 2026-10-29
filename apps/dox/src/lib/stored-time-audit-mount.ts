/**
 * The Stored Time Audit widget (CORE-83), mountable on its tool page and in
 * the chat rail.
 *
 * The reader pastes stored RFC 9557 strings, one per line. Each line shows the
 * kind `classifyStoredZoned` finds under this browser's rules and every reading
 * it allows. The selected line is drawn on two lanes: the zone's own clock
 * (a skipped or repeated hour, or the offsets in question) and the exact
 * timeline in UTC (the clock change and each reading).
 *
 * Built on the component kit: the template is builders only, with ids from
 * `idScope(idPrefix)`; the rows, the lanes and the printed calls are drawn by
 * `mount` from real calls in the reader's browser, so the build host's tz data
 * never reaches a result. The mount finds its parts by those ids and listens
 * once on the widget with its `signal`. The regions that change height sit in
 * `grow()`.
 */
import { Temporal } from "@js-temporal/polyfill";
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  findWidget,
  html,
  idScope,
  section,
  setHtml,
  toolLinks,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines } from "~/widgets/families/gnss/call-lines";
import { textArea } from "~/widgets/families/ledger/text-area";
import {
  auditTable,
  LINE_NO_SIGNAL,
  type AuditKind,
  type AuditRow,
} from "~/widgets/families/stored/audit-table";
import { storedNote } from "~/widgets/families/stored/stored-note";
import {
  dayClock,
  exactTrack,
  sinceClock,
  storedFigure,
  type ExactGate,
  type ExactMark,
  type LegendId,
} from "~/widgets/families/stored/stored-lanes";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/stored-time-audit.module.css";
import { formatMinuteOfDay } from "./dst-inspector";
import { NO_RESULT_TITLE, type EdiCall } from "./edi-widgets";
import { onWidthChange } from "./label-fit";
import { loadStoredTimeLib, type StoredTimeLib } from "./stored-time-lib";
import {
  AUDIT_LINKS,
  AUDIT_MAX_CHARS,
  AUDIT_MAX_LINES,
  AUDIT_PRESETS,
  CUSTOM_PRESET_ID,
  HOST_NOTE_TEXT,
  KIND_LABEL_WIDEST,
  NOT_STORED_TEXT,
  bandChipText,
  dayTicks,
  defaultLine,
  dstLink,
  figureLabel,
  isSeeded,
  kindLabel,
  laneMarks,
  lineSentence,
  matchPreset,
  parseAuditLines,
  permalinkOf,
  presetState,
  readArgs,
  readAuditLines,
  readingsOf,
  stripFor,
  transitionDate,
  type AuditLine,
  type AuditState,
  type LaneMark,
  type ParsedLines,
  type Strip,
  type StoredTimeAuditArgs,
} from "./stored-time-audit";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { StoredTimeAuditArgs } from "./stored-time-audit";
export { LINE_NO_SIGNAL };

const WIDGET_NAME = "stored-time-audit";

const BLANK_LINES_TEXT = "Paste a stored time above: one line each.";
const BLANK_REASON_TEXT = "Give a stored time to see the rules behind it.";
const NO_LINE_OUTPUT = "Not read: there is no line.";
const NO_TRANSITION_TEXT = (years: readonly number[]) =>
  `No clock change in ${[...years].reverse().join(" or ")} under this browser's rules.`;

const formatResult = (value: unknown): string =>
  value === null || value === undefined ? "null" : JSON.stringify(value);

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function capNote(id: string): { id: string; html: SafeHtml } {
  return {
    id,
    html: storedNote(
      html`One stored time per line, at most ${AUDIT_MAX_LINES} lines of ${AUDIT_MAX_CHARS} characters: a date and time, a UTC offset and a bracketed zone, such as <code>2016-12-01T09:00:00+02:00[Europe/Istanbul]</code>.`,
      id,
    ),
  };
}

function hostNote(): SafeHtml {
  const [before = "", after = ""] = HOST_NOTE_TEXT.split("process.versions.tz");
  return storedNote(html`${before}<code>process.versions.tz</code>${after}`);
}

function emptyFigure(): SafeHtml {
  return storedFigure({
    label: BLANK_REASON_TEXT,
    clock: "",
    exact: exactTrack({ gate: null, broken: false, marks: [] }),
    legend: new Set<LegendId>(),
  });
}

function tableOf(rows: readonly AuditRow[], group: string): SafeHtml {
  return auditTable({
    caption: "Each pasted line, its kind and its readings",
    group,
    kindWidth: KIND_LABEL_WIDEST.length,
    emptyText: BLANK_LINES_TEXT,
    rows,
  });
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the first preset. The rows, the lanes and the calls are
 * drawn by `mount`, because they come from real library calls.
 */
export function renderStoredTimeAuditTemplate(
  idPrefix: string,
  args: StoredTimeAuditArgs = {},
): string {
  const id = idScope(idPrefix);
  const state: AuditState = isSeeded(args)
    ? readArgs(args)
    : presetState(AUDIT_PRESETS[0]!);
  const presetId = matchPreset(state.values);

  const paste = section(
    { id: id("paste"), heading: "1. Paste stored times", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...AUDIT_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${field({
      id: id("values"),
      label: "Stored strings",
      hint: capNote(id("values-hint")),
      control: ({ id: cid, describedBy }) =>
        textArea({ id: cid, value: state.values, rows: 6, describedBy }),
    })}${hostNote()}`,
  );

  const lines = section(
    {
      id: id("lines-section"),
      heading: "2. What each line still says",
      level: 4,
    },
    html`${grow(html`<div id="${id("table")}">${tableOf([], id("lines"))}</div>`)}${grow(
      html`<div id="${id("truncated")}"></div>`,
    )}`,
  );

  const rules = section(
    {
      id: id("rules"),
      heading: "3. The rules behind the selected line",
      level: 4,
    },
    html`<div class="${styles.frame}" id="${id("figure")}">${emptyFigure()}</div
      >${grow(html`<div id="${id("reason")}"></div>`)}${grow(
        html`<div id="${id("calls-slot")}">${codeFrame({
          label: "Call made",
          copyLabel: "Copy call",
          copyText: "",
          gate: "codeframe",
        })}</div>`,
      )}${grow(
        html`<div id="${id("output-slot")}">${callOutput({
          label: "What classifyStoredZoned returned",
          state: "empty",
          lines: [],
        })}</div>`,
      )}<div id="${id("links")}">${linksOf(null)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Stored Time Audit", scope: idPrefix },
    html`${paste}${lines}${rules}`,
  ).toString();
}

function linksOf(line: AuditLine | null): SafeHtml {
  const info = line ? dstLink(line) : null;
  return toolLinks({
    label: "Open this line in another tool",
    links: [
      info
        ? { text: info.text, href: info.href }
        : { text: AUDIT_LINKS[0].text },
    ],
  });
}

// ---------------------------------------------------------------------------
// Section 2: the rows
// ---------------------------------------------------------------------------

function auditRow(line: AuditLine, n: number, selected: boolean): AuditRow {
  const r = line.result;
  if (r === null) {
    return {
      n,
      selected,
      stored: line.value,
      kind: null,
      kindText: "",
      pair: null,
      tokens: [],
      sentence: NOT_STORED_TEXT,
    };
  }
  const items = readingsOf(r);
  const mismatch = r.kind === "offsetMismatch";
  return {
    n,
    selected,
    stored: line.value,
    kind: r.kind as AuditKind,
    kindText: kindLabel(r.kind),
    pair: mismatch ? { stored: r.storedOffset, zone: r.zoneOffset } : null,
    tokens: mismatch ? items.filter((i) => i.name.startsWith("at")) : items,
    sentence: lineSentence(line),
  };
}

function truncatedText(parsed: ParsedLines): string {
  if (!parsed.truncated) return "";
  const parts: string[] = [];
  if (parsed.droppedLines > 0) {
    parts.push(
      `${parsed.droppedLines} more ${parsed.droppedLines === 1 ? "line" : "lines"} not read, after the first ${AUDIT_MAX_LINES}`,
    );
  }
  if (parsed.cutLines) {
    parts.push(`lines cut to ${AUDIT_MAX_CHARS} characters`);
  }
  return `Read ${parsed.lines.length} ${parsed.lines.length === 1 ? "line" : "lines"}: ${parts.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// Section 3: the lanes
// ---------------------------------------------------------------------------

function tickLabel(minute: number): string {
  return minute >= 1440 ? "24:00" : formatMinuteOfDay(minute);
}

function dayClockOf(
  strip: Extract<Strip, { kind: "day" }>,
  trackPx: number,
): SafeHtml {
  const w = strip.window;
  const ticks = dayTicks(w, trackPx > 0 ? trackPx : 600);
  return dayClock({
    kind: strip.gap ? "gap" : "overlap",
    bandText: bandChipText(strip),
    bandLeft: (w.zoneStartMinutes / 1440) * 100,
    bandWidth: ((w.zoneEndMinutes - w.zoneStartMinutes) / 1440) * 100,
    pinX: (strip.pinMinute / 1440) * 100,
    pinText: `stored ${tickLabel(strip.pinMinute)}`,
    ticks: ticks.map((m) => ({ x: (m / 1440) * 100, label: tickLabel(m) })),
  });
}

function sinceClockOf(
  strip: Extract<Strip, { kind: "since" }>,
  line: AuditLine,
): SafeHtml {
  const r = line.result!;
  const stored = r.kind === "offsetMismatch" ? r.storedOffset : "";
  const zone =
    strip.transition === null
      ? `Zone offset: ${r.kind === "offsetMismatch" ? r.zoneOffset : ""}`
      : `Zone offset since ${transitionDate(strip.transition, strip.zone)}: ${strip.transition.offsetAfter}`;
  return sinceClock({ zone, stored: `Stored offset: ${stored}` });
}

/** A reading's chip text: its names, and the time it falls at. */
function markText(m: LaneMark, withDate: boolean): string {
  const time = withDate
    ? `${m.instant.slice(5, 10)} ${m.instant.slice(11, 16)}Z`
    : `${m.instant.slice(11, 16)}Z`;
  return `${m.names.join(" = ")} ${time}`;
}

interface Placed {
  gateX: number | null;
  marks: { mark: LaneMark; x: number }[];
}

/** Places the readings and the clock change on the exact lane, as percentages. */
function placeExact(strip: Strip, marks: LaneMark[]): Placed {
  if (strip.kind === "day") {
    const gateMs = Temporal.Instant.from(
      strip.transition.instant,
    ).epochMilliseconds;
    const all = [...marks.map((m) => m.ms), gateMs];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = Math.max((max - min) * 0.14, 15 * 60_000);
    const lo = min - pad;
    const span = max + pad - lo;
    const x = (ms: number) => ((ms - lo) / span) * 100;
    return {
      gateX: x(gateMs),
      marks: marks.map((mark) => ({ mark, x: x(mark.ms) })),
    };
  }
  // A since strip: the clock change on the left, a break, then the readings.
  const lo = Math.min(...marks.map((m) => m.ms));
  const hi = Math.max(...marks.map((m) => m.ms));
  const withGate = strip.kind === "since" && strip.transition !== null;
  const from = withGate ? 36 : 12;
  const to = 90;
  return {
    gateX: withGate ? 8 : null,
    marks: marks.map((mark) => ({
      mark,
      x:
        hi === lo
          ? (from + to) / 2
          : from + ((mark.ms - lo) / (hi - lo)) * (to - from),
    })),
  };
}

function exactOf(
  strip: Extract<Strip, { kind: "day" | "since" }>,
  marks: LaneMark[],
): SafeHtml {
  const { gateX, marks: placed } = placeExact(strip, marks);
  const withDate = strip.kind === "since";
  let gate: ExactGate | null = null;
  if (gateX !== null) {
    const t = strip.transition!;
    gate = {
      kind: strip.kind === "day" ? (strip.gap ? "gap" : "overlap") : "since",
      x: gateX,
      text: withDate
        ? `${t.offsetBefore} → ${t.offsetAfter} ${t.instant.slice(0, 10)}`
        : `${t.offsetBefore} → ${t.offsetAfter} ${t.instant.slice(11, 16)}Z`,
    };
  }
  const drawn: ExactMark[] = placed.map(({ mark, x }) => ({
    x,
    text: markText(mark, withDate),
    title: mark.instant,
  }));
  return exactTrack({ gate, broken: withDate && gateX !== null, marks: drawn });
}

function reasonOf(line: AuditLine | null, strip: Strip | null): SafeHtml {
  if (line === null || strip === null) return storedNote(BLANK_REASON_TEXT);
  if (line.result === null) {
    return aside(
      { label: NO_RESULT_TITLE, tone: "caution", title: NO_RESULT_TITLE },
      html`<p>${NOT_STORED_TEXT}</p>`,
    );
  }
  if (strip.kind === "none") return storedNote(strip.reason);
  if (strip.kind === "since" && strip.transition === null) {
    return storedNote(NO_TRANSITION_TEXT(strip.years));
  }
  return html``;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): AuditState;
  apply(state: AuditState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: StoredTimeLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el, id } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const valuesEl = el<HTMLTextAreaElement>("values");
  const figureEl = el<HTMLElement>("figure");
  const group = id("lines");

  let selected: number | null = null;
  let lines: AuditLine[] = [];
  let pending = 0;

  const readState = (): AuditState => ({
    values: valuesEl.value,
    line: selected,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(valuesEl.value);
  }

  function drawTable(parsed: ParsedLines): void {
    setHtml(
      el("table"),
      tableOf(
        lines.map((l, i) => auditRow(l, i + 1, selected === i + 1)),
        group,
      ),
    );
    const text = truncatedText(parsed);
    setHtml(el("truncated"), text === "" ? html`` : storedNote(text));
  }

  /** What the last lanes were drawn for, so a change of width can draw them again. */
  let last: { line: AuditLine; strip: Strip } | null = null;

  function drawFigure(line: AuditLine | null, strip: Strip | null): void {
    last = line && strip ? { line, strip } : null;
    const legend = new Set<LegendId>();
    let clock: SafeHtml | "" = "";
    let exact: SafeHtml;
    if (!line || !strip || strip.kind === "none" || line.result === null) {
      exact = exactTrack({ gate: null, broken: false, marks: [] });
    } else {
      const marks = laneMarks(line.result);
      if (strip.kind === "day") {
        clock = dayClockOf(strip, figureEl.clientWidth);
        legend.add(strip.gap ? "gap" : "overlap");
        legend.add("gate");
      } else {
        clock = sinceClockOf(strip, line);
        if (strip.transition !== null) {
          legend.add("gate");
          legend.add("break");
        }
      }
      exact = exactOf(strip, marks);
      if (marks.length > 0) legend.add("mark");
    }
    setHtml(
      figureEl,
      storedFigure({
        label: line && strip ? figureLabel(line, strip) : BLANK_REASON_TEXT,
        clock,
        exact,
        legend,
      }),
    );
  }

  function drawCalls(line: AuditLine | null, strip: Strip | null): void {
    if (line === null || strip === null) {
      setHtml(
        el("calls-slot"),
        codeFrame({
          label: "Call made",
          copyLabel: "Copy call",
          copyText: "",
          gate: "codeframe",
        }),
      );
      setHtml(
        el("output-slot"),
        callOutput({
          label: "What classifyStoredZoned returned",
          state: "empty",
          lines: [{ text: NO_LINE_OUTPUT, lost: false }],
        }),
      );
      return;
    }
    const calls: EdiCall[] = [
      { fn: "classifyStoredZoned", args: [line.value], result: line.result },
      ...strip.calls,
    ];
    const printed = callLines(calls);
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Call made",
        copyLabel: "Copy call",
        copyText: printed.plain,
        code: printed.code,
        gate: "codeframe",
      }),
    );
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What classifyStoredZoned returned",
        state: line.result === null ? "sentinel" : "live",
        lines: calls.map((c) => ({
          text: formatResult(c.result),
          lost: c.result === null,
        })),
      }),
    );
  }

  function drawSection3(): void {
    const line = selected === null ? null : (lines[selected - 1] ?? null);
    const strip = line === null ? null : stripFor(line, lib);
    drawFigure(line, strip);
    setHtml(el("reason"), reasonOf(line, strip));
    drawCalls(line, strip);
    setHtml(el("links"), linksOf(line));
  }

  function render(): void {
    const parsed = parseAuditLines(valuesEl.value);
    lines = readAuditLines(parsed.lines, lib);
    if (selected === null || selected < 1 || selected > lines.length) {
      selected = lines.length > 0 ? defaultLine(lines) : null;
    }
    drawTable(parsed);
    drawSection3();
  }

  function apply(state: AuditState): void {
    valuesEl.value = state.values;
    selected = state.line;
  }

  const frame: (cb: () => void) => number =
    typeof requestAnimationFrame === "function"
      ? (cb) => requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number;
  const unframe: (id: number) => void =
    typeof cancelAnimationFrame === "function"
      ? (id) => cancelAnimationFrame(id)
      : (id) => clearTimeout(id);

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== valuesEl) return;
      // Debounced one frame: a paste of twelve lines reads once.
      if (pending) unframe(pending);
      pending = frame(() => {
        pending = 0;
        // New text is a new list: the old line number names nothing in it, so
        // render picks the first line that is not valid.
        selected = null;
        syncPreset();
        render();
      });
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = AUDIT_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(presetState(chosen));
        syncPreset();
        render();
        return;
      }
      if (
        target instanceof HTMLInputElement &&
        target.type === "radio" &&
        target.name === group
      ) {
        selected = Number(target.value);
        // Mark the rows in place: redrawing the table would drop the keyboard focus.
        for (const row of widgetEl.querySelectorAll<HTMLElement>(
          "tr[data-selected]",
        )) {
          row.dataset["selected"] = String(row.contains(target));
        }
        drawSection3();
      }
    },
    { signal },
  );

  // A new width can change how many ticks the day lane has room for.
  const disposeWidth = onWidthChange(figureEl, () => {
    if (last) drawFigure(last.line, last.strip);
  });

  // The template seeds a preset; opening on it selects the preset's line.
  const initial = AUDIT_PRESETS.find(
    (p) => p.id === matchPreset(valuesEl.value),
  );
  selected = initial ? initial.selected : null;
  syncPreset();
  render();

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: () => {
      if (pending) unframe(pending);
      pending = 0;
      disposeWidth();
    },
  };
}

export const mountStoredTimeAudit: MountFn<StoredTimeAuditArgs> = async (
  root,
  args = {},
  signal,
) => {
  defineElements();
  let lib: StoredTimeLib;
  try {
    lib = await loadStoredTimeLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
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
