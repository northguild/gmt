# Duration API

Parsing, validation, and arithmetic for ISO 8601 duration strings (e.g. `"P1DT2H30M"`). All functions accept and return ISO 8601 duration strings.

## Modules

### calculate

Combine two durations:

- `addDuration`
- `subtractDuration`

Both operate on day/time units (days, hours, minutes, seconds, ...). Combining any pair where either operand has a nonzero years/months/weeks component returns `""` — `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option, so calendar-unit duration arithmetic isn't supported here.

### normalize

Roll small units into larger ones:

- `normalizeDuration`

Defaults to `{ largestUnit: "auto" }`, which reformats a day/time-only duration without promoting units — pass an explicit `largestUnit` to promote (e.g. `"PT90M"` → `"PT1H30M"` with `largestUnit: "hour"`). `relativeTo` is required whenever a calendar unit (year/month/week) is involved, either as the requested `largestUnit` or because the input duration already has a nonzero year/month/week component (this applies even under the `"auto"` default) — without it, returns `""`.

### parse

Parse and normalize:

- `parseDuration`

### validate

Validation helpers:

- `isValidDuration`
