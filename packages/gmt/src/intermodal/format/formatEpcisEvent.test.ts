import { Temporal } from "@js-temporal/polyfill";
import { toOffsetInstant } from "../../instant/convert/toOffsetInstant";
import { epcisEventTime, epcisTimeZoneOffset } from "../../regex";
import { sameInstantBattleCases, unixEpochBattleCases } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import type { EpcisEventTime } from "../../types";
import { parseEpcisEvent } from "../parse/parseEpcisEvent";
import { formatEpcisEvent } from "./formatEpcisEvent";

// GS1 EPCIS 2.0 (ISO/IEC 19987). `eventTime` is the instant written in UTC, which is what
// `Temporal.Instant.prototype.toString` writes; `eventTimeZoneOffset` is the pair's offset.
// Every non-null result is also checked against the two patterns GS1 publishes.

/** Assert `result` equals `expected` and that both fields match their GS1 pattern. */
function expectEpcisEventTime(
  result: EpcisEventTime | null,
  expected: EpcisEventTime,
): void {
  expect(result).toEqual(expected);
  expect(epcisEventTime.test((result as EpcisEventTime).eventTime)).toBe(true);
  expect(
    epcisTimeZoneOffset.test((result as EpcisEventTime).eventTimeZoneOffset),
  ).toBe(true);
}

/** 14:30Z on 15 June 2024, where the local clock ran five hours behind UTC. */
const instant = "2024-06-15T14:30:00Z";
const offset = "-05:00";

/** A pair whose `instant` cannot be read at all. */
const throwingGetter = {
  get instant(): string {
    throw new Error("hostile getter");
  },
  offset,
};

/** A pair whose `offset` cannot be read at all. */
const throwingOffsetGetter = {
  instant,
  get offset(): string {
    throw new Error("hostile getter");
  },
};

/** A pair whose `timeZone` throws when read, to show that it never is. */
const unreadableTimeZone = {
  instant,
  offset,
  get timeZone(): string {
    throw new Error("timeZone was read");
  },
};

/**
 * Every kind of offset the GS1 pattern admits, in the spelling `parseEpcisEvent` returns: both
 * ends of the range (the pattern's sign is independent of its `14:00` alternative, so `-14:00`
 * is one), the minute inside each end, whole, half and quarter hours, and zero. `-00:00` is
 * left out: it is the one value written back differently, and has rows of its own.
 */
const gs1Offsets = [
  "-14:00",
  "-13:59",
  "-12:00",
  "-05:00",
  "-03:30",
  "+00:00",
  "+05:30",
  "+05:45",
  "+12:45",
  "+13:00",
  "+13:59",
  "+14:00",
];

/**
 * `eventTime` values already in the form `formatEpcisEvent` writes: `Z`, and a fraction with no
 * trailing zero. They sit at a mid-year afternoon, the leap day, the last nanosecond of a year,
 * the first millisecond of one, and the Unix epoch, so each offset carries some of them across
 * a day, month or year boundary.
 */
const canonicalEventTimes = [
  "2024-06-15T14:30:00Z",
  "2024-02-29T12:00:00Z",
  "2024-12-31T23:59:59.999999999Z",
  "2024-01-01T00:00:00.001Z",
  "1970-01-01T00:00:00Z",
];

/**
 * Every canonical `eventTime` at every offset, with the local wall clock plain Temporal gives for
 * it: the instant read in the offset used as a time zone.
 */
const roundTripCases = canonicalEventTimes.flatMap((eventTime) =>
  gs1Offsets.map((eventTimeZoneOffset) => ({
    eventTime,
    eventTimeZoneOffset,
    local: Temporal.Instant.from(eventTime)
      .toZonedDateTimeISO(eventTimeZoneOffset)
      .toPlainDateTime()
      .toString(),
  })),
);

/**
 * One instant as every battle-test zone saw it, as the pair a zoned system would hand over: the
 * zoned string, the zone's offset then, and the zone. Offset and wall clock come from plain
 * `Temporal.ZonedDateTime.from`.
 */
const battlePairs = [...sameInstantBattleCases, ...unixEpochBattleCases].map(
  ({ timeZone, value, utc }) => {
    const zoned = Temporal.ZonedDateTime.from(value);

    return {
      timeZone,
      value,
      utc,
      offset: zoned.offset,
      local: zoned.toPlainDateTime().toString(),
    };
  },
);

describe("formatEpcisEvent", () => {
  it.each`
    instant                        | offset      | eventTime                 | reads
    ${"2024-06-15T14:30:00Z"}      | ${"-05:00"} | ${"2024-06-15T14:30:00Z"} | ${"a Z instant is written as it is"}
    ${"2024-06-15T14:30:00Z"}      | ${"+02:00"} | ${"2024-06-15T14:30:00Z"} | ${"the offset does not move the instant"}
    ${"2024-06-15T09:30:00-05:00"} | ${"-05:00"} | ${"2024-06-15T14:30:00Z"} | ${"09:30 at -05:00 is 14:30Z"}
    ${"2024-06-15T10:00:00+02:00"} | ${"-05:00"} | ${"2024-06-15T08:00:00Z"} | ${"the instant's own offset need not be the pair's"}
    ${"2024-06-15T23:30:00-05:00"} | ${"-05:00"} | ${"2024-06-16T04:30:00Z"} | ${"the UTC date is the next day"}
  `(
    "writes $instant at $offset as eventTime $eventTime ($reads)",
    ({ instant, offset, eventTime }) => {
      expectEpcisEventTime(formatEpcisEvent({ instant, offset }), {
        eventTime,
        eventTimeZoneOffset: offset,
      });
    },
  );

  it.each(gs1Offsets)(
    "writes the offset %s unchanged as eventTimeZoneOffset",
    (gs1Offset) => {
      expectEpcisEventTime(formatEpcisEvent({ instant, offset: gs1Offset }), {
        eventTime: instant,
        eventTimeZoneOffset: gs1Offset,
      });
    },
  );

  // `Temporal.Instant.prototype.toString` always writes seconds, and writes a fraction to the
  // last non-zero digit: the value is kept and padding is not.
  it.each`
    instant                             | eventTime                           | reads
    ${"2024-06-15T14:30:00.1Z"}         | ${"2024-06-15T14:30:00.1Z"}         | ${"1 digit"}
    ${"2024-06-15T14:30:00.12Z"}        | ${"2024-06-15T14:30:00.12Z"}        | ${"2 digits"}
    ${"2024-06-15T14:30:00.123Z"}       | ${"2024-06-15T14:30:00.123Z"}       | ${"3 digits"}
    ${"2024-06-15T14:30:00.1234Z"}      | ${"2024-06-15T14:30:00.1234Z"}      | ${"4 digits"}
    ${"2024-06-15T14:30:00.12345Z"}     | ${"2024-06-15T14:30:00.12345Z"}     | ${"5 digits"}
    ${"2024-06-15T14:30:00.123456Z"}    | ${"2024-06-15T14:30:00.123456Z"}    | ${"6 digits"}
    ${"2024-06-15T14:30:00.1234567Z"}   | ${"2024-06-15T14:30:00.1234567Z"}   | ${"7 digits"}
    ${"2024-06-15T14:30:00.12345678Z"}  | ${"2024-06-15T14:30:00.12345678Z"}  | ${"8 digits"}
    ${"2024-06-15T14:30:00.123456789Z"} | ${"2024-06-15T14:30:00.123456789Z"} | ${"9 digits"}
    ${"2024-06-15T14:30:00.000000001Z"} | ${"2024-06-15T14:30:00.000000001Z"} | ${"one nanosecond"}
    ${"2024-06-15T14:30:00.100Z"}       | ${"2024-06-15T14:30:00.1Z"}         | ${"trailing zeros are not written"}
    ${"2024-06-15T14:30:00.120000000Z"} | ${"2024-06-15T14:30:00.12Z"}        | ${"seven trailing zeros are not written"}
    ${"2024-06-15T14:30:00.000Z"}       | ${"2024-06-15T14:30:00Z"}           | ${"a zero fraction is not written"}
    ${"2024-06-15T14:30:00,5Z"}         | ${"2024-06-15T14:30:00.5Z"}         | ${"an ISO 8601 comma is written as a period"}
    ${"2024-06-15T16:30:00.5+02:00"}    | ${"2024-06-15T14:30:00.5Z"}         | ${"a fraction on an instant with an offset"}
    ${"2024-06-15T14:30Z"}              | ${"2024-06-15T14:30:00Z"}           | ${"seconds are written when the instant omits them"}
  `(
    "writes the instant $instant as eventTime $eventTime ($reads)",
    ({ instant, eventTime }) => {
      expectEpcisEventTime(formatEpcisEvent({ instant, offset }), {
        eventTime,
        eventTimeZoneOffset: offset,
      });
    },
  );

  // The four-digit year range is the UTC year's. Digits outside it are fine when the instant
  // they name is inside: 01:30 on the first day of year 10000 at +02:00 is 23:30Z the day before.
  it.each`
    instant                             | eventTime                           | reads
    ${"0000-01-01T00:00:00Z"}           | ${"0000-01-01T00:00:00Z"}           | ${"the first instant of year 0000"}
    ${"9999-12-31T23:59:59.999999999Z"} | ${"9999-12-31T23:59:59.999999999Z"} | ${"the last nanosecond of year 9999"}
    ${"+010000-01-01T01:30:00+02:00"}   | ${"9999-12-31T23:30:00Z"}           | ${"local digits in year 10000, instant in 9999"}
    ${"-000001-12-31T19:00:00-05:00"}   | ${"0000-01-01T00:00:00Z"}           | ${"local digits in year -1, instant in 0000"}
  `(
    "writes $instant as eventTime $eventTime ($reads)",
    ({ instant, eventTime }) => {
      expectEpcisEventTime(formatEpcisEvent({ instant, offset }), {
        eventTime,
        eventTimeZoneOffset: offset,
      });
    },
  );

  // Only the instant is read from `instant`: annotations are read as `isValidInstant` reads
  // them, and a bracketed zone resolves an offset rounded to the minute and is otherwise not
  // checked. Africa/Monrovia stood at -00:44:30 in 1960 (written `-00:45`), and America/New_York
  // at -04:56:02 until noon on 18 November 1883 (written `-04:56`).
  it.each`
    instant                                          | eventTime                 | reads
    ${"2024-06-15T10:30:00-04:00[America/New_York]"} | ${"2024-06-15T14:30:00Z"} | ${"a zoned string"}
    ${"2024-06-15T14:30:00Z[u-ca=hebrew]"}           | ${"2024-06-15T14:30:00Z"} | ${"a calendar annotation: an instant has none"}
    ${"2024-06-15T14:30:00Z[foo=bar]"}               | ${"2024-06-15T14:30:00Z"} | ${"an elective unknown annotation"}
    ${"2024-06-15T14:30:00Z[Not/AZone]"}             | ${"2024-06-15T14:30:00Z"} | ${"a bracketed zone that does not exist"}
    ${"1960-01-01T00:20:00-00:45[Africa/Monrovia]"}  | ${"1960-01-01T01:04:30Z"} | ${"a minute-rounded offset, read as the zone's -00:44:30"}
    ${"1883-11-18T09:00:00-04:56[America/New_York]"} | ${"1883-11-18T13:56:02Z"} | ${"a minute-rounded offset, read as the zone's -04:56:02"}
  `(
    "reads $instant as its instant and writes $eventTime ($reads)",
    ({ instant, eventTime }) => {
      expectEpcisEventTime(formatEpcisEvent({ instant, offset: "+00:00" }), {
        eventTime,
        eventTimeZoneOffset: "+00:00",
      });
    },
  );

  // EPCIS has no field for a zone, so `timeZone` is not read: not validated, not checked against
  // the offset (New York is at -04:00 in June, not -05:00), and not written.
  it.each`
    make                                                         | kind
    ${() => ({ instant, offset, timeZone: "America/Chicago" })}  | ${"the zone the offset belongs to"}
    ${() => ({ instant, offset, timeZone: "America/New_York" })} | ${"a zone that is not at that offset then"}
    ${() => ({ instant, offset, timeZone: "Not/AZone" })}        | ${"a zone that does not exist"}
    ${() => ({ instant, offset, timeZone: null })}               | ${"null"}
    ${() => unreadableTimeZone}                                  | ${"a getter that throws when read"}
    ${() => ({ instant, offset, local: "2024-06-15T09:30:00" })} | ${"absent, on a parseEpcisEvent result"}
  `("ignores a timeZone that is $kind", ({ make }) => {
    expectEpcisEventTime(formatEpcisEvent(make() as never), {
      eventTime: instant,
      eventTimeZoneOffset: offset,
    });
  });

  // A function is an Object (ECMA-262 §6.1.7), so one carrying the pair is read as the pair.
  it("reads a function carrying the pair as the record it is", () => {
    expectEpcisEventTime(
      formatEpcisEvent(Object.assign(() => undefined, { instant, offset })),
      { eventTime: instant, eventTimeZoneOffset: offset },
    );
  });

  // RFC 9557 §2.2 reads `-00:00` as "UTC known, local offset unknown". The GS1 pattern admits
  // it; it is written as `+00:00`, the one spelling `parseEpcisEvent` returns.
  it("writes an offset of -00:00 as +00:00, as parseEpcisEvent reads it", () => {
    expectEpcisEventTime(formatEpcisEvent({ instant, offset: "-00:00" }), {
      eventTime: instant,
      eventTimeZoneOffset: "+00:00",
    });
  });

  // `eventTimeZoneOffset` has a grammar of its own, narrower than the offsets a pair can hold:
  // minutes only, and no further than 14:00. `fromOffsetInstant` accepts several of these.
  it.each`
    offset         | reads
    ${"+14:01"}    | ${"one minute past the range GS1 allows"}
    ${"-14:01"}    | ${"one minute past the range, west"}
    ${"+14:30"}    | ${"past 14:00"}
    ${"-14:30"}    | ${"past 14:00, west"}
    ${"+15:00"}    | ${"hour 15"}
    ${"-15:00"}    | ${"hour 15, west"}
    ${"+23:59"}    | ${"the largest offset utcOffset accepts"}
    ${"+05:30:00"} | ${"seconds, though they are zero"}
    ${"-00:44:30"} | ${"a sub-minute offset: Africa/Monrovia before 1972"}
    ${"Z"}         | ${"Z is eventTime's designator, not an offset"}
    ${"+0200"}     | ${"no colon"}
    ${"+02"}       | ${"hours only"}
    ${"02:00"}     | ${"no sign"}
    ${"+02:00 "}   | ${"trailing whitespace"}
    ${"UTC"}       | ${"a zone name"}
    ${""}          | ${"an empty string"}
    ${undefined}   | ${"missing"}
    ${null}        | ${"null"}
    ${-300}        | ${"a number of minutes"}
    ${["-05:00"]}  | ${"an array holding the offset: nothing is coerced to a string"}
  `("returns null when offset is $offset ($reads)", ({ offset }) => {
    expect(formatEpcisEvent({ instant, offset: offset as never })).toBeNull();
  });

  // `instant` is any string `isValidInstant` accepts, and nothing else.
  it.each`
    value                                         | reads
    ${"2024-06-15T14:30:00"}                      | ${"no Z and no offset: not an instant"}
    ${"2024-06-15"}                               | ${"a date"}
    ${"2024-06-15 14:30:00Z"}                     | ${"a space separator"}
    ${"2024-06-15T14:30:00z"}                     | ${"lower-case z"}
    ${"20240615T143000Z"}                         | ${"basic format"}
    ${"2016-12-31T23:59:60Z"}                     | ${"a leap second, which Temporal does not represent"}
    ${"2024-02-30T14:30:00Z"}                     | ${"a day that does not exist"}
    ${"2024-06-15T14:30:00.1234567891Z"}          | ${"a fraction finer than a nanosecond"}
    ${"2024-06-15T14:30:00Z[!foo=bar]"}           | ${"a critical unknown annotation"}
    ${"not an instant"}                           | ${"garbage"}
    ${""}                                         | ${"an empty string"}
    ${undefined}                                  | ${"missing"}
    ${null}                                       | ${"null"}
    ${1718461800000}                              | ${"epoch milliseconds"}
    ${{ toString: () => "2024-06-15T14:30:00Z" }} | ${"an object that stringifies to an instant: nothing is coerced"}
  `("returns null when instant is $value ($reads)", ({ value }) => {
    expect(formatEpcisEvent({ instant: value as never, offset })).toBeNull();
  });

  // `eventTime` has a four-digit year, so an instant whose UTC year is outside 0000–9999 cannot
  // be written. It is the UTC year that counts, not the year in the digits of `instant`.
  it.each`
    value                          | reads
    ${"-000001-12-31T23:59:59Z"}   | ${"one second before year 0000"}
    ${"+010000-01-01T00:00:00Z"}   | ${"the first instant of year 10000"}
    ${"0000-01-01T00:00:00+05:00"} | ${"19:00Z on the last day of year -1"}
    ${"9999-12-31T23:59:59-14:00"} | ${"13:59:59Z on the first day of year 10000"}
    ${"-271821-04-20T00:00:00Z"}   | ${"the first instant Temporal represents"}
    ${"+275760-09-13T00:00:00Z"}   | ${"the last instant Temporal represents"}
  `(
    "returns null for $value, whose UTC year has no four-digit spelling ($reads)",
    ({ value }) => {
      expect(formatEpcisEvent({ instant: value, offset })).toBeNull();
    },
  );

  it.each`
    make                                 | kind
    ${() => null}                        | ${"null"}
    ${() => undefined}                   | ${"undefined"}
    ${() => "2024-06-15T14:30:00-05:00"} | ${"a string: the instant alone"}
    ${() => 1718461800000}               | ${"a number"}
    ${() => true}                        | ${"a boolean"}
    ${() => []}                          | ${"an empty array"}
    ${() => [instant, offset]}           | ${"an array of the two values"}
    ${() => ({})}                        | ${"an empty object"}
    ${() => () => undefined}             | ${"a function with neither member"}
    ${() => hostileProxy()}              | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()}              | ${"a revoked Proxy"}
    ${() => throwingGetter}              | ${"an object whose instant getter throws"}
    ${() => throwingOffsetGetter}        | ${"an object whose offset getter throws"}
  `("returns null for a value that is $kind", ({ make }) => {
    expect(formatEpcisEvent(make() as never)).toBeNull();
  });

  it("returns null when Temporal.Instant.fromEpochNanoseconds throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(formatEpcisEvent({ instant, offset })).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(formatEpcisEvent({ instant, offset })).toBeNull();
  });
});

describe("formatEpcisEvent and parseEpcisEvent round-trip", () => {
  it.each(roundTripCases)(
    "formatEpcisEvent(parseEpcisEvent(event)) returns the event for $eventTime at $eventTimeZoneOffset",
    ({ eventTime, eventTimeZoneOffset }) => {
      const event = { eventTime, eventTimeZoneOffset };
      expectEpcisEventTime(
        formatEpcisEvent(parseEpcisEvent(event) as never),
        event,
      );
    },
  );

  it.each(roundTripCases)(
    "parseEpcisEvent(formatEpcisEvent(pair)) keeps the instant $eventTime and the offset $eventTimeZoneOffset, local $local",
    ({ eventTime, eventTimeZoneOffset, local }) => {
      const pair = { instant: eventTime, offset: eventTimeZoneOffset };
      expect(parseEpcisEvent(formatEpcisEvent(pair) as never)).toEqual({
        ...pair,
        local,
      });
    },
  );

  // An `eventTime` written with an offset names the same instant as its `Z` form, and `Z` is the
  // form written back. `eventTimeZoneOffset` is kept whether or not it was that offset.
  it.each`
    eventTime                        | eventTimeZoneOffset | written
    ${"2024-06-15T10:00:00+02:00"}   | ${"+02:00"}         | ${"2024-06-15T08:00:00Z"}
    ${"2024-06-15T10:00:00+02:00"}   | ${"-05:00"}         | ${"2024-06-15T08:00:00Z"}
    ${"2024-06-15T23:30:00-05:00"}   | ${"-05:00"}         | ${"2024-06-16T04:30:00Z"}
    ${"2024-06-15T16:30:00.5+02:00"} | ${"+05:45"}         | ${"2024-06-15T14:30:00.5Z"}
    ${"2024-06-15T14:30:00+00:00"}   | ${"+00:00"}         | ${"2024-06-15T14:30:00Z"}
    ${"2024-06-16T02:00:00+14:00"}   | ${"-14:00"}         | ${"2024-06-15T12:00:00Z"}
  `(
    "writes the event $eventTime at $eventTimeZoneOffset back with eventTime $written",
    ({ eventTime, eventTimeZoneOffset, written }) => {
      expectEpcisEventTime(
        formatEpcisEvent(
          parseEpcisEvent({ eventTime, eventTimeZoneOffset }) as never,
        ),
        { eventTime: written, eventTimeZoneOffset },
      );
    },
  );

  // The three spellings that are not written back as they were read: the value is the same.
  it.each`
    eventTime                     | eventTimeZoneOffset | expected                                                                  | reads
    ${"2024-06-15T14:30:00Z"}     | ${"-00:00"}         | ${{ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "+00:00" }}   | ${"-00:00 is written +00:00"}
    ${"2024-06-15T14:30:00.100Z"} | ${"-05:00"}         | ${{ eventTime: "2024-06-15T14:30:00.1Z", eventTimeZoneOffset: "-05:00" }} | ${"trailing zeros are dropped"}
    ${"2024-06-15T14:30:00.000Z"} | ${"-05:00"}         | ${{ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" }}   | ${"a zero fraction is dropped"}
  `(
    "writes the event $eventTime at $eventTimeZoneOffset back as $expected ($reads)",
    ({ eventTime, eventTimeZoneOffset, expected }) => {
      expectEpcisEventTime(
        formatEpcisEvent(
          parseEpcisEvent({ eventTime, eventTimeZoneOffset }) as never,
        ),
        expected,
      );
    },
  );

  // A pair whose instant is written with an offset comes back with the instant in `Z` form.
  it.each`
    instant                        | offset      | utc                       | local
    ${"2024-06-15T09:30:00-05:00"} | ${"-05:00"} | ${"2024-06-15T14:30:00Z"} | ${"2024-06-15T09:30:00"}
    ${"2024-06-15T10:00:00+02:00"} | ${"-05:00"} | ${"2024-06-15T08:00:00Z"} | ${"2024-06-15T03:00:00"}
    ${"2024-06-15T23:30:00-05:00"} | ${"-03:30"} | ${"2024-06-16T04:30:00Z"} | ${"2024-06-16T01:00:00"}
  `(
    "parseEpcisEvent(formatEpcisEvent(pair)) reads $instant at $offset back as $utc, local $local",
    ({ instant, offset, utc, local }) => {
      expect(
        parseEpcisEvent(formatEpcisEvent({ instant, offset }) as never),
      ).toEqual({ instant: utc, offset, local });
    },
  );

  // The pair a zoned system holds: `toOffsetInstant` splits the zoned string, and the zone has no
  // place in an EPCIS event. The offset each zone was at survives the trip there and back.
  it.each(battlePairs)(
    "carries $value through an EPCIS event and back as $utc at $offset, local $local",
    ({ value, utc, offset, local, timeZone }) => {
      const expected = { eventTime: utc, eventTimeZoneOffset: offset };

      expectEpcisEventTime(
        formatEpcisEvent({ instant: value, offset, timeZone }),
        expected,
      );
      expectEpcisEventTime(
        formatEpcisEvent(toOffsetInstant(value) as never),
        expected,
      );
      expect(parseEpcisEvent(expected)).toEqual({
        instant: utc,
        offset,
        local,
      });
    },
  );

  // `eventTime` may carry an offset, so within 14 hours of either end of the four-digit year
  // range it can name an instant whose UTC year has five digits or a sign. `parseEpcisEvent`
  // reads it; there is no `Z` form to write it back in.
  it.each`
    eventTime                      | eventTimeZoneOffset | instant
    ${"0000-01-01T00:00:00+05:00"} | ${"+05:00"}         | ${"-000001-12-31T19:00:00Z"}
    ${"9999-12-31T23:59:59-14:00"} | ${"-14:00"}         | ${"+010000-01-01T13:59:59Z"}
  `(
    "does not write back $eventTime, whose instant $instant is outside the four-digit year range",
    ({ eventTime, eventTimeZoneOffset, instant }) => {
      const parsed = parseEpcisEvent({ eventTime, eventTimeZoneOffset });

      expect(parsed?.instant).toBe(instant);
      expect(formatEpcisEvent(parsed as never)).toBeNull();
    },
  );
});
