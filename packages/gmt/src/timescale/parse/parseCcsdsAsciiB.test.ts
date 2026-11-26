import { Temporal } from "../../internal/temporal";
import { CCSDS_ASCII_CASES } from "../../test/ccsdsAsciiCases";
import { parseCcsdsAsciiB } from "./parseCcsdsAsciiB";

describe("parseCcsdsAsciiB", () => {
  it.each(CCSDS_ASCII_CASES.map((row) => ({ ...row })))(
    "reads the shared row '$codeB' as '$instant' ($why)",
    ({ codeB, instant }) => {
      expect(parseCcsdsAsciiB(codeB)).toBe(instant);
    },
  );

  it.each`
    input                              | expected                            | why
    ${"1988-018T17:20:43.123456Z"}     | ${"1988-01-18T17:20:43.123456Z"}    | ${"section 3.5.1.2 example"}
    ${"1988-018T17:20:43.123456"}      | ${"1988-01-18T17:20:43.123456Z"}    | ${"Z optional"}
    ${"2024-167T10:30:00"}             | ${"2024-06-15T10:30:00Z"}           | ${"Z optional, no fraction"}
    ${"2024-001T00:00:00Z"}            | ${"2024-01-01T00:00:00Z"}           | ${"first day"}
    ${"2024-060T12:00:00Z"}            | ${"2024-02-29T12:00:00Z"}           | ${"day 60, leap year"}
    ${"2023-060T12:00:00Z"}            | ${"2023-03-01T12:00:00Z"}           | ${"day 60, common year"}
    ${"2024-061T00:00:00Z"}            | ${"2024-03-01T00:00:00Z"}           | ${"day after the leap day"}
    ${"2024-167T10:30:00.000000Z"}     | ${"2024-06-15T10:30:00.000000Z"}    | ${"trailing zeros kept"}
    ${"2024-366T12:00:00Z"}            | ${"2024-12-31T12:00:00Z"}           | ${"day 366, section 3.5.1.2"}
    ${"2023-365T23:59:59Z"}            | ${"2023-12-31T23:59:59Z"}           | ${"last day, common year"}
    ${"2000-366T00:00:00Z"}            | ${"2000-12-31T00:00:00Z"}           | ${"2000 is a leap year (divisible by 400)"}
    ${"1972-182T23:59:60Z"}            | ${"1972-06-30T23:59:60Z"}           | ${"first inserted leap second, leap year"}
    ${"2015-181T23:59:60.5Z"}          | ${"2015-06-30T23:59:60.5Z"}         | ${"leap second, common year"}
    ${"2016-366T23:59:60Z"}            | ${"2016-12-31T23:59:60Z"}           | ${"last leap second, day 366"}
    ${"2016-366T23:59:60"}             | ${"2016-12-31T23:59:60Z"}           | ${"leap second without Z"}
    ${"2024-167T10:30:00.1234567891Z"} | ${"2024-06-15T10:30:00.123456789Z"} | ${"tenth digit dropped"}
    ${"0001-001T00:00:00Z"}            | ${"0001-01-01T00:00:00Z"}           | ${"lowest year"}
    ${"9999-365T23:59:59.999999999Z"}  | ${"9999-12-31T23:59:59.999999999Z"} | ${"highest instant"}
    ${"1969-365T23:59:59.5Z"}          | ${"1969-12-31T23:59:59.5Z"}         | ${"before the Unix epoch"}
  `("reads '$input' as '$expected' ($why)", ({ input, expected }) => {
    expect(parseCcsdsAsciiB(input)).toBe(expected);
  });

  it.each`
    input                            | why
    ${"2023-366T00:00:00Z"}          | ${"2023 has 365 days"}
    ${"1900-366T00:00:00Z"}          | ${"1900 is not a leap year (divisible by 100)"}
    ${"2024-367T00:00:00Z"}          | ${"beyond 366"}
    ${"2024-999T00:00:00Z"}          | ${"999 beyond 366"}
    ${"2024-000T00:00:00Z"}          | ${"days start at 001"}
    ${"2015-182T23:59:60Z"}          | ${"2015-07-01: the 60 belongs to day 181"}
    ${"2017-365T23:59:60Z"}          | ${"no insertion that day"}
    ${"2016-366T12:00:60Z"}          | ${"a leap second is only at 23:59:60"}
    ${"1971-365T23:59:60Z"}          | ${"before 1972"}
    ${"0000-001T00:00:00Z"}          | ${"year 0001 to 9999"}
    ${"2024-167T24:00:00Z"}          | ${"hour 24"}
    ${"2024-167T10:60:00Z"}          | ${"minute 60"}
    ${"2024-167T10:30:61Z"}          | ${"second 61"}
    ${"2024-167T10:30:00.Z"}         | ${"period needs a digit"}
    ${"2024-167T10:30:00,5Z"}        | ${"period only"}
    ${"2024-167t10:30:00Z"}          | ${"lower-case t"}
    ${"2024-167T10:30:00z"}          | ${"lower-case z"}
    ${"2024-167T10:30:00+00:00"}     | ${"offset, Z only"}
    ${"2024-167T10:30Z"}             | ${"no seconds"}
    ${"2024-167"}                    | ${"date only"}
    ${"2024-167T10Z"}                | ${"hour only"}
    ${"2024-67T10:30:00Z"}           | ${"DDD is three digits, too short"}
    ${"2024-0167T10:30:00Z"}         | ${"DDD is three digits, too long"}
    ${"2024167T103000Z"}             | ${"basic format"}
    ${"2024-W24-6T10:30:00Z"}        | ${"week date"}
    ${"1988-01-18T17:20:43.123456Z"} | ${"a Code A string"}
    ${"2024-167T10:30:00Z\n"}        | ${"trailing newline"}
    ${" 2024-167T10:30:00Z"}         | ${"leading space"}
    ${""}                            | ${"empty string"}
  `("returns an empty string for '$input' ($why)", ({ input }) => {
    expect(parseCcsdsAsciiB(input)).toBe("");
  });

  it.each`
    input        | label
    ${undefined} | ${"undefined"}
    ${null}      | ${"null"}
    ${2024167}   | ${"a number"}
    ${{}}        | ${"an object"}
  `("returns an empty string for $label, not a string", ({ input }) => {
    expect(parseCcsdsAsciiB(input as unknown as string)).toBe("");
  });

  it.each`
    year    | days
    ${2024} | ${366}
    ${2023} | ${365}
  `(
    "reads each of the $days days of $year as that PlainDate and refuses the next",
    ({ year, days }: { year: number; days: number }) => {
      const january1 = Temporal.PlainDate.from({ year, month: 1, day: 1 });
      for (let day = 1; day <= days; day += 1) {
        const ddd = String(day).padStart(3, "0");
        expect(parseCcsdsAsciiB(`${year}-${ddd}T00:00:00Z`)).toBe(
          `${january1.add({ days: day - 1 }).toString()}T00:00:00Z`,
        );
      }
      expect(
        parseCcsdsAsciiB(
          `${year}-${String(days + 1).padStart(3, "0")}T00:00:00Z`,
        ),
      ).toBe("");
    },
  );
});
