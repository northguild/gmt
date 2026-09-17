import { instantLeapSecond, leapSecond } from "./leap-second";

describe("leapSecond regex", () => {
  it("matches valid leap second datetimes", () => {
    expect(leapSecond.test("2024-12-31T23:59:60Z")).toBe(true);
    expect(leapSecond.test("2024-12-31T23:59:60.123Z")).toBe(true);
    expect(leapSecond.test("2024-12-31T23:59:60+00:00")).toBe(true);
    expect(leapSecond.test("2024-12-31T23:59:60.123+00:00")).toBe(true);
  });

  it("does not match non-leap second datetimes", () => {
    expect(leapSecond.test("2024-12-31T23:59:59Z")).toBe(false);
    expect(leapSecond.test("2024-12-31T23:59:61Z")).toBe(false);
  });

  // Temporal clamps a second of 60 with no designator too (PlainDateTime.from and PlainTime.from),
  // so leapSecond matches a bare date-time and a bare time. An instant always has a designator.
  it.each`
    value                        | leap     | instant
    ${"2024-12-31T23:59:60"}     | ${true}  | ${false}
    ${"2024-12-31T23:59:60.123"} | ${true}  | ${false}
    ${"23:59:60"}                | ${true}  | ${false}
    ${"T235960"}                 | ${true}  | ${false}
    ${"23:59:60-05:00"}          | ${true}  | ${false}
    ${"23:59:59"}                | ${false} | ${false}
  `(
    "leapSecond is $leap and instantLeapSecond is $instant for $value",
    ({ value, leap, instant }) => {
      expect(leapSecond.test(value)).toBe(leap);
      expect(instantLeapSecond.test(value)).toBe(instant);
    },
  );
});

// Temporal's DateTimeSeparator is SP, `T` or `t`, its TimeSpec has a basic `HHMMSS` form, and
// its DateSpec a basic `YYYYMMDD` form. ParseISODateTime clamps `secondMV = 60` to 59, so every
// one of these spellings is a leap second Temporal would silently turn into `:59`.
describe.each`
  name                   | pattern
  ${"leapSecond"}        | ${leapSecond}
  ${"instantLeapSecond"} | ${instantLeapSecond}
`("$name — every spelling Temporal's grammar accepts", ({ name, pattern }) => {
  it.each`
    value                                    | spelling
    ${"2016-12-31T23:59:60Z"}                | ${"uppercase T, extended"}
    ${"2016-12-31t23:59:60+00:00[UTC]"}      | ${"lowercase t separator"}
    ${"2016-12-31 23:59:60+00:00[UTC]"}      | ${"space separator"}
    ${"2016-12-31T235960+00:00[UTC]"}        | ${"basic HHMMSS time"}
    ${"20161231T235960Z[UTC]"}               | ${"basic YYYYMMDD date and time"}
    ${"20161231t235960z"}                    | ${"basic, lowercase t and z"}
    ${"2016-12-31T23:59:60[UTC]"}            | ${"no offset, zone annotation"}
    ${"2016-12-31T23:59:60,5-05:00"}         | ${"comma decimal separator"}
    ${"+002016-12-31T23:59:60Z"}             | ${"expanded year"}
    ${"2016-12-31T23:59:60+00:00[UTC][x=y]"} | ${"followed by an elective annotation"}
  `("matches $value ($spelling)", ({ value }) => {
    expect(pattern.test(value)).toBe(true);
  });

  // RFC 9557 §4.1: suffix-value = 1*alphanum, joined by "-", so `T123460Z` and `t000060-y` are
  // legal annotation values, and Temporal ignores an unknown elective key. They are not the
  // time of day, so they must not trip the leap-second rejection.
  it.each`
    value                                           | reason
    ${"2024-01-01T00:00:00Z[x=T123460Z]"}           | ${"annotation value that looks like a basic leap second"}
    ${"2024-01-01T00:00:00Z[x=t000060-y]"}          | ${"lowercase annotation value"}
    ${"2024-01-01T00:00:00+00:00[UTC][x=T123460Z]"} | ${"annotation after a zone"}
    ${"2016-12-31T23:59:59Z"}                       | ${"second 59"}
  `("does not match $value ($reason)", ({ value }) => {
    expect(pattern.test(value)).toBe(false);
  });

  it("matches a bare date-time only for leapSecond (an instant needs a designator)", () => {
    expect(pattern.test("2016-12-31T23:59:60")).toBe(name === "leapSecond");
  });
});
