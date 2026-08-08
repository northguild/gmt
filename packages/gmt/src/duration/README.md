# Duration API

Parsing, validation, arithmetic, and formatting for ISO 8601 duration strings (e.g. `"P1DT2H30M"`). All functions accept ISO 8601 duration strings; all but `formatDuration` return one too.

## Modules

### calculate

Combine two durations:

- `addDuration`
- `subtractDuration`

Both operate on day/time units (days, hours, minutes, seconds, ...). Combining any pair where either operand has a nonzero years/months/weeks component returns `""` — `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option, so calendar-unit duration arithmetic isn't supported here.

### format

Render a duration as a human-readable, locale-aware string:

- `formatDuration`

Built on `Intl.NumberFormat({ style: "unit" })` (per-component labels and pluralization) and `Intl.ListFormat` (joining) — both universally available, unlike `Intl.DurationFormat`, which is absent on Node 20/22 (only ships natively on Node 24+). This keeps `formatDuration` dependency-free and behaviorally identical across all currently-supported Node versions, at the cost of not being a byte-for-byte match to native `Intl.DurationFormat` output (e.g. no `"digital"` `01:30:00`-style output). Zero-valued components are omitted by default (`{ zero: true }` to include them); a zero-length duration always renders `"0 seconds"`.

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

## Bridge from `diff*` functions

`diffDateAsDuration`, `diffDateTimeAsDuration`, `diffZonedAsDuration`, `diffUnixAsDuration`, and `diffUtcAsDuration` — sibling functions to `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc` (in `plain/calculate`, `zoned/calculate`, `unix/calculate`, `utc/calculate` respectively, not this namespace) — return an ISO 8601 duration string instead of a single-unit number. Unlike their counterparts, they take a single `unit` (not an array) to set the resulting duration's `largestUnit`, since an ISO duration string already expresses a full multi-unit breakdown. They return `""` on invalid input, matching this namespace's sentinel convention rather than their counterparts' `null`.
