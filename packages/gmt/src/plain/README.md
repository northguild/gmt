# Plain API

Timezone-free date and time operations. All functions accept and return ISO 8601 date/time strings without timezone annotations.

## Modules

### calculate

Arithmetic and date manipulation:

- `addDate`, `addDateTime`, `addTime`
- `diffDate`, `diffDateTime`, `diffTime`
- `endOfDate`, `endOfDateTime`, `endOfTime`
- `endOfQuarterForDate`, `endOfQuarterForDateTime`
- `getLargestDateDurationUnit`, `getLargestDateTimeDurationUnit`, `getLargestTimeDurationUnit`
- `getQuarterForDate`, `getQuarterForDateTime`
- `getWeekNumber`
- `maxDate`, `maxDateTime`, `maxTime`
- `minDate`, `minDateTime`, `minTime`
- `sortDates`, `sortDateTimes`, `sortTimes`
- `startOfDate`, `startOfDateTime`, `startOfTime`
- `startOfQuarterForDate`, `startOfQuarterForDateTime`
- `subtractDate`, `subtractDateTime`, `subtractTime`
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

### format

Locale-aware formatting:

- `formatDate`, `formatDateTime`, `formatTime`

### get

Current values:

- `getNow`, `getNowUnit`, `getSystemTimeZone`, `getToday`
- `getYear`, `getMonth`, `getDay`, `getDayOfWeek`
- `getHour`, `getMinute`, `getSecond`
- `getMillisecond`, `getMicrosecond`, `getNanosecond`
- `getWeekOfYear`

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
- `isValidDateRange`, `isValidDateTime`, `isValidDateTimeDurationUnit`
- `isValidDateTimeUnit`, `isValidDateUnit`
- `isValidIsoDateLike`, `isValidTime`, `isValidTimeDurationUnit`, `isValidTimeUnit`