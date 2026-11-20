import { holidayDates } from "../calendar/rules/holidayDates";
import { repros } from "../internal/temporalCompat/repros";
import { isValidHolidayRule } from "../calendar/validate/isValidHolidayRule";
import { convertDateToCalendar } from "../plain/convert/convertDateToCalendar";
import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatTime } from "../plain/format/formatTime";
import { isValidCalendarDate } from "../plain/validate/isValidCalendarDate";
import { formatCalendarUnix } from "../unix/format/formatCalendarUnix";
import { formatUnix } from "../unix/format/formatUnix";
import { formatCalendarUtc } from "../utc/format/formatCalendarUtc";
import { formatUtc } from "../utc/format/formatUtc";
import { formatCalendarZoned } from "../zoned/format/formatCalendarZoned";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";
import { utcMs } from "./utcMs";

// Hosts print different Chinese and Dangi dates and GMT owns no calendar data, so every format
// that prints a year, month, day or era returns the sentinel on every host (compat D33).
describe.each`
  calendar     | locale               | extra
  ${"chinese"} | ${"en-u-ca-chinese"} | ${{}}
  ${"chinese"} | ${"zh-u-ca-chinese"} | ${{}}
  ${"chinese"} | ${"en"}              | ${{ calendar: "chinese" }}
  ${"dangi"}   | ${"en-u-ca-dangi"}   | ${{}}
  ${"dangi"}   | ${"ko-u-ca-dangi"}   | ${{}}
  ${"dangi"}   | ${"en"}              | ${{ calendar: "dangi" }}
`(
  "D33 refusal for $calendar via $locale $extra",
  ({
    locale,
    extra,
  }: {
    locale: string;
    extra: Intl.DateTimeFormatOptions;
  }) => {
    it.each`
      date            | note
      ${"2027-02-06"} | ${"the date hosts disagree on"}
      ${"2024-07-10"} | ${"a date hosts agree on"}
    `(
      "refuses every date-printing format of $date ($note)",
      ({ date }: { date: string }) => {
        const zoned = `${date}T10:00:00+08:00[Asia/Shanghai]`;
        const utc = `${date}T02:00:00Z`;
        expect([
          formatDate(date, locale, extra),
          formatDate(date, locale, { ...extra, dateStyle: "full" }),
          formatDate(date, locale, { ...extra, year: "numeric" }),
          formatDate(date, locale, { ...extra, month: "long" }),
          formatDate(date, locale, { ...extra, day: "numeric" }),
          formatDate(date, locale, { ...extra, era: "short" }),
          formatDateTime(`${date}T10:00`, locale, extra),
          formatDateRange("2027-02-05", "2027-02-07", locale, extra),
          formatDateTimeRange(
            "2027-02-05T10:00",
            "2027-02-07T10:00",
            locale,
            extra,
          ),
          formatZonedDateTime(zoned, locale, extra),
          formatZonedRange(
            "2027-02-05T10:00:00+08:00[Asia/Shanghai]",
            "2027-02-07T10:00:00+08:00[Asia/Shanghai]",
            locale,
            extra,
          ),
          formatUtc(utc, locale, extra),
          formatUnix(utcMs(utc), locale, extra),
          formatUnix(utcMs(utc) / 1000, locale, {
            ...extra,
            epochUnit: "seconds",
          }),
        ]).toEqual(Array.from({ length: 14 }, () => ""));
      },
    );

    it.each`
      date
      ${"2027-02-06"}
      ${"2024-07-10"}
    `(
      "returns [] from the ToParts functions of $date",
      ({ date }: { date: string }) => {
        expect([
          formatDateToParts(date, locale, extra),
          formatDateToParts(date, locale, { ...extra, year: "2-digit" }),
          formatDateTimeToParts(`${date}T10:00`, locale, extra),
          formatZonedToParts(
            `${date}T10:00:00+08:00[Asia/Shanghai]`,
            locale,
            extra,
          ),
        ]).toEqual([[], [], [], []]);
      },
    );

    it("keeps the default date fields refused when only a zone name is asked for", () => {
      expect(
        formatDate("2027-02-06", locale, { ...extra, timeZoneName: "short" }),
      ).toBe("");
    });
  },
);

// The day-label formats take their calendar from the locale only.
describe.each`
  locale
  ${"en-u-ca-chinese"}
  ${"zh-u-ca-chinese"}
  ${"en-u-ca-dangi"}
  ${"ko-u-ca-dangi"}
`(
  "D33 refusal of the day-label formats via $locale",
  ({ locale }: { locale: string }) => {
    it.each`
      date
      ${"2027-02-06"}
      ${"2024-07-10"}
    `(
      "returns an empty string for $date a long way from the reference",
      ({ date }: { date: string }) => {
        const utc = `${date}T02:00:00Z`;
        expect([
          formatCalendar(`${date}T10:00`, locale, { reference: "2031-01-01" }),
          formatCalendarZoned(`${date}T10:00:00+08:00[Asia/Shanghai]`, locale, {
            reference: "2031-01-01T00:00:00+08:00[Asia/Shanghai]",
          }),
          formatCalendarUtc(utc, locale, {
            reference: "2031-01-01T00:00:00Z",
          }),
          formatCalendarUnix(utcMs(utc), locale, {
            reference: utcMs("2031-01-01T00:00:00Z"),
          }),
        ]).toEqual(["", "", "", ""]);
      },
    );
  },
);

describe("D33 allowed formats", () => {
  it.each`
    locale               | extra
    ${"zh-u-ca-chinese"} | ${{}}
    ${"en-u-ca-chinese"} | ${{}}
    ${"ko-u-ca-dangi"}   | ${{}}
    ${"en"}              | ${{ calendar: "dangi" }}
    ${"en"}              | ${{ calendar: "chinese" }}
  `(
    "formats a time of day as without the calendar for $locale $extra",
    ({
      locale,
      extra,
    }: {
      locale: string;
      extra: Intl.DateTimeFormatOptions;
    }) => {
      const plain = locale.replace(/-u-ca-\w+$/, "");
      const text = formatTime("10:00", locale, extra);
      expect(text).not.toBe("");
      expect(text).toBe(formatTime("10:00", plain));
    },
  );

  it.each`
    locale               | extra
    ${"en-u-ca-chinese"} | ${{}}
    ${"en-u-ca-dangi"}   | ${{}}
    ${"en"}              | ${{ calendar: "chinese" }}
  `(
    "formats a time-only date-time as without the calendar for $locale $extra",
    ({
      locale,
      extra,
    }: {
      locale: string;
      extra: Intl.DateTimeFormatOptions;
    }) => {
      const options: Intl.DateTimeFormatOptions = {
        ...extra,
        hour: "numeric",
        minute: "numeric",
      };
      const text = formatDateTime("2027-02-06T10:00", locale, options);
      expect(text).not.toBe("");
      expect(text).toBe(
        formatDateTime("2027-02-06T10:00", "en", {
          hour: "numeric",
          minute: "numeric",
        }),
      );
    },
  );

  it.each`
    locale               | extra
    ${"en-u-ca-chinese"} | ${{}}
    ${"en-u-ca-dangi"}   | ${{}}
    ${"en"}              | ${{ calendar: "dangi" }}
  `(
    "formats a weekday on its own as Saturday for $locale $extra",
    ({
      locale,
      extra,
    }: {
      locale: string;
      extra: Intl.DateTimeFormatOptions;
    }) => {
      expect(
        formatDate("2027-02-06", locale, { ...extra, weekday: "long" }),
      ).toBe("Saturday");
    },
  );

  it.each`
    locale
    ${"en-u-ca-gregory"}
    ${"en"}
  `("leaves $locale untouched", ({ locale }: { locale: string }) => {
    expect(formatDate("2027-02-06", locale)).toBe("2/6/2027");
  });
});

describe("D33 sentinels that CalendarSystem already gave", () => {
  it.each`
    label                                     | actual                                                                                                   | expected
    ${"convertDateToCalendar chinese"}        | ${convertDateToCalendar("2027-02-06", "chinese" as never)}                                               | ${""}
    ${"convertDateToCalendar dangi"}          | ${convertDateToCalendar("2027-02-06", "dangi" as never)}                                                 | ${""}
    ${"isValidCalendarDate chinese"}          | ${isValidCalendarDate("2027-02-06[u-ca=chinese]")}                                                       | ${false}
    ${"isValidCalendarDate dangi"}            | ${isValidCalendarDate("2027-02-06[u-ca=dangi]")}                                                         | ${false}
    ${"holidayDates chinese Spring Festival"} | ${holidayDates({ kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 } as never, 2027)} | ${[]}
    ${"isValidHolidayRule chinese"}           | ${isValidHolidayRule({ kind: "calendarFixed", calendar: "chinese", monthCode: "M01", day: 1 })}          | ${false}
  `(
    "$label",
    ({ actual, expected }: { actual: unknown; expected: unknown }) => {
      expect(actual).toEqual(expected);
    },
  );
});

// The weekly swap check reads this title (scripts/polyfill-swap.mjs, D33_CHECK). Both titles pass:
// the test reports whether the host and the Temporal dependency now agree with the proposal's
// Chinese and Dangi dates, and the refusal holds either way.
const d33Repros = repros.filter((repro) => repro.defect === "D33");
const d33Failing = d33Repros.filter((repro) => {
  try {
    return repro.run() !== repro.expected;
  } catch {
    return true;
  }
});

it(
  d33Failing.length === 0
    ? "every D33 repro passes on this Temporal and this host"
    : "a D33 repro fails on this Temporal and this host",
  () => {
    expect(d33Repros).toHaveLength(32);
    expect(formatDate("2027-02-06", "en-u-ca-chinese")).toBe("");
  },
);
