# Unix API

Unix epoch (seconds or milliseconds) utilities. All functions work with numeric Unix timestamps.

## Modules

### calculate

Unix timestamp arithmetic:

- `addUnix`, `diffUnix`, `diffUnixAsDuration`
- `endOfQuarterForUnix`, `endOfUnix`
- `isBetweenUnix`
- `maxUnix`, `minUnix`, `sortUnix`
- `startOfQuarterForUnix`, `startOfUnix`
- `subtractUnix`

### convert

Unix timestamp conversion:

- `convertUnixToPlainDate`, `convertUnixToPlainDateTime`, `convertUnixToPlainTime`
- `convertUnixToUtc`, `convertUnixToZoned`

### get

Current Unix timestamps:

- `getUnixNow`, `getUnixNowUnit`
- `getUnixYear`, `getUnixMonth`, `getUnixDay`
- `getUnixHour`, `getUnixMinute`, `getUnixSecond`
- `getUnixMillisecond`, `getUnixMicrosecond`, `getUnixNanosecond`

### format

Locale-aware Unix formatting:

- `formatUnix`
- `formatRelativeUnix`

> **Locale data note.** These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):
>
> - **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatUnix(ms, "ko-KR", { timeStyle: "short" })` returns `"오후 2:30"`.
> - **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods, timezone names, and other locale data — the same call may return `"PM 2:30"`.
>
> This is a property of the runtime, not the library. If you need consistent non-English output across all environments, ensure your Node deployments use a full-ICU build, or polyfill `Intl` with a package that bundles locale data.

### parse

Parse Unix timestamps:

- `parseDateFromUnix`, `parseDayFromUnix`, `parseDayOfWeekFromUnix`
- `parseHourFromUnix`
- `parseMicrosecondFromUnix`, `parseNanosecondFromUnix`
- `parseMonthFromUnix`, `parseSecondFromUnix`
- `parseTimeFromUnix`
- `parseUnitFromUnix`
- `parseWeekFromUnix`
- `parseYearFromUnix`

### validate

Validation helpers:

- `isValidUnixMilliseconds`, `isValidUnixSeconds`, `isValidUnixUnit`