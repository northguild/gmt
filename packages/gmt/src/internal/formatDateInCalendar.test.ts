import { Temporal } from "@js-temporal/polyfill";
import { formatDateInCalendar } from "./formatDateInCalendar";

describe("formatDateInCalendar", () => {
  // Temporal TemporalDateToString with calendarName "auto": PadISOYear, ISO month and day, then
  // FormatCalendarAnnotation, which is empty only for "iso8601".
  it.each`
    iso                | calendarId        | calendar          | expected
    ${"2024-10-03"}    | ${"iso8601"}      | ${"iso8601"}      | ${"2024-10-03"}
    ${"2024-10-03"}    | ${"gregory"}      | ${"gregory"}      | ${"2024-10-03[u-ca=gregory]"}
    ${"2024-10-03"}    | ${"hebrew"}       | ${"hebrew"}       | ${"2024-10-03[u-ca=hebrew]"}
    ${"2024-10-03"}    | ${"islamic-tbla"} | ${"islamic-tbla"} | ${"2024-10-03[u-ca=islamic-tbla]"}
    ${"2024-10-03"}    | ${"ethioaa"}      | ${"ethiopic"}     | ${"2024-10-03[u-ca=ethiopic]"}
    ${"2024-10-03"}    | ${"ethioaa"}      | ${"coptic"}       | ${"2024-10-03[u-ca=coptic]"}
    ${"2024-10-03"}    | ${"ethioaa"}      | ${"ethioaa"}      | ${"2024-10-03[u-ca=ethioaa]"}
    ${"+275760-09-13"} | ${"hebrew"}       | ${"hebrew"}       | ${"+275760-09-13[u-ca=hebrew]"}
    ${"-271821-04-19"} | ${"roc"}          | ${"roc"}          | ${"-271821-04-19[u-ca=roc]"}
    ${"0000-01-01"}    | ${"japanese"}     | ${"japanese"}     | ${"0000-01-01[u-ca=japanese]"}
    ${"+010000-01-01"} | ${"persian"}      | ${"persian"}      | ${"+010000-01-01[u-ca=persian]"}
  `(
    "formats ISO $iso computed in $calendarId as $calendar: $expected",
    ({ iso, calendarId, calendar, expected }) => {
      const date = Temporal.PlainDate.from(iso).withCalendar(calendarId);
      expect(formatDateInCalendar(date, calendar)).toBe(expected);
    },
  );

  it("writes the ISO digits of the date, whatever calendar it computes in", () => {
    const date = Temporal.PlainDate.from({
      calendar: "hebrew",
      year: 5784,
      month: 6,
      day: 15,
    });
    expect(formatDateInCalendar(date, "hebrew")).toBe(
      "2024-02-24[u-ca=hebrew]",
    );
  });
});
