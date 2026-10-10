import { rfc3339DateTime } from "../../regex";
import { NON_STRINGS } from "../../test/ediCodes";
import { parseRfc3339 } from "../parse/parseRfc3339";
import { isValidRfc3339DateTime } from "./isValidRfc3339DateTime";

/**
 * Each verdict is worked out from the RFC 3339 §5.6 grammar and the calendar, never from the
 * function: `date-time = full-date "T" full-time`, where `T` and `Z` "may alternatively be lower
 * case" and a space may stand for `T`; `time-offset = "Z" / time-numoffset`; `time-secfrac = "."
 * 1*DIGIT`; and `date-mday` is "01-28, 01-29, 01-30, 01-31 based on month/year". `pattern` is what
 * the shape-only `rfc3339DateTime` says of the same string. The valid and invalid rows of
 * `parseRfc3339.test.ts` are all here, so the two files stay in step.
 */
describe("isValidRfc3339DateTime", () => {
  it.each`
    value                                    | expected | pattern  | reason
    ${"2024-03-15T14:30:00-04:00"}           | ${true}  | ${true}  | ${"numeric offset"}
    ${"2024-03-15T14:30:00Z"}                | ${true}  | ${true}  | ${"Z"}
    ${"2024-03-15t14:30:00z"}                | ${true}  | ${true}  | ${"lower-case t and z"}
    ${"2024-03-15 14:30:00Z"}                | ${true}  | ${true}  | ${"space separator"}
    ${"2024-03-15T14:30:00.5Z"}              | ${true}  | ${true}  | ${"one fraction digit"}
    ${"2024-03-15T14:30:00.123456789+05:30"} | ${true}  | ${true}  | ${"nine fraction digits"}
    ${"2024-07-01T00:00:00+13:00"}           | ${true}  | ${true}  | ${"offset east of +12:00"}
    ${"2024-07-01T00:00:00-11:00"}           | ${true}  | ${true}  | ${"offset west of UTC"}
    ${"2024-03-15T14:30:00-00:00"}           | ${true}  | ${true}  | ${"-00:00"}
    ${"2024-03-15T14:30:00+23:59"}           | ${true}  | ${true}  | ${"the largest time-numoffset"}
    ${"2024-02-29T10:00:00Z"}                | ${true}  | ${true}  | ${"29 February in a leap year"}
    ${"2000-02-29T00:00:00Z"}                | ${true}  | ${true}  | ${"2000 is divisible by 400"}
    ${"0000-01-01T00:00:00Z"}                | ${true}  | ${true}  | ${"date-fullyear = 4DIGIT"}
    ${"9999-12-31T23:59:59.999999999Z"}      | ${true}  | ${true}  | ${"the last nanosecond of year 9999"}
    ${"not a date"}                          | ${false} | ${false} | ${"not a date-time"}
    ${""}                                    | ${false} | ${false} | ${"empty"}
    ${"2024-03-15T14:30:00"}                 | ${false} | ${false} | ${"no time-offset"}
    ${"2024-03-15T14:30:00+00:00[UTC]"}      | ${false} | ${false} | ${"bracketed zone: GMT's own form"}
    ${"2024-03-15T14:30:00-0400"}            | ${false} | ${false} | ${"offset without a colon"}
    ${"2024-03-15T14:30:00+04"}              | ${false} | ${false} | ${"hour-only offset"}
    ${"2024-03-15T14:30:00+24:00"}           | ${false} | ${false} | ${"offset hour 24"}
    ${"2024-03-15T14:30:00+04:60"}           | ${false} | ${false} | ${"offset minute 60"}
    ${"2024-03-15T14:30:60Z"}                | ${false} | ${false} | ${"second 60: GMT rejects leap seconds"}
    ${"2016-12-31T23:59:60Z"}                | ${false} | ${false} | ${"a real leap second: GMT rejects it"}
    ${"2024-03-15T14:30Z"}                   | ${false} | ${false} | ${"seconds are required"}
    ${"2024-03-15T24:00:00Z"}                | ${false} | ${false} | ${"hour 24"}
    ${"2024-03-15T14:60:00Z"}                | ${false} | ${false} | ${"minute 60"}
    ${"2024-13-15T14:30:00Z"}                | ${false} | ${false} | ${"month 13"}
    ${"2024-03-00T14:30:00Z"}                | ${false} | ${false} | ${"day 00"}
    ${"2024-03-32T14:30:00Z"}                | ${false} | ${false} | ${"day 32"}
    ${"2024-3-15T14:30:00Z"}                 | ${false} | ${false} | ${"unpadded month"}
    ${"2024-03-15T14:30:00.Z"}               | ${false} | ${false} | ${"a point with no fraction digit"}
    ${"2024-03-15T14:30:00.1234567890Z"}     | ${false} | ${false} | ${"ten fraction digits: GMT keeps nine"}
    ${"2024-03-15T14:30:00,5Z"}              | ${false} | ${false} | ${"comma decimal sign"}
    ${"+002024-03-15T14:30:00Z"}             | ${false} | ${false} | ${"expanded year"}
    ${"20240315T143000Z"}                    | ${false} | ${false} | ${"basic format"}
    ${"2024-03-15"}                          | ${false} | ${false} | ${"a date without a time"}
    ${"2024-03-15  14:30:00Z"}               | ${false} | ${false} | ${"two spaces"}
    ${" 2024-03-15T14:30:00Z"}               | ${false} | ${false} | ${"leading space"}
    ${"2024-03-15T14:30:00Z "}               | ${false} | ${false} | ${"trailing space"}
    ${"2024-03-15T14:30:00Z\n"}              | ${false} | ${false} | ${"trailing line feed"}
    ${"2023-02-29T10:00:00Z"}                | ${false} | ${true}  | ${"2023 has no 29 February"}
    ${"1900-02-29T00:00:00Z"}                | ${false} | ${true}  | ${"1900 is divisible by 100, not 400"}
    ${"2024-02-30T10:00:00+00:00"}           | ${false} | ${true}  | ${"February has no 30th"}
    ${"2024-04-31 00:00:00z"}                | ${false} | ${true}  | ${"April has 30 days"}
    ${"2024-06-31T10:00:00Z"}                | ${false} | ${true}  | ${"June has 30 days"}
    ${"2024-09-31t10:00:00-04:00"}           | ${false} | ${true}  | ${"September has 30 days"}
    ${"2024-11-31T10:00:00.5+05:30"}         | ${false} | ${true}  | ${"November has 30 days"}
  `(
    "returns $expected for $value ($reason); the pattern alone says $pattern; parseRfc3339 agrees",
    ({
      value,
      expected,
      pattern,
    }: {
      value: string;
      expected: boolean;
      pattern: boolean;
    }) => {
      expect(isValidRfc3339DateTime(value)).toBe(expected);
      expect(rfc3339DateTime.test(value)).toBe(pattern);
      expect(isValidRfc3339DateTime(value)).toBe(parseRfc3339(value) !== "");
    },
  );

  it("returns false for an argument that is not a string, as parseRfc3339 returns ''", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidRfc3339DateTime(make() as never), kind).toBe(false);
      expect(parseRfc3339(make() as never), kind).toBe("");
    }
  });
});
