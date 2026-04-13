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

- `convertZonedToUnix`, `convertZonedToUtc`, `convertZonedToZoned`

### format

Locale-aware timezone formatting:

- `formatZonedDateTime`, `formatZonedRange`

### get

Current time in specific timezone:

- `getZonedDate`, `getZonedDateTime`, `getZonedNow`
- `getZonedNowUnit`, `getZonedToday`

### map

Generate multiple timezone values:

- `mapZonedDatesInRange`, `mapZonedHoursInDay`

### parse

Extract timezone components:

- `parseZonedDate`, `parseZonedDateTime`, `parseZonedTime`
- `parseZonedTimezone`, `parseZonedUnit`

### validate

Validation helpers:

- `isValidTimeZone`, `isValidZonedDateTime`
