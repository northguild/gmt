import { calendarZonedFixtures } from "../test";
import {
  calendarOfAllZonedValues,
  calendarSystemOfZonedValue,
} from "./calendarValueOfZoned";

const Y = calendarZonedFixtures.hebrewLeapYearSpan;
const islamicEnd =
  "1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]";

describe("calendarSystemOfZonedValue", () => {
  it.each`
    value                                                                      | expected
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}                           | ${"gregorian"}
    ${"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"}              | ${"hebrew"}
    ${"0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]"}       | ${"japanese"}
    ${"7517-01-23T14:30:45-04:00[u-ca=ethiopic-amete-alem][America/New_York]"} | ${"ethiopic-amete-alem"}
    ${"1446-03-30T14:30:45-04:00[u-ca=islamic-tabular][America/New_York]"}     | ${"islamic-tabular"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(calendarSystemOfZonedValue(value)).toBe(expected);
  });

  // Unlike `calendarSystemOfDateValue`, which reports "gregorian" for ANY non-match, the zoned
  // version fails closed on a non-matching string that still carries an annotation — calling
  // Temporal's own ordering "gregorian" would hand back a Gregorian answer for a string that
  // visibly asked for something else.
  it.each`
    value                                                          | reason
    ${"5784-06-15T14:30:00-05:00[u-ca=martian][America/New_York]"} | ${"unrecognized calendar identifier"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"}  | ${"Temporal's RFC 9557 segment ordering"}
    ${"5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"}  | ${"GMT digits in RFC 9557 ordering"}
  `("returns null for $value ($reason)", ({ value }) => {
    expect(calendarSystemOfZonedValue(value)).toBeNull();
  });

  // Shape validity is not this function's job — `parseCalendarZonedValue` owns that. An
  // un-annotated garbage string is reported as "gregorian" here and rejected by the validator.
  it("reports gregorian for an unannotated string without validating its shape", () => {
    expect(calendarSystemOfZonedValue("invalid")).toBe("gregorian");
  });
});

describe("calendarOfAllZonedValues", () => {
  it.each`
    label             | values                                            | expected
    ${"empty list"}   | ${[]}                                             | ${"gregorian"}
    ${"all bare ISO"} | ${[Y.isoStart, Y.isoEnd]}                         | ${"gregorian"}
    ${"all hebrew"}   | ${[Y.tishri1_5784NewYork, Y.tishri1_5785NewYork]} | ${"hebrew"}
  `("returns $expected for $label", ({ values, expected }) => {
    expect(calendarOfAllZonedValues(values as string[])).toBe(expected);
  });

  it.each`
    label                            | values
    ${"hebrew mixed with islamic"}   | ${[Y.tishri1_5784NewYork, islamicEnd]}
    ${"hebrew mixed with bare ISO"}  | ${[Y.tishri1_5784NewYork, Y.isoEnd]}
    ${"an unrecognized identifier"}  | ${[Y.tishri1_5784NewYork, "5784-06-15T14:30:00-05:00[u-ca=martian][America/New_York]"]}
    ${"Temporal's segment ordering"} | ${[Y.tishri1_5784NewYork, "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"]}
  `("returns null for a list containing $label", ({ values }) => {
    expect(calendarOfAllZonedValues(values as string[])).toBeNull();
  });
});
