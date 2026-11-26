/**
 * Pure facts for the Opening Hours Board.
 *
 * The reader edits a schedule in fields and types two instants, a duration and a horizon.
 * `boardFacts` builds the schedule from the fields (`scheduleFromEditor`), makes the library's
 * calls and returns what they said. The Board draws the answers and computes none: validity is
 * `isValidOperatingSchedule`, and a typed instant, duration or `within` is refused exactly when
 * `isValidInterval` or `isValidDuration` says so. The week the lane draws is drawing, built with
 * Temporal's local-day arithmetic like the other ledgers.
 *
 * No DOM. Text is passed as typed. The WebMCP tool calls this function too.
 */

import { Temporal } from "@northguild/gmt";
import {
  createLedgerCanvas,
  formatHandleValue,
  formatLocal,
  toEpochMs,
  type LedgerCanvas,
} from "./dwell-ledger";
import { runCall, type EdiCall } from "./edi-widgets";
import type { HoursLib } from "./hours-lib";
import { scheduleFromEditor, type EditorState } from "./opening-hours-editor";
import { probeScheduleParts, type ScheduleProbe } from "./schedule-probe";

export type { ScheduleProbe };

/** The handles snap to a quarter-hour, whatever the week's length. */
export const BOARD_SNAP_MINUTES = 15;

export type Interval = ReturnType<HoursLib["operatingIntervals"]>[number];
export type Calls = readonly EdiCall[];

export type DisambiguationChoice =
  | ""
  | "compatible"
  | "earlier"
  | "later"
  | "reject";

/** The controls, as strings, which is what the DOM holds. */
export interface BoardState {
  editor: EditorState;
  weekOf: string;
  from: string;
  to: string;
  duration: string;
  within: string;
  disambiguation: DisambiguationChoice;
}

// ---------------------------------------------------------------------------
// The week
// ---------------------------------------------------------------------------

/** Monday 00:00 to the next Monday 00:00 in `zone`. Both the week's days and its length are real. */
export function weekCanvas(
  zone: string,
  weekOf: string,
  from: string,
): LedgerCanvas | null {
  try {
    let day: Temporal.PlainDate;
    if (weekOf !== "") {
      day = Temporal.PlainDate.from(weekOf);
    } else {
      const ms = toEpochMs(from);
      if (Number.isNaN(ms)) return null;
      day = Temporal.Instant.fromEpochMilliseconds(ms)
        .toZonedDateTimeISO(zone)
        .toPlainDate();
    }
    const monday = day.subtract({ days: day.dayOfWeek - 1 });
    const start = monday.toZonedDateTime(zone).epochMilliseconds;
    const end = monday.add({ days: 7 }).toZonedDateTime(zone).epochMilliseconds;
    return createLedgerCanvas(start, end, BOARD_SNAP_MINUTES);
  } catch {
    return null;
  }
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const pad2 = (n: number): string => String(n).padStart(2, "0");

function dayText(z: Temporal.ZonedDateTime): string {
  return `${DAY_NAMES[z.dayOfWeek - 1]} ${z.day} ${MONTH_NAMES[z.month - 1]}`;
}

/** The words a bar carries for a screen reader: `Open Mon 17 Jun 09:00 to 18:00 local`. */
export function barLabel(startMs: number, endMs: number, zone: string): string {
  try {
    const a =
      Temporal.Instant.fromEpochMilliseconds(startMs).toZonedDateTimeISO(zone);
    const b =
      Temporal.Instant.fromEpochMilliseconds(endMs).toZonedDateTimeISO(zone);
    const clock = (z: Temporal.ZonedDateTime) =>
      `${pad2(z.hour)}:${pad2(z.minute)}`;
    const sameDay = a.toPlainDate().equals(b.toPlainDate());
    return sameDay
      ? `Open ${dayText(a)} ${clock(a)} to ${clock(b)} local`
      : `Open ${dayText(a)} ${clock(a)} to ${dayText(b)} ${clock(b)} local`;
  } catch {
    return "Open";
  }
}

interface BarSpec {
  from: number;
  to: number;
  label: string;
}

/** The bars for the intervals, clipped to the week, as percents of the track. */
export function barsOf(
  intervals: readonly Interval[],
  zone: string,
  canvas: LedgerCanvas,
): BarSpec[] {
  const bars: BarSpec[] = [];
  for (const iv of intervals) {
    const a = toEpochMs(iv.start);
    const b = toEpochMs(iv.end);
    if (
      Number.isNaN(a) ||
      Number.isNaN(b) ||
      b <= canvas.startMs ||
      a >= canvas.endMs
    )
      continue;
    bars.push({
      from: canvas.toPercent(a),
      to: canvas.toPercent(b),
      label: barLabel(a, b, zone),
    });
  }
  return bars;
}

/** An instant the library returned, as the zone's local text. `""` when the zone cannot say. */
export function localText(iso: string, zone: string): string {
  const ms = toEpochMs(iso);
  return Number.isNaN(ms) ? "" : formatLocal(ms, zone);
}

/** Where a gate sits in the week, or `null` when the instant is outside it. */
export function gatePlace(
  canvas: LedgerCanvas,
  iso: string,
  zone: string,
): { percent: number; text: string } | null {
  const ms = toEpochMs(iso);
  if (Number.isNaN(ms) || ms < canvas.startMs || ms > canvas.endMs) return null;
  return { percent: canvas.toPercent(ms), text: formatLocal(ms, zone) };
}

// ---------------------------------------------------------------------------
// The calls
// ---------------------------------------------------------------------------

/** What a search for an instant said: the instant, no result, or a refused `within`. */
export type Moment =
  | { kind: "at"; instant: string }
  | { kind: "none" }
  | { kind: "within-refused" };

export type Deadline =
  | { kind: "blank" }
  | { kind: "duration-refused" }
  | { kind: "within-refused" }
  | { kind: "none" }
  | { kind: "at"; instant: string };

export type Between =
  | { kind: "blank" }
  | { kind: "refused" }
  | { kind: "value"; duration: string };

export type Reading =
  /** From is empty: nothing is read. */
  | { kind: "blank" }
  /** `isValidInterval` refused From. */
  | { kind: "from-refused" }
  | {
      kind: "read";
      openAtFrom: boolean;
      nextOpen: Moment;
      nextClose: Moment;
      between: Between;
      deadline: Deadline;
    };

export type BoardFacts =
  /** `isValidOperatingSchedule` returned `false`. The probe names the refused parts. */
  | {
      kind: "refused";
      probe: ScheduleProbe;
      week: LedgerCanvas | null;
      calls: Calls;
    }
  | {
      kind: "accepted";
      intervals: readonly Interval[];
      week: LedgerCanvas | null;
      reading: Reading;
      calls: Calls;
    };

const isBlank = (s: string): boolean => s === "";

function momentOf(call: EdiCall): Moment {
  const r = call.result;
  return typeof r === "string" && r !== ""
    ? { kind: "at", instant: r }
    : { kind: "none" };
}

/** Makes the calls for one state and says what they returned. */
export function boardFacts(lib: HoursLib, state: BoardState): BoardFacts {
  const schedule = scheduleFromEditor(state.editor);
  const zone = state.editor.timeZone;
  const week = weekCanvas(zone, state.weekOf, state.from);
  const valid = runCall(lib, "isValidOperatingSchedule", schedule);
  const calls: EdiCall[] = [valid];
  if (valid.result !== true) {
    return {
      kind: "refused",
      probe: probeScheduleParts(schedule, lib.isValidOperatingSchedule),
      week,
      calls,
    };
  }

  const disambiguation =
    state.disambiguation === "" ? {} : { disambiguation: state.disambiguation };
  const withinOpts = isBlank(state.within) ? {} : { within: state.within };
  const plain = isBlank(state.disambiguation) ? [] : [disambiguation];
  const searched =
    isBlank(state.disambiguation) && isBlank(state.within)
      ? []
      : [{ ...disambiguation, ...withinOpts }];

  let intervals: readonly Interval[] = [];
  if (week !== null) {
    const found = runCall(
      lib,
      "operatingIntervals",
      schedule,
      {
        start: formatHandleValue(week.startMs, zone),
        end: formatHandleValue(week.endMs, zone),
      },
      ...plain,
    );
    calls.push(found);
    intervals = Array.isArray(found.result) ? (found.result as Interval[]) : [];
  }

  if (isBlank(state.from)) {
    return {
      kind: "accepted",
      intervals,
      week,
      reading: { kind: "blank" },
      calls,
    };
  }
  const fromValid = runCall(lib, "isValidInterval", {
    start: state.from,
    end: state.from,
  });
  calls.push(fromValid);
  if (fromValid.result !== true) {
    return {
      kind: "accepted",
      intervals,
      week,
      reading: { kind: "from-refused" },
      calls,
    };
  }

  const withinCheck = isBlank(state.within)
    ? null
    : runCall(lib, "isValidDuration", state.within);
  const withinRefused = withinCheck !== null && withinCheck.result !== true;
  const open = runCall(lib, "isOpenAt", state.from, schedule, ...plain);
  const nextOpen = runCall(
    lib,
    "nextOpenAt",
    state.from,
    schedule,
    ...searched,
  );
  const nextClose = runCall(
    lib,
    "nextCloseAt",
    state.from,
    schedule,
    ...searched,
  );
  calls.push(open);
  if (withinCheck !== null) calls.push(withinCheck);
  // A refused `within` is shown as refused; the call is still made so the printed calls are real.
  calls.push(nextOpen, nextClose);

  let between: Between = { kind: "blank" };
  if (!isBlank(state.to)) {
    const span = runCall(lib, "isValidInterval", {
      start: state.from,
      end: state.to,
    });
    calls.push(span);
    if (span.result !== true) {
      between = { kind: "refused" };
    } else {
      const total = runCall(
        lib,
        "operatingTimeBetween",
        state.from,
        state.to,
        schedule,
        ...plain,
      );
      calls.push(total);
      between = { kind: "value", duration: String(total.result) };
    }
  }

  let deadline: Deadline = { kind: "blank" };
  if (!isBlank(state.duration)) {
    const durationCheck = runCall(lib, "isValidDuration", state.duration);
    calls.push(durationCheck);
    if (durationCheck.result !== true) {
      deadline = { kind: "duration-refused" };
    } else if (withinRefused) {
      deadline = { kind: "within-refused" };
    } else {
      const due = runCall(
        lib,
        "addOperatingTime",
        state.from,
        state.duration,
        schedule,
        ...searched,
      );
      calls.push(due);
      deadline = momentOf(due);
    }
  }

  const refusedOr = (call: EdiCall): Moment =>
    withinRefused ? { kind: "within-refused" } : momentOf(call);
  return {
    kind: "accepted",
    intervals,
    week,
    reading: {
      kind: "read",
      openAtFrom: open.result === true,
      nextOpen: refusedOr(nextOpen),
      nextClose: refusedOr(nextClose),
      between,
      deadline,
    },
    calls,
  };
}
