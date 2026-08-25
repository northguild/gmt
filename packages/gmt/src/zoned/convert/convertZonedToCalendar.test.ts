import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, MustTestCalendars } from "../../test";
import type { CalendarSystem } from "../../types";
import {
  mockTemporalPlainDateFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { convertZonedToCalendar } from "./convertZonedToCalendar";

const BASE = "2024-10-03T14:30:45-04:00[America/New_York]";

describe("convertZonedToCalendar", () => {
  it.each`
    calendar                 | expected
    ${"gregorian"}           | ${"2024-10-03T14:30:45-04:00[America/New_York]"}
    ${"hebrew"}              | ${"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"}
    ${"islamic-civil"}       | ${"1446-03-29T14:30:45-04:00[u-ca=islamic-civil][America/New_York]"}
    ${"islamic-tabular"}     | ${"1446-03-30T14:30:45-04:00[u-ca=islamic-tabular][America/New_York]"}
    ${"islamic-umalqura"}    | ${"1446-03-30T14:30:45-04:00[u-ca=islamic-umalqura][America/New_York]"}
    ${"japanese"}            | ${"0006-10-03T14:30:45-04:00[u-ca=japanese;era=reiwa][America/New_York]"}
    ${"buddhist"}            | ${"2567-10-03T14:30:45-04:00[u-ca=buddhist][America/New_York]"}
    ${"taiwan"}              | ${"0113-10-03T14:30:45-04:00[u-ca=taiwan][America/New_York]"}
    ${"persian"}             | ${"1403-07-12T14:30:45-04:00[u-ca=persian][America/New_York]"}
    ${"indian"}              | ${"1946-07-11T14:30:45-04:00[u-ca=indian][America/New_York]"}
    ${"ethiopic"}            | ${"2017-01-23T14:30:45-04:00[u-ca=ethiopic;era=ethiopic][America/New_York]"}
    ${"ethiopic-amete-alem"} | ${"7517-01-23T14:30:45-04:00[u-ca=ethiopic-amete-alem][America/New_York]"}
    ${"coptic"}              | ${"1741-01-23T14:30:45-04:00[u-ca=coptic][America/New_York]"}
  `(
    "converts the base value to $calendar as $expected",
    ({ calendar, expected }) => {
      expect(convertZonedToCalendar(BASE, calendar as CalendarSystem)).toBe(
        expected,
      );
    },
  );

  // DoD-1: every calendar chains back to gregorian, which is the property that makes the grammar
  // a real round trip rather than a one-way display format.
  it.each(Object.values(MustTestCalendars).map((calendar) => ({ calendar })))(
    "chains $calendar back to the original bare ISO value",
    ({ calendar }) => {
      const annotated = convertZonedToCalendar(
        BASE,
        calendar as CalendarSystem,
      );
      expect(convertZonedToCalendar(annotated, "gregorian")).toBe(BASE);
    },
  );

  it.each`
    from                     | to                 | expected
    ${"hebrew"}              | ${"islamic-civil"} | ${"1446-03-29T14:30:45-04:00[u-ca=islamic-civil][America/New_York]"}
    ${"japanese"}            | ${"hebrew"}        | ${"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"}
    ${"ethiopic"}            | ${"coptic"}        | ${"1741-01-23T14:30:45-04:00[u-ca=coptic][America/New_York]"}
    ${"ethiopic-amete-alem"} | ${"japanese"}      | ${"0006-10-03T14:30:45-04:00[u-ca=japanese;era=reiwa][America/New_York]"}
  `(
    "chains directly from $from to $to as $expected",
    ({ from, to, expected }) => {
      const intermediate = convertZonedToCalendar(BASE, from as CalendarSystem);
      expect(convertZonedToCalendar(intermediate, to as CalendarSystem)).toBe(
        expected,
      );
    },
  );

  // DoD-5: mapped over the shared zone matrix rather than hand-picked, so the exotic offsets are
  // all exercised — Kathmandu +05:45, Chatham +12:45/+13:45, Lord Howe +10:30/+11:00,
  // Apia +13:00, Niue -11:00.
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      value: Temporal.Instant.from("2024-10-03T14:30:45Z")
        .toZonedDateTimeISO(timeZone)
        .toString(),
    })),
  )(
    "preserves the instant, offset and zone when converting to hebrew in $timeZone",
    ({ timeZone, value }) => {
      const annotated = convertZonedToCalendar(value, "hebrew");

      expect(annotated).toContain("[u-ca=hebrew]");
      expect(annotated).toContain(`[${timeZone}]`);
      // Segment ordering: the calendar annotation must precede the time zone.
      expect(annotated.indexOf("[u-ca=")).toBeLessThan(
        annotated.indexOf(`[${timeZone}]`),
      );
      expect(convertZonedToCalendar(annotated, "gregorian")).toBe(value);
    },
  );

  it.each`
    value                                                         | calendar       | reason
    ${"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"} | ${"gregorian"} | ${"Temporal's RFC 9557 segment ordering"}
    ${"5785-01-01T14:30:45-04:00[America/New_York][u-ca=hebrew]"} | ${"gregorian"} | ${"GMT digits in RFC 9557 ordering"}
    ${"2024-10-03[u-ca=hebrew]"}                                  | ${"hebrew"}    | ${"a plain calendar date, not a zoned value"}
    ${"2024-10-03T14:30:45"}                                      | ${"hebrew"}    | ${"a PlainDateTime with no zone"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}                           | ${"hebrew"}    | ${"leap second"}
    ${"invalid"}                                                  | ${"hebrew"}    | ${"not a datetime at all"}
  `('returns "" for $value ($reason)', ({ value, calendar }) => {
    expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe("");
  });

  it('returns "" for an unsupported calendar', () => {
    expect(
      convertZonedToCalendar(BASE, "martian" as unknown as CalendarSystem),
    ).toBe("");
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is non-string input', ({ value }) => {
    expect(convertZonedToCalendar(value as unknown as string, "hebrew")).toBe(
      "",
    );
  });

  it('returns "" when Temporal.ZonedDateTime.from throws', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(convertZonedToCalendar(BASE, "hebrew")).toBe("");
  });

  it('returns "" when Temporal.PlainDate.from throws while decomposing an annotated date half', () => {
    mockTemporalPlainDateFromThrow();
    expect(
      convertZonedToCalendar(
        "5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]",
        "gregorian",
      ),
    ).toBe("");
  });
});
