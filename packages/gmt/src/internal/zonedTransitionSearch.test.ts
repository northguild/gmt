import { Temporal } from "@js-temporal/polyfill";
import { TRANSITION_SEARCH_STEP_NANOSECONDS } from "./zonedTransitionSearch";
import {
  zonedNextTransition,
  zonedPreviousTransition,
} from "./zonedWallClockOperations";

const epochOf = (instant: string): bigint =>
  Temporal.Instant.from(instant).epochNanoseconds;

const at = (instant: string, timeZone: string): Temporal.ZonedDateTime =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);

const instantOf = (zoned: Temporal.ZonedDateTime | null): string | null =>
  zoned === null ? null : zoned.toInstant().toString();

/**
 * Expected values: Node 26.10.0's native Temporal and `zdump -v` (tz 2026c), TC39
 * `GetNamedTimeZoneNextTransition` / `GetNamedTimeZonePreviousTransition`. Every row is settled
 * history, the same in tz 2025c.
 */
describe("zonedNextTransition (temporalCompat D13)", () => {
  // America/Boa_Vista: -04→-03 2000-10-08T04:00Z, -03→-04 2000-10-15T03:00Z (601,200 s apart,
  // the closest pair in the tz database), and no change since.
  it.each`
    from                                | expected
    ${"2000-07-01T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-07-02T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-01T12:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-07T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T03:59:59Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T03:59:59.999999999Z"} | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T04:00:00Z"}           | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T02:59:59.999999999Z"} | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T03:00:00Z"}           | ${null}
  `(
    "finds $expected after $from in America/Boa_Vista",
    ({ from, expected }) => {
      expect(
        instantOf(zonedNextTransition(at(from, "America/Boa_Vista"))),
      ).toBe(expected);
    },
    10_000,
  );

  // Three offsets inside 14 days, where the polyfill's own search never returns.
  it.each`
    timeZone               | from                      | expected
    ${"Europe/Riga"}       | ${"1944-04-15T12:00:00Z"} | ${"1944-10-02T01:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-09-25T00:00:00Z"} | ${"1944-10-02T01:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-02T01:00:00Z"} | ${"1944-10-12T23:00:00Z"}
    ${"Europe/Simferopol"} | ${"1943-10-15T12:00:00Z"} | ${"1944-04-03T01:00:00Z"}
    ${"Europe/Simferopol"} | ${"1944-04-03T01:00:00Z"} | ${"1944-04-12T22:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-03-28T00:30:00Z"} | ${"1976-04-14T01:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-04-14T00:30:00Z"} | ${"1976-04-14T01:00:00Z"}
    ${"Africa/El_Aaiun"}   | ${"1976-04-14T01:00:00Z"} | ${"1976-05-01T00:00:00Z"}
  `(
    "finds $expected after $from in $timeZone",
    ({ timeZone, from, expected }) => {
      expect(instantOf(zonedNextTransition(at(from, timeZone)))).toBe(expected);
    },
    10_000,
  );

  it.each`
    timeZone              | from                      | expected
    ${"Asia/Tokyo"}       | ${"1960-01-01T00:00:00Z"} | ${null}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T07:00:00Z"}
    ${"UTC"}              | ${"2000-01-01T00:00:00Z"} | ${null}
    ${"+05:00"}           | ${"2000-01-01T00:00:00Z"} | ${null}
  `(
    "finds $expected after $from in $timeZone",
    ({ timeZone, from, expected }) => {
      expect(instantOf(zonedNextTransition(at(from, timeZone)))).toBe(expected);
    },
    10_000,
  );

  it.each`
    until                               | expected
    ${"2000-10-08T04:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
    ${"2000-10-08T03:59:59.999999999Z"} | ${null}
    ${"2000-10-02T00:00:00Z"}           | ${null}
    ${"2001-10-01T00:00:00Z"}           | ${"2000-10-08T04:00:00Z"}
  `(
    "finds $expected after 2000-10-01T12:00:00Z in America/Boa_Vista when the search ends at $until",
    ({ until, expected }) => {
      expect(
        instantOf(
          zonedNextTransition(
            at("2000-10-01T12:00:00Z", "America/Boa_Vista"),
            epochOf(until),
          ),
        ),
      ).toBe(expected);
    },
  );
});

// Asia/Tokyo's last change is 1951-09-08T15:00:00Z. A limit thousands of years away does not
// lengthen the search: nothing within three 366-day years of the later of the start and now means
// no further change, with or without a limit. America/New_York's rules repeat, so a limit at the
// very change (3000-03-09T07:00:00Z) still finds it, and one nanosecond less does not.
describe("a limited search and the no-further-change horizon (temporalCompat D13)", () => {
  it.each`
    timeZone              | from                      | until                               | expected
    ${"Asia/Tokyo"}       | ${"2000-01-01T00:00:00Z"} | ${"6000-01-01T00:00:00Z"}           | ${null}
    ${"Asia/Tokyo"}       | ${"2000-01-01T00:00:00Z"} | ${"+275760-09-13T00:00:00Z"}        | ${null}
    ${"America/Phoenix"}  | ${"1970-01-01T00:00:00Z"} | ${"5000-01-01T00:00:00Z"}           | ${null}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T07:00:00Z"}           | ${"3000-03-09T07:00:00Z"}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"3000-03-09T06:59:59.999999999Z"} | ${null}
    ${"America/New_York"} | ${"3000-01-01T00:00:00Z"} | ${"6000-01-01T00:00:00Z"}           | ${"3000-03-09T07:00:00Z"}
  `(
    "finds $expected after $from in $timeZone when the search ends at $until",
    ({ timeZone, from, until, expected }) => {
      expect(
        instantOf(zonedNextTransition(at(from, timeZone), epochOf(until))),
      ).toBe(expected);
    },
    10_000,
  );

  it.each`
    timeZone              | from                         | since                        | expected
    ${"Asia/Tokyo"}       | ${"6000-01-01T00:00:00Z"}    | ${"2000-01-01T00:00:00Z"}    | ${null}
    ${"Asia/Tokyo"}       | ${"6000-01-01T00:00:00Z"}    | ${"1900-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}
    ${"Asia/Tokyo"}       | ${"6000-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}    | ${null}
    ${"Asia/Tokyo"}       | ${"+275760-09-13T00:00:00Z"} | ${"-271821-04-20T00:00:00Z"} | ${"1951-09-08T15:00:00Z"}
    ${"America/New_York"} | ${"3000-06-01T00:00:00Z"}    | ${"2000-01-01T00:00:00Z"}    | ${"3000-03-09T07:00:00Z"}
    ${"America/New_York"} | ${"3000-06-01T00:00:00Z"}    | ${"3000-03-09T07:00:00Z"}    | ${null}
  `(
    "finds $expected before $from in $timeZone when the search stops after $since",
    ({ timeZone, from, since, expected }) => {
      expect(
        instantOf(zonedPreviousTransition(at(from, timeZone), epochOf(since))),
      ).toBe(expected);
    },
    10_000,
  );
});

describe("zonedPreviousTransition (temporalCompat D13)", () => {
  it.each`
    timeZone               | from                         | expected
    ${"America/Boa_Vista"} | ${"2001-06-01T00:00:00Z"}    | ${"2000-10-15T03:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-20T12:00:00Z"}    | ${"2000-10-15T03:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-15T03:00:00Z"}    | ${"2000-10-08T04:00:00Z"}
    ${"America/Boa_Vista"} | ${"2000-10-08T04:00:00Z"}    | ${"2000-02-27T03:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-20T12:00:00Z"}    | ${"1944-10-12T23:00:00Z"}
    ${"Europe/Riga"}       | ${"1944-10-12T23:00:00Z"}    | ${"1944-10-02T01:00:00Z"}
    ${"Europe/Simferopol"} | ${"1944-04-20T12:00:00Z"}    | ${"1944-04-12T22:00:00Z"}
    ${"Europe/Simferopol"} | ${"1944-04-12T22:00:00Z"}    | ${"1944-04-03T01:00:00Z"}
    ${"Asia/Tokyo"}        | ${"2024-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}
    ${"Asia/Tokyo"}        | ${"3000-01-01T00:00:00Z"}    | ${"1951-09-08T15:00:00Z"}
    ${"America/New_York"}  | ${"+275760-09-13T00:00:00Z"} | ${"+275760-03-09T07:00:00Z"}
    ${"UTC"}               | ${"2000-01-01T00:00:00Z"}    | ${null}
  `(
    "finds $expected before $from in $timeZone",
    ({ timeZone, from, expected }) => {
      expect(instantOf(zonedPreviousTransition(at(from, timeZone)))).toBe(
        expected,
      );
    },
    10_000,
  );

  it.each`
    since                               | expected
    ${"2000-10-01T00:00:00Z"}           | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T02:59:59.999999999Z"} | ${"2000-10-15T03:00:00Z"}
    ${"2000-10-15T03:00:00Z"}           | ${null}
    ${"2000-10-18T00:00:00Z"}           | ${null}
  `(
    "finds $expected before 2000-10-20T12:00:00Z in America/Boa_Vista when the search stops after $since",
    ({ since, expected }) => {
      expect(
        instantOf(
          zonedPreviousTransition(
            at("2000-10-20T12:00:00Z", "America/Boa_Vista"),
            epochOf(since),
          ),
        ),
      ).toBe(expected);
    },
  );
});

/**
 * The sampling assumption behind the search step, read from the runtime's own data through
 * `Intl.DateTimeFormat`, not through Temporal or GMT: every zone's offset is sampled every 2.5 days
 * from 1847 to 2100 and each change pinned to the second. Two changes of one zone 2.5 days or more
 * apart are both seen, so a pair closer than the step plus a day fails here. A pair under 2.5 days
 * apart could pass unseen; `zdump -v` shows none in tz 2026c (minimum 601,200 s).
 */
describe("the tz database's closest pair of offset changes", () => {
  const SECOND = 1_000;
  const DAY = 86_400 * SECOND;
  const GUARD_STEP = 2.5 * DAY;
  const SEARCH_STEP_SECONDS = Number(
    TRANSITION_SEARCH_STEP_NANOSECONDS / 1_000_000_000n,
  );
  const MARGIN_SECONDS = 86_400;

  /**
   * A proleptic Gregorian wall clock as milliseconds since 1970-01-01T00:00, by the days-from-civil
   * count (months from March, 146,097 days per 400 years).
   */
  function wallClockMilliseconds(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): number {
    const marchYear = month <= 2 ? year - 1 : year;
    const era = Math.floor(marchYear / 400);
    const yearOfEra = marchYear - era * 400;
    const dayOfYear =
      Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
    const dayOfEra =
      yearOfEra * 365 +
      Math.floor(yearOfEra / 4) -
      Math.floor(yearOfEra / 100) +
      dayOfYear;
    const days = era * 146_097 + dayOfEra - 719_468;

    return ((days * 24 + hour) * 60 + minute) * 60_000 + second * SECOND;
  }

  function offsetReader(timeZone: string): (epochMs: number) => number {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      era: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    return (epochMs) => {
      const [month, day, year, era, hour, minute, second] = formatter
        .format(epochMs)
        .split(/[^\w]+/);
      const isoYear = era.startsWith("B") ? 1 - Number(year) : Number(year);
      return (
        wallClockMilliseconds(
          isoYear,
          Number(month),
          Number(day),
          Number(hour) % 24,
          Number(minute),
          Number(second),
        ) - epochMs
      );
    };
  }

  /** The smallest gap, in seconds, between two consecutive offset changes of one zone. */
  function closestPair(): { seconds: number; where: string } {
    const from = Number(epochOf("1847-01-01T00:00:00Z") / 1_000_000n);
    const to = Number(epochOf("2100-01-01T00:00:00Z") / 1_000_000n);
    let closest = { seconds: Number.POSITIVE_INFINITY, where: "" };

    for (const timeZone of Intl.supportedValuesOf("timeZone")) {
      const offsetAt = offsetReader(timeZone);
      let offset = offsetAt(from);
      let lastChange = Number.NEGATIVE_INFINITY;

      for (let sample = from + GUARD_STEP; sample <= to; sample += GUARD_STEP) {
        const sampled = offsetAt(sample);
        if (sampled === offset) continue;

        let before = sample - GUARD_STEP;
        let after = sample;
        while (after - before > SECOND) {
          const middle = Math.floor((before + after) / (2 * SECOND)) * SECOND;
          if (offsetAt(middle) === offset) before = middle;
          else after = middle;
        }

        const seconds = (after - lastChange) / SECOND;
        if (seconds < closest.seconds) {
          closest = {
            seconds,
            where: `${timeZone} ${Temporal.Instant.fromEpochMilliseconds(after).toString()}`,
          };
        }
        lastChange = after;
        offset = sampled;
      }
    }

    return closest;
  }

  it("is a 5-day step: 432,000 s", () => {
    expect(SEARCH_STEP_SECONDS).toBe(432_000);
  });

  it("is more than the search step plus a day apart, in every zone the runtime knows", () => {
    const closest = closestPair();

    expect(
      closest.seconds,
      `closest pair: ${closest.where}, ${closest.seconds} s apart`,
    ).toBeGreaterThanOrEqual(SEARCH_STEP_SECONDS + MARGIN_SECONDS);
    // The reader measures something: it finds the pair zdump gives as the closest (America/
    // Boa_Vista, Noronha and Recife, 2000), so an empty reading cannot pass.
    // A tz release that changes the closest pair needs a conscious edit here and to the step.
    expect(closest.seconds).toBe(601_200);
  }, 180_000);
});
