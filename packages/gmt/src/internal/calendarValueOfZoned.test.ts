import { calendarZonedFixtures } from "../test";
import {
  calendarOfAllZonedValues,
  calendarSystemOfZonedValue,
} from "./calendarValueOfZoned";

const Y = calendarZonedFixtures.hebrewLeapYearSpan;
const islamicEnd =
  "2024-10-03T00:00:00-04:00[America/New_York][u-ca=islamic-tbla]";

describe("calendarSystemOfZonedValue", () => {
  it.each`
    value                                                                      | expected          | label
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}                           | ${"iso8601"}      | ${"no annotation"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=iso8601]"}             | ${"iso8601"}      | ${"[u-ca=iso8601]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][!u-ca=HEBREW]"}             | ${"hebrew"}       | ${"[!u-ca=HEBREW]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethiopic-amete-alem]"} | ${"ethioaa"}      | ${"[u-ca=ethiopic-amete-alem]"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}              | ${"hebrew"}       | ${"[u-ca=hebrew]"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]"}                  | ${"japanese"}     | ${"[u-ca=japanese]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethioaa]"}             | ${"ethioaa"}      | ${"[u-ca=ethioaa]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=islamic-tbla]"}        | ${"islamic-tbla"} | ${"[u-ca=islamic-tbla]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew][u-ca=roc]"}    | ${"hebrew"}       | ${"[u-ca=hebrew][u-ca=roc]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][foo=bar][u-ca=japanese]"}   | ${"japanese"}     | ${"[foo=bar][u-ca=japanese]"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][foo=bar]"}                  | ${"iso8601"}      | ${"[foo=bar]"}
  `("returns $expected for the annotations $label", ({ value, expected }) => {
    expect(calendarSystemOfZonedValue(value)).toBe(expected);
  });

  // The read ignores the offset, but a `Z` string is an exact instant under every `offset` option
  // (ToTemporalZonedDateTime sets offsetBehaviour ~exact~; InterpretISODateTimeOffset applies
  // "ignore" only to ~option~), so these maximum and minimum instants are in range. Read by the
  // wall clock in the zone they would fall outside it (Sao Paulo is -03:00, Kolkata +05:53:28 at
  // the minimum).
  it.each`
    value
    ${"+275760-09-13T00:00:00Z[America/Sao_Paulo][u-ca=hebrew]"}
    ${"-271821-04-20T00:00:00Z[Asia/Kolkata][u-ca=hebrew]"}
  `(
    "reads the calendar of $value, a Z string at a range limit",
    ({ value }) => {
      expect(calendarSystemOfZonedValue(value)).toBe("hebrew");
    },
  );

  // Unlike `calendarSystemOfDateValue`, which reports "iso8601" for ANY non-match, the zoned
  // version fails closed on a non-matching string that still carries an annotation — calling it
  // "iso8601" would hand back an ISO answer for a string that visibly asked for something else.
  it.each`
    value                                                                       | reason
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=martian]"}              | ${"unrecognized calendar identifier"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=chinese]"}              | ${"calendar GMT does not support"}
    ${"2024-10-03T14:30:45-04:00[u-ca=hebrew][America/New_York]"}               | ${"calendar before zone"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese;era=heisei]"}        | ${"';era=' suffix"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=chinese][u-ca=hebrew]"} | ${"first calendar unsupported"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][!u-ca=hebrew][u-ca=roc]"}    | ${"second calendar after a critical one"}
  `("returns null for $value ($reason)", ({ value }) => {
    expect(calendarSystemOfZonedValue(value)).toBeNull();
  });

  // Shape validity is not this function's job — `parseCalendarZonedValue` owns that. An
  // un-annotated garbage string is reported as "iso8601" here and rejected by the validator.
  it("reports iso8601 for an unannotated string without validating its shape", () => {
    expect(calendarSystemOfZonedValue("invalid")).toBe("iso8601");
  });
});

describe("calendarOfAllZonedValues", () => {
  it.each`
    label             | values                                            | expected
    ${"empty list"}   | ${[]}                                             | ${"iso8601"}
    ${"all bare ISO"} | ${[Y.isoStart, Y.isoEnd]}                         | ${"iso8601"}
    ${"all hebrew"}   | ${[Y.tishri1_5784NewYork, Y.tishri1_5785NewYork]} | ${"hebrew"}
  `("returns $expected for $label", ({ values, expected }) => {
    expect(calendarOfAllZonedValues(values as string[])).toBe(expected);
  });

  it.each`
    label                           | values
    ${"hebrew mixed with islamic"}  | ${[Y.tishri1_5784NewYork, islamicEnd]}
    ${"hebrew mixed with bare ISO"} | ${[Y.tishri1_5784NewYork, Y.isoEnd]}
    ${"an unrecognized identifier"} | ${[Y.tishri1_5784NewYork, "2024-10-03T14:30:45-04:00[America/New_York][u-ca=martian]"]}
    ${"calendar before zone"}       | ${[Y.tishri1_5784NewYork, "2024-10-03T14:30:45-04:00[u-ca=hebrew][America/New_York]"]}
  `("returns null for a list containing $label", ({ values }) => {
    expect(calendarOfAllZonedValues(values as string[])).toBeNull();
  });
});
