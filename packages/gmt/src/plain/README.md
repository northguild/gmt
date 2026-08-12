# Plain API

Timezone-free date and time operations. All functions accept and return ISO 8601 date/time strings without timezone annotations.

## Modules

### calculate

Arithmetic and date manipulation:

- `addBusinessDays`, `addDate`, `addDateTime`, `addTime`
- `clampDate`, `closestDateTo`
- `diffDate`, `diffDateAsDuration`, `diffDateTime`, `diffDateTimeAsDuration`, `diffTime`
- `endOfDate`, `endOfDateTime`, `endOfTime`
- `endOfQuarterForDate`, `endOfQuarterForDateTime`
- `getLargestDateDurationUnit`, `getLargestDateTimeDurationUnit`, `getLargestTimeDurationUnit`
- `getLocaleEndOfWeek`, `getLocaleStartOfWeek`
- `getQuarterForDate`, `getQuarterForDateTime`
- `getWeekNumber`
- `maxDate`, `maxDateTime`, `maxTime`
- `minDate`, `minDateTime`, `minTime`
- `roundDate`, `roundDateTime`, `roundTime`
- `sortDates`, `sortDateTimes`, `sortTimes`
- `startOfDate`, `startOfDateTime`, `startOfTime`
- `startOfQuarterForDate`, `startOfQuarterForDateTime`
- `subtractBusinessDays`, `subtractDate`, `subtractDateTime`, `subtractTime`
- `weekOfYear`

### chop

Strip components from date/time strings:

- `chopDate`, `chopMilliseconds`, `chopSeconds`, `chopTime`
- `chopUtc` (re-exported from utc/chop)

### compare

Date/time comparison:

- `areDatesEqual`, `areDateTimesEqual`, `areTimesEqual`
- `isAfterDate`, `isAfterDateTime`, `isAfterTime`
- `isBeforeDate`, `isBeforeDateTime`, `isBeforeTime`
- `isBetweenDate`, `isBetweenDateTime`, `isBetweenTime`
- `isBusinessDay`
- `isWeekend`

### format

Locale-aware formatting:

- `formatDate`, `formatDateTime`, `formatTime`
- `formatRelativeDate`, `formatRelativeTime`, `formatRelativeDateTime`

> **Locale data note.** These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):
>
> - **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatTime("14:30:00", "ko-KR", { timeStyle: "short" })` returns `"오후 2:30"`.
> - **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods, timezone names, and other locale data — the same call may return `"PM 2:30"`.
>
> This is a property of the runtime, not the library. If you need consistent non-English output across all environments, ensure your Node deployments use a full-ICU build, or polyfill `Intl` with a package that bundles locale data.

### get

Current values and locale-aware extraction:

- `getNow`, `getNowUnit`, `getToday`
- `getYear`, `getMonth`, `getDay`, `getDayOfWeek`
- `getHour`, `getMinute`, `getSecond`
- `getMillisecond`, `getMicrosecond`, `getNanosecond`
- `getWeekOfYear`
- `getLocaleDayOfWeek`

### interval

Validate and check date/time intervals:

- `isValidDateInterval`, `isValidDateTimeInterval`, `isValidTimeInterval`
- `intervalContainsDate`, `intervalContainsDateTime`, `intervalContainsTime`

### map

Generate multiple values:

- `mapDatesInRange`, `mapDaysInMonth`

### parse

Extract components:

- `parseDayFromDate`, `parseDayFromDateTime`
- `parseDayOfWeekFromDate`, `parseDayOfWeekFromDateTime`
- `parseHourFromDateTime`, `parseHourFromTime`
- `parseMicrosecondFromDateTime`, `parseMicrosecondFromTime`
- `parseMillisecondFromDateTime`, `parseMillisecondFromTime`
- `parseMinuteFromDateTime`, `parseMinuteFromTime`
- `parseMonthFromDate`, `parseMonthFromDateTime`
- `parseNanosecondFromDateTime`, `parseNanosecondFromTime`
- `parseSecondFromDateTime`, `parseSecondFromTime`
- `parseUnitFromDate`, `parseUnitFromDateTime`, `parseUnitFromTime`
- `parseWeekFromDate`, `parseWeekFromDateTime`
- `parseYearFromDate`, `parseYearFromDateTime`

### validate

Validation helpers:

- `isLeapSecond`, `isValidDate`, `isValidDateDurationUnit`
- `isValidDateRange`, `isValidDateTime`, `isValidDateTimeDurationUnit`, `isValidDateTimeRange`
- `isValidDateTimeUnit`, `isValidDateUnit`
- `isValidIsoDateLike`, `isValidTime`, `isValidTimeDurationUnit`, `isValidTimeRange`, `isValidTimeUnit`
