import { Temporal } from "@js-temporal/polyfill";
import {
  formatCalendarDate,
  parseCalendarDateValue,
} from "./calendarDateString";

describe("parseCalendarDateValue", () => {
  it.each`
    value                                  | expectedIso
    ${"2024-10-03"}                        | ${"2024-10-03"}
    ${"5785-01-01[u-ca=hebrew]"}           | ${"2024-10-03"}
    ${"5784-06-01[u-ca=hebrew]"}           | ${"2024-02-10"}
    ${"1446-03-29[u-ca=islamic-civil]"}    | ${"2024-10-03"}
    ${"1446-03-30[u-ca=islamic-tabular]"}  | ${"2024-10-03"}
    ${"1446-03-30[u-ca=islamic-umalqura]"} | ${"2024-10-03"}
  `(
    "parses $value to iso $expectedIso",
    ({ value, expectedIso }: { value: string; expectedIso: string }) => {
      expect(
        parseCalendarDateValue(value).withCalendar("iso8601").toString(),
      ).toBe(expectedIso);
    },
  );

  it.each`
    value
    ${"2024-02-30"}
    ${"5783-14-01[u-ca=hebrew]"}
    ${"2024-10-03[u-ca=martian]"}
    ${"not-a-date"}
  `("throws for invalid $value", ({ value }: { value: string }) => {
    expect(() => parseCalendarDateValue(value)).toThrow();
  });
});

describe("formatCalendarDate", () => {
  it("formats an iso8601 PlainDate without a calendar annotation", () => {
    const date = Temporal.PlainDate.from("2024-10-03");
    expect(formatCalendarDate(date)).toBe("2024-10-03");
  });

  it("formats a hebrew PlainDate with calendar-native fields and annotation", () => {
    const date = Temporal.PlainDate.from("2024-10-03").withCalendar("hebrew");
    expect(formatCalendarDate(date)).toBe("5785-01-01[u-ca=hebrew]");
  });

  it("zero-pads a hebrew leap-month ordinal to two digits", () => {
    const date = Temporal.PlainDate.from({
      year: 5784,
      month: 6,
      day: 1,
      calendar: "hebrew",
    });
    expect(formatCalendarDate(date)).toBe("5784-06-01[u-ca=hebrew]");
  });

  it("annotates with GMT's own id, not Temporal's differing calendarId", () => {
    const date =
      Temporal.PlainDate.from("2024-10-03").withCalendar("islamic-tbla");
    expect(date.calendarId).toBe("islamic-tbla");
    expect(formatCalendarDate(date)).toBe("1446-03-30[u-ca=islamic-tabular]");
  });
});
