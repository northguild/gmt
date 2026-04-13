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

Current time values:

- `getNow`, `getSystemTimeZone`, `getToday`

### map

Generate multiple values:

- `mapDatesInRange`, `mapDaysInMonth`

### parse

Extract components:

- `parseDateTimeUnit`, `parseDateUnit`, `parseTimeUnit`

### validate

Validation helpers:

- `isLeapSecond`, `isValidDate`, `isValidDateDurationUnit`
- `isValidDateRange`, `isValidDateTime`, `isValidDateTimeDurationUnit`
- `isValidIsoDateLike`, `isValidTime`, `isValidTimeDurationUnit`
