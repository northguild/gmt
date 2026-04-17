# UTC API

UTC instant utilities. All functions work with UTC-labeled ISO 8601 strings (ending in `Z` or with `+00:00` offset).

## Modules

### calculate

UTC timestamp arithmetic:

- `addUtc`, `diffUtc`
- `endOfQuarterForUtc`, `endOfUtc`
- `isBetweenUtc`
- `maxUtc`, `minUtc`, `sortUtc`
- `startOfQuarterForUtc`, `startOfUtc`
- `subtractUtc`

### chop

Strip UTC components:

- `chopUtc`

### convert

UTC conversion:

- `convertUtcToPlainDate`, `convertUtcToPlainDateTime`, `convertUtcToPlainTime`
- `convertUtcToUnix`, `convertUtcToZoned`

### get

Current UTC time:

- `getUtcNow`, `getUtcNowUnit`
- `getUtcYear`, `getUtcMonth`, `getUtcDay`
- `getUtcHour`, `getUtcMinute`, `getUtcSecond`
- `getUtcMillisecond`, `getUtcMicrosecond`, `getUtcNanosecond`

### parse

Parse UTC components:

- `parseDateFromUtc`
- `parseDayFromUtc`, `parseDayOfWeekFromUtc`
- `parseHourFromUtc`
- `parseMicrosecondFromUtc`, `parseMillisecondFromUtc`
- `parseMinuteFromUtc`
- `parseMonthFromUtc`
- `parseNanosecondFromUtc`, `parseSecondFromUtc`
- `parseTimeFromUtc`
- `parseUnitFromUtc`
- `parseWeekFromUtc`, `parseYearFromUtc`

### validate

Validation helpers:

- `isValidUtc`