import { convertDateToCalendar } from "../plain/convert/convertDateToCalendar";
import { MustTestCalendars, SampledCalendars } from "../test";
import {
  calendarOfAllDateValues,
  calendarSystemOfDateValue,
} from "./calendarValueOfDate";

describe("calendarSystemOfDateValue", () => {
  it.each`
    value                                        | expected
    ${"2024-10-03"}                               | ${MustTestCalendars.gregorian}
    ${"5785-01-01[u-ca=hebrew]"}                   | ${MustTestCalendars.hebrew}
    ${"1446-03-29[u-ca=islamic-civil]"}            | ${MustTestCalendars["islamic-civil"]}
    ${"1446-03-30[u-ca=islamic-tabular]"}          | ${MustTestCalendars["islamic-tabular"]}
    ${"1446-03-30[u-ca=islamic-umalqura]"}         | ${MustTestCalendars["islamic-umalqura"]}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"}       | ${MustTestCalendars.japanese}
    ${"2567-10-03[u-ca=buddhist]"}                 | ${MustTestCalendars.buddhist}
    ${"0113-10-03[u-ca=taiwan]"}                   | ${MustTestCalendars.taiwan}
    ${"1403-07-12[u-ca=persian]"}                  | ${MustTestCalendars.persian}
    ${"1946-07-11[u-ca=indian]"}                   | ${MustTestCalendars.indian}
    ${"2017-01-23[u-ca=ethiopic;era=ethiopic]"}    | ${MustTestCalendars.ethiopic}
    ${"7517-01-23[u-ca=ethiopic-amete-alem]"}      | ${MustTestCalendars["ethiopic-amete-alem"]}
    ${"1741-01-23[u-ca=coptic]"}                   | ${MustTestCalendars.coptic}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(calendarSystemOfDateValue(value)).toBe(expected);
    },
  );

  // Exercises the SampledCalendars structural-sample set (see test/calendarMatrix.ts) end to
  // end: convert a fixed Gregorian date into each sampled calendar and confirm
  // calendarSystemOfDateValue correctly recovers the tag from the resulting string.
  it.each`
    calendar
    ${SampledCalendars.gregorian}
    ${SampledCalendars.hebrew}
    ${SampledCalendars.islamicTabular}
    ${SampledCalendars.japanese}
    ${SampledCalendars.ethiopic}
    ${SampledCalendars.persian}
  `(
    "round-trips the $calendar calendar tag through convertDateToCalendar",
    ({ calendar }: { calendar: string }) => {
      const value = convertDateToCalendar(
        "2024-10-03",
        calendar as Parameters<typeof convertDateToCalendar>[1],
      );
      expect(calendarSystemOfDateValue(value)).toBe(calendar);
    },
  );

  it("returns null for an unrecognized calendar identifier", () => {
    expect(calendarSystemOfDateValue("2024-10-03[u-ca=martian]")).toBeNull();
  });

  it("returns gregorian (not null) for a shape that doesn't match the calendar-annotated grammar at all — pair with isValidCalendarDate for full validation", () => {
    expect(calendarSystemOfDateValue("not-a-date")).toBe("gregorian");
  });
});

describe("calendarOfAllDateValues", () => {
  it("returns gregorian for an empty list (identity/no-op case)", () => {
    expect(calendarOfAllDateValues([])).toBe("gregorian");
  });

  it("returns the shared calendar when every value carries the same tag", () => {
    expect(
      calendarOfAllDateValues([
        "5785-01-01[u-ca=hebrew]",
        "5785-02-01[u-ca=hebrew]",
        "5785-03-01[u-ca=hebrew]",
      ]),
    ).toBe("hebrew");
  });

  it("returns gregorian when every value is bare ISO", () => {
    expect(
      calendarOfAllDateValues(["2024-01-01", "2024-06-01", "2024-12-31"]),
    ).toBe("gregorian");
  });

  it("returns null when calendars are mismatched", () => {
    expect(
      calendarOfAllDateValues(["5785-01-01[u-ca=hebrew]", "2024-01-01"]),
    ).toBeNull();
  });

  it("returns null when any value has an unrecognized calendar identifier", () => {
    expect(
      calendarOfAllDateValues([
        "2024-01-01[u-ca=martian]",
        "2024-01-01[u-ca=martian]",
      ]),
    ).toBeNull();
  });
});
