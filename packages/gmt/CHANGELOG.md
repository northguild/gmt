# @burglekitt/gmt

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
