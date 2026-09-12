import { zonelessCalendarDate } from "./zonelessCalendarDate";

describe("zonelessCalendarDate", () => {
  it.each`
    value                        | expected
    ${"2024-06-15"}              | ${"2024-06-15"}
    ${"2024-06-15T00:00:00"}     | ${"2024-06-15"}
    ${"2024-06-15T23:59:59.999"} | ${"2024-06-15"}
    ${"2024-02-29"}              | ${"2024-02-29"}
    ${"+000031-04-30"}           | ${"0031-04-30"}
  `("reads $value as the calendar date $expected", ({ value, expected }) => {
    expect(zonelessCalendarDate(value)?.toString()).toBe(expected);
  });

  it.each`
    value                                            | description
    ${"2024-06-15T12:00:00Z"}                        | ${"a UTC instant"}
    ${"2024-06-15T12:00:00-04:00"}                   | ${"an offset datetime"}
    ${"2024-06-15T12:00:00-04:00[America/New_York]"} | ${"a zoned datetime"}
    ${"2024-06-15T12:00:00+00:00[UTC]"}              | ${"a UTC-bracketed zoned datetime"}
    ${"5784-01-01[u-ca=hebrew]"}                     | ${"a calendar-annotated date"}
    ${"2024-06-15 12:00:00"}                         | ${"a space separator"}
    ${"2024-02-30"}                                  | ${"a date that does not exist"}
    ${"2024-12-31T23:59:60"}                         | ${"a leap second"}
    ${"2024-06"}                                     | ${"a year-month"}
    ${"invalid"}                                     | ${"an unparseable string"}
    ${""}                                            | ${"an empty string"}
  `("returns null for $value ($description)", ({ value }) => {
    expect(zonelessCalendarDate(value)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `("returns null when $value is non-string input", ({ value }) => {
    expect(zonelessCalendarDate(value as unknown as string)).toBeNull();
  });
});
