# Zoned API

IANA timezone-aware date and time operations. All functions accept and return ISO 8601 strings with timezone annotations (e.g., `2024-03-17T14:30:45+00:00[America/New_York]`).

## Modules

### calculate

Timezone-aware arithmetic:

- `addZoned`, `addZonedBusinessDays`, `clampZoned`, `closestZonedTo`
- `diffZoned`, `diffZonedAsDuration`
- `endOfQuarterForZoned`, `endOfZoned`
- `getLocaleZonedEndOfWeek`, `getLocaleZonedStartOfWeek`
- `getQuarterForZoned`
- `maxZoned`, `minZoned`, `roundZoned`, `sortZoned`
- `startOfQuarterForZoned`, `startOfZoned`
- `subtractZoned`, `subtractZonedBusinessDays`

### chop

Strip timezone components:

- `chopZonedDate`, `chopZonedDateTime`
- `chopZonedMilliseconds`, `chopZonedSeconds`
- `chopZonedTime`, `chopZonedTimezone`

### compare

Timezone-aware comparison:

- `areZonedEqual`, `isAfterZoned`, `isBeforeZoned`, `isBetweenZoned`, `isZonedBusinessDay`, `isZonedWeekend`

### convert

Timezone/format conversion:

- `convertPlainDateTimeToZoned`
- `convertZonedToPlainDateTime`
- `convertZonedToUnix`, `convertZonedToUtc`, `convertZonedToZoned`

### format

Locale-aware timezone formatting:

- `formatZonedDateTime`, `formatZonedRange`
- `formatRelativeZoned`

> **Locale data note.** These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):
>
> - **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatZonedDateTime(value, "ko-KR", { dateStyle: "full", timeStyle: "full" })` includes `"오후"` and the long Korean timezone name `"대한민국 표준시"`.
> - **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods and shorter timezone names — the same call may return `"PM"` and `"한국 표준시"`, and some long-style timezone names may be replaced by offset strings like `"GMT+9"` or `"GMT+03:00"`.
>
> This is a property of the runtime, not the library. If you need consistent non-English output across all environments, ensure your Node deployments use a full-ICU build, or polyfill `Intl` with a package that bundles locale data.

### get

Current in specific timezone and locale-aware extraction:

- `getSystemTimeZone`, `getTimeZones`
- `getZonedNow`, `getZonedNowUnit`, `getZonedToday`
- `getZonedYear`, `getZonedMonth`, `getZonedDay`, `getZonedDayOfWeek`
- `getZonedHour`, `getZonedMinute`, `getZonedSecond`
- `getZonedMillisecond`, `getZonedMicrosecond`, `getZonedNanosecond`
- `getZonedWeekOfYear`
- `getLocaleZonedDayOfWeek`

### interval

Validate and check zoned intervals:

- `isValidZonedInterval`
- `intervalContainsZoned`

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

- `isValidTimeZone`, `isValidZonedDateTime`, `isValidZonedRange`
