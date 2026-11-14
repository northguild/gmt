import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDate } from "../plain/format/formatDate";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatMonthDay } from "../plain/format/formatMonthDay";
import { formatRelativeDate } from "../plain/format/formatRelativeDate";
import { formatRelativeDateTime } from "../plain/format/formatRelativeDateTime";
import { formatRelativeTime } from "../plain/format/formatRelativeTime";
import { formatTime } from "../plain/format/formatTime";
import { formatYearMonth } from "../plain/format/formatYearMonth";
import { formatCalendarUnix } from "../unix/format/formatCalendarUnix";
import { formatRelativeUnix } from "../unix/format/formatRelativeUnix";
import { formatUnix } from "../unix/format/formatUnix";
import { formatCalendarUtc } from "../utc/format/formatCalendarUtc";
import { formatRelativeUtc } from "../utc/format/formatRelativeUtc";
import { formatUtc } from "../utc/format/formatUtc";
import { formatCalendarZoned } from "../zoned/format/formatCalendarZoned";
import { formatRelativeZoned } from "../zoned/format/formatRelativeZoned";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";
import { formatDuration } from "../duration/format/formatDuration";

const day = "2024-06-15";
const time = "14:30:00";
const dateTime = "2024-06-15T14:30:00";
const utc = "2024-06-15T14:30:00Z";
const zoned = "2024-06-15T14:30:00+02:00[Europe/Berlin]";

// A locale is `undefined`, a string or an array of strings. Any other value is not a locale: the
// function returns its sentinel (ECMA-402's CanonicalizeLocaleList throws there) and never
// formats in the default locale.
describe("a locale argument of a type the types reject", () => {
  const empty = (value: unknown) =>
    Array.isArray(value) ? value.length === 0 : value === "";

  it.each`
    name                        | call
    ${"formatCalendar"}         | ${(l: unknown) => formatCalendar(day, l as string)}
    ${"formatDate"}             | ${(l: unknown) => formatDate(day, l as string)}
    ${"formatDateRange"}        | ${(l: unknown) => formatDateRange(day, "2024-06-16", l as string)}
    ${"formatDateTime"}         | ${(l: unknown) => formatDateTime(dateTime, l as string)}
    ${"formatDateTimeRange"}    | ${(l: unknown) => formatDateTimeRange(dateTime, "2024-06-16T14:30:00", l as string)}
    ${"formatDateTimeToParts"}  | ${(l: unknown) => formatDateTimeToParts(dateTime, l as string)}
    ${"formatDateToParts"}      | ${(l: unknown) => formatDateToParts(day, l as string)}
    ${"formatMonthDay"}         | ${(l: unknown) => formatMonthDay("06-15", l as string)}
    ${"formatRelativeDate"}     | ${(l: unknown) => formatRelativeDate(day, l as string)}
    ${"formatRelativeDateTime"} | ${(l: unknown) => formatRelativeDateTime(dateTime, l as string)}
    ${"formatRelativeTime"}     | ${(l: unknown) => formatRelativeTime(time, l as string)}
    ${"formatTime"}             | ${(l: unknown) => formatTime(time, l as string)}
    ${"formatYearMonth"}        | ${(l: unknown) => formatYearMonth("2024-06", l as string)}
    ${"formatCalendarUnix"}     | ${(l: unknown) => formatCalendarUnix(1718461800, l as string)}
    ${"formatRelativeUnix"}     | ${(l: unknown) => formatRelativeUnix(1718461800, l as string)}
    ${"formatUnix"}             | ${(l: unknown) => formatUnix(1718461800, l as string)}
    ${"formatCalendarUtc"}      | ${(l: unknown) => formatCalendarUtc(utc, l as string)}
    ${"formatRelativeUtc"}      | ${(l: unknown) => formatRelativeUtc(utc, l as string)}
    ${"formatUtc"}              | ${(l: unknown) => formatUtc(utc, l as string)}
    ${"formatCalendarZoned"}    | ${(l: unknown) => formatCalendarZoned(zoned, l as string)}
    ${"formatRelativeZoned"}    | ${(l: unknown) => formatRelativeZoned(zoned, l as string)}
    ${"formatZonedDateTime"}    | ${(l: unknown) => formatZonedDateTime(zoned, l as string)}
    ${"formatZonedRange"}       | ${(l: unknown) => formatZonedRange(zoned, "2024-06-16T14:30:00+02:00[Europe/Berlin]", l as string)}
    ${"formatZonedToParts"}     | ${(l: unknown) => formatZonedToParts(zoned, l as string)}
    ${"formatDuration"}         | ${(l: unknown) => formatDuration("PT90M", l as string)}
  `("$name returns its sentinel for each such locale", ({ call }) => {
    const bad: unknown[] = [
      5,
      0,
      true,
      {},
      1n,
      Symbol("locale"),
      () => "en",
      new String("en"),
    ];
    for (const locale of bad) {
      expect(empty(call(locale)), String(typeof locale)).toBe(true);
    }
  });
});
