/**
 * The Demurrage Clock widget (INT-14), mountable on its tool page and in the
 * chat rail.
 *
 * Which two events bound each clock. The reader lists a container's events, and
 * the widget calls `demurrageClock` once for each of the four clocks (demurrage,
 * detention, storage, combined) and draws the four intervals as half-open bars
 * under one rail of events, over the terminal's local days. The chosen clock
 * is lit and the other three are dimmed. The pair each clock runs between is
 * read from the library (`clockPair`), never from a table.
 *
 * The terminal clock is a display zone. It sets the day columns and the local
 * times, and it is not an argument of `demurrageClock`; the widget says so
 * beside the control.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`, and the
 * ledger family's wiring: every listener is delegated on the root, so the host
 * dropping the subtree is a complete teardown apart from the width observer.
 * Every printed call and result is the real one; the drawing only places them.
 */
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
  select,
  setHtml,
  srOnly,
  textInput,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines } from "~/widgets/families/gnss/call-lines";
import { formatValue } from "./punctuality-widgets";
import {
  CLOCK_PLOT_HEIGHT,
  clockLanes,
  clockPlot,
  clockRail,
  type ClockLaneView,
  type RailEventView,
} from "~/widgets/families/ledger/clock-plot";
import { dayColumns } from "~/widgets/families/ledger/day-columns";
import { handoffLink } from "~/widgets/families/ledger/handoff-link";
import {
  axisTicks,
  ledgerAxis,
  ledgerFrame,
  ledgerLane,
  ledgerLegend,
} from "~/widgets/families/ledger/ledger-lane";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/demurrage-clock.module.css";
import {
  CLOCK_DIRECTIONS,
  CLOCK_EVENT_TYPES,
  CLOCK_SCOPES,
  CLOCK_START_EVENTS,
  CUSTOM_PRESET_ID,
  DEMURRAGE_PRESETS,
  MAX_EVENTS,
  blankPlates,
  clockPlates,
  eventMarks,
  freeTimeArgs,
  freeTimeHint,
  isSeeded,
  laneAria,
  laneLabel,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readClocks,
  summaryText,
  zoneLabel,
  zoneReadable,
  type ClockRead,
  type DemurrageClockArgs,
  type DemurrageState,
  type EventMark,
  type LaneRead,
} from "./demurrage-clock";
import {
  axisLabels,
  createLedgerCanvas,
  dayCells,
  fitLedgerCanvas,
  toEpochMs,
  type LedgerCanvas,
} from "./dwell-ledger";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { layoutWidth, onWidthChange, thinTickLabels } from "./label-fit";
import { loadDemurrageLib } from "./ledger-lib";
import type { DemurrageLib } from "./ledger-lib";
import type { PlateSpec } from "./ledger-widgets";
import { placeLabels, type LabelBox } from "./punctuality-widgets";
import { TRANSPORT_ZONES } from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";

export type { DemurrageClockArgs } from "./demurrage-clock";

const WIDGET_NAME = "demurrage-clock";

/** The size of an event's diamond, for the label placer (px). */
const MARK_PX = 14;

/** The widest values the plates show, so they keep their width from one reading to the next. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-start": ["empty returned"],
  "hero-end": ["empty returned"],
  "hero-ran": ["99 d 23 h 59 min"],
};

const EMPTY_TEXT = "Add an event with an instant to draw the clocks.";
const NO_INTERVAL_TEXT =
  "The library returned no interval for these events and options.";

interface Option {
  value: string;
  label: string;
}

const plain = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value, label: value }));

/**
 * Options for a select. A selected value the list lacks (a seed the form does not offer, or a
 * blank where a choice is needed) is added as its own option, so it reaches the library as
 * given and is never silently replaced. A blank label makes the blank a choice of its own.
 */
function withSelected(
  options: readonly Option[],
  selected: string,
  blankLabel?: string,
): Option[] {
  const list = [...options];
  if (blankLabel !== undefined) list.unshift({ value: "", label: blankLabel });
  if (!list.some((o) => o.value === selected)) {
    const extra = {
      value: selected,
      label: selected === "" ? "not chosen" : selected,
    };
    if (selected === "") list.unshift(extra);
    else list.push(extra);
  }
  return list;
}

function plateList(specs: readonly PlateSpec[]): Plate[] {
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

const blankLanes = (): ClockLaneView[] =>
  CLOCK_SCOPES.map((scope, i) => ({
    n: i + 1,
    scope,
    label: scope,
    aria: scope,
    chosen: false,
    bar: null,
    why: null,
  }));

const outputView = (label: string, read: ClockRead | null): SafeHtml => {
  if (read === null) {
    return callOutput({ label, state: "empty", lines: [] });
  }
  if (read.chosen.interval === null) {
    return callOutput({
      label,
      state: "sentinel",
      lines: [{ text: "NO SIGNAL", lost: true }],
    });
  }
  return callOutput({
    label,
    state: "live",
    lines: read.calls.map((c) => ({
      text: formatValue(c.result),
      lost: false,
    })),
  });
};

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The rail, the lanes, the plates and the outputs are drawn by `mount`,
 * because they come from the real library calls.
 */
export function renderDemurrageClockTemplate(
  idPrefix: string,
  args: DemurrageClockArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: DemurrageState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEMURRAGE_PRESETS[0]!);
  const presetId = matchPreset(state);

  const zoneOptions = withSelected(
    plain(TRANSPORT_ZONES),
    state.zone,
    "UTC (no zone)",
  );

  const rows = state.rows.slice(0, MAX_EVENTS);
  const eventRows = Array.from({ length: MAX_EVENTS }, (_, i) => {
    const n = i + 1;
    const row = rows[i] ?? { type: "", at: "" };
    return html`<div class="${styles.row}">${field({
      id: id(`type-${n}`),
      label: `Event ${n}`,
      control: ({ id: cid }) =>
        select({
          id: cid,
          value: row.type,
          options: withSelected(plain(CLOCK_EVENT_TYPES), row.type, "No event"),
        }),
    })}${field({
      id: id(`at-${n}`),
      label: `Instant ${n}`,
      control: ({ id: cid }) =>
        textInput({
          id: cid,
          value: row.at,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 64,
        }),
    })}</div>`;
  });

  const tariff = section(
    {
      id: id("events-section"),
      heading: "1. Set the events and the options",
      level: 4,
    },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...DEMURRAGE_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("scope"),
        label: "Clock",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.scope,
            options: withSelected(plain(CLOCK_SCOPES), state.scope),
          }),
      })}${field({
        id: id("direction"),
        label: "Direction",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.direction,
            options: withSelected(plain(CLOCK_DIRECTIONS), state.direction),
          }),
      })}${field({
        id: id("start-event"),
        label: "Start event (optional)",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.startEvent,
            options: withSelected(
              plain(CLOCK_START_EVENTS),
              state.startEvent,
              "not given",
            ),
          }),
      })}${field({
        id: id("zone"),
        label: "Terminal clock",
        control: ({ id: cid }) =>
          select({ id: cid, value: state.zone, options: zoneOptions }),
      })}`,
    )}<p class="${styles.hint}">The terminal clock is a display zone. It sets the day columns and the local times. It is not an argument of demurrageClock, so it never changes an interval.</p><fieldset class="${styles.events}"><legend>Events</legend>${eventRows}</fieldset></div>`,
  );

  const drawn = section(
    {
      id: id("drawn-section"),
      heading: "2. Which events bound each clock",
      level: 4,
    },
    html`${ledgerFrame(
      html`<div id="${id("plates")}" role="group" aria-label="The chosen clock">${plates(
        plateList(blankPlates(state.scope)),
        { gate: "hero" },
      )}</div>${ledgerLane(
        {
          id: id("lane"),
          label: "",
          daysLabel: "Local days",
          height: CLOCK_PLOT_HEIGHT,
        },
        clockPlot({
          id: id("plot"),
          empty: "",
          events: [],
          lanes: blankLanes(),
        }),
      )}${ledgerAxis(id("axis"), ["", "", ""])}${ledgerLegend([
        { text: "event", swatch: "event" },
        { text: "chosen clock", swatch: "lit" },
        { text: "other clocks, dimmed", swatch: "dim" },
      ])}`,
      { gate: "frame" },
    )}<p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>${grow(
      html`<div id="${id("reason")}"></div>`,
    )}<div class="${styles.handoff}">${handoffLink({
      id: id("handoff"),
      label: "Count the days in the Free Time Ledger",
      describedBy: id("handoff-hint"),
    })}<p class="${styles.hint}" id="${id("handoff-hint")}"></p></div>`,
  );

  const returns = section(
    {
      id: id("calls-section"),
      heading: "3. What demurrageClock returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("calls")}">${codeFrame({
        label: "Calls made",
        copyLabel: "Copy the calls",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(html`<div id="${id("out")}">${outputView("What the calls returned", null)}</div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Demurrage Clock", scope: idPrefix },
    html`${tariff}${drawn}${returns}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): DemurrageState;
  apply(state: DemurrageState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: DemurrageLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const rowNumbers = Array.from({ length: MAX_EVENTS }, (_, i) => i + 1);
  const typeEls = rowNumbers.map((n) => el<HTMLSelectElement>(`type-${n}`));
  const atEls = rowNumbers.map((n) => el<HTMLInputElement>(`at-${n}`));
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const scopeEl = el<HTMLSelectElement>("scope");
  const directionEl = el<HTMLSelectElement>("direction");
  const startEventEl = el<HTMLSelectElement>("start-event");
  const zoneEl = el<HTMLSelectElement>("zone");
  const trackEl = el("lane-track");

  const readState = (): DemurrageState => ({
    rows: rowNumbers.map((_, i) => ({
      type: typeEls[i]!.value,
      at: atEls[i]!.value,
    })),
    scope: scopeEl.value,
    direction: directionEl.value,
    startEvent: startEventEl.value,
    zone: zoneEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  /** The canvas: every event the rail can draw, with a margin, out to the terminal's local midnights. */
  function canvasFor(
    marks: readonly EventMark[],
    state: DemurrageState,
  ): LedgerCanvas | null {
    if (marks.length === 0) return null;
    const ms = marks.map((m) => m.ms);
    const zones = zoneReadable(state.zone) ? [zoneLabel(state.zone)] : [];
    return (
      fitLedgerCanvas(Math.min(...ms), Math.max(...ms), zones) ??
      createLedgerCanvas(Math.min(...ms), Math.max(...ms) + 1)
    );
  }

  const laneView = (
    lane: LaneRead,
    index: number,
    chosen: boolean,
    canvas: LedgerCanvas | null,
    zone: string,
  ): ClockLaneView => {
    let bar: ClockLaneView["bar"] = null;
    if (lane.interval !== null && canvas !== null) {
      const left = canvas.toPercent(toEpochMs(lane.interval.start));
      const right = canvas.toPercent(toEpochMs(lane.interval.end));
      bar = { from: left, to: Math.max(left, right) };
    }
    return {
      n: index + 1,
      scope: lane.scope,
      label: laneLabel(lane.scope, lane.pair),
      aria: laneAria(lane, zone),
      chosen,
      bar,
      why: lane.interval === null ? (lane.reason?.lane ?? "no result") : null,
    };
  };

  /** Place each event's chip so no chip covers another or a diamond. */
  function placeChips(): void {
    const rail = el("plot-rail");
    const w = rail.clientWidth;
    const h = rail.clientHeight;
    if (w === 0 || h === 0) return;
    const chips = [...rail.querySelectorAll<HTMLElement>("[data-event-chip]")];
    const boxes: LabelBox[] = chips.map((chip) => ({
      x: (Number(chip.dataset["x"] ?? 0) / 100) * w,
      y: h - MARK_PX,
      w: layoutWidth(chip),
      h: chip.offsetHeight,
    }));
    placeLabels(boxes, w, h, { markPx: MARK_PX }).forEach((p, i) => {
      const chip = chips[i]!;
      const box = boxes[i]!;
      // When nothing is clear the placer falls back to its first choice, which
      // may hang past the rail; a chip always stays inside it.
      chip.style.insetInlineStart = `${Math.max(0, Math.min(p.left, w - box.w))}px`;
      chip.style.insetBlockStart = `${Math.max(0, Math.min(p.top, h - box.h))}px`;
    });
  }

  function render(): void {
    const s = readState();
    const read: ClockRead = readClocks(s, lib);
    const marks = eventMarks(s, lib);
    const canvas = canvasFor(marks, s);
    const zone = zoneLabel(s.zone);
    const readable = zoneReadable(s.zone);

    setHtml(
      el("plates"),
      plates(plateList(clockPlates(read, s.zone)), { gate: "hero" }),
    );

    // The chart: days, rail, lanes.
    el("lane-label").textContent = readable ? zone : "zone not read";
    if (canvas === null || !readable) {
      setHtml(el("lane-cells"), html``);
    } else {
      const ms = marks.map((m) => m.ms);
      setHtml(
        el("lane-cells"),
        dayColumns(
          dayCells(canvas, zone, Math.min(...ms), Math.max(...ms)),
          canvas,
          {},
        ),
      );
    }
    const events: RailEventView[] =
      canvas === null
        ? []
        : marks.map((m) => ({
            n: m.n,
            type: m.type,
            word: m.word,
            local: m.local,
            pct: Math.round(canvas.toPercent(m.ms) * 100) / 100,
            aria: `${m.word}, ${m.local === "" ? m.at : m.local} on the ${zone} clock`,
          }));
    setHtml(el("plot-rail"), clockRail(events));
    setHtml(
      el("plot-lanes"),
      clockLanes(
        read.lanes.map((lane, i) =>
          laneView(lane, i, lane === read.chosen, canvas, s.zone),
        ),
      ),
    );
    const empty = el("plot-empty");
    empty.hidden = canvas !== null;
    empty.textContent = canvas === null ? EMPTY_TEXT : "";
    placeChips();

    const axis = el("axis");
    setHtml(
      axis,
      axisTicks(
        canvas !== null && readable ? axisLabels(canvas, zone) : ["", "", ""],
      ),
    );
    thinTickLabels(axis, "span");

    // The calls made, and what they returned.
    const lines = callLines(read.calls);
    setHtml(
      el("calls"),
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy the calls",
        copyText: lines.plain,
        code: lines.code,
        gate: "codeframe",
      }),
    );
    setHtml(el("out"), outputView("What the calls returned", read));

    // The sentence for a screen reader, and why the chosen clock is null.
    setHtml(el("summary"), srOnly(summaryText(read, s.zone)));
    setHtml(
      el("reason"),
      read.chosen.interval === null
        ? aside(
            { label: NO_RESULT_TITLE, tone: "caution", title: NO_RESULT_TITLE },
            html`<p>${read.chosen.reason?.sentence ?? NO_INTERVAL_TEXT}</p>`,
          )
        : html``,
    );

    // The hand-off to the Free Time Ledger.
    const link = el<HTMLAnchorElement>("handoff");
    const handoff = freeTimeArgs(read, s);
    if (handoff) {
      link.setAttribute("href", encodeWidgetPermalink("freetime", handoff));
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
    }
    el("handoff-hint").textContent = freeTimeHint(read);
  }

  /** Set a select's value, adding the value as an option when the list lacks it. */
  function setSelect(
    select: HTMLSelectElement,
    value: string,
    blank?: string,
  ): void {
    if (![...select.options].some((o) => o.value === value)) {
      select.append(
        new Option(value === "" ? (blank ?? "not chosen") : value, value),
      );
    }
    select.value = value;
  }

  function apply(state: DemurrageState): void {
    state.rows.slice(0, MAX_EVENTS).forEach((row, i) => {
      setSelect(typeEls[i]!, row.type, "No event");
      atEls[i]!.value = row.at;
    });
    setSelect(scopeEl, state.scope);
    setSelect(directionEl, state.direction);
    setSelect(startEventEl, state.startEvent, "not given");
    setSelect(zoneEl, state.zone, "UTC (no zone)");
  }

  function applyPreset(): void {
    const chosen = DEMURRAGE_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    apply(presetState(chosen));
    syncPreset();
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (atEls.includes(e.target as HTMLInputElement)) {
        syncPreset();
        render();
      }
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
      if (
        typeEls.includes(target as HTMLSelectElement) ||
        atEls.includes(target as HTMLInputElement) ||
        target === scopeEl ||
        target === directionEl ||
        target === startEventEl ||
        target === zoneEl
      ) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  // The chips are placed against the rail's measured width, so a width change
  // (rotation, the chat rail opening) places them again.
  const disposeWidth = onWidthChange(trackEl, render);

  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: disposeWidth };
}

export const mountDemurrageClock: MountFn<DemurrageClockArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: DemurrageLib;
  try {
    lib = await loadDemurrageLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
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
