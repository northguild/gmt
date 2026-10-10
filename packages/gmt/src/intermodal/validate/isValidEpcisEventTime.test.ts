import { epcisEventTime } from "../../regex";
import { NON_STRINGS } from "../../test/ediCodes";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseEpcisEvent } from "../parse/parseEpcisEvent";
import { isValidEpcisEvent } from "./isValidEpcisEvent";
import { isValidEpcisEventTime } from "./isValidEpcisEventTime";

/**
 * GS1 EPCIS 2.0 (ISO/IEC 19987). Each verdict is decided from the grammar GS1 publishes for
 * `eventTime` (the XSD's `DateTimeStamp`: `YYYY-MM-DDTHH:MM:SS`, an optional fraction, then `Z` or
 * a `±HH:MM` offset up to `14:00`), from the calendar, and from the library's rule that a fraction
 * holds at most nine digits. `pattern` is what the shape-only `epcisEventTime` says of the same
 * string. Every row then checks that the event validator and the parser, given a valid
 * `eventTimeZoneOffset` beside it, agree.
 */
describe("isValidEpcisEventTime", () => {
  it.each`
    value                                | expected | pattern  | reason
    ${"2024-06-15T14:30:00Z"}            | ${true}  | ${true}  | ${"a Z instant with seconds"}
    ${"2024-06-15T14:30:00+02:00"}       | ${true}  | ${true}  | ${"an offset east of UTC"}
    ${"2024-06-15T14:30:00-05:00"}       | ${true}  | ${true}  | ${"an offset west of UTC"}
    ${"2024-06-15T14:30:00.1Z"}          | ${true}  | ${true}  | ${"a one-digit fraction"}
    ${"2024-06-15T14:30:00.123Z"}        | ${true}  | ${true}  | ${"a three-digit fraction"}
    ${"2024-06-15T14:30:00.123456789Z"}  | ${true}  | ${true}  | ${"a nine-digit fraction"}
    ${"2024-06-15T14:30:00+14:00"}       | ${true}  | ${true}  | ${"the 14:00 offset"}
    ${"2024-06-15T14:30:00-14:00"}       | ${true}  | ${true}  | ${"the 14:00 offset, west"}
    ${"2024-06-15T14:30:00+13:59"}       | ${true}  | ${true}  | ${"the last minute below 14:00"}
    ${"0000-01-01T00:00:00Z"}            | ${true}  | ${true}  | ${"the first four-digit year"}
    ${"9999-12-31T23:59:59Z"}            | ${true}  | ${true}  | ${"the last four-digit year"}
    ${"2024-02-29T23:59:59Z"}            | ${true}  | ${true}  | ${"29 February in a leap year"}
    ${"2024-06-15T14:30Z"}               | ${false} | ${false} | ${"seconds are required"}
    ${"2024-06-15T14:30:00"}             | ${false} | ${false} | ${"Z or an offset is required"}
    ${"2024-06-15T14:30:00+15:00"}       | ${false} | ${false} | ${"offset hour 15"}
    ${"2024-06-15T14:30:00+14:01"}       | ${false} | ${false} | ${"an offset one minute past 14:00"}
    ${"2024-06-15T14:30:00-14:30"}       | ${false} | ${false} | ${"an offset past 14:00, west"}
    ${"2024-06-15T14:30:00+0200"}        | ${false} | ${false} | ${"an offset without a colon"}
    ${"2024-06-15T24:00:00Z"}            | ${false} | ${false} | ${"hour 24"}
    ${"2024-13-15T14:30:00Z"}            | ${false} | ${false} | ${"month 13"}
    ${"2024-06-32T14:30:00Z"}            | ${false} | ${false} | ${"day 32"}
    ${"2016-12-31T23:59:60Z"}            | ${false} | ${false} | ${"a leap second"}
    ${"2024-06-15 14:30:00Z"}            | ${false} | ${false} | ${"a space separator"}
    ${"2024-06-15t14:30:00Z"}            | ${false} | ${false} | ${"lower-case t"}
    ${"2024-06-15T14:30:00z"}            | ${false} | ${false} | ${"lower-case z"}
    ${"2024-06-15T14:30:00.Z"}           | ${false} | ${false} | ${"a period with no fraction digit"}
    ${"2024-06-15T14:30:00Z[UTC]"}       | ${false} | ${false} | ${"a bracketed zone"}
    ${"+002024-06-15T14:30:00Z"}         | ${false} | ${false} | ${"an expanded year"}
    ${"20240615T143000Z"}                | ${false} | ${false} | ${"basic format"}
    ${" 2024-06-15T14:30:00Z"}           | ${false} | ${false} | ${"leading space"}
    ${"2024-06-15T14:30:00Z "}           | ${false} | ${false} | ${"trailing space"}
    ${""}                                | ${false} | ${false} | ${"empty"}
    ${"2024-02-30T14:30:00Z"}            | ${false} | ${true}  | ${"February has no 30th"}
    ${"2023-02-29T00:00:00Z"}            | ${false} | ${true}  | ${"2023 has no 29 February"}
    ${"2024-06-31T14:30:00+02:00"}       | ${false} | ${true}  | ${"June has 30 days"}
    ${"2024-06-15T14:30:00.1234567891Z"} | ${false} | ${true}  | ${"a ten-digit fraction: finer than a nanosecond (GMT rule)"}
    ${"2024-06-15T14:30:00.1234567890Z"} | ${false} | ${true}  | ${"ten digits ending in zero: still refused"}
  `(
    "returns $expected for $value ($reason); the pattern alone says $pattern; isValidEpcisEvent and parseEpcisEvent agree",
    ({
      value,
      expected,
      pattern,
    }: {
      value: string;
      expected: boolean;
      pattern: boolean;
    }) => {
      const event = { eventTime: value, eventTimeZoneOffset: "+00:00" };

      expect(isValidEpcisEventTime(value)).toBe(expected);
      expect(epcisEventTime.test(value)).toBe(pattern);
      expect(isValidEpcisEvent(event)).toBe(expected);
      expect(parseEpcisEvent(event) !== null).toBe(expected);
    },
  );

  it("returns false for an argument that is not a string, as isValidEpcisEvent does for the field", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidEpcisEventTime(make() as never), kind).toBe(false);
      expect(
        isValidEpcisEvent({ eventTime: make(), eventTimeZoneOffset: "+00:00" }),
        kind,
      ).toBe(false);
    }
  });

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(isValidEpcisEventTime("2024-06-15T14:30:00Z")).toBe(false);
  });
});
