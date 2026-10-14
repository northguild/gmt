import { NON_STRINGS } from "../../test/ediCodes";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { isValidUtc } from "./isValidUtc";
import { isValidUtcTimestamp } from "./isValidUtcTimestamp";

/**
 * Each verdict is worked out from the RFC 3339 §5.6 grammar and the calendar, never from the
 * function: `date-time = full-date "T" full-time`; `date-fullyear = 4DIGIT`; `date-month` is
 * 01-12; `time-hour` is 00-23 and `time-minute` 00-59; `partial-time = time-hour ":" time-minute
 * ":" time-second [time-secfrac]`; `time-secfrac = "." 1*DIGIT`; `time-offset = "Z" /
 * time-numoffset`. The last day of each month is the §5.7 table, and the leap-year rule is
 * Appendix C: divisible by 4, and a year divisible by 100 must also be divisible by 400.
 *
 * The function takes one spelling of that grammar, so the other spellings §5.6 allows are false
 * here: a lower-case `t` or `z`, a space for `T` (its NOTE) and a `time-numoffset`, the `-00:00`
 * of §4.3 included. Two GMT rules are narrower than the grammar as well: nine fraction digits at
 * most (Temporal keeps nanoseconds), and no second `60` (Temporal would read it as `:59`).
 */
describe("isValidUtcTimestamp", () => {
  it.each`
    value                                   | expected | reason
    ${"2026-10-06T12:00:00Z"}               | ${true}  | ${"full-date, T, full-time, Z"}
    ${"2026-10-06T12:00:00.5Z"}             | ${true}  | ${"one fraction digit"}
    ${"2026-10-06T12:00:00.000Z"}           | ${true}  | ${"a second spelling of 12:00:00Z"}
    ${"2026-10-06T12:00:00.123456789Z"}     | ${true}  | ${"nine fraction digits"}
    ${"0000-01-01T00:00:00Z"}               | ${true}  | ${"year 0000: date-fullyear = 4DIGIT"}
    ${"9999-12-31T23:59:59Z"}               | ${true}  | ${"the last second of year 9999"}
    ${"9999-12-31T23:59:59.999999999Z"}     | ${true}  | ${"the last nanosecond of year 9999"}
    ${"2024-02-29T00:00:00Z"}               | ${true}  | ${"29 February in a leap year"}
    ${"2000-02-29T00:00:00Z"}               | ${true}  | ${"Appendix C: 2000 divides by 400"}
    ${"2026-10-06T12:00:00Z[Europe/Paris]"} | ${false} | ${"RFC 9557 time zone annotation after Z"}
    ${"2026-10-06T12:00:00Z[u-ca=gregory]"} | ${false} | ${"RFC 9557 calendar annotation after Z"}
    ${"2026-10-06T12:00:00Z[foo=bar]"}      | ${false} | ${"RFC 9557 elective annotation after Z"}
    ${"2026-10-06T12:00:00,5Z"}             | ${false} | ${"comma: time-secfrac starts with a dot"}
    ${"2026-10-06T12:00:00.Z"}              | ${false} | ${"time-secfrac: a dot needs a digit"}
    ${"-005000-01-01T00:00:00Z"}            | ${false} | ${"expanded year before 0000"}
    ${"+010000-01-01T00:00:00Z"}            | ${false} | ${"expanded year after 9999"}
    ${"+002026-10-06T12:00:00Z"}            | ${false} | ${"expanded year inside 0000-9999"}
    ${"2026-10-06T12:00:00.1234567890Z"}    | ${false} | ${"ten fraction digits: GMT keeps nine"}
    ${"2026-10-06T12:00:00+00:00"}          | ${false} | ${"UTC as a numeric offset, not Z"}
    ${"2026-10-06T12:00:00-00:00"}          | ${false} | ${"§4.3 -00:00: a numeric offset, not Z"}
    ${"2026-10-06T12:00:00+03:00"}          | ${false} | ${"an offset east of UTC, not Z"}
    ${"2026-10-06t12:00:00z"}               | ${false} | ${"lower-case t and z"}
    ${"2026-10-06 12:00:00Z"}               | ${false} | ${"a space for T"}
    ${"20261006T120000Z"}                   | ${false} | ${"ISO 8601 basic format"}
    ${"2026-10-06T12:00Z"}                  | ${false} | ${"no seconds: time-second is required"}
    ${"2026-10-06"}                         | ${false} | ${"a date without a time"}
    ${"2026-10-06T24:00:00Z"}               | ${false} | ${"hour 24: time-hour is 00-23"}
    ${"2026-10-06T12:60:00Z"}               | ${false} | ${"minute 60: time-minute is 00-59"}
    ${"2026-13-06T12:00:00Z"}               | ${false} | ${"month 13: date-month is 01-12"}
    ${"2026-00-06T12:00:00Z"}               | ${false} | ${"month 00: date-month is 01-12"}
    ${"2026-10-00T12:00:00Z"}               | ${false} | ${"day 00: date-mday starts at 01"}
    ${"2026-10-32T12:00:00Z"}               | ${false} | ${"day 32: date-mday ends at 31"}
    ${"2026-02-30T00:00:00Z"}               | ${false} | ${"February has no 30th"}
    ${"2026-04-31T00:00:00Z"}               | ${false} | ${"§5.7: April has 30 days"}
    ${"2025-02-29T00:00:00Z"}               | ${false} | ${"§5.7: 2025 is a common year"}
    ${"1900-02-29T00:00:00Z"}               | ${false} | ${"App. C: 1900 divides by 100, not 400"}
    ${"2016-12-31T23:59:60Z"}               | ${false} | ${"a real leap second: GMT rejects it"}
    ${" 2026-10-06T12:00:00Z"}              | ${false} | ${"leading space"}
    ${"2026-10-06T12:00:00Z "}              | ${false} | ${"trailing space"}
    ${"2026-10-06T12:00:00Z\n"}             | ${false} | ${"trailing line feed"}
    ${""}                                   | ${false} | ${"empty"}
  `(
    "returns $expected for $value ($reason); a true row is true for isValidUtc",
    ({ value, expected }: { value: string; expected: boolean }) => {
      expect(isValidUtcTimestamp(value)).toBe(expected);
      // A subset of isValidUtc: no row is true here and false there.
      expect(isValidUtc(value) || !expected).toBe(true);
    },
  );

  it("returns false for an argument that is not a string", () => {
    for (const [kind, make] of NON_STRINGS) {
      expect(isValidUtcTimestamp(make() as never), kind).toBe(false);
    }
  });

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(isValidUtcTimestamp("2026-10-06T12:00:00Z")).toBe(false);
  });
});
