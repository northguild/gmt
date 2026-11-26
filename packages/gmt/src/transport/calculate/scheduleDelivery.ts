import { scheduleDeliveryValue } from "../../internal/deliverySchedule";

/** One leg of a multi-modal journey: a departure, how long it takes, and where it lands. */
export interface Leg {
  /**
   * The departure: an instant (`Z`/offset) or a zoned string, always exact; on any leg but the
   * first, a zoneless wall time is also accepted and is read in the previous leg's `timeZone`
   * (the first leg's equivalent is `ScheduleDeliveryOptions.startTimeZone`). Required on the
   * first leg; on later legs it is the scheduled connection the cargo waits for.
   *
   * @defaultValue None. The leg leaves as soon as the previous leg's arrival plus its
   * `dwellAfter` allows; a first leg without it is invalid input.
   */
  departure?: string;
  /** The ISO 8601 duration of the leg; time units and 24-hour days only (`transitTime`'s rule). */
  duration: string;
  /**
   * The time zone of the destination, the caller's fact: an IANA name or a UTC offset to the minute
   * (what `isValidTimeZone` accepts).
   */
  timeZone: string;
  /**
   * The handling time at the handoff after this leg; the minimum connect time.
   *
   * @defaultValue `"PT0S"`
   */
  dwellAfter?: string;
  /**
   * An opaque tag echoed back on the LegTime; GMT does not interpret transport modes.
   *
   * @defaultValue None. The LegTime carries no `mode`.
   */
  mode?: string;
  /**
   * An opaque tag echoed back on the LegTime; never resolved to a zone.
   *
   * @defaultValue None. The LegTime carries no `origin`.
   */
  origin?: string;
  /**
   * An opaque tag echoed back on the LegTime; never resolved to a zone.
   *
   * @defaultValue None. The LegTime carries no `destination`.
   */
  destination?: string;
}

/** One leg's computed times, with the leg's own tags echoed back. */
export interface LegTime {
  /** The arrival as a UTC instant (`Z` form) — every leg boundary is an exact instant. */
  arrival: string;
  /** The arrival rendered in the leg's `timeZone`, as `etaAtZone` renders it. */
  localArrival: string;
  /** The leg's `dwellAfter` echoed as written, `"PT0S"` when omitted. */
  dwellAfter: string;
  /** The leg's `mode`, echoed back; absent when the leg did not supply it. */
  mode?: string;
  /** The leg's `origin`, echoed back; absent when the leg did not supply it. */
  origin?: string;
  /** The leg's `destination`, echoed back; absent when the leg did not supply it. */
  destination?: string;
}

/** Options for `scheduleDelivery`. */
export interface ScheduleDeliveryOptions {
  /**
   * The time zone a zoneless first-leg departure is read in, an IANA name or a UTC offset to the
   * minute (what `isValidTimeZone` accepts), for schedules published as local wall times. An
   * ambiguous wall time resolves to the earlier instant and a nonexistent one to the later instant
   * (`"compatible"`). Ignored when the first departure is already exact; never applied to later
   * legs.
   *
   * @defaultValue None. A zoneless first-leg departure is invalid input.
   */
  startTimeZone?: string;
}

/** What `scheduleDelivery` returns: the final local ETA and every leg's times. */
export interface DeliverySchedule {
  /** The last leg's `localArrival`. `""` only for an empty legs array. */
  eta: string;
  /** One `LegTime` per leg, in order. */
  legTimes: LegTime[];
}

/**
 * Chain the legs of a multi-modal move into an end-to-end ETA with zone-local times at every
 * handoff.
 *
 * A truck→ship→rail move is published as one departure plus a duration per leg, and the hour
 * naive implementations lose lives at the handoffs: every leg boundary here is an exact
 * instant, and local rendering happens only at the edges, via `etaAtZone`.
 *
 * - **Each leg's arrival plus its `dwellAfter` is the next leg's departure** unless the next leg
 *   carries an explicit `departure` — a scheduled connection the cargo waits for. `dwellAfter`
 *   is the handling time at the handoff, the minimum connect time: a scheduled departure
 *   earlier than the previous arrival plus its dwell is a missed connection and returns `null`
 *   (equal passes — a zero-slack connection is feasible). It follows `transitTime`'s duration
 *   grammar, may not be negative, and is echoed on the `LegTime` exactly as written (`"PT90M"`
 *   stays `"PT90M"`), `"PT0S"` when omitted. The last leg's dwell moves nothing — there is no
 *   leg after it — so it is validated as a duration (no years, months or weeks, not negative)
 *   and echoed, but never added to an instant: it cannot turn a representable ETA into `null`.
 * - **`departure` must be exact:** an instant (`Z`/offset) or a zoned string, whose bracketed
 *   zone is read and must be real and agree with its offset. The first leg requires one.
 * - **`startTimeZone` resolves the first leg alone:** schedules are published as zone-local wall
 *   times, so a zoneless first-leg departure is read in `startTimeZone`. Zoneless without the
 *   option is `null`; the option is ignored when the departure is already exact; an invalid
 *   `startTimeZone` is `null` even when unused; it is never applied to a later leg — see the next
 *   rule for those.
 * - **A later leg's zoneless departure is read in the previous leg's `timeZone`:** a real
 *   timetable publishes a local wall time at every hub, not just at origin, and leg N−1's
 *   `timeZone` is exactly leg N's departure zone. So a zoneless departure on any leg but the
 *   first is read there, with the same `"compatible"` disambiguation as `startTimeZone`. This is
 *   a separate, always-on mechanism — `startTimeZone` still names only the first leg's zone and
 *   cannot be used for a later one. The missed-connection check still runs after resolution, so a
 *   later zoneless departure that resolves earlier than the cursor is still `null`.
 * - **Local-time resolution policy (`"compatible"`).** A zoned departure written without an
 *   offset (`"2024-10-27T01:30:00[Europe/London]"`), a zoneless first departure read in
 *   `startTimeZone`, and a zoneless later-leg departure read in the previous leg's `timeZone`
 *   are all wall times. An **ambiguous** wall time — a fall-back hour the clock ran through
 *   twice — resolves to the **earlier** instant; a **nonexistent** one — a spring-forward hour
 *   the clock skipped — resolves to the **later** instant. Write the offset to pick the other
 *   pass of a repeated hour.
 * - **A repeated hour at a hub takes the pass the cargo can catch.** On any leg but the first, an
 *   ambiguous wall time resolves to the earliest pass at or after the previous arrival plus its
 *   dwell — a printed timetable never says which pass it means. When neither pass is that late,
 *   it resolves to the earlier pass as above, and the connection is missed. A skipped hour, and
 *   the first leg, which has no arrival to wait for, keep the rule above.
 * - `duration` follows `transitTime`: time units are elapsed time, a day is exactly 24 hours,
 *   and calendar units (years, months, weeks) return `null`. `transitTime` accepts a negative
 *   duration (to recover a departure from an arrival), but a leg cannot arrive before it
 *   departs, so a negative leg is invalid input here and returns `null` (`-PT0S` is zero).
 * - `mode`, `origin` and `destination` are opaque string tags echoed onto each `LegTime` and
 *   absent when not supplied; GMT does not resolve them to zones — `timeZone` is the caller's
 *   fact.
 * - `eta` is the last leg's `localArrival`, so a single-leg schedule is exactly `transitTime`
 *   composed with `etaAtZone`.
 * - An empty legs array is valid vacuous input and returns `{ eta: "", legTimes: [] }`;
 *   malformed input (a non-array, a non-object leg, an invalid field) returns `null`.
 * - Returns `null` on invalid input.
 * - An offset with seconds (`-00:44:30`) as a leg's `timeZone` or as `startTimeZone` returns
 *   `null`. A written zone cannot carry seconds (RFC 9557 §4.1), so `eta` and `localArrival` could
 *   not name it. Pass the IANA name, or call `fromOffsetInstant({ instant, offset })` on a leg's
 *   `arrival` for the local time with its full offset and no bracket.
 *
 * @param legs the journey's legs, in travel order
 * @param options The zone a zoneless first-leg departure is read in
 * @returns the final local ETA and each leg's arrival, local arrival and dwell, or null on invalid input
 *
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT36H", timeZone: "Asia/Tokyo" }]) // { eta: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-16T22:00:00Z", localArrival: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }
 * @example scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]) // { eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] } (the second leg leaves at 12:00Z, after the dwell)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", mode: "ship" }]) // { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT0S", mode: "ship" }] } (tags echo back; unsupplied tag keys stay absent)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/Sao_Paulo" }) // { eta: "2024-06-15T14:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T14:00:00Z", localArrival: "2024-06-15T14:00:00+00:00[UTC]", dwellAfter: "PT0S" }] } (a published 10:00 wall time, read in São Paulo)
 * @example scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T13:00:00", duration: "PT1H", timeZone: "UTC" }]) // { eta: "2024-06-15T14:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T14:00:00Z", localArrival: "2024-06-15T14:00:00+00:00[UTC]", dwellAfter: "PT0S" }] } (leg 2's zoneless 13:00 is read in leg 1's UTC destination zone, not startTimeZone, since none was supplied)
 * @example scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T11:00:00", duration: "PT1H", timeZone: "UTC" }]) // null (leg 2's zoneless 11:00, read in UTC, falls inside leg 1's dwell: a missed connection)
 * @example scheduleDelivery([]) // { eta: "", legTimes: [] }
 * @example scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { departure: "2024-06-15T11:00:00Z", duration: "PT1H", timeZone: "UTC" }]) // null (the scheduled connection leaves inside the dwell: a missed connection)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }]) // null (a zoneless departure without startTimeZone is not a moment)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "-PT1H", timeZone: "UTC" }]) // null (a leg cannot arrive before it departs)
 * @example scheduleDelivery([{ duration: "PT1H", timeZone: "UTC" }]) // null (the first leg needs a departure)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "P1M", timeZone: "UTC" }]) // null (calendar units need a reference point)
 * @example scheduleDelivery("legs") // null
 */
export function scheduleDelivery(
  legs: Leg[],
  options?: ScheduleDeliveryOptions,
): DeliverySchedule | null {
  return scheduleDeliveryValue(legs, options);
}
