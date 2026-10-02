import {
  type ExactMoment,
  exactDurationNanoseconds,
  isObject,
  isOptionsArgument,
  nonNegativeExactDurationNanoseconds,
  readExactMoment,
  writeExactMoment,
} from "../../internal";
import { hasInstantShape } from "../../internal/isoStringBody";

/**
 * A headway service: a departure every `headway` from `from`, up to (not including) `to` — the
 * shape of a GTFS `frequencies.txt` row (`headway_secs`, `start_time`, `end_time`; GTFS Schedule
 * Reference, https://github.com/google/transit/blob/master/gtfs/spec/en/reference.md#frequenciestxt).
 *
 * The departures are modelled as GTFS `exact_times=1` (schedule-based): each `from + k × headway`
 * is a real departure. For a frequency-based service (`exact_times=0`, "a bus every 20 minutes"
 * with no published times) the result is a nominal slot, not a timetabled departure.
 */
export interface Headway {
  /** ISO 8601 duration between departures: exact time (a day is 24 hours), greater than zero. */
  headway: string;
  /** The first departure, an exact moment: an instant (`Z`/offset) or a zoned string. */
  from: string;
  /** The end of the service window, excluded: an exact moment after `from`. */
  to: string;
}

/** Options for `nextDeparture`. */
export interface NextDepartureOptions {
  /**
   * ISO 8601 duration the connection needs after `after` before a departure can be made: exact
   * time (a day is 24 hours), not negative. Default `"PT0S"`.
   */
  minimumConnection?: string;
}

/**
 * A moment that carries its own offset (`Z`, `±HH:MM`, or a zoned string with one), read as
 * `transitTime` reads a departure, or `null`. A zoned wall time without an offset is refused: in
 * a repeated hour it names two instants, and a timetable must say which.
 */
function readTimetableMoment(value: unknown): ExactMoment | null {
  return typeof value === "string" && hasInstantShape(value)
    ? readExactMoment(value)
    : null;
}

/** The earliest entry at or after `threshold`, echoed as written; `""` when none, or one is invalid. */
function listDeparture(threshold: bigint, entries: readonly unknown[]): string {
  let best: { entry: string; nanoseconds: bigint } | null = null;
  for (const entry of entries) {
    const moment = readTimetableMoment(entry);
    if (moment === null) {
      return "";
    }
    // Strictly earlier replaces, so of two entries at the same instant the first is kept.
    if (
      moment.nanoseconds >= threshold &&
      (best === null || moment.nanoseconds < best.nanoseconds)
    ) {
      best = { entry: entry as string, nanoseconds: moment.nanoseconds };
    }
  }
  return best === null ? "" : best.entry;
}

/**
 * The first `from + k × headway` at or after `threshold` and before `to`, written the way `from`
 * was written; `""` when none. Computed, never stepped: `k` is the ceiling of the distance over
 * the headway, in bigint nanoseconds, so a long window costs nothing and every candidate is
 * before `to`, inside the instant range.
 */
function headwayDeparture(threshold: bigint, service: Headway): string {
  const { headway, from, to } = service;
  const step = exactDurationNanoseconds(headway);
  const start = readTimetableMoment(from);
  const end = readTimetableMoment(to);
  if (
    step === null ||
    step <= 0n ||
    start === null ||
    end === null ||
    start.nanoseconds >= end.nanoseconds
  ) {
    return "";
  }

  const behind = threshold - start.nanoseconds;
  const steps = behind <= 0n ? 0n : (behind + step - 1n) / step;
  const departure = start.nanoseconds + steps * step;
  return departure < end.nanoseconds
    ? writeExactMoment(departure, start.notation)
    : "";
}

/**
 * Find the next departure a connection can make: the first scheduled departure at or after
 * `after` plus the minimum connection time.
 *
 * This is timetable lookup, not routing: it answers "which departure does this arrival make",
 * the explicit `departure` a `scheduleDelivery` leg takes. Choosing among routes is the
 * consumer's.
 *
 * - **The threshold is `after` plus `minimumConnection`, in exact time.** A departure exactly at
 *   the threshold is made: a zero-slack connection is feasible, as in `scheduleDelivery`. The
 *   connection follows `transitTime`'s duration rule (a day is 24 hours; years, months and weeks
 *   return `""`) and may not be negative.
 * - **List form** (`string[]`): the earliest entry at or after the threshold, in any order. Two
 *   entries at the same instant go to the first in the list. The entry is returned **exactly as
 *   written**, so it can be passed straight to `scheduleDelivery` as a leg's `departure`. An empty
 *   list, or no entry late enough, returns `""`.
 * - **Headway form** (`{ headway, from, to }`): departures every `headway` from `from`, in the
 *   half-open window `[from, to)` — `to` itself is never a departure, as a GTFS
 *   `frequencies.txt` `end_time` is not. Departures are `from + k × headway` in exact time, so
 *   across a DST transition they keep their spacing and the wall clock shifts. The result is
 *   written the way `from` was written: in its zone, at its offset exactly as written, or as a
 *   `Z` instant. A headway that is not greater than zero, or `to` at or before `from`, returns
 *   `""`, as does a threshold past the last departure. This models GTFS `exact_times=1`
 *   (schedule-based) service; for frequency-based service (`exact_times=0`) the result is a
 *   nominal slot, not a timetabled departure.
 * - **Every moment must carry its offset** — `after`, each entry, `from` and `to`: an instant
 *   (`Z`/offset), or a zoned string with its offset, whose bracketed zone must be real and agree
 *   with that offset, as `transitTime` reads a departure. A zoned wall time without an offset is
 *   refused, since in a repeated fall-back hour it names two departures, and a zoneless wall time
 *   names none; both return `""`. One invalid entry invalidates the whole list, never a partial
 *   answer.
 * - Returns `""` on invalid input or when no departure qualifies.
 *
 * @param after ISO 8601 instant or zoned datetime string of the arrival that must connect
 * @param timetable the departures as exact moments, or a headway service `{ headway, from, to }`
 * @param options optional: minimumConnection (ISO 8601 duration of exact time needed before a departure can be made)
 * @returns the departure (a list entry as written, or a headway departure in from's notation; "" when none qualifies), or "" on invalid input
 *
 * @example nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T08:00:00Z", "2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"]) // "2024-06-15T09:30:00Z"
 * @example nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T08:00:00Z", "2024-06-15T09:30:00Z", "2024-06-15T11:00:00Z"], { minimumConnection: "PT45M" }) // "2024-06-15T11:00:00Z" (a 45-minute connection misses the 09:30)
 * @example nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T05:30:00-04:00[America/New_York]"]) // "2024-06-15T05:30:00-04:00[America/New_York]" (echoed as written)
 * @example nextDeparture("2024-06-15T06:05:00+02:00", { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" }) // "2024-06-15T06:20:00+02:00"
 * @example nextDeparture("2024-06-15T09:00:00+02:00", { headway: "PT20M", from: "2024-06-15T06:00:00+02:00", to: "2024-06-15T09:00:00+02:00" }) // "" (to is excluded)
 * @example nextDeparture("2024-11-03T01:30:00-04:00[America/New_York]", { headway: "PT1H", from: "2024-11-03T00:00:00-04:00[America/New_York]", to: "2024-11-03T04:00:00-05:00[America/New_York]" }) // "2024-11-03T01:00:00-05:00[America/New_York]" (hourly in exact time: the repeated hour's second pass)
 * @example nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T09:30:00"]) // "" (a timetable entry needs an offset)
 * @example nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T09:30:00[Europe/London]"]) // "" (a zoned entry needs its offset too)
 * @example nextDeparture("2024-06-15T09:00:00Z", ["2024-06-15T09:30:00Z"], { minimumConnection: "-PT5M" }) // "" (a negative connection)
 */
export function nextDeparture(
  after: string,
  timetable: readonly string[] | Headway,
  options?: NextDepartureOptions,
): string {
  try {
    if (!isOptionsArgument(options)) {
      return "";
    }
    const connection = options?.minimumConnection;
    const connectionNanoseconds =
      connection === undefined
        ? 0n
        : nonNegativeExactDurationNanoseconds(connection);
    if (connectionNanoseconds === null) {
      return "";
    }

    const arrival = readTimetableMoment(after);
    if (arrival === null) {
      return "";
    }
    const threshold = arrival.nanoseconds + connectionNanoseconds;

    if (Array.isArray(timetable)) {
      return listDeparture(threshold, timetable as readonly unknown[]);
    }
    return isObject(timetable)
      ? headwayDeparture(threshold, timetable as Headway)
      : "";
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return "";
  }
}
