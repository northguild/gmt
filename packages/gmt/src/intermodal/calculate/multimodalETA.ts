import { Temporal } from "@js-temporal/polyfill";
import { exactDurationNanoseconds } from "../../internal";
import { formatHourDuration } from "../../internal/hourDurationString";
import {
  type Leg,
  type ScheduleDeliveryOptions,
  scheduleDelivery,
} from "../../transport/calculate/scheduleDelivery";
import { isObject } from "../../internal/isObject";

/** What `multimodalETA` returns: the end-to-end ETA, with the time moving and the time waiting kept apart. */
export interface MultimodalJourney {
  /** The last leg's arrival rendered in its `timeZone`, as `scheduleDelivery` gives it. `""` only for an empty legs array. */
  eta: string;
  /** The number of legs in the journey. */
  totalLegs: number;
  /**
   * The time the cargo spent moving: every leg's `duration` added up, as an ISO 8601 duration of
   * elapsed time with hours as the largest unit.
   */
  totalTransit: string;
  /**
   * The time the cargo spent at the handoffs between legs: each leg's departure minus the previous
   * leg's arrival, added up, in the same form as `totalTransit`. It includes any wait for a
   * scheduled departure on top of the handoff's `dwellAfter`.
   */
  totalDwell: string;
}

/**
 * Every field of a `Leg`, each read once into a plain copy. Typed as a record of `keyof Leg`, so a
 * field added to `Leg` and missing here, or a key here that `Leg` does not have, fails to compile
 * rather than being dropped from the copy.
 */
const LEG_FIELDS: Record<keyof Leg, true> = {
  departure: true,
  duration: true,
  timeZone: true,
  dwellAfter: true,
  mode: true,
  origin: true,
  destination: true,
};
const LEG_KEYS = Object.keys(LEG_FIELDS) as (keyof Leg)[];

/**
 * A plain copy of one leg with every field read exactly once, so the schedule and the totals are
 * computed from the same values even when a field is a getter. An undefined field stays absent,
 * which `scheduleDelivery` reads as omitted either way. A leg that is not an object is passed
 * through for `scheduleDelivery` to refuse.
 */
function snapshotLeg(leg: unknown): unknown {
  if (!isObject(leg)) {
    return leg;
  }
  const copy: Partial<Record<keyof Leg, unknown>> = {};
  for (const key of LEG_KEYS) {
    const value: unknown = Reflect.get(leg, key);
    if (value !== undefined) {
      copy[key] = value;
    }
  }
  return copy;
}

/**
 * Compute an end-to-end ETA across the legs of a multimodal move, and report the time in transit
 * and the time in dwell separately.
 *
 * A truck→ship→rail move spends its time two ways: moving, and sitting at a handoff. The two are
 * forecast differently and fail differently, so one opaque total hides the part a planner needs.
 * `multimodalETA` schedules the legs with `scheduleDelivery` and splits the elapsed time from the
 * first departure to the ETA into the two.
 *
 * - **The legs are `scheduleDelivery`'s.** Each leg's arrival plus its `dwellAfter` is the next
 *   leg's departure unless the next leg names a scheduled `departure`; a scheduled departure
 *   inside the dwell is a missed connection. Departures, zones and every validity rule are that
 *   function's, and `eta` is its `eta`.
 * - **Local-time resolution policy (`"compatible"`), as `scheduleDelivery` applies it.** A zoneless
 *   first departure read in `startTimeZone`, a zoneless later-leg departure read in the previous
 *   leg's `timeZone`, and a zoned departure written without an offset are wall times. An
 *   **ambiguous** one (a fall-back hour the clock ran through twice) resolves to the **earlier**
 *   instant and a **nonexistent** one (a spring-forward hour the clock skipped) to the **later**
 *   instant, except that on any leg but the first a repeated hour takes the earliest pass at or
 *   after the previous arrival plus its dwell, the first the cargo can catch. Write the offset to
 *   pick a pass yourself.
 * - **`totalTransit` is every leg's `duration` added up.** Durations are exact time: a day is 24
 *   hours, and years, months and weeks return `null`. The sum is elapsed time, so a leg across a
 *   DST change counts the hours that passed, not the change in the wall clock.
 * - **`totalDwell` is the time actually spent at the handoffs**: each leg's departure minus the
 *   previous leg's arrival. When every leg after the first chains from its predecessor, that is the
 *   sum of the `dwellAfter` values. When a leg waits for a scheduled departure, the wait is dwell
 *   too: the cargo is at the handoff either way. Dwell is never estimated; it is the caller's
 *   `dwellAfter` and schedule.
 * - **Transit plus dwell is the elapsed time** from the first departure to the ETA, exactly.
 * - **The last leg's `dwellAfter` is not dwell.** There is no handoff after it, so it moves
 *   nothing; it is still checked as a duration, as `scheduleDelivery` checks it.
 * - Both totals are ISO 8601 durations with hours as the largest unit (`"PT400H"`, `"PT2H15M"`),
 *   as `crossingTime` and `dwellTime` report elapsed time; they do not depend on any zone.
 * - Each leg's fields are read once, so the totals always agree with the schedule.
 * - An empty legs array returns `{ eta: "", totalLegs: 0, totalTransit: "PT0S", totalDwell: "PT0S" }`.
 *   Returns `null` on invalid input: a non-array, a malformed leg, a missed connection, an invalid
 *   `startTimeZone`, or an arrival outside the instant range.
 * - An offset with seconds (`-00:44:30`) as a leg's `timeZone` or as `startTimeZone` returns
 *   `null`, as in `scheduleDelivery`. A written zone cannot carry seconds (RFC 9557 §4.1), so `eta`
 *   could not name it. Pass the IANA name.
 *
 * @param legs the journey's legs, in travel order
 * @param options The zone a zoneless first-leg departure is read in
 * @returns the ETA, the number of legs, and the total transit and dwell, or null on invalid input
 *
 * @example multimodalETA([{ departure: "2024-06-10T08:00:00+08:00[Asia/Shanghai]", duration: "PT6H", timeZone: "Asia/Shanghai", dwellAfter: "P2D" }, { duration: "P14DT6H", timeZone: "America/Los_Angeles", dwellAfter: "PT36H" }, { duration: "PT52H", timeZone: "America/Chicago" }]) // { eta: "2024-06-29T23:00:00-05:00[America/Chicago]", totalLegs: 3, totalTransit: "PT400H", totalDwell: "PT84H" } (truck, ship and rail: 484 hours door to door)
 * @example multimodalETA([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]) // { eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", totalLegs: 2, totalTransit: "PT15H", totalDwell: "PT2H" }
 * @example multimodalETA([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T13:00:00Z", duration: "PT1H", timeZone: "UTC" }]) // { eta: "2024-06-15T14:00:00+00:00[UTC]", totalLegs: 2, totalTransit: "PT11H", totalDwell: "PT3H" } (two hours' handling and an hour's wait for the 13:00 departure)
 * @example multimodalETA([{ departure: "2024-06-15T10:00:00Z", duration: "PT36H", timeZone: "Asia/Tokyo", dwellAfter: "PT5H" }]) // { eta: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", totalLegs: 1, totalTransit: "PT36H", totalDwell: "PT0S" } (no handoff after the last leg)
 * @example multimodalETA([{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }) // { eta: "2024-06-15T15:00:00+00:00[UTC]", totalLegs: 1, totalTransit: "PT1H", totalDwell: "PT0S" } (a published 10:00 wall time, read in New York)
 * @example multimodalETA([]) // { eta: "", totalLegs: 0, totalTransit: "PT0S", totalDwell: "PT0S" }
 * @example multimodalETA([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T11:00:00Z", duration: "PT1H", timeZone: "UTC" }]) // null (the connection leaves inside the dwell: missed)
 * @example multimodalETA([{ departure: "2024-06-15T10:00:00Z", duration: "P1M", timeZone: "UTC" }]) // null (calendar units have no exact length)
 * @example multimodalETA("legs") // null
 */
export function multimodalETA(
  legs: Leg[],
  options?: ScheduleDeliveryOptions,
): MultimodalJourney | null {
  try {
    if (!Array.isArray(legs)) {
      return null;
    }
    const snapshot = legs.map(snapshotLeg) as Leg[];
    const schedule = scheduleDelivery(snapshot, options);
    if (schedule === null) {
      return null;
    }

    const first = schedule.legTimes.at(0);
    const last = schedule.legTimes.at(-1);
    if (first === undefined || last === undefined) {
      return {
        eta: "",
        totalLegs: 0,
        totalTransit: "PT0S",
        totalDwell: "PT0S",
      };
    }

    // scheduleDelivery has accepted every duration as exact and not negative.
    const durations = snapshot.map((leg) =>
      exactDurationNanoseconds(leg.duration),
    );
    if (durations.some((nanoseconds) => nanoseconds === null)) {
      return null;
    }
    const transit = (durations as bigint[]).reduce((sum, ns) => sum + ns, 0n);

    // Arrivals are the Z strings scheduleDelivery wrote. The first leg left its own duration
    // before it arrived; the time between that departure and the last arrival that was not spent
    // moving was spent at the handoffs.
    const departure =
      Temporal.Instant.from(first.arrival).epochNanoseconds -
      (durations[0] as bigint);
    const elapsed =
      Temporal.Instant.from(last.arrival).epochNanoseconds - departure;

    const totalTransit = formatHourDuration(transit);
    const totalDwell = formatHourDuration(elapsed - transit);
    if (totalTransit === "" || totalDwell === "") {
      return null;
    }

    return {
      eta: schedule.eta,
      totalLegs: snapshot.length,
      totalTransit,
      totalDwell,
    };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
