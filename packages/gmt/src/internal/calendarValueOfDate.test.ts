import { convertDateToCalendar } from "../plain/convert/convertDateToCalendar";
import { MustTestCalendars, SampledCalendars } from "../test";
import {
  calendarOfAllDateValues,
  calendarSystemOfDateValue,
} from "./calendarValueOfDate";

describe("calendarSystemOfDateValue", () => {
  it.each`
    value                                     | expected
    ${"2024-10-03"}                           | ${MustTestCalendars.iso8601}
    ${"2024-10-03[u-ca=hebrew]"}              | ${MustTestCalendars.hebrew}
    ${"2024-10-03[u-ca=islamic-civil]"}       | ${MustTestCalendars["islamic-civil"]}
    ${"2024-10-03[u-ca=islamic-tbla]"}        | ${MustTestCalendars["islamic-tbla"]}
    ${"2024-10-03[u-ca=islamic-umalqura]"}    | ${MustTestCalendars["islamic-umalqura"]}
    ${"2024-10-03[u-ca=japanese]"}            | ${MustTestCalendars.japanese}
    ${"2024-10-03[u-ca=buddhist]"}            | ${MustTestCalendars.buddhist}
    ${"2024-10-03[u-ca=roc]"}                 | ${MustTestCalendars.roc}
    ${"2024-10-03[u-ca=persian]"}             | ${MustTestCalendars.persian}
    ${"2024-10-03[u-ca=indian]"}              | ${MustTestCalendars.indian}
    ${"2024-10-03[u-ca=ethiopic]"}            | ${MustTestCalendars.ethiopic}
    ${"2024-10-03[u-ca=ethioaa]"}             | ${MustTestCalendars.ethioaa}
    ${"2024-10-03[u-ca=coptic]"}              | ${MustTestCalendars.coptic}
    ${"2024-10-03[u-ca=gregory]"}             | ${MustTestCalendars.gregory}
    ${"2024-10-03[u-ca=iso8601]"}             | ${MustTestCalendars.iso8601}
    ${"2024-10-03[!u-ca=hebrew]"}             | ${MustTestCalendars.hebrew}
    ${"2024-10-03[u-ca=HEBREW]"}              | ${MustTestCalendars.hebrew}
    ${"2024-10-03[u-ca=ethiopic-amete-alem]"} | ${MustTestCalendars.ethioaa}
    ${"2024-10-03[u-ca=islamicc]"}            | ${MustTestCalendars["islamic-civil"]}
    ${"2024-10-03[u-ca=hebrew][u-ca=roc]"}    | ${MustTestCalendars.hebrew}
    ${"2024-10-03[Asia/Tokyo][u-ca=roc]"}     | ${MustTestCalendars.roc}
    ${"2024-10-03[foo=bar][u-ca=japanese]"}   | ${MustTestCalendars.japanese}
    ${"2024-10-03[Asia/Tokyo]"}               | ${MustTestCalendars.iso8601}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(calendarSystemOfDateValue(value)).toBe(expected);
    },
  );

  // Exercises the SampledCalendars structural-sample set (see test/calendarMatrix.ts) end to
  // end: convert a fixed ISO date into each sampled calendar and confirm
  // calendarSystemOfDateValue correctly recovers the tag from the resulting string.
  it.each`
    calendar
    ${SampledCalendars.iso8601}
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

  it.each`
    value
    ${"2024-10-03[u-ca=martian]"}
    ${"2024-10-03[u-ca=taiwan]"}
    ${"2024-10-03[u-ca=chinese]"}
    ${"2024-10-03[u-ca=chinese][u-ca=hebrew]"}
    ${"2024-10-03[u-ca=hebrew][!u-ca=roc]"}
  `(
    "returns null for the unsupported calendar identifier in $value",
    ({ value }) => {
      expect(calendarSystemOfDateValue(value)).toBeNull();
    },
  );

  it("returns iso8601 (not null) for a shape that doesn't match the calendar-annotated grammar at all — pair with isValidCalendarDate for full validation", () => {
    expect(calendarSystemOfDateValue("not-a-date")).toBe("iso8601");
  });
});

describe("calendarOfAllDateValues", () => {
  it("returns iso8601 for an empty list (identity/no-op case)", () => {
    expect(calendarOfAllDateValues([])).toBe("iso8601");
  });

  it("returns the shared calendar when every value carries the same tag", () => {
    expect(
      calendarOfAllDateValues([
        "2024-10-03[u-ca=hebrew]",
        "2024-11-02[u-ca=hebrew]",
        "2024-12-02[u-ca=hebrew]",
      ]),
    ).toBe("hebrew");
  });

  it("returns iso8601 when every value is bare ISO", () => {
    expect(
      calendarOfAllDateValues(["2024-01-01", "2024-06-01", "2024-12-31"]),
    ).toBe("iso8601");
  });

  it("returns null when calendars are mismatched", () => {
    expect(
      calendarOfAllDateValues(["2024-10-03[u-ca=hebrew]", "2024-01-01"]),
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
