/**
 * The GTFS Trip Board widget (RAI-100), mountable on its tool page and in the chat rail.
 *
 * The reader pastes one trip's `stop_times.txt` rows (with `stop_timezone` joined on), a service
 * date and the agency's zone. For each stop the board shows the instant `gtfsToInstant` gives,
 * the clock on the platform at that instant, the reading a stop's own zone would give (the
 * mistake) and the length of each leg, by the clock and by elapsed time. Two plates sum the trip.
 * The calls made for one stop are printed under the table.
 *
 * Built on the component kit: `renderGtfsTripBoardTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. Every
 * listener is delegated on the widget with the mount's `signal`; no timer runs. The widget holds
 * no GTFS rule: every value comes from the library (`gtfs-trip-board.ts`).
 *
 * `""` / `null` from the library renders as NO SIGNAL (amber). An empty box, or a paste the
 * board cannot read, makes no call and reads in words, never amber. Every value sits in a `hold`
 * sized for the widest zone, so for a given row count typing never moves a cell or a plate.
 */
import { defineElements } from "~/widgets/define";
import {
  badge,
  codeFrame,
  field,
  findWidget,
  hold,
  html,
  idScope,
  section,
  select,
  selectOptions,
  setHtml,
  table,
  textInput,
  toolLinks,
  widget,
  zonedValue,
  type SafeHtml,
} from "~/widgets/builders";
import { textArea } from "~/widgets/families/ledger/text-area";
import { SIGNAL_TEXT } from "~/widgets/families/holiday/signal-plates";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/gtfs-trip-board.module.css";
import {
  BLANK_RESULT,
  CALLS_SIZER,
  CLOCKS_AGREE,
  CLOCK_CHANGE,
  CUSTOM_PRESET_ID,
  DATE_MAX_CHARS,
  FIRST_STOP,
  GHOST_BADGE,
  GHOST_CHANGE,
  GHOST_DURATION,
  GHOST_MOVED,
  GHOST_UTC,
  GHOST_ZONED,
  NOTHING_TO_MISREAD,
  NOTHING_TYPED,
  NOT_GIVEN,
  NOT_READ,
  PRESETS,
  ZONE_CHANGE,
  ZONE_MAX_CHARS,
  callsFor,
  computeTrip,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readTrip,
  type CellState,
  type GtfsTripBoardArgs,
  type LegCell,
  type PlateValue,
  type StopRow,
  type TimeCell,
  type TripResult,
  type TripState,
  type WrongCell,
} from "./gtfs-trip-board";
import { loadTripBoardLib, type TripBoardLib } from "./rail-lib";
import { encodeWidgetPermalink } from "./widget-permalink";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { GtfsTripBoardArgs } from "./gtfs-trip-board";

const WIDGET_NAME = "gtfs-trip-board";

/** The textarea shows this many lines before it scrolls inside itself. */
const ROWS_VISIBLE = 8;

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const held = (
  live: SafeHtml,
  ghosts: readonly (string | SafeHtml)[],
): SafeHtml => hold(live, ghosts, { ghostClass: styles.ghost });

/** A zoned reading; the wrapper lets the zone piece break when the column is narrower than it. */
const zoned = (text: string): SafeHtml =>
  html`<span class="${styles.zoned}">${zonedValue(text)}</span>`;

/** A library answer (zoned), a library refusal (NO SIGNAL) or a plain word. */
function shown(state: CellState, text: string): SafeHtml {
  if (state === "live") return zoned(text);
  if (state === "signal")
    return html`<span class="${styles.word}" data-state="signal">${SIGNAL_TEXT}</span>`;
  return html`<span class="${styles.word}">${text}</span>`;
}

const READING_GHOSTS: readonly (string | SafeHtml)[] = [
  zoned(GHOST_ZONED),
  SIGNAL_TEXT,
  NOT_GIVEN,
  NOT_READ,
  NOTHING_TYPED,
];

const timeCellOf = (c: TimeCell): SafeHtml =>
  html`${held(shown(c.state, c.text), READING_GHOSTS)}${held(
    c.instant === ""
      ? html``
      : html`<span class="${styles.instant}">${c.instant}</span>`,
    [GHOST_UTC],
  )}`;

const wrongBadge = (b: NonNullable<WrongCell["badge"]>): SafeHtml =>
  badge({ text: b.text, tone: b.tone, wrap: true });

const wrongCellOf = (c: WrongCell): SafeHtml =>
  html`${held(shown(c.state, c.text), [
    ...READING_GHOSTS,
    NOTHING_TO_MISREAD,
  ])}${hold(c.badge === null ? html`` : wrongBadge(c.badge), [
    badge({ text: GHOST_BADGE, tone: "danger", wrap: true }),
  ])}`;

const VERDICT_TONES = {
  [CLOCKS_AGREE]: "neutral",
  [CLOCK_CHANGE]: "cyan",
  [ZONE_CHANGE]: "purple",
} as const;

function verdictOf(leg: LegCell): SafeHtml {
  if (leg.verdict === "") return html``;
  const tone =
    VERDICT_TONES[leg.verdict as keyof typeof VERDICT_TONES] ?? "neutral";
  const first = [...leg.changes].sort()[0];
  const text =
    leg.verdict === CLOCK_CHANGE && first !== undefined
      ? `${CLOCK_CHANGE} at ${first}`
      : leg.verdict;
  return badge({ text, tone, wrap: true });
}

function legCellOf(c: LegCell): SafeHtml {
  const clocks =
    c.clocksState === "signal"
      ? html`<span class="${styles.word}" data-state="signal">${SIGNAL_TEXT}</span>`
      : c.clocks === ""
        ? html``
        : html`<span class="${styles.word}">clocks ${c.clocks}</span>`;
  return html`${held(shown(c.state, c.text), [
    GHOST_DURATION,
    SIGNAL_TEXT,
    FIRST_STOP,
    NOT_GIVEN,
    NOT_READ,
    NOTHING_TYPED,
  ])}${held(clocks, [`clocks ${GHOST_DURATION}`, SIGNAL_TEXT])}${hold(
    verdictOf(c),
    [badge({ text: GHOST_CHANGE, tone: "cyan", wrap: true })],
  )}`;
}

function stopCellOf(r: StopRow): SafeHtml {
  return html`<span class="${styles.line}">Line ${r.line}</span
    ><span class="${styles.stop}">${r.stopId === "" ? NOT_READ : r.stopId}</span
    ><span class="${styles.zone}">${r.zoneNote}</span>`;
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

const word = (text: string): TimeCell => ({ state: "word", text, instant: "" });

/** A row with every value empty: the first paint's row, before the library has answered. */
function emptyRow(line: number, stopId: string, zoneNote: string): StopRow {
  const none = word("");
  return {
    line,
    stopId,
    zoneNote,
    rejected: "",
    arrival: none,
    departure: none,
    wrong: { ...none, badge: null, shift: null },
    leg: {
      state: "word",
      text: "",
      clocks: "",
      clocksState: "word",
      verdict: "",
      changes: [],
    },
    calls: [],
  };
}

function tableOf(rows: readonly StopRow[]): SafeHtml {
  return table({
    caption: "Each stop, read two ways",
    columns: [
      { key: "stop", header: "Stop", align: "start", numeric: false },
      { key: "arrival", header: "Arrival", align: "start", numeric: false },
      {
        key: "departure",
        header: "Departure",
        align: "start",
        numeric: false,
      },
      {
        key: "wrong",
        header: "Read in stop_timezone (wrong)",
        align: "start",
        numeric: false,
      },
      { key: "leg", header: "Leg", align: "start", numeric: false },
    ],
    rowHeader: "stop",
    layout: "fixed",
    widths: ["16%", "22%", "22%", "22%", "18%"],
    labelCells: true,
    roles: true,
    gate: "drawn",
    rows: rows.map((r) => ({
      stop: stopCellOf(r),
      arrival: timeCellOf(r.arrival),
      departure: timeCellOf(r.departure),
      wrong: wrongCellOf(r.wrong),
      leg: legCellOf(r.leg),
    })),
  });
}

function notesOf(notes: readonly string[]): SafeHtml {
  return html`<ul class="${styles.notes}" aria-live="polite" aria-label="Notes on the paste"
    >${notes.map((n) => html`<li>${n}</li>`)}</ul
  >`;
}

function boardOf(rows: readonly StopRow[], notes: readonly string[]): SafeHtml {
  return html`${tableOf(rows)}${notesOf(notes)}`;
}

// ---------------------------------------------------------------------------
// Plates
// ---------------------------------------------------------------------------

function plate(
  caption: string,
  value: PlateValue,
  ghosts: readonly string[],
): SafeHtml {
  const live =
    value.state === "live"
      ? html`<span class="${styles.figure}">${value.text}</span>`
      : value.state === "signal"
        ? html`<span class="${styles.word}">${SIGNAL_TEXT}</span>`
        : html`<span class="${styles.word}">${value.text}</span>`;
  return html`<div class="${styles.plate}" data-state="${value.state}" data-gate="hero"
    ><dt class="${styles.caption}">${caption}</dt
    ><dd class="${styles.value}"
      >${held(live, [...ghosts, SIGNAL_TEXT, NOTHING_TYPED, NOT_READ])}</dd
    ></div
  >`;
}

function platesOf(r: TripResult): SafeHtml {
  return html`<dl class="${styles.plates}"
    >${plate("Trip, first departure to last arrival", r.trip, [GHOST_DURATION])}${plate(
      "Stops the wrong zone moves",
      r.moved,
      [GHOST_MOVED],
    )}</dl
  >`;
}

// ---------------------------------------------------------------------------
// Calls and links
// ---------------------------------------------------------------------------

function callsOf(text: string): SafeHtml {
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy the calls",
    copyText: text,
    code: html`${text}`,
    gate: "codeframe",
    minLines: CALLS_SIZER.lines,
    sizer: CALLS_SIZER.widest,
  });
}

interface CallOption {
  value: string;
  label: string;
}

function callOptions(r: TripResult): CallOption[] {
  const read = r.rows.filter((row) => row.stopId !== "");
  return read.length === 0
    ? [{ value: "", label: "No stop read" }]
    : read.map((row) => ({
        value: String(row.line),
        label: `Line ${row.line}: ${row.stopId}`,
      }));
}

function linksOf(state: TripState): SafeHtml {
  return toolLinks({
    label: "Open this trip in another tool",
    links: [
      {
        text: "Read one service day in the GTFS Service Day Clock",
        href:
          state.date === "" || state.zone === ""
            ? undefined
            : encodeWidgetPermalink("gtfsday", {
                serviceDate: state.date,
                time: "08:00:00",
                timeZone: state.zone,
              }),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const presetOptions = () => [
  { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
  ...PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  })),
];

/** The rows of the paste as the first paint holds them: names and zones, no readings. */
function seedRows(text: string): StopRow[] {
  const read = readTrip(text);
  if (read.kind === "refused") return [];
  return read.rows.map((r) =>
    r.ok
      ? emptyRow(
          r.line,
          r.stopId,
          r.zoneCell === "" ? "agency zone" : r.zoneCell,
        )
      : emptyRow(r.line, "", NOT_READ),
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The table has one empty row for each row of the paste (string work only);
 * the plates, the calls and the readings are drawn blank here, without the library; `mount`
 * draws every result.
 */
export function renderGtfsTripBoardTemplate(
  idPrefix: string,
  args: GtfsTripBoardArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: TripState = isSeeded(args) ? readArgs(args) : presetState();

  const input = (
    local: string,
    label: string,
    value: string,
    maxLength: number,
  ) =>
    field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          inputMode: "text",
          autocomplete: "off",
          spellcheck: false,
          maxLength,
          describedBy,
        }),
    });

  const inputs = section(
    {
      id: id("inputs"),
      heading: "A trip, as the feed holds it",
      level: 3,
    },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: presetOptions(),
    })}</div><div class="${styles.wide} ${styles.rowsBox}">${field({
      id: id("rows"),
      label: "Trip rows (stop_times.txt, with stop_timezone from stops.txt)",
      control: ({ id: cid, describedBy }) =>
        textArea({
          id: cid,
          value: state.rows,
          rows: ROWS_VISIBLE,
          describedBy,
        }),
    })}</div>${input("date", "Service date (calendar.txt)", state.date, DATE_MAX_CHARS)}${input(
      "zone",
      "Zone (agency.txt, agency_timezone)",
      state.zone,
      ZONE_MAX_CHARS,
    )}</div>`,
  );

  const board = section(
    { id: id("board-section"), heading: "The trip, stop by stop", level: 3 },
    html`<div id="${id("plates")}">${platesOf(BLANK_RESULT)}</div
      >${grow(html`<div class="${styles.board}" id="${id("board")}">${boardOf(seedRows(state.rows), [])}</div>`)}`,
  );

  const calls = section(
    { id: id("calls-section"), heading: "The calls", level: 3 },
    html`<div class="${styles.callsFor}">${field({
      id: id("calls-for"),
      label: "Calls for",
      control: ({ id: cid, describedBy }) =>
        select({
          id: cid,
          options: [{ value: "", label: "No stop read" }],
          describedBy,
        }),
    })}</div>${grow(html`<div class="${styles.slot}" id="${id("calls")}">${callsOf("")}</div>`)}<div id="${id("links")}">${linksOf(state)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "GTFS Trip Board", scope: idPrefix },
    html`${inputs}${board}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): TripState;
  apply(state: TripState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: TripBoardLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const rowsEl = el<HTMLTextAreaElement>("rows");
  const dateEl = el<HTMLInputElement>("date");
  const zoneEl = el<HTMLInputElement>("zone");
  const callsForEl = el<HTMLSelectElement>("calls-for");

  /** The stop the reader chose in "Calls for"; `null` follows the default. */
  let chosen: number | null = null;
  let result: TripResult = BLANK_RESULT;

  const readState = (): TripState => ({
    rows: rowsEl.value,
    date: dateEl.value,
    zone: zoneEl.value,
  });

  function syncPresets(): void {
    presetEl.value = matchPreset(readState());
  }

  function drawCalls(): void {
    const options = callOptions(result);
    const lines = options.map((o) => o.value);
    const wanted =
      chosen !== null && lines.includes(String(chosen))
        ? chosen
        : (result.firstMoved ?? result.firstRead);
    const value = wanted === null ? "" : String(wanted);
    setHtml(callsForEl, selectOptions(options, value));
    callsForEl.value = lines.includes(value) ? value : (lines[0] ?? "");
    setHtml(el("calls"), callsOf(callsFor(result, wanted)));
  }

  function render(): void {
    const state = readState();
    result = computeTrip(lib, state);
    setHtml(el("plates"), platesOf(result));
    setHtml(el("board"), boardOf(result.rows, result.notes));
    setHtml(el("links"), linksOf(state));
    drawCalls();
  }

  function apply(state: TripState): void {
    rowsEl.value = state.rows;
    dateEl.value = state.date;
    zoneEl.value = state.zone;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== rowsEl && e.target !== dateEl && e.target !== zoneEl) {
        return;
      }
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === callsForEl) {
        chosen = callsForEl.value === "" ? null : Number(callsForEl.value);
        drawCalls();
        return;
      }
      if (e.target !== presetEl) return;
      const picked = PRESETS.find((p) => p.id === presetEl.value);
      // "Your values" keeps what is typed.
      if (!picked) return;
      chosen = null;
      apply(picked);
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountGtfsTripBoard: MountFn<GtfsTripBoardArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: TripBoardLib;
  try {
    lib = await loadTripBoardLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPresets();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
