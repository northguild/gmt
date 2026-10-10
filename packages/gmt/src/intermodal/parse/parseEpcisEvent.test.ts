import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { parseEpcisEvent } from "./parseEpcisEvent";

/** A valid event: 14:30Z on 15 June 2024, where the local clock ran five hours behind UTC. */
const eventTime = "2024-06-15T14:30:00Z";
const eventTimeZoneOffset = "-05:00";

/** A record whose `eventTime` cannot be read at all. */
const throwingGetter = {
  get eventTime(): string {
    throw new Error("hostile getter");
  },
  eventTimeZoneOffset,
};

/** A record whose `eventTimeZoneOffset` cannot be read at all. */
const throwingOffsetGetter = {
  eventTime,
  get eventTimeZoneOffset(): string {
    throw new Error("hostile getter");
  },
};

// GS1 EPCIS 2.0 (ISO/IEC 19987). `eventTime` fixes the instant; `eventTimeZoneOffset` is the
// offset the local clock ran at where the event happened. Every expected `local` below is the
// instant's UTC wall clock plus the offset, worked by hand and checked against a plain
// `Temporal.Instant#toZonedDateTimeISO("UTC").toPlainDateTime().add(...)`.

describe("parseEpcisEvent", () => {
  it.each`
    eventTime                 | eventTimeZoneOffset | local                    | reads
    ${"2024-06-15T14:30:00Z"} | ${"-05:00"}         | ${"2024-06-15T09:30:00"} | ${"14:30 less five hours"}
    ${"2024-06-15T14:30:00Z"} | ${"+02:00"}         | ${"2024-06-15T16:30:00"} | ${"14:30 plus two hours"}
    ${"2024-06-15T14:30:00Z"} | ${"+00:00"}         | ${"2024-06-15T14:30:00"} | ${"an event that happened at UTC"}
  `(
    "reads $eventTime at $eventTimeZoneOffset as local $local ($reads)",
    ({ eventTime, eventTimeZoneOffset, local }) => {
      expect(parseEpcisEvent({ eventTime, eventTimeZoneOffset })).toEqual({
        instant: eventTime,
        offset: eventTimeZoneOffset,
        local,
      });
    },
  );

  // The XSD lets `eventTime` carry an offset instead of `Z`. That offset fixes the instant and
  // nothing else: the local clock comes from `eventTimeZoneOffset`, whether or not the two agree.
  // 10:00 at +02:00 is 08:00Z, which a clock five hours behind UTC shows as 03:00.
  it.each`
    eventTime                      | eventTimeZoneOffset | instant                   | local                    | reads
    ${"2024-06-15T10:00:00+02:00"} | ${"+02:00"}         | ${"2024-06-15T08:00:00Z"} | ${"2024-06-15T10:00:00"} | ${"the two offsets agree"}
    ${"2024-06-15T09:30:00-05:00"} | ${"-05:00"}         | ${"2024-06-15T14:30:00Z"} | ${"2024-06-15T09:30:00"} | ${"the two offsets agree, west"}
    ${"2024-06-15T10:00:00+02:00"} | ${"-05:00"}         | ${"2024-06-15T08:00:00Z"} | ${"2024-06-15T03:00:00"} | ${"the two offsets differ: not an error"}
    ${"2024-06-15T14:30:00+00:00"} | ${"-05:00"}         | ${"2024-06-15T14:30:00Z"} | ${"2024-06-15T09:30:00"} | ${"+00:00 in eventTime is Z"}
    ${"2024-06-15T14:30:00-00:00"} | ${"-05:00"}         | ${"2024-06-15T14:30:00Z"} | ${"2024-06-15T09:30:00"} | ${"-00:00 in eventTime is Z"}
    ${"2024-06-15T23:30:00-05:00"} | ${"+09:00"}         | ${"2024-06-16T04:30:00Z"} | ${"2024-06-16T13:30:00"} | ${"the offset in eventTime moves the UTC date"}
    ${"2024-06-16T02:00:00+14:00"} | ${"-14:00"}         | ${"2024-06-15T12:00:00Z"} | ${"2024-06-14T22:00:00"} | ${"the two ends of the range, 28 hours apart"}
    ${"2024-06-14T22:00:00-14:00"} | ${"+14:00"}         | ${"2024-06-15T12:00:00Z"} | ${"2024-06-16T02:00:00"} | ${"the two ends of the range, the other way round"}
    ${"2024-06-16T01:59:00+13:59"} | ${"+00:00"}         | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00"} | ${"+13:59 in eventTime, the last minute before 14:00"}
    ${"2024-06-14T22:01:00-13:59"} | ${"+00:00"}         | ${"2024-06-15T12:00:00Z"} | ${"2024-06-15T12:00:00"} | ${"-13:59 in eventTime"}
  `(
    "reads $eventTime at $eventTimeZoneOffset as $instant, local $local ($reads)",
    ({ eventTime, eventTimeZoneOffset, instant, local }) => {
      expect(parseEpcisEvent({ eventTime, eventTimeZoneOffset })).toEqual({
        instant,
        offset: eventTimeZoneOffset,
        local,
      });
    },
  );

  // Noon UTC on 15 June 2024 at every kind of offset the GS1 pattern admits: both ends of the
  // range, half and quarter hours, and the zero offsets. `local` is 12:00 plus the offset. The
  // pattern's sign is independent of its `14:00` alternative, so `-14:00` is in range.
  it.each`
    offset      | local                    | reads
    ${"-14:00"} | ${"2024-06-14T22:00:00"} | ${"the western end of the pattern"}
    ${"-13:59"} | ${"2024-06-14T22:01:00"} | ${"the last minute before it"}
    ${"-12:00"} | ${"2024-06-15T00:00:00"} | ${"exactly local midnight"}
    ${"-05:00"} | ${"2024-06-15T07:00:00"} | ${"a whole hour west"}
    ${"-03:30"} | ${"2024-06-15T08:30:00"} | ${"a half hour west"}
    ${"+00:00"} | ${"2024-06-15T12:00:00"} | ${"UTC"}
    ${"+05:30"} | ${"2024-06-15T17:30:00"} | ${"a half hour east"}
    ${"+05:45"} | ${"2024-06-15T17:45:00"} | ${"a quarter hour east"}
    ${"+12:45"} | ${"2024-06-16T00:45:00"} | ${"a quarter hour, into the next day"}
    ${"+13:00"} | ${"2024-06-16T01:00:00"} | ${"thirteen hours east"}
    ${"+13:59"} | ${"2024-06-16T01:59:00"} | ${"the last minute before 14:00"}
    ${"+14:00"} | ${"2024-06-16T02:00:00"} | ${"the eastern end of the pattern"}
  `(
    "shows 12:00Z at the offset $offset as local $local and keeps the offset ($reads)",
    ({ offset, local }) => {
      expect(
        parseEpcisEvent({
          eventTime: "2024-06-15T12:00:00Z",
          eventTimeZoneOffset: offset,
        }),
      ).toEqual({ instant: "2024-06-15T12:00:00Z", offset, local });
    },
  );

  // The local date is the date on the clock where the event happened, so it leaves the UTC date
  // whenever the offset carries the time across midnight, a month end or a year end.
  it.each`
    eventTime                           | offset      | local                              | reads
    ${"2024-06-15T23:30:00Z"}           | ${"+02:00"} | ${"2024-06-16T01:30:00"}           | ${"the next day"}
    ${"2024-06-15T00:30:00Z"}           | ${"-05:00"} | ${"2024-06-14T19:30:00"}           | ${"the previous day"}
    ${"2024-12-31T23:30:00Z"}           | ${"+02:00"} | ${"2025-01-01T01:30:00"}           | ${"the next year"}
    ${"2024-01-01T00:30:00Z"}           | ${"-05:00"} | ${"2023-12-31T19:30:00"}           | ${"the previous year"}
    ${"2024-02-28T23:30:00Z"}           | ${"+02:00"} | ${"2024-02-29T01:30:00"}           | ${"onto the leap day"}
    ${"2024-03-01T00:30:00Z"}           | ${"-05:00"} | ${"2024-02-29T19:30:00"}           | ${"back onto the leap day"}
    ${"2023-02-28T23:30:00Z"}           | ${"+02:00"} | ${"2023-03-01T01:30:00"}           | ${"past February in a common year"}
    ${"2024-06-15T23:59:59.999999999Z"} | ${"+00:01"} | ${"2024-06-16T00:00:59.999999999"} | ${"one nanosecond before UTC midnight, a minute east"}
    ${"2024-06-15T22:00:00Z"}           | ${"+02:00"} | ${"2024-06-16T00:00:00"}           | ${"exactly local midnight"}
  `(
    "shows $eventTime at $offset as local $local ($reads)",
    ({ eventTime, offset, local }) => {
      expect(
        parseEpcisEvent({ eventTime, eventTimeZoneOffset: offset }),
      ).toEqual({ instant: eventTime, offset, local });
    },
  );

  // A fraction is kept to the nanosecond in `instant` and in `local`. Temporal writes it without
  // trailing zeros, so the value is kept and the padding is not. 14:30 at +05:45 is 20:15.
  it.each`
    eventTime                           | instant                             | local                              | digits
    ${"2024-06-15T14:30:00.1Z"}         | ${"2024-06-15T14:30:00.1Z"}         | ${"2024-06-15T20:15:00.1"}         | ${1}
    ${"2024-06-15T14:30:00.12Z"}        | ${"2024-06-15T14:30:00.12Z"}        | ${"2024-06-15T20:15:00.12"}        | ${2}
    ${"2024-06-15T14:30:00.123Z"}       | ${"2024-06-15T14:30:00.123Z"}       | ${"2024-06-15T20:15:00.123"}       | ${3}
    ${"2024-06-15T14:30:00.1234Z"}      | ${"2024-06-15T14:30:00.1234Z"}      | ${"2024-06-15T20:15:00.1234"}      | ${4}
    ${"2024-06-15T14:30:00.12345Z"}     | ${"2024-06-15T14:30:00.12345Z"}     | ${"2024-06-15T20:15:00.12345"}     | ${5}
    ${"2024-06-15T14:30:00.123456Z"}    | ${"2024-06-15T14:30:00.123456Z"}    | ${"2024-06-15T20:15:00.123456"}    | ${6}
    ${"2024-06-15T14:30:00.1234567Z"}   | ${"2024-06-15T14:30:00.1234567Z"}   | ${"2024-06-15T20:15:00.1234567"}   | ${7}
    ${"2024-06-15T14:30:00.12345678Z"}  | ${"2024-06-15T14:30:00.12345678Z"}  | ${"2024-06-15T20:15:00.12345678"}  | ${8}
    ${"2024-06-15T14:30:00.123456789Z"} | ${"2024-06-15T14:30:00.123456789Z"} | ${"2024-06-15T20:15:00.123456789"} | ${9}
    ${"2024-06-15T14:30:00.000000001Z"} | ${"2024-06-15T14:30:00.000000001Z"} | ${"2024-06-15T20:15:00.000000001"} | ${"9, one nanosecond"}
    ${"2024-06-15T14:30:00.100Z"}       | ${"2024-06-15T14:30:00.1Z"}         | ${"2024-06-15T20:15:00.1"}         | ${"3, two of them trailing zeros"}
    ${"2024-06-15T14:30:00.120000000Z"} | ${"2024-06-15T14:30:00.12Z"}        | ${"2024-06-15T20:15:00.12"}        | ${"9, seven of them trailing zeros"}
    ${"2024-06-15T14:30:00.000Z"}       | ${"2024-06-15T14:30:00Z"}           | ${"2024-06-15T20:15:00"}           | ${"3, all zero"}
    ${"2024-06-15T16:30:00.5+02:00"}    | ${"2024-06-15T14:30:00.5Z"}         | ${"2024-06-15T20:15:00.5"}         | ${"1, on an eventTime with an offset"}
  `(
    "keeps the fraction of $eventTime ($digits digits) as $instant, local $local",
    ({ eventTime, instant, local }) => {
      expect(
        parseEpcisEvent({ eventTime, eventTimeZoneOffset: "+05:45" }),
      ).toEqual({ instant, offset: "+05:45", local });
    },
  );

  // `eventTime` has a four-digit year. Within 14 hours of either end of that range the offset
  // carries the local clock, or the instant itself, outside it, and Temporal writes a year
  // outside 0000–9999 with a sign and six digits.
  it.each`
    eventTime                      | offset      | instant                      | local                       | reads
    ${"0000-01-01T00:00:00Z"}      | ${"-05:00"} | ${"0000-01-01T00:00:00Z"}    | ${"-000001-12-31T19:00:00"} | ${"the local year is before 0000"}
    ${"9999-12-31T23:30:00Z"}      | ${"+02:00"} | ${"9999-12-31T23:30:00Z"}    | ${"+010000-01-01T01:30:00"} | ${"the local year is after 9999"}
    ${"0000-01-01T00:00:00+05:00"} | ${"+05:00"} | ${"-000001-12-31T19:00:00Z"} | ${"0000-01-01T00:00:00"}    | ${"the instant's UTC year is before 0000"}
    ${"9999-12-31T23:59:59-14:00"} | ${"-14:00"} | ${"+010000-01-01T13:59:59Z"} | ${"9999-12-31T23:59:59"}    | ${"the instant's UTC year is after 9999"}
  `(
    "reads $eventTime at $offset as $instant, local $local ($reads)",
    ({ eventTime, offset, instant, local }) => {
      expect(
        parseEpcisEvent({ eventTime, eventTimeZoneOffset: offset }),
      ).toEqual({ instant, offset, local });
    },
  );

  // A real EPCIS event carries many more members. Only the two time fields are read, and
  // `recordTime`, which the schema makes optional, is not validated.
  it("ignores every other member of the event, an unreadable recordTime included", () => {
    const event = {
      type: "ObjectEvent",
      action: "OBSERVE",
      bizStep: "shipping",
      epcList: ["urn:epc:id:sgtin:0614141.107346.2017"],
      eventTime,
      recordTime: "not a time",
      eventTimeZoneOffset,
    };

    expect(parseEpcisEvent(event)).toEqual({
      instant: eventTime,
      offset: eventTimeZoneOffset,
      local: "2024-06-15T09:30:00",
    });
  });

  // A function is an Object (ECMA-262 §6.1.7), so one carrying the two fields is read as the
  // record it is, the way every other GMT record is.
  it("reads a function carrying the two fields as the record it is", () => {
    const event = Object.assign(() => undefined, {
      eventTime,
      eventTimeZoneOffset,
    });
    expect(parseEpcisEvent(event)).toEqual({
      instant: eventTime,
      offset: eventTimeZoneOffset,
      local: "2024-06-15T09:30:00",
    });
  });

  it("reads each field once, with an ordinary property get", () => {
    const reads: string[] = [];
    const event = {
      get eventTime(): string {
        reads.push("eventTime");
        return eventTime;
      },
      get eventTimeZoneOffset(): string {
        reads.push("eventTimeZoneOffset");
        return eventTimeZoneOffset;
      },
    };
    expect(parseEpcisEvent(event)).not.toBeNull();
    expect(reads.toSorted()).toEqual(["eventTime", "eventTimeZoneOffset"]);
  });

  // RFC 9557 §2.2 reads `-00:00` as "UTC known, local offset unknown". GS1's pattern admits it,
  // and the result has no spelling for an unknown offset, so it is recorded as `+00:00`, exactly
  // as `toOffsetInstant` records it.
  it("records an eventTimeZoneOffset of -00:00 as +00:00, as toOffsetInstant does", () => {
    expect(
      parseEpcisEvent({ eventTime, eventTimeZoneOffset: "-00:00" }),
    ).toEqual({
      instant: eventTime,
      offset: "+00:00",
      local: eventTime.slice(0, -1),
    });
  });

  // The JSON schema's `eventTimeZoneOffset` pattern: a sign, then `HH:MM` up to 13:59, or 14:00.
  it.each`
    offset         | reads
    ${undefined}   | ${"missing: the schema requires the field"}
    ${"Z"}         | ${"Z is eventTime's designator, not an offset"}
    ${"z"}         | ${"lower-case z"}
    ${"+0200"}     | ${"no colon"}
    ${"+02"}       | ${"hours only"}
    ${"02:00"}     | ${"no sign"}
    ${"+2:00"}     | ${"an unpadded hour"}
    ${"+14:01"}    | ${"one minute past the range GS1 allows"}
    ${"-14:01"}    | ${"one minute past the range, west"}
    ${"+14:30"}    | ${"past 14:00"}
    ${"-14:30"}    | ${"past 14:00, west"}
    ${"+15:00"}    | ${"hour 15"}
    ${"-15:00"}    | ${"hour 15, west"}
    ${"+02:60"}    | ${"minute 60"}
    ${"+05:30:00"} | ${"seconds, which utcOffset accepts and GS1 does not"}
    ${"+02:00 "}   | ${"trailing whitespace"}
    ${" +02:00"}   | ${"leading whitespace"}
    ${"UTC"}       | ${"a zone name"}
    ${""}          | ${"an empty string"}
    ${null}        | ${"null"}
    ${-300}        | ${"a number of minutes"}
    ${["-05:00"]}  | ${"an array holding the offset: nothing is coerced to a string"}
  `(
    "returns null when eventTimeZoneOffset is $offset ($reads)",
    ({ offset }) => {
      expect(
        parseEpcisEvent({ eventTime, eventTimeZoneOffset: offset as never }),
      ).toBeNull();
    },
  );

  // The XSD's `DateTimeStamp` pattern: seconds required, upper-case `T` and `Z`, a four-digit
  // year, `Z` or a colon offset in the range above, and nothing after it.
  it.each`
    value                                         | reads
    ${undefined}                                  | ${"missing: the schema requires the field"}
    ${"2024-06-15 14:30:00Z"}                     | ${"a space separator"}
    ${"2024-06-15t14:30:00Z"}                     | ${"lower-case t"}
    ${"2024-06-15T14:30:00z"}                     | ${"lower-case z"}
    ${"2024-06-15T14:30Z"}                        | ${"no seconds"}
    ${"2024-06-15T14:30:00"}                      | ${"no Z and no offset: not an instant"}
    ${"2024-06-15T14:30:00+0200"}                 | ${"an offset without a colon"}
    ${"2024-06-15T14:30:00+02"}                   | ${"an hours-only offset"}
    ${"2024-06-15T14:30:00+15:00"}                | ${"an offset past the range GS1 allows"}
    ${"2024-06-15T14:30:00+14:01"}                | ${"an offset one minute past 14:00"}
    ${"2024-06-15T14:30:00-14:30"}                | ${"an offset past 14:00, west"}
    ${"2024-06-15T14:30:00-04:56:02"}             | ${"an offset with seconds"}
    ${"2024-06-15T24:00:00Z"}                     | ${"hour 24"}
    ${"2016-12-31T23:59:60Z"}                     | ${"a leap second: second 60 is outside the pattern"}
    ${"2024-06-15T14:30:00,5Z"}                   | ${"a comma before the fraction"}
    ${"2024-06-15T14:30:00.Z"}                    | ${"a period with no fraction digits"}
    ${"+002024-06-15T14:30:00Z"}                  | ${"an expanded year"}
    ${"20240615T143000Z"}                         | ${"basic format"}
    ${"2024-06-15T14:30:00Z[UTC]"}                | ${"a bracketed zone: the grammar has no annotation"}
    ${"2024-06-15T14:30:00Z[u-ca=iso8601]"}       | ${"a calendar annotation"}
    ${"2024-06-15T14:30:00-04:00[-04:00]"}        | ${"a bracketed offset"}
    ${"2024-06-15"}                               | ${"a date"}
    ${" 2024-06-15T14:30:00Z"}                    | ${"leading whitespace"}
    ${"2024-06-15T14:30:00Z\n"}                   | ${"a trailing newline"}
    ${""}                                         | ${"an empty string"}
    ${null}                                       | ${"null"}
    ${1718461800000}                              | ${"epoch milliseconds"}
    ${{ toString: () => "2024-06-15T14:30:00Z" }} | ${"an object that stringifies to an instant: nothing is coerced"}
  `("returns null when eventTime is $value ($reads)", ({ value }) => {
    expect(
      parseEpcisEvent({ eventTime: value as never, eventTimeZoneOffset }),
    ).toBeNull();
  });

  // The pattern checks the shape of the date, not the calendar: day 30 or 31 passes it in any
  // month. `Temporal.Instant.from` rejects a day the month does not have.
  it.each`
    value                     | reads
    ${"2024-02-30T14:30:00Z"} | ${"30 February"}
    ${"2023-02-29T14:30:00Z"} | ${"29 February in a common year"}
    ${"2024-04-31T14:30:00Z"} | ${"31 April"}
    ${"2024-06-31T14:30:00Z"} | ${"31 June"}
  `(
    "returns null for $value, which matches the pattern and names no day ($reads)",
    ({ value }) => {
      expect(
        parseEpcisEvent({ eventTime: value, eventTimeZoneOffset }),
      ).toBeNull();
    },
  );

  // GMT rule. The XSD allows a fraction of any length (`\.[0-9]+`); an instant holds nanoseconds.
  // A reader that dropped the tenth digit would report a different time from the one written, so
  // a longer fraction is refused, zeros included.
  it.each`
    value                                        | digits
    ${"2024-06-15T14:30:00.1234567891Z"}         | ${"10"}
    ${"2024-06-15T14:30:00.1234567890Z"}         | ${"10 (the last a zero)"}
    ${"2024-06-15T14:30:00.0000000000Z"}         | ${"10 (all zero)"}
    ${"2024-06-15T14:30:00.123456789012345678Z"} | ${"18"}
  `(
    "returns null for $value: a fraction of $digits digits is longer than the nine an instant holds",
    ({ value }) => {
      expect(
        parseEpcisEvent({ eventTime: value, eventTimeZoneOffset }),
      ).toBeNull();
    },
  );

  // A function is an Object (ECMA-262 §6.1.7) and is read as the record it carries; `[]` and a
  // bare function are objects with neither member.
  it.each`
    make                                      | kind
    ${() => null}                             | ${"null"}
    ${() => undefined}                        | ${"undefined"}
    ${() => "2024-06-15T14:30:00Z"}           | ${"a string: the eventTime alone"}
    ${() => 1718461800000}                    | ${"a number"}
    ${() => true}                             | ${"a boolean"}
    ${() => []}                               | ${"an empty array"}
    ${() => [eventTime, eventTimeZoneOffset]} | ${"an array of the two values"}
    ${() => ({})}                             | ${"an empty object"}
    ${() => () => undefined}                  | ${"a function with neither member"}
    ${() => hostileProxy()}                   | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()}                   | ${"a revoked Proxy"}
    ${() => throwingGetter}                   | ${"an object whose eventTime getter throws"}
    ${() => throwingOffsetGetter}             | ${"an object whose eventTimeZoneOffset getter throws"}
  `("returns null for an event that is $kind", ({ make }) => {
    expect(parseEpcisEvent(make() as never)).toBeNull();
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(parseEpcisEvent({ eventTime, eventTimeZoneOffset })).toBeNull();
  });
});
