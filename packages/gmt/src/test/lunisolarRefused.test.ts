import { holidayDates } from "../calendar/rules/holidayDates";
import { isLunisolarTextCompatNeeded } from "../internal/temporalCompat/capabilities";
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
import { normalizeDateTime } from "../internal/normalizeDateTime";
import {
  hostDateText,
  hostDateTimeText,
  hostPlainRangeText,
  hostRangeText,
  hostText,
} from "./hostIntl";
import { utcMs } from "./utcMs";

// Hosts print different Chinese and Dangi dates and GMT owns no calendar data, so on a runtime
// whose D33 probe fails every format that prints a year, month, day or era returns the sentinel. A
// runtime that passes the probe returns its own text, read here from the host's own
// `Intl.DateTimeFormat`, so deleting D33 on a passing runtime changes no row.
// The fields each function asks Intl for when the caller names none: a plain date prints the date
// fields, a plain date-time and an instant range the date and the wall clock, and a zoned
// date-time adds the short zone name (Temporal ECMA-402 GetDateTimeFormat defaults).
const DATE_DEFAULTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
};
const WALL_DEFAULTS: Intl.DateTimeFormatOptions = {
  ...DATE_DEFAULTS,
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};
const ZONED_DEFAULTS: Intl.DateTimeFormatOptions = {
  ...WALL_DEFAULTS,
  timeZoneName: "short",
};
/** The host's two singles joined by the locale fallback's ASCII dash (UTS #35 `{0} - {1}`). */
const joined = (start: string, end: string): string => `${start} - ${end}`;
const joinedParts = (parts: readonly { value: string }[]): string =>
  normalizeDateTime(parts.map((part) => part.value).join(""));

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
    calendar,
    locale,
    extra,
  }: {
    calendar: "chinese" | "dangi";
    locale: string;
    extra: Intl.DateTimeFormatOptions;
  }) => {
    const refused = isLunisolarTextCompatNeeded(calendar);
    /**
     * Each result is the sentinel where the probe fails, and the host's own text where it passes.
     * A range may list a second answer: where the host's own range drops a field of a date (D29,
     * the chinese and dangi related year), ECMA-402's `[[Default]]` is the two singles joined, so
     * the host's range or the host's two singles are both the host's text.
     */
    const expectSentinelOrHost = (
      rows: readonly (readonly [
        actual: string,
        host: string | readonly string[],
      ])[],
    ): void => {
      for (const [actual, host] of rows) {
        if (refused) {
          expect(actual).toBe("");
        } else {
          expect(typeof host === "string" ? [host] : host).toContain(actual);
        }
      }
    };
    it.each`
      date            | note
      ${"2027-02-06"} | ${"the date hosts disagree on"}
      ${"2024-07-10"} | ${"a date hosts agree on"}
    `(
      "refuses every date-printing format of $date ($note)",
      ({ date }: { date: string }) => {
        const zoned = `${date}T10:00:00+08:00[Asia/Shanghai]`;
        const utc = `${date}T02:00:00+00:00[UTC]`;
        const utcInstant = `${date}T02:00:00Z`;
        const withExtra = (more: Intl.DateTimeFormatOptions) => ({
          ...extra,
          ...more,
        });
        expectSentinelOrHost([
          [
            formatDate(date, locale, extra),
            hostDateText(locale, { ...DATE_DEFAULTS, ...extra }, date),
          ],
          [
            formatDate(date, locale, { ...extra, dateStyle: "full" }),
            hostDateText(locale, withExtra({ dateStyle: "full" }), date),
          ],
          [
            formatDate(date, locale, { ...extra, year: "numeric" }),
            hostDateText(locale, withExtra({ year: "numeric" }), date),
          ],
          [
            formatDate(date, locale, { ...extra, month: "long" }),
            hostDateText(locale, withExtra({ month: "long" }), date),
          ],
          [
            formatDate(date, locale, { ...extra, day: "numeric" }),
            hostDateText(locale, withExtra({ day: "numeric" }), date),
          ],
          [
            formatDate(date, locale, { ...extra, era: "short" }),
            hostDateText(locale, withExtra({ era: "short" }), date),
          ],
          [
            formatDateTime(`${date}T10:00`, locale, extra),
            hostDateTimeText(
              locale,
              { ...WALL_DEFAULTS, ...extra },
              `${date}T10:00:00`,
            ),
          ],
          [
            formatDateRange("2027-02-05", "2027-02-07", locale, extra),
            [
              hostPlainRangeText(
                locale,
                { ...DATE_DEFAULTS, ...extra },
                "2027-02-05",
                "2027-02-07",
              ),
              joined(
                hostDateText(
                  locale,
                  { ...DATE_DEFAULTS, ...extra },
                  "2027-02-05",
                ),
                hostDateText(
                  locale,
                  { ...DATE_DEFAULTS, ...extra },
                  "2027-02-07",
                ),
              ),
            ],
          ],
          [
            formatDateTimeRange(
              "2027-02-05T10:00",
              "2027-02-07T10:00",
              locale,
              extra,
            ),
            [
              hostPlainRangeText(
                locale,
                { ...WALL_DEFAULTS, ...extra },
                "2027-02-05T10:00:00",
                "2027-02-07T10:00:00",
              ),
              joined(
                hostDateTimeText(
                  locale,
                  { ...WALL_DEFAULTS, ...extra },
                  "2027-02-05T10:00:00",
                ),
                hostDateTimeText(
                  locale,
                  { ...WALL_DEFAULTS, ...extra },
                  "2027-02-07T10:00:00",
                ),
              ),
            ],
          ],
          [
            formatZonedDateTime(zoned, locale, extra),
            hostText(locale, { ...ZONED_DEFAULTS, ...extra }, zoned),
          ],
          [
            formatZonedRange(
              "2027-02-05T10:00:00+08:00[Asia/Shanghai]",
              "2027-02-07T10:00:00+08:00[Asia/Shanghai]",
              locale,
              extra,
            ),
            [
              hostRangeText(
                locale,
                { ...WALL_DEFAULTS, ...extra },
                "2027-02-05T10:00:00+08:00[Asia/Shanghai]",
                "2027-02-07T10:00:00+08:00[Asia/Shanghai]",
              ),
              joined(
                hostText(
                  locale,
                  { ...WALL_DEFAULTS, ...extra },
                  "2027-02-05T10:00:00+08:00[Asia/Shanghai]",
                ),
                hostText(
                  locale,
                  { ...WALL_DEFAULTS, ...extra },
                  "2027-02-07T10:00:00+08:00[Asia/Shanghai]",
                ),
              ),
            ],
          ],
          [
            formatUtc(utcInstant, locale, extra),
            hostText(locale, { ...WALL_DEFAULTS, ...extra }, utc),
          ],
          [
            formatUnix(utcMs(utcInstant), locale, extra),
            hostText(locale, { ...WALL_DEFAULTS, ...extra }, utc),
          ],
          [
            formatUnix(utcMs(utcInstant) / 1000, locale, {
              ...extra,
              epochUnit: "seconds",
            }),
            hostText(locale, { ...WALL_DEFAULTS, ...extra }, utc),
          ],
        ]);
      },
    );

    it.each`
      date
      ${"2027-02-06"}
      ${"2024-07-10"}
    `(
      "returns [] from the ToParts functions of $date where the probe fails, else parts that join to the host's text",
      ({ date }: { date: string }) => {
        const zoned = `${date}T10:00:00+08:00[Asia/Shanghai]`;
        const rows = [
          [
            formatDateToParts(date, locale, extra),
            hostDateText(locale, { ...DATE_DEFAULTS, ...extra }, date),
          ],
          [
            formatDateToParts(date, locale, { ...extra, year: "2-digit" }),
            hostDateText(locale, { ...extra, year: "2-digit" }, date),
          ],
          [
            formatDateTimeToParts(`${date}T10:00`, locale, extra),
            hostDateTimeText(
              locale,
              { ...WALL_DEFAULTS, ...extra },
              `${date}T10:00:00`,
            ),
          ],
          [
            formatZonedToParts(zoned, locale, extra),
            hostText(locale, { ...ZONED_DEFAULTS, ...extra }, zoned),
          ],
        ] as const;
        for (const [parts, host] of rows) {
          if (refused) {
            expect(parts).toEqual([]);
          } else {
            expect(joinedParts(parts)).toBe(host);
          }
        }
      },
    );

    it("keeps the default date fields refused where the probe fails when only a zone name is asked for", () => {
      expectSentinelOrHost([
        [
          formatDate("2027-02-06", locale, { ...extra, timeZoneName: "short" }),
          hostDateText(locale, { ...DATE_DEFAULTS, ...extra }, "2027-02-06"),
        ],
      ]);
    });
  },
);

// The day-label formats take their calendar from the locale only.
describe.each`
  calendar     | locale
  ${"chinese"} | ${"en-u-ca-chinese"}
  ${"chinese"} | ${"zh-u-ca-chinese"}
  ${"dangi"}   | ${"en-u-ca-dangi"}
  ${"dangi"}   | ${"ko-u-ca-dangi"}
`(
  "D33 refusal of the day-label formats via $locale",
  ({ calendar, locale }: { calendar: "chinese" | "dangi"; locale: string }) => {
    it.each`
      date
      ${"2027-02-06"}
      ${"2024-07-10"}
    `(
      "returns an empty string where the probe fails, and text where it passes, for $date a long way from the reference",
      ({ date }: { date: string }) => {
        const utc = `${date}T02:00:00Z`;
        const results = [
          formatCalendar(`${date}T10:00`, locale, {
            reference: "2031-01-01T00:00",
          }),
          formatCalendarZoned(`${date}T10:00:00+08:00[Asia/Shanghai]`, locale, {
            reference: "2031-01-01T00:00:00+08:00[Asia/Shanghai]",
          }),
          formatCalendarUtc(utc, locale, {
            reference: "2031-01-01T00:00:00Z",
          }),
          formatCalendarUnix(utcMs(utc), locale, {
            reference: utcMs("2031-01-01T00:00:00Z"),
          }),
        ];
        const long = { dateStyle: "long", timeStyle: "short" } as const;
        const hosts = [
          hostText(locale, long, `${date}T10:00:00+00:00[UTC]`),
          hostText(locale, long, `${date}T10:00:00+08:00[Asia/Shanghai]`),
          hostText(locale, long, `${date}T02:00:00+00:00[UTC]`),
          hostText(locale, long, `${date}T02:00:00+00:00[UTC]`),
        ];
        const refused = isLunisolarTextCompatNeeded(calendar);
        results.forEach((result, index) => {
          expect(result).toBe(refused ? "" : hosts[index]);
        });
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

// The refusal follows the probe, and the probe follows the D33 repros: where a repro of a calendar
// fails, that calendar's text is refused, and where all pass it is the host's own.
const d33Repros = repros.filter((repro) => repro.defect === "D33");

it("refuses the Chinese text exactly where the D33 repros fail", () => {
  expect(d33Repros).toHaveLength(6);
  expect(formatDate("2027-02-06", "en-u-ca-chinese") === "").toBe(
    isLunisolarTextCompatNeeded("chinese"),
  );
});
