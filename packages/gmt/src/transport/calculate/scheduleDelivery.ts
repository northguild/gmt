import { Temporal } from "@js-temporal/polyfill";
import {
  TIME_ZONE_ANNOTATION,
  exactDurationNanoseconds,
  isOptionsArgument,
  isoStringBody,
  zonedDateTimeFrom,
} from "../../internal";
import { isValidDateTime } from "../../plain/validate/isValidDateTime";
import { isValidInstant } from "../../precision/validate/isValidInstant";
import { isValidTimeZone } from "../../zoned/validate/isValidTimeZone";
import { isValidZonedDateTime } from "../../zoned/validate/isValidZonedDateTime";
import { etaAtZone } from "../convert/etaAtZone";
import { transitTime } from "./transitTime";
import { optionOrDefault } from "../../internal/optionOrDefault";

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
  /** The time zone of the destination, the caller's fact: an IANA name or a UTC offset. */
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
   * The time zone a zoneless first-leg departure is read in, an IANA name or a UTC offset, for
   * schedules published as local wall times. An ambiguous wall time resolves to the earlier instant
   * and a nonexistent one to the later instant (`"compatible"`). Ignored when the first departure
   * is already exact; never applied to later legs.
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
 * A time-zone annotation anywhere in the string (`TIME_ZONE_ANNOTATION`): a bracket without
 * `=`. A departure that names a zone must name a real one that agrees with its offset.
 */
const zoneAnnotation = new RegExp(TIME_ZONE_ANNOTATION);

/**
 * A departure resolved to the exact instant it names, or `null`.
 *
 * An instant (`Z`/offset) is already exact; a zoned string is exact through its bracket, which
 * is read and must be real and agree with its offset (unlike `crossingTime`, which never reads
 * one). A zoneless wall time is a published local schedule time, exact only through
 * `wallTimeZone` — the caller decides which zone that is: `startTimeZone` for the first leg,
 * the previous leg's `timeZone` for any other leg (see `legDeparture`). Without one, a
 * zoneless departure is not a moment. `cursor` picks the pass of a repeated hour (see
 * `wallTimeInstant`).
 */
function departureInstant(
  departure: unknown,
  wallTimeZone: string | undefined,
  cursor: Temporal.Instant | null,
): Temporal.Instant | null {
  if (typeof departure !== "string") {
    return null;
  }
  if (isValidZonedDateTime(departure)) {
    return wallTimeInstant(departure, cursor);
  }
  if (zoneAnnotation.test(departure)) {
    return null;
  }
  if (isValidInstant(departure)) {
    return Temporal.Instant.from(departure);
  }
  if (wallTimeZone !== undefined && isValidDateTime(departure)) {
    // resolveLocal's core: the zone the schedule's wall time is exact in.
    return wallTimeInstant(
      `${isoStringBody(departure)}[${wallTimeZone}]`,
      cursor,
    );
  }
  return null;
}

/**
 * The instant a zoned string names. On a later leg (`cursor` set), a wall time the clock showed
 * twice — a fall-back hour — resolves to the earliest pass at or after `cursor`, the first
 * moment the cargo can leave: a printed hub time never says which pass it means, and the one a
 * shipper would catch is the first the cargo is ready for. Otherwise, and when neither pass is
 * at or after `cursor` (a real miss), it resolves `"compatible"`: the earlier pass of a
 * repeated hour, the later instant of a skipped one. A written offset names one pass, so both
 * reads agree and it always wins. A repeated hour is told apart from a skipped one by whether
 * both passes keep the wall time asked for.
 */
function wallTimeInstant(
  zoned: string,
  cursor: Temporal.Instant | null,
): Temporal.Instant {
  if (cursor !== null) {
    const earlier = zonedDateTimeFrom(zoned, { disambiguation: "earlier" });
    const later = zonedDateTimeFrom(zoned, { disambiguation: "later" });
    const repeated =
      !earlier.toInstant().equals(later.toInstant()) &&
      earlier.toPlainDateTime().equals(later.toPlainDateTime());
    if (repeated) {
      for (const pass of [earlier.toInstant(), later.toInstant()]) {
        if (Temporal.Instant.compare(pass, cursor) >= 0) {
          return pass;
        }
      }
    }
  }
  return zonedDateTimeFrom(zoned, { disambiguation: "compatible" }).toInstant();
}

/** The three opaque tag keys of a leg, echoed onto its LegTime. */
const TAG_KEYS = ["mode", "origin", "destination"] as const;

/**
 * The leg's tags, ready to spread onto its LegTime — an unsupplied key stays truly absent —
 * or `null` when a present tag is not a string.
 */
function legTags(
  leg: Leg,
): Pick<LegTime, "mode" | "origin" | "destination"> | null {
  const tags: Partial<Pick<LegTime, "mode" | "origin" | "destination">> = {};
  for (const key of TAG_KEYS) {
    const tag = leg[key];
    if (tag === undefined) {
      continue;
    }
    if (typeof tag !== "string") {
      return null;
    }
    tags[key] = tag;
  }
  return tags;
}

/**
 * The instant this leg leaves: its scheduled `departure`, or the connection cursor (the previous
 * arrival plus its dwell) it chains from. A zoneless `departure` is read as a wall time in
 * `startTimeZone` on the first leg (`cursor === null`), or in `previousTimeZone` — the previous
 * leg's own `timeZone`, already proven real by that leg's `legBoundaries` call — on any other
 * leg; `previousTimeZone` is `undefined`, and ignored, on the first leg. A scheduled departure
 * before the cursor — inside the previous handoff's minimum connect time, or before the arrival
 * itself — is a missed connection, invalid input rather than a negative wait; equal passes, a
 * zero-slack connection is feasible. `null` on the first leg (no cursor) means the leg's
 * departure did not resolve.
 */
function legDeparture(
  leg: Leg,
  cursor: Temporal.Instant | null,
  startTimeZone: string | undefined,
  previousTimeZone: string | undefined,
): Temporal.Instant | null {
  if (cursor !== null && leg.departure === undefined) {
    return cursor;
  }
  const wallTimeZone = cursor === null ? startTimeZone : previousTimeZone;
  const departure = departureInstant(leg.departure, wallTimeZone, cursor);
  if (departure === null) {
    return null;
  }
  if (cursor !== null && Temporal.Instant.compare(departure, cursor) < 0) {
    return null;
  }
  return departure;
}

/** A leg's computed boundary times, or `null` when a field is invalid. */
type LegBoundaries = {
  arrival: string;
  localArrival: string;
  dwellAfter: string;
  /** When the next leg may leave: the arrival plus this leg's dwell; `null` for the final leg. */
  released: Temporal.Instant | null;
};

/**
 * Whether a final leg's `dwellAfter` is a dwell `transitTime` would accept — an ISO 8601
 * duration with no years, months or weeks — and is not negative. Checked on the duration alone:
 * the last dwell moves nothing, so no instant is computed and the range cannot reject it.
 */
function isValidFinalDwell(dwellAfter: string): boolean {
  const nanoseconds = exactDurationNanoseconds(dwellAfter);
  return nanoseconds !== null && nanoseconds >= 0n;
}

/**
 * A leg's arrival, its local rendering, and the dwell hop to when the next leg may leave.
 *
 * `transitTime` gives both the leg and the hop the duration grammar (calendar units refused, a
 * day is 24 hours). A leg that lands before it departs, or a hop that lands before its own
 * arrival, is negative time — a data error. The final leg's hop is not taken (`released` is
 * `null`): its dwell is validated as a duration and echoed, never turned into an instant.
 */
function legBoundaries(
  departure: Temporal.Instant,
  leg: Leg,
  isFinal: boolean,
): LegBoundaries | null {
  const arrival = transitTime(departure.toString(), leg.duration);
  if (arrival === "") {
    return null;
  }
  const arrivalInstant = Temporal.Instant.from(arrival);
  if (Temporal.Instant.compare(arrivalInstant, departure) < 0) {
    return null;
  }
  const localArrival = etaAtZone(arrival, leg.timeZone);
  if (localArrival === "") {
    return null;
  }
  const dwellAfter = optionOrDefault(leg.dwellAfter, "PT0S");
  if (isFinal) {
    return isValidFinalDwell(dwellAfter)
      ? { arrival, localArrival, dwellAfter, released: null }
      : null;
  }
  const releasedString = transitTime(arrival, dwellAfter);
  if (releasedString === "") {
    return null;
  }
  const released = Temporal.Instant.from(releasedString);
  if (Temporal.Instant.compare(released, arrivalInstant) < 0) {
    return null;
  }
  return { arrival, localArrival, dwellAfter, released };
}

/**
 * Chain the legs: each leg leaves at its scheduled departure or at the cursor the previous leg
 * released, and lands as `legBoundaries` computes. `previousTimeZone` carries leg N-1's own
 * `timeZone` forward so leg N's zoneless departure can be read in it; it stays `undefined`
 * before leg 0 (where `startTimeZone` applies instead, never this) and is captured only once
 * `legBoundaries` has proven that zone real, never speculatively. `null` when any leg is
 * malformed, misses its connection, or leaves the instant range.
 */
function chainLegs(
  legs: Leg[],
  startTimeZone: string | undefined,
): LegTime[] | null {
  const legTimes: LegTime[] = [];
  let cursor: Temporal.Instant | null = null;
  let previousTimeZone: string | undefined;
  for (const [index, leg] of legs.entries()) {
    if (typeof leg !== "object" || leg === null) {
      return null;
    }
    const tags = legTags(leg);
    if (tags === null) {
      return null;
    }
    const departure = legDeparture(
      leg,
      cursor,
      startTimeZone,
      previousTimeZone,
    );
    if (departure === null) {
      return null;
    }
    const boundaries = legBoundaries(departure, leg, index === legs.length - 1);
    if (boundaries === null) {
      return null;
    }
    cursor = boundaries.released;
    previousTimeZone = leg.timeZone;
    legTimes.push({
      arrival: boundaries.arrival,
      localArrival: boundaries.localArrival,
      dwellAfter: boundaries.dwellAfter,
      ...tags,
    });
  }
  return legTimes;
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
 *   offset (`"2024-11-03T01:30:00[America/New_York]"`), a zoneless first departure read in
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
 *
 * @param legs the journey's legs, in travel order
 * @param options The zone a zoneless first-leg departure is read in
 * @returns the final local ETA and each leg's arrival, local arrival and dwell, or null on invalid input
 *
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT36H", timeZone: "Asia/Tokyo" }]) // { eta: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-16T22:00:00Z", localArrival: "2024-06-17T07:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] }
 * @example scheduleDelivery([{ departure: "2024-06-15T00:00:00Z", duration: "PT10H", timeZone: "UTC", dwellAfter: "PT2H" }, { duration: "PT5H", timeZone: "Asia/Tokyo" }]) // { eta: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", legTimes: [{ arrival: "2024-06-15T10:00:00Z", localArrival: "2024-06-15T10:00:00+00:00[UTC]", dwellAfter: "PT2H" }, { arrival: "2024-06-15T17:00:00Z", localArrival: "2024-06-16T02:00:00+09:00[Asia/Tokyo]", dwellAfter: "PT0S" }] } (the second leg leaves at 12:00Z, after the dwell)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00Z", duration: "PT1H", timeZone: "UTC", mode: "ship" }]) // { eta: "2024-06-15T11:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T11:00:00Z", localArrival: "2024-06-15T11:00:00+00:00[UTC]", dwellAfter: "PT0S", mode: "ship" }] } (tags echo back; unsupplied tag keys stay absent)
 * @example scheduleDelivery([{ departure: "2024-06-15T10:00:00", duration: "PT1H", timeZone: "UTC" }], { startTimeZone: "America/New_York" }) // { eta: "2024-06-15T15:00:00+00:00[UTC]", legTimes: [{ arrival: "2024-06-15T15:00:00Z", localArrival: "2024-06-15T15:00:00+00:00[UTC]", dwellAfter: "PT0S" }] } (a published 10:00 wall time, read in New York)
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
  try {
    if (!isOptionsArgument(options)) {
      return null;
    }
    const startTimeZone = options?.startTimeZone;
    if (startTimeZone !== undefined && !isValidTimeZone(startTimeZone)) {
      return null;
    }

    if (!Array.isArray(legs)) {
      return null;
    }

    const legTimes = chainLegs(legs, startTimeZone);
    if (legTimes === null) {
      return null;
    }

    // An empty legs array is the vacuous schedule: eta is "" only there.
    const last = legTimes.at(-1);
    return { eta: last === undefined ? "" : last.localArrival, legTimes };
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return null;
  }
}
