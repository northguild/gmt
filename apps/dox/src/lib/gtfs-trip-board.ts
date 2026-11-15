/**
 * Pure logic for the GTFS Trip Board (RAI-100).
 *
 * The reader pastes one trip's `stop_times.txt` rows (with each stop's `stop_timezone` joined on
 * from `stops.txt`), a service date and the agency's zone. For each stop the board shows the
 * instant `gtfsToInstant` gives, the clock on the platform at that instant, the reading a
 * feed reader gets by passing `stop_timezone` to `gtfsToInstant` instead of the agency's zone,
 * and how long the leg from the stop before it took, by the clock and by the instants.
 *
 * The site holds no GTFS rule, no offset and no day arithmetic. Every instant, reading, shift
 * and duration is a library result, and a refusal is explained by asking the library again
 * (`explainRefusal`). The only text this module cuts is the paste itself, into lines and cells.
 *
 * No DOM, no library import (the library arrives as a `TripBoardLib`).
 */
import {
  explainRefusal,
  NOTHING_TYPED,
  REASONS,
  recorder,
  WIDEST_ZONE,
  yearAt,
} from "./gtfs-service-day-clock";
import type { TripBoardLib } from "./rail-lib";

export { NOTHING_TYPED, WIDEST_ZONE };

export const CUSTOM_PRESET_ID = "custom";

/** The most each box takes. */
export const ROWS_MAX_CHARS = 2000;
export const DATE_MAX_CHARS = 16;
export const ZONE_MAX_CHARS = 64;
/** The most stops a trip is read for, and the longest line a row may be. */
export const MAX_STOPS = 12;
export const MAX_LINE_CHARS = 150;
/** Most years a leg is asked about, per zone. */
const MAX_YEARS = 4;

// ---------------------------------------------------------------------------
// State, presets and arguments
// ---------------------------------------------------------------------------

/** The text of the three boxes, as typed. */
export interface TripState {
  rows: string;
  date: string;
  zone: string;
}

export interface GtfsTripBoardArgs {
  preset?: string;
  stopTimes?: string;
  date?: string;
  zone?: string;
}

export interface TripPreset extends TripState {
  id: string;
  label: string;
  description: string;
}

const HEADER = "stop_id,arrival_time,departure_time,stop_timezone";
const paste = (...rows: string[]): string => [HEADER, ...rows].join("\n");

const ANDES_ROWS = paste(
  "santiago-terminal,08:00:00,08:00:00,",
  "los-andes,09:20:00,09:30:00,",
  "los-libertadores,11:30:00,12:30:00,America/Argentina/Mendoza",
  "uspallata,14:10:00,14:20:00,America/Argentina/Mendoza",
  "mendoza-terminal,16:00:00,16:00:00,America/Argentina/Mendoza",
);

/** Each preset's values are the library's, asserted in the unit test. */
export const PRESETS: readonly TripPreset[] = [
  {
    id: "border",
    label: "Madrid to Lisbon, across the border",
    description: "The stops past the border sit an hour behind the agency.",
    rows: paste(
      "madrid-chamartin,08:00:00,08:00:00,",
      "caceres,10:32:00,10:35:00,",
      "badajoz,11:25:00,11:32:00,",
      "elvas,11:52:00,11:54:00,Europe/Lisbon",
      "entroncamento,13:20:00,13:22:00,Europe/Lisbon",
      "lisboa-oriente,14:15:00,14:15:00,Europe/Lisbon",
    ),
    date: "20260615",
    zone: "Europe/Madrid",
  },
  {
    id: "night-train",
    label: "Vienna to Hamburg, a night train",
    description: "Times past 24:00:00, and a clock change inside a leg.",
    rows: paste(
      "wien-hbf,20:13:00,20:13:00,Europe/Vienna",
      "linz-hbf,21:28:00,21:31:00,Europe/Vienna",
      "passau-hbf,22:43:00,22:50:00,Europe/Berlin",
      "nuernberg-hbf,25:10:00,25:18:00,Europe/Berlin",
      "wuerzburg-hbf,26:25:00,26:30:00,Europe/Berlin",
      "goettingen,28:40:00,28:44:00,Europe/Berlin",
      "hannover-hbf,29:50:00,29:58:00,Europe/Berlin",
      "hamburg-hbf,31:20:00,31:20:00,Europe/Berlin",
    ),
    date: "20261024",
    zone: "Europe/Vienna",
  },
  {
    id: "andes-june",
    label: "Santiago to Mendoza, coach timetable in June",
    description: "Chile has put its clocks back; Mendoza has not.",
    rows: ANDES_ROWS,
    date: "20260615",
    zone: "America/Santiago",
  },
  {
    id: "andes-january",
    label: "Santiago to Mendoza, coach timetable in January",
    description: "Both sides are on the same offset, so the mistake hides.",
    rows: ANDES_ROWS,
    date: "20260115",
    zone: "America/Santiago",
  },
  {
    id: "no-noon",
    label: "Samoa skipped a day",
    description: "Noon did not happen, so every stop is refused.",
    rows: paste(
      "apia-wharf,08:00:00,08:00:00,",
      "faleolo,08:45:00,08:50:00,",
      "mulifanua,09:05:00,09:05:00,",
    ),
    date: "20111230",
    zone: "Pacific/Apia",
  },
];

const DEFAULT_PRESET = PRESETS[0]!;

export function matchPreset(state: TripState): string {
  return (
    PRESETS.find(
      (p) =>
        p.rows === state.rows && p.date === state.date && p.zone === state.zone,
    )?.id ?? CUSTOM_PRESET_ID
  );
}

export function presetState(preset: TripPreset = DEFAULT_PRESET): TripState {
  return { rows: preset.rows, date: preset.date, zone: preset.zone };
}

/** Whether the args seed the widget: a blank box is a seed, a cleared field. */
export function isSeeded(args: GtfsTripBoardArgs | undefined): boolean {
  return (
    args !== undefined &&
    (["preset", "stopTimes", "date", "zone"] as const).some(
      (k) => typeof args[k] === "string",
    )
  );
}

/** The state a seed describes: the named preset, then any text the seed also gives. */
export function readArgs(args: GtfsTripBoardArgs): TripState {
  const state = presetState(PRESETS.find((p) => p.id === args.preset));
  // A blank box is a seed: a link made from a cleared field must open cleared.
  if (typeof args.stopTimes === "string") state.rows = args.stopTimes;
  if (typeof args.date === "string") state.date = args.date;
  if (typeof args.zone === "string") state.zone = args.zone;
  return state;
}

/**
 * The permalink keys for `state`: a preset's id while the boxes match one, else the text itself
 * (even blank, so the link does not fall back to the default).
 */
export function permalinkOf(state: TripState): Record<string, string> {
  const id = matchPreset(state);
  return id === CUSTOM_PRESET_ID
    ? { stopTimes: state.rows, date: state.date, zone: state.zone }
    : { preset: id };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** What a value reads when the paste held it but the board did not read the row. */
export const NOT_READ = "not read";
/** A time a stop leaves empty. */
export const NOT_GIVEN = "not given";
export const FIRST_STOP = "first stop";
export const AGENCY_ZONE = "agency zone";
export const NOT_A_TIMEPOINT = "not a timepoint";
export const NOTHING_TO_MISREAD = "agency zone: nothing to misread";
export const SAME_INSTANT = "same instant";

export const NOTES = {
  empty: "Paste a header line and up to 12 stop_times.txt rows.",
  tooLong:
    "The paste is over 2,000 characters. The board reads one trip of up to 12 stops.",
  missing: (cols: readonly string[]): string =>
    `The header has no ${cols.map((c) => `\`${c}\``).join(", ")} column${cols.length === 1 ? "" : "s"}.`,
  twice: (col: string): string => `The header names \`${col}\` twice.`,
  boxes: "Type a service date and the agency's zone.",
  extra: (n: number): string => `Rows past the 12th are not read: ${n} more.`,
} as const;

/** The most a clock change names in a verdict. */
export const CLOCK_CHANGE = "clock change in leg";
export const CLOCKS_AGREE = "clocks agree";
export const ZONE_CHANGE = "zone change";
export const CLOCKS_DIFFER = "clocks differ";

export const badgeText = (minutes: number): string =>
  minutes === 0
    ? SAME_INSTANT
    : `${Math.abs(minutes)} min ${minutes > 0 ? "later" : "earlier"}`;

// ---------------------------------------------------------------------------
// The held widths
// ---------------------------------------------------------------------------

/**
 * One zoned reading in the widest zone, widest first of the shapes a stop gives: the value a
 * time cell reserves. The unit test asserts it is the library's `convertUtcToZoned` output for
 * `WIDEST_ZONE`.
 */
export const GHOST_ZONED = `2026-03-08T08:00:00-03:00[${WIDEST_ZONE}]`;
/** The widest UTC instant a stop gives. */
export const GHOST_UTC = "2026-10-03T21:00:00Z";
/** The widest trip or leg length the board prints. */
export const GHOST_DURATION = "−999 h 59 min";
/** The widest "N of M stops". */
export const GHOST_MOVED = "12 of 12 stops";
/** The widest badge the wrong-reading column writes. */
export const GHOST_BADGE = badgeText(-1560);
/** A clock change names the instant it happens at. */
export const GHOST_CHANGE = `${CLOCK_CHANGE} at 2026-10-25T01:00:00Z`;

// ---------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------

const REQUIRED = ["stop_id", "arrival_time", "departure_time"] as const;

/** A row of the paste that the board read. */
export interface ReadRow {
  ok: true;
  line: number;
  stopId: string;
  arrival: string;
  departure: string;
  /** The `stop_timezone` cell, `""` when empty or the column is missing. */
  zoneCell: string;
}

/** A row of the paste that the board left unread, with why. */
export interface RejectedRow {
  ok: false;
  line: number;
  /** The text after "Line N ", for example "is over 150 characters". */
  reason: string;
}

export type TripRow = ReadRow | RejectedRow;

export type TripRead =
  | { kind: "refused"; blank: boolean; note: string }
  | { kind: "rows"; rows: TripRow[]; extra: number };

/** Cuts the paste into lines and cells. String work only; no library call. */
export function readTrip(text: string): TripRead {
  if (text.length > ROWS_MAX_CHARS)
    return { kind: "refused", blank: false, note: NOTES.tooLong };
  const lines: { n: number; text: string }[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.trim() !== "") lines.push({ n: i + 1, text: line });
  });
  // A header and no row has nothing to read: it is the same empty board.
  if (lines.length < 2)
    return { kind: "refused", blank: true, note: NOTES.empty };

  const header = lines[0]!.text.split(",");
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0)
    return { kind: "refused", blank: false, note: NOTES.missing(missing) };
  const twice = header.find((c, i) => header.indexOf(c) !== i);
  if (twice !== undefined)
    return { kind: "refused", blank: false, note: NOTES.twice(twice) };

  const at = (name: string) => header.indexOf(name);
  const [iStop, iArr, iDep] = [
    at("stop_id"),
    at("arrival_time"),
    at("departure_time"),
  ];
  const iZone = at("stop_timezone");

  const body = lines.slice(1);
  const rows: TripRow[] = body.slice(0, MAX_STOPS).map(({ n, text: line }) => {
    if (line.length > MAX_LINE_CHARS)
      return { ok: false, line: n, reason: "is over 150 characters" };
    if (line.includes('"'))
      return {
        ok: false,
        line: n,
        reason: "has a quoted field; the board reads unquoted rows only",
      };
    const cells = line.split(",");
    if (cells.length !== header.length)
      return {
        ok: false,
        line: n,
        reason: `has ${cells.length} cells; the header has ${header.length}`,
      };
    if (cells[iStop] === "")
      return { ok: false, line: n, reason: "has no stop_id" };
    return {
      ok: true,
      line: n,
      stopId: cells[iStop]!,
      arrival: cells[iArr]!,
      departure: cells[iDep]!,
      zoneCell: iZone < 0 ? "" : cells[iZone]!,
    };
  });
  return { kind: "rows", rows, extra: Math.max(0, body.length - MAX_STOPS) };
}

// ---------------------------------------------------------------------------
// Printing a record
// ---------------------------------------------------------------------------

export interface HoursMinutes {
  hours: number;
  minutes: number;
}

/** A `diffUtc` or `diffDateTime` answer in hours and minutes, or `null` for anything else. */
export function recordOf(value: unknown): HoursMinutes | null {
  if (typeof value !== "object" || value === null) return null;
  const { hours, minutes } = value as Record<string, unknown>;
  return typeof hours === "number" && typeof minutes === "number"
    ? { hours, minutes }
    : null;
}

/** `2 h 10 min`; the hours drop when 0; a negative record carries one U+2212 minus. */
export function printRecord(r: HoursMinutes): string {
  const negative = r.hours < 0 || r.minutes < 0;
  const h = Math.abs(r.hours);
  const m = Math.abs(r.minutes);
  return `${negative ? "−" : ""}${h > 0 ? `${h} h ` : ""}${m} min`;
}

// ---------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------

/** How a value is drawn: a library answer, a library refusal, or a plain word. */
export type CellState = "live" | "signal" | "word";

/** One time of a stop: the clock on the platform, and the instant under it. */
export interface TimeCell {
  state: CellState;
  /** The zoned reading when live, else the word. */
  text: string;
  /** The UTC instant, `""` unless live. */
  instant: string;
}

export interface WrongCell {
  state: CellState;
  text: string;
  instant: string;
  /** The badge under a live reading. */
  badge: { text: string; tone: "danger" | "neutral" } | null;
  /** Minutes the wrong reading is later (positive) or earlier (negative). */
  shift: number | null;
}

export interface LegCell {
  state: CellState;
  /** The elapsed time when live, else the word. */
  text: string;
  /** The length by the platform clocks, `""` unless live. */
  clocks: string;
  /** Set when the clocks could not be read though the elapsed time could. */
  clocksState: CellState;
  verdict: string;
  /** The instants of the clock changes inside the leg. */
  changes: string[];
}

export interface StopRow {
  line: number;
  /** `""` for a row the board did not read. */
  stopId: string;
  /** The words under the stop name: its zone, "agency zone", "not a timepoint". */
  zoneNote: string;
  /** A rejected row: the reason, else `""`. */
  rejected: string;
  arrival: TimeCell;
  departure: TimeCell;
  wrong: WrongCell;
  leg: LegCell;
  calls: string[];
}

export interface PlateValue {
  state: "live" | "signal" | "note";
  text: string;
}

export interface TripResult {
  rows: StopRow[];
  /** What the notes list says, in order. */
  notes: string[];
  trip: PlateValue;
  moved: PlateValue;
  /** The line of the stop the calls frame opens on. */
  firstMoved: number | null;
  firstRead: number | null;
}

const word = (text: string): TimeCell => ({ state: "word", text, instant: "" });

const blankWrong = (text: string): WrongCell => ({
  state: "word",
  text,
  instant: "",
  badge: null,
  shift: null,
});

const blankLeg = (text: string): LegCell => ({
  state: "word",
  text,
  clocks: "",
  clocksState: "word",
  verdict: "",
  changes: [],
});

function blankRow(row: TripRow, text: string): StopRow {
  return {
    line: row.line,
    stopId: row.ok ? row.stopId : "",
    zoneNote: row.ok ? zoneNoteOf(row) : "",
    rejected: row.ok ? "" : row.reason,
    arrival: word(text),
    departure: word(text),
    wrong: blankWrong(text),
    leg: blankLeg(text),
    calls: [],
  };
}

function zoneNoteOf(row: ReadRow): string {
  const zone = row.zoneCell === "" ? AGENCY_ZONE : row.zoneCell;
  return row.arrival === "" && row.departure === ""
    ? `${zone}, ${NOT_A_TIMEPOINT}`
    : zone;
}

/** Whether the paste can be read into rows at all, and how many it holds. */
export function rowCount(text: string): number {
  const read = readTrip(text);
  return read.kind === "rows" ? read.rows.length : 0;
}

/** The result for a paste that cannot be read, or a board with nothing to call. */
function emptyResult(
  rows: StopRow[],
  notes: string[],
  plate: PlateValue,
): TripResult {
  return {
    rows,
    notes,
    trip: plate,
    moved: plate,
    firstMoved: null,
    firstRead:
      rows.find((r) => r.rejected === "" && r.stopId !== "")?.line ?? null,
  };
}

export const BLANK_RESULT: TripResult = emptyResult([], [], {
  state: "note",
  text: NOTHING_TYPED,
});

interface Timed {
  row: StopRow;
  zone: string;
  /** The instant of the departure, else of the arrival; `""` when refused or none. */
  leaving: string;
  /** The instant of the arrival, else of the departure. */
  arriving: string;
  hasTime: boolean;
}

/** Computes the board from the paste, the date and the agency's zone. */
export function computeTrip(lib: TripBoardLib, state: TripState): TripResult {
  const read = readTrip(state.rows);
  if (read.kind === "refused") {
    return emptyResult([], [read.note], {
      state: "note",
      text: read.blank ? NOTHING_TYPED : NOT_READ,
    });
  }

  const notes: string[] = [];
  if (read.extra > 0) notes.push(NOTES.extra(read.extra));

  // A box left empty is a box the reader has not typed in: no call is made.
  if (state.date === "" || state.zone === "") {
    const rows = read.rows.map((r) =>
      r.ok ? blankRow(r, NOTHING_TYPED) : blankRow(r, NOT_READ),
    );
    for (const r of read.rows)
      if (!r.ok) notes.push(`Line ${r.line} ${r.reason}.`);
    notes.push(NOTES.boxes);
    return emptyResult(rows, notes, { state: "note", text: NOTHING_TYPED });
  }

  const { date } = state;
  const agency = state.zone;
  const rows: StopRow[] = [];
  const timed: Timed[] = [];
  let previous: Timed | null = null;

  for (const r of read.rows) {
    if (!r.ok) {
      rows.push(blankRow(r, NOT_READ));
      notes.push(`Line ${r.line} ${r.reason}.`);
      continue;
    }
    const calls: string[] = [];
    const call = recorder(calls);
    const stopZone = r.zoneCell === "" ? agency : r.zoneCell;

    // One time of the stop: the instant, then the platform's reading of it.
    const timeOf = (
      cell: string,
      column: string,
    ): TimeCell & { raw: string } => {
      if (cell === "") return { ...word(NOT_GIVEN), raw: "" };
      const instant = call(
        "gtfsToInstant",
        [date, cell, agency],
        lib.gtfsToInstant(date, cell, agency),
      );
      if (instant === "") {
        const why = explainRefusal(lib, date, cell, agency, calls);
        notes.push(`Line ${r.line}, ${column}: ${REASONS[why]}`);
        return { state: "signal", text: "", instant: "", raw: "" };
      }
      const platform = call(
        "convertUtcToZoned",
        [instant, stopZone],
        lib.convertUtcToZoned(instant, stopZone),
      );
      if (platform === "") {
        const text = `Line ${r.line}: stop_timezone is not an IANA name or an offset.`;
        if (!notes.includes(text)) notes.push(text);
        return { state: "signal", text: "", instant, raw: instant };
      }
      return { state: "live", text: platform, instant, raw: instant };
    };

    const arrival = timeOf(r.arrival, "arrival_time");
    const departure = timeOf(r.departure, "departure_time");

    // The wrong reading: the stop's own zone given to `gtfsToInstant` as the agency's.
    const wrongSource = r.arrival !== "" ? r.arrival : r.departure;
    const wrongInstant = r.arrival !== "" ? arrival.raw : departure.raw;
    let wrong: WrongCell;
    if (wrongSource === "") {
      wrong = blankWrong(NOT_GIVEN);
    } else if (r.zoneCell === "") {
      wrong = blankWrong(NOTHING_TO_MISREAD);
    } else {
      const moved = call(
        "gtfsToInstant",
        [date, wrongSource, stopZone],
        lib.gtfsToInstant(date, wrongSource, stopZone),
      );
      const shown =
        moved === ""
          ? ""
          : call(
              "convertUtcToZoned",
              [moved, stopZone],
              lib.convertUtcToZoned(moved, stopZone),
            );
      const gap =
        moved === "" || wrongInstant === ""
          ? null
          : call(
              "diffUtc",
              [wrongInstant, moved, "minutes"],
              lib.diffUtc(wrongInstant, moved, "minutes"),
            );
      wrong =
        shown === "" || typeof gap !== "number"
          ? { ...blankWrong(""), state: "signal" }
          : {
              state: "live",
              text: shown,
              instant: moved,
              badge: {
                text: badgeText(gap),
                tone: gap === 0 ? "neutral" : "danger",
              },
              shift: gap,
            };
    }

    const leaving = departure.raw !== "" ? departure.raw : arrival.raw;
    const arriving = arrival.raw !== "" ? arrival.raw : departure.raw;
    const hasTime = r.arrival !== "" || r.departure !== "";
    const row: StopRow = {
      line: r.line,
      stopId: r.stopId,
      zoneNote: zoneNoteOf(r),
      rejected: "",
      arrival,
      departure,
      wrong,
      leg: blankLeg(FIRST_STOP),
      calls,
    };
    const here: Timed = { row, zone: stopZone, leaving, arriving, hasTime };

    // The leg from the nearest earlier stop that gave a time.
    if (previous !== null) {
      row.leg = hasTime
        ? legOf(lib, previous, here, call)
        : blankLeg(NOT_GIVEN);
    }
    if (hasTime) previous = here;
    rows.push(row);
    timed.push(here);
  }

  const given = timed.filter((t) => t.hasTime);
  const live = given.filter(
    (t) => t.row.arrival.state === "live" || t.row.departure.state === "live",
  );
  const moves = rows.filter(
    (r) => r.wrong.shift !== null && r.wrong.shift !== 0,
  );
  const firstMoved = moves[0]?.line ?? null;
  const firstRead = rows.find((r) => r.rejected === "")?.line ?? null;

  let trip: PlateValue = { state: "signal", text: "" };
  let movedPlate: PlateValue = { state: "signal", text: "" };
  if (given.length === 0) {
    trip = movedPlate = { state: "note", text: NOT_READ };
  } else {
    const start = given[0]!.leaving;
    const end = given[given.length - 1]!.arriving;
    const span =
      start === "" || end === ""
        ? null
        : recordOf(lib.diffUtc(start, end, ["hours", "minutes"]));
    if (span !== null) trip = { state: "live", text: printRecord(span) };
    if (live.length > 0)
      movedPlate = {
        state: "live",
        text: `${moves.length} of ${given.length} stops`,
      };
  }

  return { rows, notes, trip, moved: movedPlate, firstMoved, firstRead };
}

/** The leg from `from` to `to`: elapsed time, the length by the clocks, and which is which. */
function legOf(
  lib: TripBoardLib,
  from: Timed,
  to: Timed,
  call: ReturnType<typeof recorder>,
): LegCell {
  const start = from.leaving;
  const end = to.arriving;
  const elapsed = recordOf(
    call(
      "diffUtc",
      [start, end, ["hours", "minutes"]],
      lib.diffUtc(start, end, ["hours", "minutes"]),
    ),
  );
  if (elapsed === null || start === "" || end === "") {
    return {
      ...blankLeg(""),
      state: "signal",
      clocksState: "signal",
    };
  }
  const fromClock = call(
    "convertUtcToPlainDateTime",
    [start, { timeZone: from.zone }],
    lib.convertUtcToPlainDateTime(start, { timeZone: from.zone }),
  );
  const toClock = call(
    "convertUtcToPlainDateTime",
    [end, { timeZone: to.zone }],
    lib.convertUtcToPlainDateTime(end, { timeZone: to.zone }),
  );
  const clocks = recordOf(
    call(
      "diffDateTime",
      [fromClock, toClock, ["hours", "minutes"]],
      lib.diffDateTime(fromClock, toClock, ["hours", "minutes"]),
    ),
  );
  if (clocks === null) {
    return {
      state: "live",
      text: printRecord(elapsed),
      clocks: "",
      clocksState: "signal",
      verdict: "",
      changes: [],
    };
  }

  let verdict = CLOCKS_DIFFER;
  const changes: string[] = [];
  if (clocks.hours === elapsed.hours && clocks.minutes === elapsed.minutes) {
    verdict = CLOCKS_AGREE;
  } else {
    for (const zone of new Set([from.zone, to.zone])) {
      const first = yearAt(lib, zone, start);
      const last = yearAt(lib, zone, end);
      if (!Number.isFinite(first) || !Number.isFinite(last)) continue;
      for (let y = first; y <= last && y < first + MAX_YEARS; y++) {
        const found = call(
          "getDstTransitions",
          [zone, y],
          lib.getDstTransitions(zone, y),
        );
        for (const t of found) {
          if (lib.isBetweenUtc(t.instant, start, end)) changes.push(t.instant);
        }
      }
    }
    if (changes.length > 0) verdict = CLOCK_CHANGE;
    else if (from.zone !== to.zone) verdict = ZONE_CHANGE;
  }
  return {
    state: "live",
    text: printRecord(elapsed),
    clocks: printRecord(clocks),
    clocksState: "live",
    verdict,
    changes,
  };
}

// ---------------------------------------------------------------------------
// The calls frame
// ---------------------------------------------------------------------------

/** The calls for the stop on `line`, one per line. */
export function callsFor(result: TripResult, line: number | null): string {
  const row = result.rows.find((r) => r.line === line);
  return row === undefined ? "" : row.calls.join("\n");
}

/**
 * The stops a stub library answers with the widest values, run through the real reader: the
 * calls frame holds the height and width of the longest of them, so it never moves whatever the
 * reader types.
 */
function sizerRows(): StopRow[] {
  let years = 0;
  const instant = "2026-03-28T22:00:00Z";
  const stub = {
    gtfsToInstant: () => instant,
    convertUtcToZoned: () => GHOST_ZONED,
    convertUtcToPlainDateTime: () => "2026-03-08T08:00:00",
    convertUtcToPlainDate: () => "2026-03-08",
    // Each zone asks for the first and the last year of the leg: the leg crosses a new year.
    parseYearFromDate: () => String(2026 + (years++ % 2)),
    diffUtc: (_a: string, _b: string, units: unknown) =>
      Array.isArray(units) ? { hours: 999, minutes: 59 } : 1560,
    diffDateTime: () => ({ hours: 998, minutes: 59 }),
    // A zone reports up to three changes in a year.
    getDstTransitions: () => [
      { instant, offsetBefore: "-05:00", offsetAfter: "-04:00" },
      { instant, offsetBefore: "-04:00", offsetAfter: "-05:00" },
      { instant, offsetBefore: "-10:00", offsetAfter: "+14:00" },
    ],
    isBetweenUtc: () => true,
  } as unknown as TripBoardLib;
  const stop = (id: string, zone: string) => `${id},08:00:00,08:10:00,${zone}`;
  return computeTrip(stub, {
    rows: [
      HEADER,
      stop("a-very-long-stop-identifier", WIDEST_ZONE),
      stop("b-very-long-stop-identifier", WIDEST_ZONE),
    ].join("\n"),
    date: "20260308",
    zone: "Pacific/Port_Moresby",
  }).rows;
}

/** The most lines, and the widest line, the calls frame prints for one stop. */
export const CALLS_SIZER: { lines: number; widest: string } = (() => {
  const rows = sizerRows();
  return {
    lines: Math.max(1, ...rows.map((r) => r.calls.length)),
    widest: rows
      .flatMap((r) => r.calls)
      .reduce((a, b) => (b.length > a.length ? b : a), ""),
  };
})();
