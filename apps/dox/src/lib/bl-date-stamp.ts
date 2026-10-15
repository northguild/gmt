/**
 * Pure helpers for the B/L Date Stamp widget (INT-14).
 *
 * One moment has a different calendar date in each place. A bill of lading
 * carries the local one. The tool takes a moment, the event it stamps and the
 * place of the event, asks `bolTimestamp` for the date, and draws that date
 * against the UTC date and up to three other calendars, on lanes that share
 * one time axis.
 *
 * No DOM and no gmt import. Every function that calls the library takes a
 * `BlDateLib`, loaded by the mount (`ledger-lib.ts`). The widget draws the
 * library's results and computes none of them: every date on screen is a
 * `bolTimestamp` result, and the comparisons ("same date", "after") are
 * `areDatesEqual` and `isAfterDate`. `@js-temporal/polyfill` is imported for
 * drawing only: where a day begins and ends on a lane, and a moment as a clock
 * time. The one site-side rule is `blNullText`, and it holds no table either:
 * it probes the library with a known moment.
 *
 * Naming rule: GMT tracks no law, and the UI names no body. No string here
 * names a statute, an agency, a carrier or a court. The three events are the
 * library's own names, and the DCSA field names are standard data. A place may
 * be named as an example (a preset's zone).
 */

import { Temporal } from "@js-temporal/polyfill";
import {
  createLedgerCanvas,
  dayCells,
  toEpochMs,
  type DayCell,
  type LedgerCanvas,
} from "./dwell-ledger";
import { runCall, type EdiCall } from "./edi-widgets";
import {
  dateText,
  localText,
  type DayMark,
  type PlateSpec,
  type SeriesNumber,
} from "./ledger-widgets";
import type { BlDateLib } from "./ledger-lib";
import { writtenParts } from "./punctuality-widgets";

// ---------------------------------------------------------------------------
// The library's names
// ---------------------------------------------------------------------------

/** The three events `bolTimestamp` reads, in the order the form lists them. */
export const BL_EVENTS = ["shippedOnBoard", "received", "issue"] as const;

export interface EventOption {
  value: string;
  label: string;
}

/** Each event, labelled with the DCSA field it fills. */
export const EVENT_OPTIONS: readonly EventOption[] = [
  {
    value: "shippedOnBoard",
    label: "Shipped on board (shippedOnBoardDate)",
  },
  {
    value: "received",
    label: "Received for shipment (receivedForShipmentDate)",
  },
  { value: "issue", label: "Issue (issueDate)" },
];

/** The caption of the B/L plate for each event. */
const EVENT_CAPTIONS: Readonly<Record<string, string>> = {
  shippedOnBoard: "Shipped on board date",
  received: "Received for shipment date",
  issue: "Issue date",
};

/** The caption for an event, or "B/L date" for one the library does not name. */
export function eventCaption(event: string): string {
  return EVENT_CAPTIONS[event.trim()] ?? "B/L date";
}

export const CUSTOM_PRESET_ID = "custom";

/** The moment the slider's window is 72 hours wide around (36 hours each side). */
export const WINDOW_HALF_HOURS = 36;
/** The slider's step, in minutes. It is the canvas's snap. */
export const SLIDER_STEP_MINUTES = 15;
/** The slider's positions: 72 hours in quarter-hours. */
export const SLIDER_STEPS = (2 * WINDOW_HALF_HOURS * 60) / SLIDER_STEP_MINUTES;
/**
 * The slider's last position. The window is half-open, `[start, end)`, so the
 * last position is the last quarter-hour inside it. The instant at `end` begins
 * a day the window does not draw, and a lane would have a date there with no
 * column to light.
 */
export const SLIDER_MAX = SLIDER_STEPS - 1;

/** How many lanes the chart always draws: UTC, the place, and three calendars. */
export const LANE_COUNT = 5;

const HOUR_MS = 3_600_000;
const STEP_MS = SLIDER_STEP_MINUTES * 60_000;

// ---------------------------------------------------------------------------
// State and seeds
// ---------------------------------------------------------------------------

/** The widget's controls, as strings, which is what the DOM holds. */
export interface BlDateState {
  /** The moment, at most 64 characters. */
  value: string;
  event: string;
  /** The place of the event: an IANA name or a UTC offset. Blank is no zone. */
  timeZone: string;
  /** Other calendars. Blank is none. */
  zone2: string;
  zone3: string;
  zone4: string;
  /** The latest date allowed, `YYYY-MM-DD`. Blank is none. */
  latest: string;
}

/** Seed arguments: the chat tool's input and a permalink's strings. */
export interface BlDateStampArgs {
  value?: string;
  event?: string;
  timeZone?: string;
  zone2?: string;
  zone3?: string;
  zone4?: string;
  latest?: string;
}

const ARG_KEYS = [
  "value",
  "event",
  "timeZone",
  "zone2",
  "zone3",
  "zone4",
  "latest",
] as const;

/** Whether the args name anything, so the widget opens on them and not on a preset. */
export function isSeeded(args: BlDateStampArgs): boolean {
  return ARG_KEYS.some((key) => args[key] !== undefined);
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Seed arguments as control values. Anything that is not a string becomes `""`,
 * and a key the seed does not carry stays blank: the event and the place are
 * never filled in for the reader.
 */
export function readArgs(args: BlDateStampArgs): BlDateState {
  return {
    value: str(args.value),
    event: str(args.event),
    timeZone: str(args.timeZone),
    zone2: str(args.zone2),
    zone3: str(args.zone3),
    zone4: str(args.zone4),
    latest: str(args.latest),
  };
}

/** Every non-blank control under its permalink key. Strings only. */
export function permalinkOf(state: BlDateState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ARG_KEYS) {
    const value = state[key].trim();
    if (value !== "") out[key] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export interface BlDatePreset {
  id: string;
  label: string;
  description: string;
  value: string;
  event: string;
  /** The place of the event, written by hand: the library maps no place to a zone. */
  timeZone: string;
  zone2: string;
  zone3: string;
  zone4: string;
  latest: string;
}

/**
 * Every preset is a JSDoc example of `bolTimestamp` or a worked case. The mount
 * test runs each against the library, so the date the widget prints is the date
 * the library gives. A zone is a literal field, not a lookup from a place.
 */
export const BL_DATE_PRESETS: readonly BlDatePreset[] = [
  {
    id: "new-york-evening",
    label: "New York evening",
    description:
      "A box is loaded at 21:00 in New York. In UTC the clock has already reached the next day, but the bill of lading carries the local date. Shanghai is added as a second calendar.",
    value: "2024-06-16T01:00:00Z",
    event: "shippedOnBoard",
    timeZone: "America/New_York",
    zone2: "Asia/Shanghai",
    zone3: "",
    zone4: "",
    latest: "",
  },
  {
    id: "shanghai-morning",
    label: "Shanghai morning",
    description:
      "A box is loaded at 07:00 in Shanghai. UTC is still on the day before, so reading the timestamp as UTC would date the bill a day early.",
    value: "2024-06-14T23:00:00Z",
    event: "shippedOnBoard",
    timeZone: "Asia/Shanghai",
    zone2: "",
    zone3: "",
    zone4: "",
    latest: "",
  },
  {
    id: "rotterdam-fall-back",
    label: "Rotterdam fall back",
    description:
      "The clocks go back in Amsterdam on 27 October, so that local day lasts 25 hours and 02:30 happens twice. The moment is one of them, and the date is still the 27th.",
    value: "2024-10-27T00:30:00Z",
    event: "received",
    timeZone: "Europe/Amsterdam",
    zone2: "",
    zone3: "",
    zone4: "",
    latest: "",
  },
  {
    id: "apia-deleted-day",
    label: "Apia, the deleted day",
    description:
      "Samoa moved across the date line at the end of 29 December 2011. Its calendar has no 30 December, so a moment on UTC's 30th is already the 31st there.",
    value: "2011-12-30T10:00:00Z",
    event: "shippedOnBoard",
    timeZone: "Pacific/Apia",
    zone2: "",
    zone3: "",
    zone4: "",
    latest: "",
  },
  {
    id: "fixed-offset",
    label: "A fixed offset",
    description:
      "The place can be a UTC offset instead of a zone name. An offset never changes with the season, so the date follows from the offset alone.",
    value: "2024-06-16T01:00:00Z",
    event: "shippedOnBoard",
    timeZone: "+08:00",
    zone2: "",
    zone3: "",
    zone4: "",
    latest: "",
  },
  {
    id: "no-zone",
    label: "No zone chosen",
    description:
      "The same moment with no place. Every bill of lading date is local, so without a zone the library has no date to give.",
    value: "2024-06-16T01:00:00Z",
    event: "shippedOnBoard",
    timeZone: "",
    zone2: "",
    zone3: "",
    zone4: "",
    latest: "",
  },
];

/** A preset as control values. */
export function presetState(p: BlDatePreset): BlDateState {
  return {
    value: p.value,
    event: p.event,
    timeZone: p.timeZone,
    zone2: p.zone2,
    zone3: p.zone3,
    zone4: p.zone4,
    latest: p.latest,
  };
}

/** The preset whose controls match `state`, or `custom`. */
export function matchPreset(state: BlDateState): string {
  const hit = BL_DATE_PRESETS.find((p) => {
    const s = presetState(p);
    return ARG_KEYS.every((key) => s[key] === state[key].trim());
  });
  return hit ? hit.id : CUSTOM_PRESET_ID;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** How the UTC date sits against the B/L date, in the words the plate shows. */
export type Sameness = "same date" | "one day later" | "one day earlier";

/** How a date sits against the latest date allowed. */
export type LatestWords =
  | "after the latest date"
  | "on or before the latest date";

/** One lane's reading: the zone, the `bolTimestamp` call made for it, and its date. */
export interface LaneRead {
  /** 0 is UTC, 1 the place, 2 to 4 the other calendars. */
  index: number;
  /** The zone the lane is read in. `""` for a lane with no zone. */
  zone: string;
  /** The call made for this lane, or `null` for a lane with no zone. */
  call: EdiCall | null;
  /** The library's date, or `""` (no zone, or the library returned nothing). */
  date: string;
}

export interface LatestRead {
  /** The latest date as typed. `""` when there is none. */
  value: string;
  /** What `isValidDate` said, or `null` when there is no latest date. */
  valid: boolean | null;
  /** The B/L date against it, or `null` when no comparison was made. */
  bl: LatestWords | null;
  /** The UTC date against it, or `null` when no comparison was made. */
  utc: LatestWords | null;
}

export interface BlRead {
  /** The five lanes, in order: UTC, the place, then the other calendars. */
  lanes: LaneRead[];
  /** The B/L date, `""` when the library returned none. */
  bl: string;
  /** The UTC date, the naive read, `""` when the library returned none. */
  utc: string;
  /** `null` when either date is missing, since no comparison is made then. */
  sameness: Sameness | null;
  latest: LatestRead;
  /** Every call made, in order: the place, UTC, the calendars, then the comparisons. */
  calls: EdiCall[];
}

function readLane(
  index: number,
  zone: string,
  state: BlDateState,
  lib: BlDateLib,
  optional: boolean,
): LaneRead {
  if (zone === "" && optional) return { index, zone, call: null, date: "" };
  // With no place zone the call is `bolTimestamp(value, event)`: a blank zone is
  // left out and never filled in.
  const call =
    zone === ""
      ? runCall(lib, "bolTimestamp", state.value.trim(), state.event.trim())
      : runCall(lib, "bolTimestamp", state.value.trim(), state.event.trim(), {
          timeZone: zone,
        });
  const date = typeof call.result === "string" ? call.result : "";
  return { index, zone, call, date };
}

function latestWords(
  date: string,
  latest: string,
  calls: EdiCall[],
  lib: BlDateLib,
): LatestWords | null {
  if (date === "") return null;
  const call = runCall(lib, "isAfterDate", date, latest);
  calls.push(call);
  return call.result === true
    ? "after the latest date"
    : "on or before the latest date";
}

/**
 * The B/L date, the UTC date, the other calendars and the words that compare
 * them. Each is one real call. `areDatesEqual` and `isAfterDate` are called only
 * when both dates came back, and the latest-date comparisons only when
 * `isValidDate` accepts the latest date.
 */
export function readBlDate(state: BlDateState, lib: BlDateLib): BlRead {
  const place = readLane(1, state.timeZone.trim(), state, lib, false);
  const utc = readLane(0, "UTC", state, lib, false);
  const others = [state.zone2, state.zone3, state.zone4].map((z, i) =>
    readLane(i + 2, z.trim(), state, lib, true),
  );
  const calls: EdiCall[] = [place.call!, utc.call!];
  for (const lane of others) if (lane.call !== null) calls.push(lane.call);

  let sameness: Sameness | null = null;
  if (place.date !== "" && utc.date !== "") {
    const equal = runCall(lib, "areDatesEqual", utc.date, place.date);
    const after = runCall(lib, "isAfterDate", utc.date, place.date);
    calls.push(equal, after);
    sameness =
      equal.result === true
        ? "same date"
        : after.result === true
          ? "one day later"
          : "one day earlier";
  }

  const latestValue = state.latest.trim();
  const latest: LatestRead = {
    value: latestValue,
    valid: null,
    bl: null,
    utc: null,
  };
  if (latestValue !== "") {
    const valid = runCall(lib, "isValidDate", latestValue);
    calls.push(valid);
    latest.valid = valid.result === true;
    if (latest.valid) {
      latest.bl = latestWords(place.date, latestValue, calls, lib);
      latest.utc = latestWords(utc.date, latestValue, calls, lib);
    }
  }

  return {
    lanes: [utc, place, ...others],
    bl: place.date,
    utc: utc.date,
    sameness,
    latest,
    calls,
  };
}

// ---------------------------------------------------------------------------
// Why NO SIGNAL
// ---------------------------------------------------------------------------

/** A moment the library reads in every zone it reads, used only to probe. */
const PROBE_MOMENT = "2024-06-15T12:00:00Z";
/** An event the library reads, used to probe the other inputs. */
const PROBE_EVENT = "issue";

/**
 * One sentence for a B/L date the library did not give, decided by probing the
 * library and never by a table: it asks `bolTimestamp` about a known moment in
 * the zone, then about the reader's moment in the zone, then about a known
 * moment with the reader's event.
 */
export function blNullText(state: BlDateState, lib: BlDateLib): string {
  const zone = state.timeZone.trim();
  const read = (value: string, event: string, timeZone: string): string =>
    lib.bolTimestamp(value, event, { timeZone });
  if (zone === "") {
    return "Choose the place of the event. Every bill of lading date is the local one, so the zone is required.";
  }
  if (read(PROBE_MOMENT, PROBE_EVENT, zone) === "") {
    return `The library does not read ${zone} as a place. Use an IANA zone name such as America/New_York, or a UTC offset such as +08:00.`;
  }
  if (read(state.value.trim(), PROBE_EVENT, zone) === "") {
    return "The value is not a moment. It needs a Z, an offset, or an offset with a bracketed zone.";
  }
  if (read(PROBE_MOMENT, state.event.trim(), zone) === "") {
    const event = state.event.trim();
    return `${event === "" ? "No event is chosen" : `${event} is not one of the three events`}. Use shippedOnBoard, received or issue.`;
  }
  return "The library returned no date for these inputs.";
}

// ---------------------------------------------------------------------------
// Drawing: the window and the lanes
// ---------------------------------------------------------------------------

/** Whether the drawing can lay out days in `zone` (an offset with seconds, or a
 *  name Temporal does not know, cannot be drawn even if the library reads it). */
export function zoneDrawable(zone: string): boolean {
  return zone !== "" && localText("2000-01-01T00:00:00Z", zone) !== "";
}

/** The moment as epoch milliseconds, or NaN when it is not a moment. */
export function momentMs(value: string): number {
  return toEpochMs(value.trim());
}

/**
 * Whether the slider can move this value: it must read as a moment and be
 * writable back in the form it was typed (`writeLike` returns text for it).
 */
export function sliderReadable(value: string): boolean {
  return (
    !Number.isNaN(momentMs(value)) && writtenParts(value.trim()).date !== ""
  );
}

/**
 * The 72-hour window of the slider: 36 hours each side of the local midnight
 * nearest the moment, in the place zone (UTC when there is none or when the
 * drawing cannot read it). `null` when the value is not a moment.
 */
export function windowFor(ms: number, placeZone: string): LedgerCanvas | null {
  if (Number.isNaN(ms)) return null;
  const zone = zoneDrawable(placeZone) ? placeZone : "UTC";
  const day = Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(zone)
    .startOfDay();
  const before = day.epochMilliseconds;
  const after = day.add({ days: 1 }).startOfDay().epochMilliseconds;
  const mid = ms - before <= after - ms ? before : after;
  return createLedgerCanvas(
    mid - WINDOW_HALF_HOURS * HOUR_MS,
    mid + WINDOW_HALF_HOURS * HOUR_MS,
  );
}

/** The slider's position for a moment: quarter-hours from the window's start. */
export function sliderPosition(canvas: LedgerCanvas, ms: number): number {
  const steps = Math.round((ms - canvas.startMs) / STEP_MS);
  return Math.max(0, Math.min(SLIDER_MAX, steps));
}

/** The moment at a slider position. */
export function sliderMoment(canvas: LedgerCanvas, position: number): number {
  return canvas.startMs + position * STEP_MS;
}

/** `HH:MM`, with `:SS` only when the seconds are not zero, on `zone`'s clock. */
export function clockTime(ms: number, zone: string): string {
  try {
    const z =
      Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone);
    const hh = String(z.hour).padStart(2, "0");
    const mm = String(z.minute).padStart(2, "0");
    const ss = String(z.second).padStart(2, "0");
    return z.second === 0 && z.millisecond === 0
      ? `${hh}:${mm}`
      : `${hh}:${mm}:${ss}`;
  } catch {
    return "";
  }
}

/** The moment as the slider reads it out: "Sun 16 Jun 01:15Z". */
export function momentText(ms: number): string {
  if (Number.isNaN(ms)) return "";
  const text = localText(
    Temporal.Instant.fromEpochMilliseconds(ms).toString(),
    "UTC",
  );
  return text === "" ? "" : `${text}Z`;
}

/** The moment in UTC as the gate's chip reads it: `01:00Z`. */
export function utcClock(ms: number): string {
  const t = clockTime(ms, "UTC");
  return t === "" ? "" : `${t}Z`;
}

/** The lane's label: the zone it reads, or a word for a lane with no zone. */
export function laneLabel(lane: LaneRead): string {
  if (lane.index === 0) return "UTC (naive)";
  if (lane.zone !== "") return lane.zone;
  return lane.index === 1 ? "Place of the event" : `Calendar ${lane.index}`;
}

/** The series (1 to 4) of a lane, or `undefined` for the UTC lane. */
export function laneSeries(index: number): SeriesNumber | undefined {
  return index >= 1 && index <= 4 ? (index as SeriesNumber) : undefined;
}

/** What one lane draws: its day columns, the lit day and a note, if any. */
export interface LaneView {
  index: number;
  label: string;
  series: SeriesNumber | undefined;
  cells: DayCell[];
  marks: Record<string, DayMark>;
  /** The date of the lit column: the library's date, when a column holds it. */
  lit: string | null;
  /** Words for a lane with nothing to draw, else `""`. */
  note: string;
}

/**
 * The days of one lane over `canvas`, and the one that is lit: the day whose date
 * is the library's date for the lane. A lane with no zone, or a zone the drawing
 * cannot lay out, keeps its box and says so in words; a zone the drawing cannot
 * lay out still shows its date from the library.
 */
export function laneView(
  lane: LaneRead,
  canvas: LedgerCanvas | null,
  ms: number,
): LaneView {
  const series = laneSeries(lane.index);
  const drawable = lane.zone !== "" && zoneDrawable(lane.zone);
  const cells =
    canvas !== null && drawable ? dayCells(canvas, lane.zone, ms, ms) : [];
  const marks: Record<string, DayMark> = {};
  let lit: string | null = null;
  if (lane.date !== "" && cells.some((c) => c.date === lane.date)) {
    lit = lane.date;
    marks[lane.date] = {
      state: "lit",
      chip: lane.date,
      kind: "bl-date",
      ...(series === undefined ? {} : { series }),
    };
  }
  let note = "";
  if (lane.zone === "") note = "no zone chosen";
  else if (lane.date === "") note = "the library returned no date";
  else if (cells.length === 0 && canvas !== null)
    note = `${lane.date} · its days are not drawn`;
  return {
    index: lane.index,
    label: laneLabel(lane),
    series,
    cells,
    marks,
    lit,
    note,
  };
}

/** The date of the day the moment falls in, from the drawn columns. */
export function dayHoldingMoment(
  cells: readonly DayCell[],
  ms: number,
): string | null {
  return cells.find((c) => c.startMs <= ms && ms < c.endMs)?.date ?? null;
}

/** The sentence a lane's list item carries for a screen reader. */
export function laneAria(lane: LaneRead): string {
  const label = laneLabel(lane);
  if (lane.zone === "") return `${label}: no zone chosen`;
  return lane.date === ""
    ? `${label}: no date`
    : `${label}: ${dateText(lane.date) || lane.date}`;
}

// ---------------------------------------------------------------------------
// Drawing text: the plates and the summary
// ---------------------------------------------------------------------------

/** The line under the B/L date: the local time and the zone it was read in. */
function localLine(state: BlDateState, ms: number): string {
  const zone = state.timeZone.trim();
  if (zone === "") return "";
  const time = Number.isNaN(ms) ? "" : clockTime(ms, zone);
  return time === "" ? `in ${zone}` : `${time} in ${zone}`;
}

/** The latest-date line of a plate: the words, or a note that none was made. */
function latestLine(latest: LatestRead, words: LatestWords | null): string {
  if (latest.value === "") return "";
  if (latest.valid === false) return "latest date is not a date";
  return words ?? "";
}

/**
 * The two result plates. A plate with no date reads "no result" and blanks its
 * lines. The UTC plate is the quiet one, since it is the naive read.
 */
export function blPlates(state: BlDateState, read: BlRead): PlateSpec[] {
  const ms = momentMs(state.value);
  return [
    {
      role: "hero-bl",
      caption: eventCaption(state.event),
      captions: Object.values(EVENT_CAPTIONS),
      series: 1,
      value: read.bl === "" ? null : dateText(read.bl) || read.bl,
      lines: [localLine(state, ms), latestLine(read.latest, read.latest.bl)],
    },
    {
      role: "hero-utc",
      caption: "UTC date",
      quiet: true,
      value: read.utc === "" ? null : dateText(read.utc) || read.utc,
      lines: [read.sameness ?? "", latestLine(read.latest, read.latest.utc)],
    },
  ];
}

/** The two plates before the library has answered: the same boxes, "no result". */
export function blankPlates(event: string): PlateSpec[] {
  return [
    {
      role: "hero-bl",
      caption: eventCaption(event),
      captions: Object.values(EVENT_CAPTIONS),
      series: 1,
      value: null,
      lines: ["", ""],
    },
    {
      role: "hero-utc",
      caption: "UTC date",
      quiet: true,
      value: null,
      lines: ["", ""],
    },
  ];
}

/** One sentence for the visually hidden live region: both plates as one. */
export function summaryText(
  state: BlDateState,
  read: BlRead,
  reason: string,
): string {
  const caption = eventCaption(state.event);
  const utc =
    read.utc === ""
      ? "UTC date: no result."
      : `UTC date: ${dateText(read.utc) || read.utc}${read.sameness === null ? "" : `, ${read.sameness}`}.`;
  if (read.bl === "") return `${caption}: no result. ${reason} ${utc}`.trim();
  const at = localLine(state, momentMs(state.value));
  const latest =
    read.latest.value === ""
      ? ""
      : read.latest.valid === false
        ? " The latest date is not a date, so no comparison was made."
        : ` The ${caption.toLowerCase()} is ${read.latest.bl ?? "not compared"}.`;
  return `${caption}: ${dateText(read.bl) || read.bl}${at === "" ? "" : `, ${at}`}.${latest} ${utc}`.trim();
}
