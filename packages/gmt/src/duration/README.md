# Duration API

Parsing, validation, arithmetic, introspection, comparison, and formatting for ISO 8601 duration strings (e.g. `"P1DT2H30M"`). All functions accept ISO 8601 duration strings; those that return a duration return one too, while the introspection and comparison helpers return numbers (sentinel `null`) rather than strings (sentinel `""`).

## Modules

### calculate

Combine two durations:

- `addDuration`
- `subtractDuration`

Both operate on day/time units (days, hours, minutes, seconds, ...). Combining any pair where either operand has a nonzero years/months/weeks component returns `""` — `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option, so calendar-unit duration arithmetic isn't supported here.

Flip or drop a duration's sign:

- `negateDuration`
- `absDuration`

Both are pure sign operations, so neither needs `relativeTo` and both work on calendar-unit durations. Temporal canonicalizes every zero-length duration, so `"P0D"` comes back as `"PT0S"`.

Read a duration's contents:

- `getDurationUnit` — one component, as stored
- `durationAs` — the whole duration totalled into one unit
- `getDurationSign` — `-1`, `0`, or `1`

`getDurationUnit` and `durationAs` answer different questions and disagree on purpose: `getDurationUnit("PT90M", "hours")` is `0` (the hours *field* is empty — "PT90M" stores 90 minutes), while `durationAs("PT90M", "hours")` is `1.5`. `durationAs` returns a fractional total and does not round; pass the result through `normalizeDuration` instead if you want a rebalanced duration string.

`durationAs` needs `relativeTo` whenever a calendar unit is involved on either side — as the requested `unit`, or because the input duration already carries a nonzero year/month/week component. Without it, returns `null`. The requested-unit half applies even to day/time-only input: `durationAs("PT36H", "weeks")` is `null`, because a week is a calendar quantity to Temporal regardless of what is being measured. `getDurationUnit` and `getDurationSign` never need it — reading a stored field is not a unit conversion.

`relativeTo` accepts a GMT calendar-annotated `PlainDate` string (E5, e.g. `"5784-06-15[u-ca=hebrew]"`, as produced by `convertDateToCalendar`), not Temporal's own differently-shaped `[u-ca=...]` convention — `durationAs("P1Y", "days", { relativeTo: "5784-06-15[u-ca=hebrew]" })` is `385`, a Hebrew leap year, not the `366` a Gregorian `P1Y` would total. `compareDurations` and `normalizeDuration` (below) accept the same calendar-annotated shape for their own `relativeTo`.

### compare

Compare two durations by length:

- `compareDurations`

Returns `-1`/`0`/`1`, comparing by length rather than by spelling: `compareDurations("PT60M", "PT1H")` is `0`. `relativeTo` is required when either side has a calendar unit, and — unlike `addDuration`/`subtractDuration` — `Temporal.Duration.compare` actually accepts it, so calendar-unit durations *are* comparable here even though they cannot be combined. The anchor decides the answer rather than merely unblocking it: `"P1M"` is longer than `"P30D"` relative to `2024-01-01` (31 days) and shorter relative to `2024-02-01` (29). It matters for non-calendar units too when it names a zoned instant — across a DST spring-forward, `"P1D"` is 23 real hours and compares shorter than `"PT24H"`.

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
