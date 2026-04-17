# Zoned API

IANA timezone-aware date and time operations. All functions accept and return ISO 8601 strings with timezone annotations (e.g., `2024-03-17T14:30:45+00:00[America/New_York]`).

## Modules

### calculate

Timezone-aware arithmetic:

- `addZoned`, `diffZoned`
- `endOfQuarterForZoned`, `endOfZoned`
- `getQuarterForZoned`
- `maxZoned`, `minZoned`, `sortZoned`
- `startOfQuarterForZoned`, `startOfZoned`
- `subtractZoned`

### chop

Strip timezone components:

- `chopZonedDate`, `chopZonedDateTime`
- `chopZonedMilliseconds`, `chopZonedSeconds`
- `chopZonedTime`, `chopZonedTimezone`

### compare

Timezone-aware comparison:

- `areZonedEqual`, `isAfterZoned`, `isBeforeZoned`, `isBetweenZoned`

### convert

Timezone/format conversion:

- `convertPlainDateTimeToZoned`
- `convertZonedToPlainDateTime`
- `convertZonedToUnix`, `convertZonedToUtc`, `convertZonedToZoned`

### format

Locale-aware timezone formatting:

- `formatZonedDateTime`, `formatZonedRange`

### get

Current in specific timezone:

- `getZonedNow`, `getZonedNowUnit`, `getZonedToday`
- `getZonedYear`, `getZonedMonth`, `getZonedDay`, `getZonedDayOfWeek`
- `getZonedHour`, `getZonedMinute`, `getZonedSecond`
- `getZonedMillisecond`, `getZonedMicrosecond`, `getZonedNanosecond`
- `getZonedWeekOfYear`

### map

Generate multiple timezone values:

- `mapZonedDatesInRange`, `mapZonedHoursInDay`

### parse

Extract timezone components:

- `parseDateFromZoned`, `parseDateTimeFromZoned`
- `parseDayFromZoned`, `parseDayOfWeekFromZoned`
- `parseHourFromZoned`
- `parseMicrosecondFromZoned`, `parseMillisecondFromZoned`
- `parseMinuteFromZoned`
- `parseMonthFromZoned`
- `parseNanosecondFromZoned`, `parseSecondFromZoned`
- `parseTimeFromZoned`, `parseTimeZoneFromZoned`
- `parseUnitFromZoned`
- `parseWeekFromZoned`
- `parseYearFromZoned`

### validate

Validation helpers:

- `isValidTimeZone`, `isValidZonedDateTime`