/**
 * The call-by-call tables on the `/migrate/` pages: what each library call is in GMT.
 *
 * A row names the library call, the GMT functions that replace it, and a note for the cases where
 * the two do not behave alike. GMT cells hold function names only; the page looks each name up in
 * the reference corpus for its module and link, and `behaviour-matrix.test.ts` fails when a name
 * does not resolve to exactly one function. `cases` points at rows of the behaviour matrix, and
 * the same test fails when a case id is not in `behaviour-matrix.json`.
 */
import type { LibraryId } from "./behaviour-matrix";

export interface MapRow {
  /** The library call, as its own docs write it. */
  theirs: string;
  /** GMT function names. Empty when the string is the value and nothing replaces the call. */
  gmt: readonly string[];
  /** Plain text. Backticks mark code. */
  note?: string;
  /** Behaviour-matrix cases that measure this row. */
  cases?: readonly string[];
}

export interface LibraryMap {
  id: LibraryId;
  rows: readonly MapRow[];
  /** Further calls, shorter: the library call and the GMT function. */
  more: readonly MapRow[];
}

const dateFns: LibraryMap = {
  id: "date-fns",
  rows: [
    {
      theirs: "`parseISO(s)`",
      gmt: [
        "isValidDate",
        "isValidDateTime",
        "isValidZonedDateTime",
        "isValidUtc",
      ],
      note: "The string is the value, so there is nothing to parse; check it with a validator. `parseISO` drops the offset before a `[zone]` and then reads the wall time as UTC (`03:30Z`). Temporal reads the basic format `20240212`; GMT rejects it on purpose and follows the extended format of RFC 3339 §5.6.",
      cases: ["M9c", "M10"],
    },
    {
      theirs: '`parse(s, "dd/MM/yyyy", ref)`',
      gmt: ["parseDateWithPattern"],
      note: "`yyyy` is four digits in GMT. date-fns reads `2-12-12` as year 2.",
      cases: ["M9d"],
    },
    {
      theirs: '`parse(s, "yyyy MMMM", ref)`',
      gmt: ["parseYearMonthWithPattern"],
      note: "A year and a month with no day, returned as `YYYY-MM`.",
    },
    {
      theirs: "`isValid(d)`",
      gmt: ["isValidDate"],
      note: "GMT rejects 2024-02-30 and basic format.",
      cases: ["M9b", "M9c"],
    },
    {
      theirs: '`format(d, "d MMMM yyyy")`',
      gmt: ["formatDate"],
      note: "GMT has no token formatter; pass a locale and `dateStyle`.",
    },
    {
      theirs: "`formatISO(d)`",
      gmt: [],
      note: "None for a GMT string, which is already ISO 8601. `formatISO` writes the host offset.",
      cases: ["M14"],
    },
    {
      theirs: "The current time, from the built-in date object",
      gmt: ["getUtcNow", "getZonedNow"],
    },
    { theirs: "`startOfToday()`", gmt: ["getToday", "getZonedToday"] },
    {
      theirs: "`addDays(d, n)`",
      gmt: ["addDate", "addZoned"],
      note: "date-fns works in the host zone, so a day is a calendar day of the host, and the result depends on the host zone. GMT takes the zone from the value.",
      cases: ["M1", "M2"],
    },
    {
      theirs: "`addMonths(d, n)`",
      gmt: ["addDate"],
      note: 'The day is clamped to the month length. `{ overflow: "reject" }` returns `""`.',
      cases: ["M7"],
    },
    { theirs: "`subDays(d, n)`, `subMonths(d, n)`", gmt: ["subtractDate"] },
    {
      theirs: "`addHours(d, n)`",
      gmt: ["addZoned", "addUtc"],
      note: "Hours are exact time.",
    },
    {
      theirs: "`differenceInCalendarDays(later, earlier)`",
      gmt: ["diffDate"],
      note: "The arguments are in the other order: earlier first.",
    },
    {
      theirs: "`differenceInMonths(later, earlier)`",
      gmt: ["diffDate"],
      note: "From 2024-01-31 to 2024-02-29 date-fns counts 1 month and GMT counts 0.",
      cases: ["M8"],
    },
    {
      theirs: "`intervalToDuration({ start, end })`",
      gmt: ["diffDate"],
      note: 'Pass the units you want, for example `["years", "months", "days"]`.',
    },
    { theirs: "`startOfMonth(d)`", gmt: ["startOfDate"] },
    { theirs: "`endOfMonth(d)`", gmt: ["endOfDate"] },
    {
      theirs: "`startOfDay(d, { in: tz(z) })`",
      gmt: ["startOfZoned"],
      note: "The first instant of the day, which is not always 00:00.",
      cases: ["M6"],
    },
    {
      theirs: "`isBefore(a, b)`, `isAfter(a, b)`",
      gmt: ["isBeforeDate", "isAfterDate", "isBeforeZoned"],
    },
    {
      theirs: "`isEqual(a, b)`",
      gmt: ["areDatesEqual", "areUtcEqual", "areZonedEqual"],
      note: "`areZonedEqual` follows `ZonedDateTime.prototype.equals`.",
      cases: ["M3b", "M13b", "M13c"],
    },
    {
      theirs: "`isSameDay(a, b)`",
      gmt: ["areDatesEqualBy", "areZonedEqualBy"],
    },
    {
      theirs: "`isWithinInterval(d, { start, end })`",
      gmt: ["isBetweenDate"],
      note: "Both ends are inclusive by default.",
    },
    {
      theirs: "`areIntervalsOverlapping(a, b)`",
      gmt: ["intervalsOverlapDate"],
    },
    { theirs: "`min(ds)`, `max(ds)`", gmt: ["minDate", "maxDate"] },
    {
      theirs: "`getDaysInMonth(d)`, `isLeapYear(d)`",
      gmt: ["getDaysInMonth", "getDaysInYearMonth", "isLeapYear"],
    },
    {
      theirs: "`getISOWeek(d)`, `getISOWeekYear(d)`",
      gmt: ["getIsoWeekDate"],
      note: "One call returns year, week and weekday. `getWeek` is a locale week.",
      cases: ["M12"],
    },
    { theirs: "`getISOWeeksInYear(d)`", gmt: ["getWeeksInYear"] },
    {
      theirs:
        "`isWeekend(d)`, `addBusinessDays(d, n)`, `differenceInBusinessDays(a, b)`",
      gmt: ["isWeekend", "addBusinessDays", "businessDaysBetween"],
      note: "date-fns fixes the weekend to Saturday and Sunday. `isWeekend` in GMT takes a locale. `addBusinessDays` takes an optional calendar and counts Monday to Friday without one. `businessDaysBetween` requires a calendar and reads the weekend from `calendar.weekend`.",
      cases: ["M15"],
    },
    {
      theirs: "`formatDistance(d, base)`, `formatRelative(d, base)`",
      gmt: ["formatRelativeDate", "formatRelativeZoned"],
      note: "The wording comes from `Intl.RelativeTimeFormat`.",
    },
  ],
  more: [
    { theirs: "`getQuarter(d)`", gmt: ["getQuarterForDate"] },
    {
      theirs: "`set(d, { month: 1 })`",
      gmt: ["setDate"],
      note: "Months are 1 to 12 in GMT.",
    },
    {
      theirs: "`fromUnixTime(sec)`",
      gmt: ["convertUnixToUtc"],
      note: 'Pass `{ epochUnit: "seconds" }`.',
    },
    {
      theirs: "`getUnixTime(d)`",
      gmt: ["convertUtcToUnix"],
      note: 'Pass `{ epochUnit: "seconds" }`.',
    },
    {
      theirs: "`eachDayOfInterval({ start, end })`",
      gmt: ["mapDatesInRange"],
      note: "The end date is included.",
    },
    { theirs: "`getDayOfYear(d)`", gmt: ["getDayOfYear"] },
    { theirs: "`formatDuration(d)`", gmt: ["formatDuration"] },
    {
      theirs: "`new TZDate(…, z)`",
      gmt: ["convertUtcToZoned", "convertPlainDateTimeToZoned"],
    },
  ],
};

const luxon: LibraryMap = {
  id: "luxon",
  rows: [
    {
      theirs: "`DateTime.fromISO(s)`",
      gmt: ["isValidDate", "isValidDateTime", "isValidZonedDateTime"],
      note: "The string is the value; check it with a validator. Luxon reads a `[zone]` only with `{ setZone: true }`. Temporal reads the basic format `20240212`; GMT rejects it on purpose and follows the extended format of RFC 3339 §5.6.",
      cases: ["M9c", "M10", "M10b", "M10d"],
    },
    {
      theirs: '`DateTime.fromFormat(s, "dd/MM/yyyy")`',
      gmt: ["parseDateWithPattern"],
      cases: ["M9d"],
    },
    {
      theirs: '`DateTime.fromFormat(s, "yyyy MMMM")`',
      gmt: ["parseYearMonthWithPattern"],
      note: "A year and a month with no day, returned as `YYYY-MM`.",
    },
    {
      theirs: "`dt.isValid`, `dt.invalidReason`",
      gmt: ["isValidDate"],
      note: "GMT gives no reason string.",
    },
    {
      theirs: "`dt.toLocaleString(DateTime.DATE_FULL)`, `dt.toFormat(f)`",
      gmt: ["formatDate"],
      note: "GMT has no token formatter; pass a locale and `dateStyle`.",
    },
    {
      theirs: "`dt.toISO()`, `dt.toISODate()`",
      gmt: [],
      note: "None; the value is already the string. `toISO()` omits the `[zone]`.",
      cases: ["M10b", "M14"],
    },
    { theirs: "`DateTime.now().setZone(z)`", gmt: ["getZonedNow"] },
    {
      theirs: "`DateTime.now().setZone(z).toISODate()`",
      gmt: ["getZonedToday"],
    },
    {
      theirs: "`dt.plus({ days: 1 })`",
      gmt: ["addDate", "addZoned"],
      note: "The result across the Berlin gap is the same.",
      cases: ["M1", "M2"],
    },
    {
      theirs: "`dt.plus({ months: 1 })`",
      gmt: ["addDate"],
      note: "The day is clamped to the month length.",
      cases: ["M7"],
    },
    { theirs: "`dt.minus({ … })`", gmt: ["subtractDate", "subtractZoned"] },
    { theirs: "`dt.plus({ hours: 1 })`", gmt: ["addZoned"] },
    {
      theirs: '`b.diff(a, "days").days`',
      gmt: ["diffDate", "diffZoned"],
      note: "The arguments are in the other order: earlier first.",
    },
    {
      theirs: '`b.diff(a, ["months", "days"])`',
      gmt: ["diffDate"],
      note: "From 2024-01-31 to 2024-02-29 Luxon gives 1 month and 0 days; GMT gives 0 months and 29 days.",
      cases: ["M8"],
    },
    { theirs: '`dt.startOf("month")`', gmt: ["startOfDate"] },
    { theirs: '`dt.endOf("month")`', gmt: ["endOfDate"] },
    {
      theirs: '`dt.setZone(z).startOf("day")`',
      gmt: ["startOfZoned"],
      note: "The Santiago result is the same.",
      cases: ["M6"],
    },
    { theirs: "`a < b`", gmt: ["isBeforeDate", "isBeforeZoned"] },
    {
      theirs: "`a.equals(b)`",
      gmt: ["areZonedEqual"],
      note: "`areZonedEqual` follows `ZonedDateTime.prototype.equals`. Luxon treats `UTC` and `Etc/UTC` as different zones.",
      cases: ["M13b", "M13c"],
    },
    {
      theirs: '`a.hasSame(b, "day")`',
      gmt: ["areZonedEqualBy", "areDatesEqualBy"],
    },
    {
      theirs: "`Interval.fromDateTimes(s, e).contains(d)`",
      gmt: ["isBetweenDate"],
      note: "Luxon intervals are half-open. GMT includes both ends by default; pass `{ inclusiveEnd: false }`.",
    },
    {
      theirs: "`i.overlaps(j)`",
      gmt: ["intervalsOverlapDate", "intervalsOverlapZoned"],
    },
    {
      theirs: "`DateTime.min(…)`, `DateTime.max(…)`",
      gmt: ["minDate", "maxDate", "minZoned"],
    },
    {
      theirs: "`dt.daysInMonth`, `dt.isInLeapYear`",
      gmt: ["getDaysInMonth", "getDaysInYearMonth", "isLeapYear"],
    },
    {
      theirs: "`dt.weekYear`, `dt.weekNumber`, `dt.weeksInWeekYear`",
      gmt: ["getIsoWeekDate", "getWeeksInYear"],
      note: "`localWeekNumber` is a locale week.",
      cases: ["M12"],
    },
    {
      theirs: "`dt.isWeekend`",
      gmt: ["isWeekend"],
      note: "Both read the weekend from the locale.",
    },
    {
      theirs: "`dt.setZone(z)`",
      gmt: ["convertZonedToZoned", "convertUtcToZoned"],
      cases: ["M16"],
    },
    {
      theirs: "`DateTime.fromISO(local, { zone: z })`",
      gmt: ["convertPlainDateTimeToZoned"],
      note: "Luxon has no disambiguation option; GMT takes `disambiguation`, with the four Temporal values.",
      cases: ["M4", "M4b"],
    },
    {
      theirs: "`dt.toRelative()`, `Duration.fromISO(s).toHuman()`",
      gmt: ["formatRelativeZoned", "formatDuration"],
    },
  ],
  more: [
    { theirs: "`dt.quarter`", gmt: ["getQuarterForDate"] },
    {
      theirs: "`dt.set({ month })`",
      gmt: ["setDate"],
      note: "Months are 1 to 12 in both.",
    },
    {
      theirs: "`DateTime.fromSeconds(n)`, `dt.toUnixInteger()`",
      gmt: ["convertUnixToUtc", "convertUtcToUnix"],
      note: 'Pass `{ epochUnit: "seconds" }`.',
    },
    {
      theirs: "`dt.offset`",
      gmt: ["getZonedOffsetAs"],
      note: "Pass the unit `minutes`.",
    },
    { theirs: "`dt.isInDST`", gmt: ["isInDaylightSaving"] },
    { theirs: "`Info.isValidIANAZone(z)`", gmt: ["isValidTimeZone"] },
    { theirs: "`dt.ordinal`", gmt: ["getDayOfYear"] },
  ],
};

const dayjs: LibraryMap = {
  id: "dayjs",
  rows: [
    {
      theirs: "`dayjs(s)`",
      gmt: ["isValidDate", "isValidDateTime"],
      note: 'The string is the value; check it with a validator. `dayjs("2024-02-30")` is 2024-03-01.',
      cases: ["M9", "M9b"],
    },
    {
      theirs: '`dayjs(s, "DD/MM/YYYY", true)` (customParseFormat)',
      gmt: ["parseDateWithPattern"],
      note: "Rewrite the tokens to `dd/MM/yyyy`.",
      cases: ["M9d"],
    },
    {
      theirs: '`dayjs(s, "YYYY-MM", true)` (customParseFormat)',
      gmt: ["parseYearMonth", "parseYearMonthWithPattern"],
      note: "`YYYY-MM` is the ISO form, which `parseYearMonth` reads. For another pattern, rewrite the tokens, as in `MM/yyyy`.",
    },
    { theirs: "`.isValid()`", gmt: ["isValidDate"] },
    {
      theirs: '`.format("LL")` (localizedFormat)',
      gmt: ["formatDate"],
      note: "GMT has no token formatter; pass a locale and `dateStyle`.",
    },
    {
      theirs: "`.toISOString()`",
      gmt: [],
      note: "None for a GMT UTC string; it is already ISO 8601.",
      cases: ["M14"],
    },
    { theirs: "`dayjs()`, `dayjs().tz(z)`", gmt: ["getUtcNow", "getZonedNow"] },
    {
      theirs: '`dayjs().format("YYYY-MM-DD")`',
      gmt: ["getToday", "getZonedToday"],
    },
    {
      theirs: '`.add(1, "day")`',
      gmt: ["addDate", "addZoned"],
      note: "With the `timezone` plugin, Day.js keeps the starting offset after a clock change: 2024-03-30 12:00 in Berlin plus one day gives `12:00+01:00`; Temporal gives `12:00+02:00`.",
      cases: ["M1", "M2", "M3", "M5"],
    },
    {
      theirs: '`.add(1, "month")`',
      gmt: ["addDate"],
      note: "The day is clamped to the month length.",
      cases: ["M7"],
    },
    { theirs: "`.subtract(n, unit)`", gmt: ["subtractDate", "subtractZoned"] },
    { theirs: '`.add(1, "hour")`', gmt: ["addZoned"] },
    {
      theirs: '`b.diff(a, "day")`',
      gmt: ["diffDate"],
      note: "The arguments are in the other order: earlier first.",
    },
    {
      theirs: '`b.diff(a, "month")`',
      gmt: ["diffDate"],
      note: "From 2024-01-31 to 2024-02-29 Day.js counts 1 month and GMT counts 0.",
      cases: ["M8"],
    },
    { theirs: '`.startOf("month")`', gmt: ["startOfDate"] },
    { theirs: '`.endOf("month")`', gmt: ["endOfDate"] },
    {
      theirs: '`dayjs.tz(s, z).startOf("day")` (timezone)',
      gmt: ["startOfZoned"],
      note: "On a day whose midnight is skipped, Day.js returns a 00:00 that does not exist unless the host zone is America/Santiago, so the result depends on the host zone.",
      cases: ["M6"],
    },
    {
      theirs: "`.isBefore(b)`, `.isAfter(b)`",
      gmt: ["isBeforeDate", "isAfterDate"],
    },
    {
      theirs: "`.isSame(b)`",
      gmt: ["areDatesEqual", "areUtcEqual"],
      cases: ["M3b"],
    },
    { theirs: '`.isSame(b, "day")`', gmt: ["areDatesEqualBy"] },
    {
      theirs: "`.isBetween(a, b)` (isBetween)",
      gmt: ["isBetweenDate"],
      note: "Day.js excludes both ends by default; pass `{ inclusiveStart: false, inclusiveEnd: false }`. Day.js also returns true when `a` is after `b`; GMT returns false.",
    },
    {
      theirs: "`dayjs.min(…)`, `dayjs.max(…)` (minMax)",
      gmt: ["minDate", "maxDate"],
    },
    {
      theirs: "`.daysInMonth()`, `.isLeapYear()` (isLeapYear)",
      gmt: ["getDaysInMonth", "getDaysInYearMonth", "isLeapYear"],
    },
    {
      theirs: "`.isoWeek()`, `.isoWeekYear()`, `.isoWeeksInYear()` (isoWeek)",
      gmt: ["getIsoWeekDate", "getWeeksInYear"],
      note: "`.week()` (weekOfYear) is a locale week.",
      cases: ["M12"],
    },
    {
      theirs: "`dayjs.tz(local, z)`, `.tz(z)` (timezone)",
      gmt: ["convertPlainDateTimeToZoned", "convertZonedToZoned"],
      note: "GMT takes `disambiguation` for a wall time in a gap or an overlap.",
      cases: ["M4", "M4b", "M16"],
    },
    {
      theirs: "`.fromNow()` (relativeTime)",
      gmt: ["formatRelativeZoned", "formatRelativeDate"],
    },
    {
      theirs: "`dayjs.duration(s).humanize()` (duration)",
      gmt: ["parseDuration", "formatDuration"],
    },
    {
      theirs: "`dayjs.unix(sec)`, `.unix()`",
      gmt: ["convertUnixToUtc", "convertUtcToUnix"],
      note: 'Pass `{ epochUnit: "seconds" }`.',
    },
  ],
  more: [
    { theirs: "`.quarter()` (quarterOfYear)", gmt: ["getQuarterForDate"] },
    {
      theirs: "`.month(1)`",
      gmt: ["setDate"],
      note: "`month()` counts from 0; GMT counts from 1.",
    },
    { theirs: "`.dayOfYear()` (dayOfYear)", gmt: ["getDayOfYear"] },
    {
      theirs: "`.utcOffset()`",
      gmt: ["getZonedOffsetAs"],
      note: "Pass the unit `minutes`.",
    },
  ],
};

const moment: LibraryMap = {
  id: "moment",
  rows: [
    {
      theirs: "`moment(s, moment.ISO_8601, true)`",
      gmt: ["isValidDate", "isValidDateTime", "isValidZonedDateTime"],
      note: "The string is the value; check it with a validator. Strict ISO mode rejects a string with a `[zone]`.",
      cases: ["M10"],
    },
    {
      theirs: '`moment(s, "DD/MM/YYYY", true)`',
      gmt: ["parseDateWithPattern"],
      note: "Rewrite the tokens to `dd/MM/yyyy`.",
      cases: ["M9d"],
    },
    {
      theirs: '`moment(s, "YYYY MMM", locale)`',
      gmt: ["parseYearMonthWithPattern"],
      note: "Rewrite the tokens to `yyyy MMM`. The result is `YYYY-MM`, with no day.",
    },
    { theirs: "`.isValid()`", gmt: ["isValidDate"] },
    {
      theirs: '`.format("LL")`',
      gmt: ["formatDate"],
      note: "GMT has no token formatter; pass a locale and `dateStyle`.",
    },
    {
      theirs: "`.toISOString()`",
      gmt: [],
      note: "None for a GMT UTC string; it is already ISO 8601.",
      cases: ["M14"],
    },
    { theirs: "`moment()`, `moment.tz(z)`", gmt: ["getUtcNow", "getZonedNow"] },
    {
      theirs: "`.clone()`",
      gmt: [],
      note: "Not needed: a string cannot change.",
    },
    {
      theirs: '`.add(1, "day")`',
      gmt: ["addDate", "addZoned"],
      note: "Moment changes the object and returns it; GMT returns a new string. The Berlin gap result is the same.",
      cases: ["M1", "M2", "M3", "M5"],
    },
    {
      theirs: '`.add(1, "month")`',
      gmt: ["addDate"],
      note: "The day is clamped to the month length.",
      cases: ["M7"],
    },
    { theirs: "`.subtract(n, unit)`", gmt: ["subtractDate", "subtractZoned"] },
    { theirs: '`.add(1, "hour")`', gmt: ["addZoned"] },
    {
      theirs: '`b.diff(a, "days")`',
      gmt: ["diffDate"],
      note: "The arguments are in the other order: earlier first.",
    },
    {
      theirs: '`b.diff(a, "months")`',
      gmt: ["diffDate"],
      note: "From 2024-01-31 to 2024-02-29 Moment counts 1 month and GMT counts 0.",
      cases: ["M8"],
    },
    { theirs: '`.startOf("month")`', gmt: ["startOfDate"] },
    { theirs: '`.endOf("month")`', gmt: ["endOfDate"] },
    {
      theirs: '`moment.tz(s, z).startOf("day")`',
      gmt: ["startOfZoned"],
      note: "The Santiago result is the same.",
      cases: ["M6"],
    },
    {
      theirs: "`.isBefore(b)`, `.isAfter(b)`",
      gmt: ["isBeforeDate", "isAfterDate", "isBeforeZoned"],
    },
    {
      theirs: "`.isSame(b)`",
      gmt: ["areDatesEqual", "areUtcEqual"],
      cases: ["M3b"],
    },
    {
      theirs: '`.isSame(b, "day")`',
      gmt: ["areDatesEqualBy", "areZonedEqualBy"],
    },
    {
      theirs: "`.isBetween(a, b)`",
      gmt: ["isBetweenDate"],
      note: "Moment excludes both ends by default; pass `{ inclusiveStart: false, inclusiveEnd: false }`.",
    },
    { theirs: "`moment.min(…)`, `moment.max(…)`", gmt: ["minDate", "maxDate"] },
    {
      theirs: "`.daysInMonth()`, `.isLeapYear()`",
      gmt: ["getDaysInMonth", "getDaysInYearMonth", "isLeapYear"],
    },
    {
      theirs: "`.isoWeek()`, `.isoWeekYear()`, `.isoWeeksInYear()`",
      gmt: ["getIsoWeekDate", "getWeeksInYear"],
      note: "`.week()` is a locale week.",
      cases: ["M12"],
    },
    {
      theirs: "`moment.tz(local, z)`, `.tz(z)`",
      gmt: ["convertPlainDateTimeToZoned", "convertZonedToZoned"],
      note: "Moment has no disambiguation option; GMT takes `disambiguation`.",
      cases: ["M4", "M4b", "M16"],
    },
    {
      theirs: "`.fromNow()`, `.calendar()`",
      gmt: ["formatRelativeZoned", "formatCalendar"],
    },
    {
      theirs: "`moment.duration(s).humanize()`",
      gmt: ["parseDuration", "formatDuration"],
    },
    {
      theirs: "`moment.unix(sec)`, `.unix()`",
      gmt: ["convertUnixToUtc", "convertUtcToUnix"],
      note: 'Pass `{ epochUnit: "seconds" }`.',
    },
    {
      theirs: "`.isDST()`, `.utcOffset()`, `moment.tz.zone(z)`",
      gmt: ["isInDaylightSaving", "getZonedOffsetAs", "isValidTimeZone"],
    },
  ],
  more: [
    { theirs: "`.quarter()`", gmt: ["getQuarterForDate"] },
    {
      theirs: "`.month(1)`",
      gmt: ["setDate"],
      note: "`month()` counts from 0; GMT counts from 1.",
    },
    { theirs: "`.dayOfYear()`", gmt: ["getDayOfYear"] },
  ],
};

const internationalizedDate: LibraryMap = {
  id: "internationalized-date",
  rows: [
    {
      theirs: "`parseDate(s)`",
      gmt: ["isValidDate"],
      note: "`parseDate` throws on 2024-02-30; `isValidDate` returns `false`.",
      cases: ["M9b"],
    },
    { theirs: "`parseDateTime(s)`", gmt: ["isValidDateTime"] },
    {
      theirs: "`parseZonedDateTime(s, disambiguation)`",
      gmt: ["isValidZonedDateTime", "isValidCalendarZonedDateTime"],
      note: "The library rejects a string with a `[u-ca=…]` annotation.",
      cases: ["M10", "M10c"],
    },
    {
      theirs: "`parseAbsolute(s, z)`",
      gmt: ["convertUtcToZoned", "convertZonedToZoned"],
      note: "The library reads an offset with minutes before UTC one hour off.",
      cases: ["M11"],
    },
    {
      theirs: "`parseAbsoluteToLocal(s)`",
      gmt: ["convertUtcToZoned", "getSystemTimeZone"],
    },
    { theirs: "`today(z)`", gmt: ["getZonedToday"] },
    { theirs: "`now(z)`", gmt: ["getZonedNow"] },
    {
      theirs: "`d.add({ days: 1 })`",
      gmt: ["addDate", "addZoned"],
      note: "The Berlin gap result is the same.",
      cases: ["M1", "M2"],
    },
    {
      theirs: "`d.add({ months: 1 })`",
      gmt: ["addDate"],
      note: "The day is clamped to the month length.",
      cases: ["M7"],
    },
    { theirs: "`d.subtract({ … })`", gmt: ["subtractDate", "subtractZoned"] },
    { theirs: "`zdt.add({ hours: 1 })`", gmt: ["addZoned"] },
    {
      theirs: "`b.compare(a)`",
      gmt: ["diffDate"],
      note: 'The library has no month difference; `diffDate(a, b, "months")` returns one.',
    },
    {
      theirs: "`startOfMonth(d)`, `endOfMonth(d)`",
      gmt: ["startOfDate", "endOfDate"],
    },
    {
      theirs: "`startOfWeek(d, locale)`",
      gmt: ["getLocaleStartOfWeek"],
      note: "Both read the first day from the locale.",
    },
    { theirs: "`a.compare(b) < 0`", gmt: ["isBeforeDate"] },
    {
      theirs: "`isSameDay(a, b)`, `isSameMonth(a, b)`",
      gmt: ["areDatesEqualBy"],
    },
    { theirs: "`isEqualDay(a, b)`", gmt: ["areDatesEqual"] },
    {
      theirs: "`minDate(a, b)`, `maxDate(a, b)`",
      gmt: ["minDate", "maxDate"],
      note: "GMT takes an array.",
    },
    { theirs: "`d.calendar.getDaysInMonth(d)`", gmt: ["getDaysInMonth"] },
    {
      theirs: "`getDayOfWeek(d, locale)`",
      gmt: ["getLocaleDayOfWeek", "parseDayOfWeekFromDate"],
      note: "`getLocaleDayOfWeek` counts from the locale's first day; `parseDayOfWeekFromDate` returns the ISO number 1 to 7.",
    },
    {
      theirs: "`isWeekend(d, locale)`",
      gmt: ["isWeekend"],
      note: "Both read CLDR week data.",
    },
    {
      theirs: "`toTimeZone(zdt, z)`",
      gmt: ["convertZonedToZoned"],
      cases: ["M16"],
    },
    {
      theirs: "`toZoned(dt, z, disambiguation)`",
      gmt: ["convertPlainDateTimeToZoned"],
      note: "The option takes the same four values.",
      cases: ["M4", "M4b"],
    },
    {
      theirs: '`toCalendar(d, createCalendar("japanese"))`',
      gmt: ["convertDateToCalendar"],
    },
    { theirs: "`getHoursInDay(d, z)`", gmt: ["getHoursInZonedDay"] },
    {
      theirs: "`parseDuration(s)`, `DateFormatter(locale, o).format(…)`",
      gmt: ["parseDuration", "formatDate"],
    },
  ],
  more: [
    { theirs: "`getLocalTimeZone()`", gmt: ["getSystemTimeZone"] },
    { theirs: "`d.set({ month: 2 })`", gmt: ["setDate"] },
    {
      theirs: "`fromDate(date, z)`",
      gmt: ["convertUtcToZoned"],
      note: "Pass `date.toISOString()`.",
    },
    {
      theirs: "ISO week",
      gmt: ["getIsoWeekDate"],
      note: "The library has no ISO-week call.",
      cases: ["M12"],
    },
  ],
};

export const migrationMaps: readonly LibraryMap[] = [
  dateFns,
  luxon,
  dayjs,
  moment,
  internationalizedDate,
];

export const mapFor = (id: LibraryId): LibraryMap => {
  const map = migrationMaps.find((known) => known.id === id);
  if (map === undefined) throw new Error(`migration-maps: no map for ${id}`);
  return map;
};
