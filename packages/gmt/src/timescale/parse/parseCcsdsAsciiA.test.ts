import { CCSDS_ASCII_CASES } from "../../test/ccsdsAsciiCases";
import { parseCcsdsAsciiA } from "./parseCcsdsAsciiA";

describe("parseCcsdsAsciiA", () => {
  // CCSDS 301.0-B-4 §3.5.1.1: every shared Code A row reads as the same text with its Z.
  it.each(
    CCSDS_ASCII_CASES.map(({ codeA, instant, why }) => ({
      codeA,
      instant,
      why,
    })),
  )("returns '$instant' for '$codeA' ($why)", ({ codeA, instant }) => {
    expect(parseCcsdsAsciiA(codeA)).toBe(instant);
  });

  it.each`
    input                                  | expected                            | why
    ${"1988-01-18T17:20:43.123456"}        | ${"1988-01-18T17:20:43.123456Z"}    | ${"Z optional, §3.5.1.1"}
    ${"2024-06-15T10:30:00"}               | ${"2024-06-15T10:30:00Z"}           | ${"Z optional, no fraction"}
    ${"2024-06-15T10:30:00.5Z"}            | ${"2024-06-15T10:30:00.5Z"}         | ${"one digit, one- to n-character fraction"}
    ${"2024-06-15T10:30:00.1234567891Z"}   | ${"2024-06-15T10:30:00.123456789Z"} | ${"ten digits: ninth kept, cut not rounded"}
    ${"2024-06-15T10:30:00.999999999999Z"} | ${"2024-06-15T10:30:00.999999999Z"} | ${"rounding would carry into :01"}
    ${"2016-12-31T23:59:60"}               | ${"2016-12-31T23:59:60Z"}           | ${"leap second, no Z"}
    ${"2016-12-31T23:59:60.9999999999Z"}   | ${"2016-12-31T23:59:60.999999999Z"} | ${"cut stays inside the leap second"}
    ${"2016-12-31T23:59:59Z"}              | ${"2016-12-31T23:59:59Z"}           | ${"second before a leap second is ordinary"}
    ${"2024-02-29T00:00:00Z"}              | ${"2024-02-29T00:00:00Z"}           | ${"leap day"}
  `("returns '$expected' for '$input' ($why)", ({ input, expected }) => {
    expect(parseCcsdsAsciiA(input)).toBe(expected);
  });

  it("returns nine digits for a 60-digit fraction", () => {
    expect(parseCcsdsAsciiA(`2024-06-15T10:30:00.${"9".repeat(60)}Z`)).toBe(
      "2024-06-15T10:30:00.999999999Z",
    );
  });

  it.each`
    input                          | why
    ${"2017-12-31T23:59:60Z"}      | ${"no insertion that day (IERS table)"}
    ${"2016-12-31T12:00:60Z"}      | ${"leap second only at 23:59:60 (hour)"}
    ${"2016-12-31T23:58:60Z"}      | ${"leap second only at 23:59:60 (minute)"}
    ${"1971-12-31T23:59:60Z"}      | ${"none before 1972"}
    ${"2016-12-31T23:59:61Z"}      | ${"second above 60"}
    ${"0000-01-01T00:00:00Z"}      | ${"year 0001-9999"}
    ${"2024-02-30T00:00:00Z"}      | ${"day out of range"}
    ${"2023-02-29T00:00:00Z"}      | ${"29 February in a common year"}
    ${"2024-13-01T00:00:00Z"}      | ${"month 13"}
    ${"2024-00-10T00:00:00Z"}      | ${"month 00"}
    ${"2024-06-15T24:00:00Z"}      | ${"hour 24"}
    ${"2024-06-15T10:60:00Z"}      | ${"minute 60"}
    ${"2024-06-15T10:30:00.Z"}     | ${"period needs a digit, with Z"}
    ${"2024-06-15T10:30:00."}      | ${"period needs a digit, no Z"}
    ${"2024-06-15T10:30:00,5Z"}    | ${"comma is not the decimal sign"}
    ${"2024-06-15t10:30:00Z"}      | ${"lower-case t"}
    ${"2024-06-15T10:30:00z"}      | ${"lower-case z"}
    ${"2024-06-15T10:30:00ZZ"}     | ${"double Z"}
    ${"2024-06-15T10:30:00+00:00"} | ${"offset terminator"}
    ${"2024-06-15T10:30:00Z[UTC]"} | ${"bracket suffix"}
    ${"2024-06-15 10:30:00Z"}      | ${"space separator"}
    ${"2024-06-15T10:30Z"}         | ${"no seconds"}
    ${"2024-06-15T10Z"}            | ${"hour only"}
    ${"2024-06-15"}                | ${"date only"}
    ${"10:30:00"}                  | ${"time only"}
    ${"2024-06"}                   | ${"month only"}
    ${"2024-6-15T10:30:00Z"}       | ${"month without leading zero"}
    ${"2024-06-15T1:30:00Z"}       | ${"hour without leading zero"}
    ${"20240615T103000Z"}          | ${"basic format"}
    ${"+002024-06-15T10:30:00Z"}   | ${"expanded year"}
    ${"-2024-06-15T10:30:00Z"}     | ${"signed year"}
    ${"1988-018T17:20:43.123456Z"} | ${"a Code B string"}
    ${"2024-06-15T10:30:00Z\n"}    | ${"trailing newline"}
    ${" 2024-06-15T10:30:00Z"}     | ${"leading space"}
    ${"２０２４-06-15T10:30:00Z"}  | ${"full-width digits"}
    ${""}                          | ${"empty string"}
  `("returns '' for '$input' ($why)", ({ input }) => {
    expect(parseCcsdsAsciiA(input)).toBe("");
  });

  it.each`
    label          | input
    ${"undefined"} | ${undefined}
    ${"null"}      | ${null}
    ${"a number"}  | ${20240615}
    ${"an object"} | ${{}}
  `("returns '' for $label (not a string)", ({ input }) => {
    expect(parseCcsdsAsciiA(input as string)).toBe("");
  });
});
