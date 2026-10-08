import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { parseEpcisEvent } from "../parse/parseEpcisEvent";
import { isValidEpcisEvent } from "./isValidEpcisEvent";

// GS1 EPCIS 2.0 (ISO/IEC 19987). An event's time is valid when both required fields are present
// and each matches the grammar GS1 publishes for it: the XSD's `DateTimeStamp` for `eventTime`,
// the JSON schema's pattern for `eventTimeZoneOffset`. Each `expected` is decided from those two
// grammars; every row then also checks that the parser agrees, null exactly where it is false.

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

describe("isValidEpcisEvent", () => {
  it.each`
    eventTime                            | eventTimeZoneOffset | expected | reads
    ${"2024-06-15T14:30:00Z"}            | ${"-05:00"}         | ${true}  | ${"a Z instant and a negative offset"}
    ${"2024-06-15T14:30:00Z"}            | ${"+02:00"}         | ${true}  | ${"a positive offset"}
    ${"2024-06-15T14:30:00Z"}            | ${"+00:00"}         | ${true}  | ${"an event at UTC"}
    ${"2024-06-15T14:30:00Z"}            | ${"-00:00"}         | ${true}  | ${"-00:00: the GS1 pattern admits it"}
    ${"2024-06-15T14:30:00Z"}            | ${"+14:00"}         | ${true}  | ${"the eastern end of the pattern"}
    ${"2024-06-15T14:30:00Z"}            | ${"-14:00"}         | ${true}  | ${"the western end: the sign is independent of 14:00"}
    ${"2024-06-15T14:30:00Z"}            | ${"+13:59"}         | ${true}  | ${"the last minute before 14:00"}
    ${"2024-06-15T14:30:00Z"}            | ${"-13:59"}         | ${true}  | ${"the last minute before 14:00, west"}
    ${"2024-06-15T14:30:00Z"}            | ${"+05:45"}         | ${true}  | ${"a quarter-hour offset"}
    ${"2024-06-15T14:30:00-14:00"}       | ${"+14:00"}         | ${true}  | ${"the two ends of the range in the two fields"}
    ${"2024-06-15T14:30:00.1Z"}          | ${"-05:00"}         | ${true}  | ${"a one-digit fraction"}
    ${"2024-06-15T10:00:00+02:00"}       | ${"+02:00"}         | ${true}  | ${"an eventTime with an offset"}
    ${"2024-06-15T10:00:00+02:00"}       | ${"-05:00"}         | ${true}  | ${"two offsets that differ: they are independent"}
    ${"2024-06-15T14:30:00.123456789Z"}  | ${"-05:00"}         | ${true}  | ${"a nine-digit fraction"}
    ${"2024-02-29T23:59:59Z"}            | ${"-05:00"}         | ${true}  | ${"the leap day"}
    ${"0000-01-01T00:00:00Z"}            | ${"-05:00"}         | ${true}  | ${"the first four-digit year"}
    ${"9999-12-31T23:59:59Z"}            | ${"+14:00"}         | ${true}  | ${"the last four-digit year"}
    ${"2024-06-15T14:30:00Z"}            | ${undefined}        | ${false} | ${"eventTimeZoneOffset is missing"}
    ${"2024-06-15T14:30:00Z"}            | ${"Z"}              | ${false} | ${"Z in the offset field"}
    ${"2024-06-15T14:30:00Z"}            | ${"+0200"}          | ${false} | ${"an offset without a colon"}
    ${"2024-06-15T14:30:00Z"}            | ${"+02"}            | ${false} | ${"an hours-only offset"}
    ${"2024-06-15T14:30:00Z"}            | ${"+14:01"}         | ${false} | ${"an offset past 14:00"}
    ${"2024-06-15T14:30:00Z"}            | ${"-14:01"}         | ${false} | ${"an offset past 14:00, west"}
    ${"2024-06-15T14:30:00Z"}            | ${"-14:30"}         | ${false} | ${"an offset past 14:00, west"}
    ${"2024-06-15T14:30:00Z"}            | ${"+15:00"}         | ${false} | ${"hour 15"}
    ${"2024-06-15T14:30:00Z"}            | ${"+05:30:00"}      | ${false} | ${"an offset with seconds"}
    ${"2024-06-15T14:30:00Z"}            | ${""}               | ${false} | ${"an empty offset"}
    ${"2024-06-15T14:30:00Z"}            | ${null}             | ${false} | ${"a null offset"}
    ${"2024-06-15T14:30:00Z"}            | ${-300}             | ${false} | ${"a number of minutes"}
    ${undefined}                         | ${"-05:00"}         | ${false} | ${"eventTime is missing"}
    ${"2024-06-15 14:30:00Z"}            | ${"-05:00"}         | ${false} | ${"a space separator"}
    ${"2024-06-15t14:30:00Z"}            | ${"-05:00"}         | ${false} | ${"lower-case t"}
    ${"2024-06-15T14:30:00z"}            | ${"-05:00"}         | ${false} | ${"lower-case z"}
    ${"2024-06-15T14:30Z"}               | ${"-05:00"}         | ${false} | ${"no seconds"}
    ${"2024-06-15T14:30:00"}             | ${"-05:00"}         | ${false} | ${"no Z and no offset in eventTime"}
    ${"2024-06-15T14:30:00+15:00"}       | ${"-05:00"}         | ${false} | ${"an eventTime offset past 14:00"}
    ${"2024-06-15T14:30:00+14:01"}       | ${"-05:00"}         | ${false} | ${"an eventTime offset one minute past 14:00"}
    ${"2016-12-31T23:59:60Z"}            | ${"-05:00"}         | ${false} | ${"a leap second"}
    ${"2024-06-15T14:30:00Z[UTC]"}       | ${"-05:00"}         | ${false} | ${"a bracketed zone"}
    ${"2024-02-30T14:30:00Z"}            | ${"-05:00"}         | ${false} | ${"30 February: the pattern matches, the day does not exist"}
    ${"2023-02-29T14:30:00Z"}            | ${"-05:00"}         | ${false} | ${"29 February in a common year"}
    ${"2024-06-15T14:30:00.1234567891Z"} | ${"-05:00"}         | ${false} | ${"a ten-digit fraction: finer than a nanosecond (GMT rule)"}
    ${1718461800000}                     | ${"-05:00"}         | ${false} | ${"epoch milliseconds"}
    ${null}                              | ${"-05:00"}         | ${false} | ${"a null eventTime"}
  `(
    "returns $expected for eventTime $eventTime and eventTimeZoneOffset $eventTimeZoneOffset ($reads), as parseEpcisEvent does",
    ({ eventTime, eventTimeZoneOffset, expected }) => {
      const event = { eventTime, eventTimeZoneOffset };

      expect(isValidEpcisEvent(event)).toBe(expected);
      expect(parseEpcisEvent(event) !== null).toBe(expected);
    },
  );

  // The argument is `unknown`: anything can be asked about. A function is an Object (ECMA-262
  // §6.1.7), so one carrying both fields is the record it carries, and extra members, which a
  // real EPCIS event has many of, do not matter.
  it.each`
    make                                                                                  | expected | kind
    ${() => ({ type: "ObjectEvent", action: "OBSERVE", eventTime, eventTimeZoneOffset })} | ${true}  | ${"an event with other members"}
    ${() => ({ eventTime, eventTimeZoneOffset, recordTime: "not a time" })}               | ${true}  | ${"an event whose optional recordTime is unreadable: it is not checked"}
    ${() => Object.assign(() => undefined, { eventTime, eventTimeZoneOffset })}           | ${true}  | ${"a function carrying both fields"}
    ${() => null}                                                                         | ${false} | ${"null"}
    ${() => undefined}                                                                    | ${false} | ${"undefined"}
    ${() => eventTime}                                                                    | ${false} | ${"a string: the eventTime alone"}
    ${() => 1718461800000}                                                                | ${false} | ${"a number"}
    ${() => true}                                                                         | ${false} | ${"a boolean"}
    ${() => []}                                                                           | ${false} | ${"an empty array"}
    ${() => [eventTime, eventTimeZoneOffset]}                                             | ${false} | ${"an array of the two values"}
    ${() => ({})}                                                                         | ${false} | ${"an empty object"}
    ${() => () => undefined}                                                              | ${false} | ${"a function with neither member"}
    ${() => ({ instant: eventTime, offset: eventTimeZoneOffset })}                        | ${false} | ${"an instant-plus-offset pair, which is not an event"}
    ${() => hostileProxy()}                                                               | ${false} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()}                                                               | ${false} | ${"a revoked Proxy"}
    ${() => throwingGetter}                                                               | ${false} | ${"an object whose eventTime getter throws"}
  `(
    "returns $expected for a value that is $kind, as parseEpcisEvent does",
    ({ make, expected }) => {
      expect(isValidEpcisEvent(make())).toBe(expected);
      expect(parseEpcisEvent(make()) !== null).toBe(expected);
    },
  );

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(isValidEpcisEvent({ eventTime, eventTimeZoneOffset })).toBe(false);
  });
});
