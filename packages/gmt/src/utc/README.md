# UTC API

UTC instant utilities. All functions work with UTC-labeled ISO 8601 strings (ending in `Z` or with `+00:00` offset).

## Modules

### calculate

UTC timestamp arithmetic:

- `addUtc`, `diffUtc`, `diffUtcAsDuration`
- `endOfQuarterForUtc`, `endOfUtc`
- `isBetweenUtc`
- `maxUtc`, `minUtc`, `roundUtc`, `sortUtc`
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

### interval

Validate and check UTC intervals:

- `isValidUtcInterval`
- `intervalContainsUtc`
- `intervalUnionUtc`

### format

Locale-aware UTC formatting:

- `formatUtc`
- `formatRelativeUtc`

> **Locale data note.** These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):
>
> - **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatUtc(value, "ko-KR", { timeStyle: "short" })` returns `"오후 2:30"`.
> - **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods, timezone names, and other locale data — the same call may return `"PM 2:30"`.
>
> This is a property of the runtime, not the library. If you need consistent non-English output across all environments, ensure your Node deployments use a full-ICU build, or polyfill `Intl` with a package that bundles locale data.

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

- `isValidUtc`, `isValidUtcRange`
