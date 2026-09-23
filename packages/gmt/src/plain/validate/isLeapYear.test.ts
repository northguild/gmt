import { isLeapYear } from "./isLeapYear";

describe("isLeapYear", () => {
  it.each`
    value
    ${"2024-02-29"}
    ${"2020-02-29"}
    ${"2016-02-29"}
    ${"2000-02-29"}
  `("returns true for leap year date: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(true);
  });

  it.each`
    value
    ${"2023-01-01"}
    ${"1900-02-28"}
    ${"2100-02-28"}
  `("returns false for non-leap year date: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(false);
  });

  it.each`
    value
    ${"2024-02-30"}
    ${"2024-13-01"}
    ${"not-a-date"}
  `("returns false for invalid date string: $value", ({ value }) => {
    expect(isLeapYear(value)).toBe(false);
  });

  // Validate, then parse (isValidDate): every shape isValidDate rejects is invalid input here,
  // not something to truncate or read with ISO digits. Each is a leap year (2024) if read loosely.
  it.each`
    value                                        | shape
    ${"2024-03-15T10:00"}                        | ${"PlainDateTime"}
    ${"2024-03-15T10:00:00+05:30[Asia/Kolkata]"} | ${"zoned datetime"}
    ${"20240315"}                                | ${"basic format"}
    ${"2024-12-31T23:59:60"}                     | ${"leap second"}
    ${"2024-06-15[u-ca=hebrew]"}                 | ${"calendar annotation"}
  `(
    "returns false for $value ($shape), which isValidDate rejects",
    ({ value }) => {
      expect(isLeapYear(value)).toBe(false);
    },
  );

  // isValidDate reads annotations as Temporal.PlainDate.from does (RFC 9557 §3.3): `[u-ca=iso8601]`
  // names the ISO calendar and an elective annotation is ignored, so 2024 is a leap year.
  it.each`
    value                         | expected
    ${"2024-06-15[u-ca=iso8601]"} | ${true}
    ${"2024-06-15[foo=bar]"}      | ${true}
    ${"2024-06-15[!foo=bar]"}     | ${false}
  `(
    "reads the annotations of $value as Temporal does → $expected",
    ({ value, expected }) => {
      expect(isLeapYear(value)).toBe(expected);
    },
  );
});
