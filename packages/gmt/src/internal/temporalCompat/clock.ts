import { Temporal } from "../temporal";

/*
 * D21: `Temporal.Now` reads one millisecond early after a clock before 1970.
 *
 * Polyfill 0.5.1 builds each reading as `Date.now()` in nanoseconds plus the previous reading's
 * `ms % 1e6` as a sub-millisecond tail. JavaScript's `%` keeps the dividend's sign, so after a
 * `Date.now()` before 1970 the tail is negative and the next reading lands in the millisecond
 * before `Date.now()`. The Temporal proposal defines SystemUTCEpochMilliseconds as the floor of
 * the system time in nanoseconds over 1e6 (spec/temporal.html) and wires it into `Date.now()`
 * (spec/mainadditions.html), so no reading may be earlier than a `Date.now()` taken before it, and
 * test262 `built-ins/Temporal/Now/instant/return-value-value.js` asserts that.
 *
 * Each reader below takes `Date.now()` first, then calls the seam's `Temporal.Now` member at call
 * time (so a spy on `Temporal.Now` still intercepts). A negative tail is the only way a reading
 * can fall in the millisecond just before `Date.now()`, and adding one millisecond is exactly the
 * floored-modulo result. On a fixed runtime that millisecond never occurs, so the check never
 * fires and no runtime probe is needed.
 */

const NANOSECONDS_PER_MILLISECOND = 1_000_000n;
// The Instant range in nanoseconds: the Temporal spec's nsMaxInstant, 8.64e15 ms either side of
// the epoch.
const INSTANT_LIMIT = 8_640_000_000_000_000n * NANOSECONDS_PER_MILLISECOND;

/**
 * The epoch nanoseconds one millisecond later (clamped to the Instant range) when a reading lies in
 * the millisecond before `dateNow`, else `undefined`.
 */
function corrected(
  epochMilliseconds: number,
  epochNanoseconds: bigint,
  dateNow: number,
): bigint | undefined {
  if (epochMilliseconds !== dateNow - 1) return undefined;
  const later = epochNanoseconds + NANOSECONDS_PER_MILLISECOND;
  return later > INSTANT_LIMIT ? INSTANT_LIMIT : later;
}

/**
 * `Temporal.Now.instant()`, never earlier than a `Date.now()` read just before it.
 *
 * @returns the current instant
 * @throws whatever `Temporal.Now.instant` throws
 */
export function nowInstant(): Temporal.Instant {
  // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- D21 guard compares the polyfill's reading with Date.now()
  const dateNow = Date.now(); // date-ban: D21 guard compares the polyfill's reading with Date.now()
  const instant = Temporal.Now.instant();
  const later = corrected(
    instant.epochMilliseconds,
    instant.epochNanoseconds,
    dateNow,
  );
  return later === undefined
    ? instant
    : Temporal.Instant.fromEpochNanoseconds(later);
}

/**
 * `Temporal.Now.zonedDateTimeISO(timeZone)`, never earlier than a `Date.now()` read just before it.
 * A bad zone argument throws the polyfill's own error.
 *
 * @param timeZone a time zone identifier; omitted for the system zone
 * @returns the current date and time in the zone
 * @throws whatever `Temporal.Now.zonedDateTimeISO` throws
 */
export function nowZonedDateTimeISO(timeZone?: string): Temporal.ZonedDateTime {
  // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- D21 guard compares the polyfill's reading with Date.now()
  const dateNow = Date.now(); // date-ban: D21 guard compares the polyfill's reading with Date.now()
  const zoned = Temporal.Now.zonedDateTimeISO(timeZone);
  const later = corrected(
    zoned.epochMilliseconds,
    zoned.epochNanoseconds,
    dateNow,
  );
  return later === undefined
    ? zoned
    : new Temporal.ZonedDateTime(later, zoned.timeZoneId);
}

/**
 * The current date and time in the zone as a `PlainDateTime`, read from {@link nowZonedDateTimeISO}.
 *
 * @param timeZone a time zone identifier; omitted for the system zone
 * @returns the current wall-clock date and time
 * @throws whatever `Temporal.Now.zonedDateTimeISO` throws
 */
export function nowPlainDateTimeISO(timeZone?: string): Temporal.PlainDateTime {
  return nowZonedDateTimeISO(timeZone).toPlainDateTime();
}

/**
 * The current date in the zone as a `PlainDate`, read from {@link nowZonedDateTimeISO}.
 *
 * @param timeZone a time zone identifier; omitted for the system zone
 * @returns the current date
 * @throws whatever `Temporal.Now.zonedDateTimeISO` throws
 */
export function nowPlainDateISO(timeZone?: string): Temporal.PlainDate {
  return nowZonedDateTimeISO(timeZone).toPlainDate();
}

/**
 * The current time in the zone as a `PlainTime`, read from {@link nowZonedDateTimeISO}.
 *
 * @param timeZone a time zone identifier; omitted for the system zone
 * @returns the current wall-clock time
 * @throws whatever `Temporal.Now.zonedDateTimeISO` throws
 */
export function nowPlainTimeISO(timeZone?: string): Temporal.PlainTime {
  return nowZonedDateTimeISO(timeZone).toPlainTime();
}
