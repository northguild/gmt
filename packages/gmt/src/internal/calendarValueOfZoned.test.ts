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
    value                                                                      | expected
    ${"2024-10-03T14:30:45-04:00[America/New_York]"}                           | ${"iso8601"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=iso8601]"}             | ${"iso8601"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][!u-ca=HEBREW]"}             | ${"hebrew"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethiopic-amete-alem]"} | ${"ethioaa"}
    ${"2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]"}              | ${"hebrew"}
    ${"2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]"}                  | ${"japanese"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=ethioaa]"}             | ${"ethioaa"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=islamic-tbla]"}        | ${"islamic-tbla"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew][u-ca=roc]"}    | ${"hebrew"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][foo=bar][u-ca=japanese]"}   | ${"japanese"}
    ${"2024-10-03T14:30:45-04:00[America/New_York][foo=bar]"}                  | ${"iso8601"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(calendarSystemOfZonedValue(value)).toBe(expected);
  });

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
