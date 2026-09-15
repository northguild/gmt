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

  // CORE-6 D1: the date half of a zoned value at the TC39 maximum parses through the same
  // fields -> ISO path as plain dates. Values: test262 extreme-dates.js max rows.
  it.each`
    calendar                 | expected
    ${"hebrew"}              | ${"279517-10-11T00:00:00+00:00[u-ca=hebrew][UTC]"}
    ${"buddhist"}            | ${"276303-09-13T00:00:00+00:00[u-ca=buddhist][UTC]"}
    ${"islamic-civil"}       | ${"283583-05-23T00:00:00+00:00[u-ca=islamic-civil][UTC]"}
    ${"islamic-tabular"}     | ${"283583-05-24T00:00:00+00:00[u-ca=islamic-tabular][UTC]"}
    ${"islamic-umalqura"}    | ${"283583-05-23T00:00:00+00:00[u-ca=islamic-umalqura][UTC]"}
    ${"persian"}             | ${"275139-07-12T00:00:00+00:00[u-ca=persian][UTC]"}
    ${"indian"}              | ${"275682-06-22T00:00:00+00:00[u-ca=indian][UTC]"}
    ${"japanese"}            | ${"273742-09-13T00:00:00+00:00[u-ca=japanese;era=reiwa][UTC]"}
    ${"taiwan"}              | ${"273849-09-13T00:00:00+00:00[u-ca=taiwan][UTC]"}
    ${"ethiopic-amete-alem"} | ${"281247-05-22T00:00:00+00:00[u-ca=ethiopic-amete-alem][UTC]"}
    ${"coptic"}              | ${"275471-05-22T00:00:00+00:00[u-ca=coptic][UTC]"}
    ${"ethiopic"}            | ${"275747-05-22T00:00:00+00:00[u-ca=ethiopic;era=ethiopic][UTC]"}
  `(
    "converts the maximum instant to $calendar as $expected and back",
    ({ calendar, expected }) => {
      const max = "+275760-09-13T00:00:00+00:00[UTC]";
      expect(convertZonedToCalendar(max, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(convertZonedToCalendar(expected, "gregorian")).toBe(max);
    },
  );

  // CORE-6 D1 + G1: the minimum instant in UTC, whose date is -271821-04-20 (minimum + 1 day), so
  // the date half sits inside every D1 min window. Values: Chromium 152 reads of that date
  // (q2-xscan-chromium152.json edge[<calendar>].min[1]); coptic = ethioaa year - 5776.
  it.each`
    calendar                 | expected
    ${"gregorian"}           | ${"-271821-04-20T00:00:00+00:00[UTC]"}
    ${"islamic-civil"}       | ${"-280804-03-22T00:00:00+00:00[u-ca=islamic-civil][UTC]"}
    ${"islamic-tabular"}     | ${"-280804-03-23T00:00:00+00:00[u-ca=islamic-tabular][UTC]"}
    ${"islamic-umalqura"}    | ${"-280804-03-22T00:00:00+00:00[u-ca=islamic-umalqura][UTC]"}
    ${"persian"}             | ${"-272442-01-10T00:00:00+00:00[u-ca=persian][UTC]"}
    ${"taiwan"}              | ${"-273732-04-20T00:00:00+00:00[u-ca=taiwan][UTC]"}
    ${"ethiopic-amete-alem"} | ${"-266323-03-24T00:00:00+00:00[u-ca=ethiopic-amete-alem][UTC]"}
    ${"coptic"}              | ${"-272099-03-24T00:00:00+00:00[u-ca=coptic][UTC]"}
    ${"ethiopic"}            | ${"-266323-03-24T00:00:00+00:00[u-ca=ethiopic;era=ethioaa][UTC]"}
    ${"buddhist"}            | ${"-271278-04-20T00:00:00+00:00[u-ca=buddhist][UTC]"}
    ${"hebrew"}              | ${"-268058-11-05T00:00:00+00:00[u-ca=hebrew][UTC]"}
    ${"indian"}              | ${"-271899-01-30T00:00:00+00:00[u-ca=indian][UTC]"}
    ${"japanese"}            | ${"271822-04-20T00:00:00+00:00[u-ca=japanese;era=bce][UTC]"}
  `(
    "converts the minimum instant in UTC to $calendar as $expected and back",
    ({ calendar, expected }) => {
      const min = "-271821-04-20T00:00:00+00:00[UTC]";
      expect(convertZonedToCalendar(min, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(convertZonedToCalendar(expected, "gregorian")).toBe(min);
    },
  );

  // CORE-6 owner decisions: buddhist is proleptic (ISO year + 543); hebrew years <= 0 and indian
  // dates before ISO year 1 follow the published arithmetic; japanese emits the Intl era/monthCode
  // proposal's era codes. Values: Chromium 152 reads (spec §4.2, §5.1).
  it.each`
    value                                  | calendar      | expected
    ${"1000-01-01T00:00:00+00:00[UTC]"}    | ${"buddhist"} | ${"1543-01-01T00:00:00+00:00[u-ca=buddhist][UTC]"}
    ${"-100000-01-01T00:00:00+00:00[UTC]"} | ${"hebrew"}   | ${"-096239-06-23T00:00:00+00:00[u-ca=hebrew][UTC]"}
    ${"-000500-06-15T00:00:00+00:00[UTC]"} | ${"indian"}   | ${"-000578-03-25T00:00:00+00:00[u-ca=indian][UTC]"}
    ${"1800-01-01T00:00:00+00:00[UTC]"}    | ${"japanese"} | ${"1800-01-01T00:00:00+00:00[u-ca=japanese;era=ce][UTC]"}
    ${"-000500-06-15T00:00:00+00:00[UTC]"} | ${"japanese"} | ${"0501-06-15T00:00:00+00:00[u-ca=japanese;era=bce][UTC]"}
  `(
    "converts $value to $calendar as $expected and back",
    ({ value, calendar, expected }) => {
      expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe(
        expected,
      );
      expect(convertZonedToCalendar(expected, "gregorian")).toBe(value);
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

// CORE-6 §4.1 at the minimum instant behind UTC. The instant -271821-04-20T00:00Z is valid, but its
// local date -271821-04-19 is 10^8 + 1 days before the epoch, and TC39 InterpretISODateTimeOffset
// runs CheckISODaysRange on that local date whenever the string carries an offset under the default
// `offset: "reject"`. So TC39 (and Chromium 153) accept the wall clock alone and reject the same
// wall clock with its offset: the offset-bearing min strings are "" in both directions, while an
// offset-less string resolves. Dates: test262 extreme-dates.js min rows.
describe("convertZonedToCalendar at the minimum instant behind UTC (CORE-6)", () => {
  it.each`
    calendar                 | expected
    ${"gregorian"}           | ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12]"}
    ${"hebrew"}              | ${"-268058-11-04T12:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"}
    ${"buddhist"}            | ${"-271278-04-19T12:00:00-12:00[u-ca=buddhist][Etc/GMT+12]"}
    ${"islamic-civil"}       | ${"-280804-03-21T12:00:00-12:00[u-ca=islamic-civil][Etc/GMT+12]"}
    ${"islamic-tabular"}     | ${"-280804-03-22T12:00:00-12:00[u-ca=islamic-tabular][Etc/GMT+12]"}
    ${"islamic-umalqura"}    | ${"-280804-03-21T12:00:00-12:00[u-ca=islamic-umalqura][Etc/GMT+12]"}
    ${"persian"}             | ${"-272442-01-09T12:00:00-12:00[u-ca=persian][Etc/GMT+12]"}
    ${"indian"}              | ${"-271899-01-29T12:00:00-12:00[u-ca=indian][Etc/GMT+12]"}
    ${"taiwan"}              | ${"-273732-04-19T12:00:00-12:00[u-ca=taiwan][Etc/GMT+12]"}
    ${"japanese"}            | ${"271822-04-19T12:00:00-12:00[u-ca=japanese;era=bce][Etc/GMT+12]"}
    ${"ethiopic-amete-alem"} | ${"-266323-03-23T12:00:00-12:00[u-ca=ethiopic-amete-alem][Etc/GMT+12]"}
    ${"coptic"}              | ${"-272099-03-23T12:00:00-12:00[u-ca=coptic][Etc/GMT+12]"}
    ${"ethiopic"}            | ${"-266323-03-23T12:00:00-12:00[u-ca=ethiopic;era=ethioaa][Etc/GMT+12]"}
  `(
    "converts the offset-less minimum wall clock in Etc/GMT+12 to $calendar as $expected",
    ({ calendar, expected }) => {
      expect(
        convertZonedToCalendar(
          "-271821-04-19T12:00:00[Etc/GMT+12]",
          calendar as CalendarSystem,
        ),
      ).toBe(expected);
    },
  );

  it("converts the offset-less minimum wall clock in America/New_York to hebrew in local mean time", () => {
    expect(
      convertZonedToCalendar(
        "-271821-04-19T19:03:58[America/New_York]",
        "hebrew",
      ),
    ).toBe("-268058-11-04T19:03:58-04:56:02[u-ca=hebrew][America/New_York]");
  });

  it.each`
    value                                                               | calendar
    ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12]"}                       | ${"hebrew"}
    ${"-271821-04-19T12:00:00-12:00[Etc/GMT+12]"}                       | ${"gregorian"}
    ${"-268058-11-04T12:00:00-12:00[u-ca=hebrew][Etc/GMT+12]"}          | ${"gregorian"}
    ${"-271821-04-19T19:03:58-04:56:02[America/New_York]"}              | ${"hebrew"}
    ${"-268058-11-04T19:03:58-04:56:02[u-ca=hebrew][America/New_York]"} | ${"gregorian"}
  `(
    'returns "" converting $value to $calendar: its offset makes TC39 check the local date against the day range',
    ({ value, calendar }) => {
      expect(convertZonedToCalendar(value, calendar as CalendarSystem)).toBe(
        "",
      );
    },
  );
});
