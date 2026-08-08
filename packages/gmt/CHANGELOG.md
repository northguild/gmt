# @burglekitt/gmt

## 1.6.0

### Minor Changes

- b7a9440: Adds `diffDateAsDuration`, `diffDateTimeAsDuration`, `diffZonedAsDuration`, `diffUnixAsDuration`, and `diffUtcAsDuration` — sibling functions to the existing `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc`, bridging to the `duration` namespace by returning an ISO 8601 duration string (e.g. `"P1DT2H"`) instead of a single-unit number.

  - Each takes a single `unit` (not an array like its counterpart) to set the duration's `largestUnit` — an ISO duration string already expresses a full multi-unit breakdown via `largestUnit` alone.
  - Accepts the same `smallestUnit`/`roundingIncrement`/`roundingMode` rounding options as its counterpart (controlling the underlying difference), plus new `toStringSmallestUnit`/`fractionalSecondDigits`/`toStringRoundingMode` options controlling the precision of the rendered string itself (mirroring `parseDuration`'s options) — kept as separately-named keys since both option sets have colliding `smallestUnit`/`roundingMode` names with different Temporal types.
  - Returns `""` on invalid input, matching the `duration` namespace's string sentinel convention (rather than `null`, which its counterpart number-returning functions use).

  This completes Story Group A (Duration) of the Luxon/react-aria parity roadmap.

- 0eb2052: Adds `formatDuration` to the `duration` namespace, rendering an ISO 8601 duration string as a human-readable, locale-aware string (e.g. `"P1DT2H30M"` + `"en-US"` → `"1 day, 2 hours, and 30 minutes"`).

  - Built on `Intl.NumberFormat({ style: "unit" })` for per-locale unit labels and pluralization, joined via `Intl.ListFormat` — both universally available on Node 20/22/24 with no version variance, unlike `Intl.DurationFormat`, which is absent entirely on Node 20/22 (only ships natively on Node 24+). This keeps `formatDuration` free of any new runtime dependency, at the cost of not being a byte-for-byte match to native `Intl.DurationFormat` output (e.g. no `"digital"` style).
  - Accepts an optional `locale` (system default if omitted) and `{ style?: "long" | "short" | "narrow", zero?: boolean }` options.
  - Zero-valued components are omitted by default; pass `{ zero: true }` to include them. A zero-length duration (`"PT0S"`) always renders `"0 seconds"`.
  - Negative durations render each component with its own leading `"-"`.
  - Returns `""` on invalid input: non-string value or invalid duration string.

- 5b66743: Adds `addDuration` and `subtractDuration` to the `duration` namespace, combining two ISO 8601 duration strings (e.g. `"P1D"` + `"PT2H"` → `"P1DT2H"`) via `Temporal.Duration.prototype.add`/`.subtract`.

  Both operate on day/time units only — combining a pair where either operand has a nonzero years/months/weeks component returns `""`, since `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` option to resolve calendar-unit arithmetic.

- eeee737: Adds `normalizeDuration` to the `duration` namespace, rolling an ISO 8601 duration string's small units into larger ones via `Temporal.Duration.prototype.round` (e.g. `"PT90M"` + `{ largestUnit: "hour" }` → `"PT1H30M"`).

  - Defaults to `{ largestUnit: "auto" }` when no options are given, which reformats a day/time-only duration without promoting units — pass an explicit `largestUnit` to promote.
  - Accepts `largestUnit`, `smallestUnit`, `roundingIncrement`, `roundingMode`, and `relativeTo` options, mirroring `Temporal.Duration.prototype.round`'s options.
  - `relativeTo` is required whenever a calendar unit (year/month/week) is involved — either as the requested `largestUnit`, or because the input duration already has a nonzero year/month/week component (this applies even under the `"auto"` default). Without it in either case, returns `""`.
  - Returns `""` on invalid input: non-string value, invalid duration string, or invalid `relativeTo`.

  Also expands `addDuration`/`subtractDuration`'s test coverage with additional permutations (overflow-without-borrow, negative-operand cancellation, fractional-second combination, negative-result subtraction) per `context/testing-standards.md`'s exhaustive `it.each` coverage bar.

- 6839dca: Adds a new `duration` namespace for parsing and validating ISO 8601 duration strings:

  - `isValidDuration` — validates an ISO 8601 duration string (e.g. `"P1DT2H30M"`) via `Temporal.Duration.from`.
  - `parseDuration` — parses and re-normalizes an ISO 8601 duration string, returning `""` on invalid input. Accepts `smallestUnit`, `fractionalSecondDigits`, and `roundingMode` options to control the precision/rounding of the output.

  Also extends the existing `add*`/`subtract*`/`diff*` functions across the `plain`, `zoned`, `unix`, and `utc` namespaces (`addDate`, `addDateTime`, `addTime`, `addUnix`, `addUtc`, `addZoned`, and their `subtract`/`diff` equivalents) with additional Temporal options that were previously unreachable:

  - `add*`/`subtract*` gain an `overflow` option (`"constrain"` (default, matches current behavior) | `"reject"`) controlling how an out-of-range arithmetic result (e.g. adding 1 month to Jan 31) is resolved — clamp to the nearest valid date, or reject and return the function's sentinel (`""`/`null`).
  - `diff*` gain `smallestUnit`, `roundingIncrement`, and `roundingMode` options to round the computed difference before it's returned, instead of always returning the exact unrounded value.

  All new options are optional and default to current behavior — no existing call signature changes.

## 1.5.0

### Minor Changes

- e83828a: `startOfZoned`, `endOfZoned`, `startOfQuarterForZoned`, `endOfQuarterForZoned`, `mapZonedHoursInDay`, `startOfUnix`, `endOfUnix`, `startOfQuarterForUnix`, and `endOfQuarterForUnix` accept new `disambiguation` and `offset` options (`disambiguation`: `"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`; `offset`: `"prefer" | "use" | "ignore" | "reject"`, defaulting to `"ignore"`) to control how DST gaps and overlaps are resolved when the function's boundary computation lands on an ambiguous or nonexistent local time. `"reject"` returns the function's sentinel (`""`/`null`/`[]`) instead of silently picking a resolution.

  `offset` must stay at its default (`"ignore"`) for `disambiguation` to take effect on these functions — setting it to `"prefer"` (or `"use"`) can make `disambiguation` inert, since these functions construct their boundary via `Temporal.ZonedDateTime.prototype.with()`, which otherwise prefers the source's existing UTC offset whenever it's still valid. See `docs/dst-disambiguation.md` for the full explanation.

  `convertPlainDateTimeToZoned`, `addZoned`, and `subtractZoned` also gain the same `offset` option for API consistency, but it is permanently inert on those three: their underlying construction path always parses a plain datetime string with no offset embedded, so there is never a stored offset for `offset` to act on.

- d6da928: `convertPlainDateTimeToZoned` accepts a new `disambiguation` option (`"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`) to control how DST gaps (spring-forward) and overlaps (fall-back) are resolved when attaching a timezone to a plain datetime. `"reject"` returns `""` for any ambiguous or nonexistent local time instead of silently picking one.
- 2186c3a: `addZoned` and `subtractZoned` accept a new `disambiguation` option (`"compatible" | "earlier" | "later" | "reject"`, defaulting to `"compatible"`) to control how a fall-back (DST-end) overlap is resolved when the arithmetic result lands on an ambiguous local time. `"reject"` returns `""` for an ambiguous result instead of silently picking one.

  This option has no effect on a spring-forward (DST-start) gap: Temporal's arithmetic always resolves a gap landing unambiguously before disambiguation is evaluated, so all four values produce the same result in that case.

## 1.4.0

### Minor Changes

- 313f052: Adds `getTimeZones` to the `zoned` namespace, returning the full list of IANA timezone identifiers supported by the runtime (via `Intl.supportedValuesOf("timeZone")`, `[]` on unsupported runtimes).

  `getSystemTimeZone` moves from the `plain` namespace to `zoned` alongside it. It remains available from the package root (`@burglekitt/gmt`) and from `@burglekitt/gmt/zoned`, but is no longer exported from `@burglekitt/gmt/plain` — update imports accordingly if you were importing it from the `plain` subpath.

## 1.3.0

### Minor Changes

- 9868c37: Adds relative time formatters across all value types, and fills in the missing base formatters for the unix and utc namespaces.

  New relative formatters — all accept `locale`, `style` (`"long" | "short" | "narrow"`), `numeric` (`"auto" | "always"`), `largestUnit`, and an optional `reference` anchor; auto-select the largest sensible unit when `largestUnit` is omitted; return `""` for invalid input:

  - `formatRelativeDate` — relative plain date (e.g. `"3 days ago"`, `"next year"`)
  - `formatRelativeTime` — relative plain time (e.g. `"30 minutes ago"`)
  - `formatRelativeDateTime` — relative plain datetime (e.g. `"in 2 hours"`)
  - `formatRelativeZoned` — relative zoned datetime, DST-safe; reference can be a `ZonedDateTime` string, UTC string, or Unix epoch (ms)
  - `formatRelativeUnix` — relative time from a Unix epoch (ms or seconds); reference can be a numeric epoch or UTC ISO string
  - `formatRelativeUtc` — relative time from a UTC ISO string

  New base formatters:

  - `formatUnix` — locale-aware formatting for Unix epochs (ms or seconds); accepts `timeZone` (including `"local"`) and `includeTimeZoneName`
  - `formatUtc` — locale-aware formatting for UTC ISO strings; accepts `timeZone` and `includeTimeZoneName`

## 1.2.1

### Patch Changes

- 8d49857: Add missing barrel exports for unix and utc comparators, and add a new public export for `plain/validate/isLeapYear`

## 1.2.0

### Minor Changes

- Adds parser methods for plain, unix, utc, zoned. Updates tanstack-intent skills.

## 1.1.0

### Minor Changes

- cc4feab: Adds more unix and utc methods. Adds min, max, sort methods.

## 1.0.0

### Major Changes

- fa5a465: Initial public release of the gmt suite.

  ## @burglekitt/gmt

  Temporal-first date and time library. String-in, string-out API wrapping
  `@js-temporal/polyfill`. Covers plain and zoned arithmetic, comparison,
  formatting, parsing, mapping, conversion, and validation. No `Date` object
  used anywhere.

  ## @burglekitt/gmt-eslint

  ESLint flat-config plugin that bans the `Date` API (`new Date`, `Date.now`,
  `Date.UTC`, `Date.parse`, and the global `Date` reference) and points
  consumers toward `@burglekitt/gmt` replacements.

  ## @burglekitt/gmt-oxlint

  Oxlint JS plugin with the same `Date`-ban policy as `gmt-eslint`. Rules
  cover `new Date`, `Date.now`, `Date.UTC`, `Date.parse`,
  `date.getTimezoneOffset`, and bare `Date` global references.

  ## @burglekitt/gmt-biome

  Biome GritQL plugin enforcing the same `Date`-ban rules for projects using
  Biome as their formatter/linter.
