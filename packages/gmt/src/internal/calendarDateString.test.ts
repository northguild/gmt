import { Temporal } from "@js-temporal/polyfill";
import {
  formatCalendarDate,
  parseCalendarDateValue,
} from "./calendarDateString";

describe("parseCalendarDateValue", () => {
  it.each`
    value                                       | expectedIso
    ${"2024-10-03"}                             | ${"2024-10-03"}
    ${"5785-01-01[u-ca=hebrew]"}                | ${"2024-10-03"}
    ${"5784-06-01[u-ca=hebrew]"}                | ${"2024-02-10"}
    ${"1446-03-29[u-ca=islamic-civil]"}         | ${"2024-10-03"}
    ${"1446-03-30[u-ca=islamic-tabular]"}       | ${"2024-10-03"}
    ${"1446-03-30[u-ca=islamic-umalqura]"}      | ${"2024-10-03"}
    ${"0006-10-03[u-ca=japanese;era=reiwa]"}    | ${"2024-10-03"}
    ${"2567-10-03[u-ca=buddhist]"}              | ${"2024-10-03"}
    ${"0113-10-03[u-ca=taiwan]"}                | ${"2024-10-03"}
    ${"1403-07-12[u-ca=persian]"}               | ${"2024-10-03"}
    ${"1946-07-11[u-ca=indian]"}                | ${"2024-10-03"}
    ${"2017-01-23[u-ca=ethiopic;era=ethiopic]"} | ${"2024-10-03"}
    ${"7517-01-23[u-ca=ethiopic-amete-alem]"}   | ${"2024-10-03"}
    ${"1741-01-23[u-ca=coptic]"}                | ${"2024-10-03"}
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
    ${"0000-10-03[u-ca=japanese;era=unknown-era]"}
    ${"0000-01-01[u-ca=ethiopic;era=unknown-era]"}
  `("throws for invalid $value", ({ value }: { value: string }) => {
    expect(() => parseCalendarDateValue(value)).toThrow();
  });

  // Regression (E5, issue #78): a bare (non-calendar-annotated) datetime/zoned string used to
  // silently succeed here — Temporal.PlainDate.from truncates a full datetime string to its
  // date portion rather than rejecting it, which this function's fallback branch inherited
  // before E5 added the strict `plainDate` regex pre-check. Predates E5 but is fixed as part
  // of it, since this function is E5's own shared parsing gate for `plain/` calendar-aware
  // functions and must not inherit the hazard.
  it.each`
    value
    ${"2024-03-10T14:30:00"}
    ${"2024-03-10T14:30:00-05:00[America/New_York]"}
  `(
    "throws for a datetime/zoned string $value instead of silently truncating to its date portion",
    ({ value }: { value: string }) => {
      expect(() => parseCalendarDateValue(value)).toThrow();
    },
  );
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

  it("annotates with GMT's own id, not Temporal's differing calendarId (taiwan/roc)", () => {
    const date = Temporal.PlainDate.from("2024-10-03").withCalendar("roc");
    expect(date.calendarId).toBe("roc");
    expect(formatCalendarDate(date)).toBe("0113-10-03[u-ca=taiwan]");
  });

  it("tags a japanese PlainDate with eraYear and an era suffix instead of the proleptic year", () => {
    const date = Temporal.PlainDate.from("2024-10-03").withCalendar("japanese");
    expect(date.year).toBe(2024);
    expect(date.eraYear).toBe(6);
    expect(date.era).toBe("reiwa");
    expect(formatCalendarDate(date)).toBe(
      "0006-10-03[u-ca=japanese;era=reiwa]",
    );
  });

  it("tags a pre-Meiji japanese PlainDate with the synthetic 'japanese' era", () => {
    const date = Temporal.PlainDate.from("1800-01-01").withCalendar("japanese");
    expect(date.era).toBe("japanese");
    expect(formatCalendarDate(date)).toBe(
      "1800-01-01[u-ca=japanese;era=japanese]",
    );
  });

  // Ethiopic-family dates ("ethiopic" / "ethiopic-amete-alem" / "coptic") never reach this
  // function — they format via formatEthiopicFamilyDate in ethiopicFamilyCalendar.ts
  // instead, which never constructs or reads a Temporal PlainDate calendared as "ethiopic"
  // or "coptic" (see that file's tests, and its module comment for why).
});
