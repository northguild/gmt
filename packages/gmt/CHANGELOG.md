# @burglekitt/gmt

## 1.13.0

### Minor Changes

- 9d341ce: Add calendar quantity getters: `getDaysInMonth`, `getDaysInYear`, `getDayOfYear`, `getWeeksInYear`, `getWeeksInMonth`, `getWeekOfMonth` (Story J3).

  All six take a `PlainDate` ISO string and return `number | null`. `getDaysInMonth`, `getDaysInYear`, and `getDayOfYear` wrap Temporal's own `daysInMonth`/`daysInYear`/`dayOfYear`. `getWeeksInYear` reports the ISO week-numbering year's total week count (52 or 53), resolved from `value`'s own `yearOfWeek` rather than its calendar year, since late-December/early-January dates can belong to a different ISO week-year than their calendar year.

  `getWeeksInMonth` and `getWeekOfMonth` are locale-aware — they size and index a month's calendar-grid rows using `locale`'s first day of week, matching date-fns's `getWeekOfMonth` convention (the row containing the 1st of the month counts as row 1, even when partial). They live in `plain/calculate/`, not `plain/get/`, per the rule J0b established: `get/` namespaces are current-moment accessors only, and these take a date value.

- 6d9ed5e: Add duration introspection and comparison: `getDurationUnit`, `durationAs`, `negateDuration`, `absDuration`, `compareDurations`, `getDurationSign` (Story J8).

  `getDurationUnit` reads a single component as stored (`getDurationUnit("PT90M", "hours")` is `0` — the minutes field holds 90, not a converted total); `durationAs` totals the whole duration into one unit instead (`durationAs("PT90M", "hours")` is `1.5`). `negateDuration`/`absDuration` flip or drop the sign; `getDurationSign` reports `-1`/`0`/`1`. New `duration/compare/` module holds `compareDurations`, wrapping `Temporal.Duration.compare`.

  `durationAs` and `compareDurations` follow the `relativeTo` pattern already documented for `normalizeDuration` (A3): any calendar unit (years/months/weeks) on either side requires `relativeTo`, returning the sentinel (`null`) without it — this applies even when the _requested_ unit is the only calendar-shaped one, e.g. `durationAs("PT36H", "weeks")` is `null`. Worth noting the asymmetry with `addDuration`/`subtractDuration` (A2): `Temporal.Duration.compare` **does** accept `relativeTo`, so `compareDurations` can order calendar-unit durations in cases `addDuration` cannot combine. `negateDuration`, `absDuration`, and `getDurationSign` are pure sign operations and never need `relativeTo`, even on calendar-unit durations.

  Updated `packages/gmt/README.md`, `packages/gmt/src/duration/README.md`, and the `durations` skill (new Core Patterns plus two Common Mistakes entries extending the existing `relativeTo` guidance).

- 3eae84e: Add field setters: `setDate`, `setDateTime`, `setTime`, `setZoned`, `setUnix`, `setUtc` (Story J1).

  Each takes a partial fields object and wraps `Temporal.*.prototype.with()`, resolving every supplied field in a single atomic overflow pass — the safe alternative to composing `add*` calls field-by-field, which resolves each field's overflow independently and can silently diverge on multi-field updates (e.g. setting month-then-day vs. day-then-month on the same target).

  All six take `overflow` ("constrain" (default) | "reject"). `setZoned`, `setUnix`, and `setUtc` additionally take `disambiguation` and `offset` (default `"ignore"`, same rule as the `startOfZoned` family — see `docs/dst-disambiguation.md`) for DST gap/overlap control; `setUtc`'s `disambiguation`/`offset` are accepted for signature consistency but are permanently inert, since `"UTC"` has no DST transitions.

  An empty fields object is a no-op on all six.

- f948e85: Add `formatCalendar`, `formatCalendarZoned`, `formatCalendarUnix`, `formatCalendarUtc` (Story J15) — Story Group J complete.

  Moment's `.calendar()`: a relative day label plus time-of-day, e.g. `"Tomorrow at 2:30 PM"`. This is distinct from the existing `formatRelative*` family, which renders an elapsed-time phrase ("in 1 day") and never includes a clock time — Group I's notes over-generalized Luxon's `toRelativeCalendar` parity claim to Moment's `.calendar()`, which this story corrects.

  Within `±6` days of `reference` (default "now"), renders `<day label> <connector> <time>` — "today"/"tomorrow"/"yesterday" near the boundary, "in N days"/"N days ago" further out, via `Intl.RelativeTimeFormat`. Beyond that, falls back to an absolute `dateStyle: "long"` + `timeStyle` string with no relative wording, matching Moment's `sameElse` behavior.

  The day label and time are joined using the **locale's own connector** — read from `Intl.DateTimeFormat`'s combined `dateStyle` + `timeStyle` part sequence for the same instant, never a hardcoded `"at"`. This is the go/no-go decision the story required before implementation: a verified `Intl`-only route with no hardcoded English, covering all 17 `MustTestLocales` including a locale (ru-RU) whose combined date+time pattern fuses a date-side suffix onto the connector literal, which the new `internal/joinDateTimeConnector.ts` helper detects and strips.

  `timeStyle: "full"` is available on the zoned/unix/utc variants (a real IANA zone) but not on plain `formatCalendar` — a plain value has no real timezone, so `"full"`'s `timeZoneName` would misrepresent the internal UTC anchor as a fact about the input.

  Updated `packages/gmt/README.md`, `plain/README.md`, `zoned/README.md`, `unix/README.md`, `utc/README.md`, and the `format-date-time` skill (new Core Pattern + a Common Mistakes entry distinguishing `formatCalendar` from `formatRelativeDateTime`).

- c14db2a: Add `formatDateToParts`, `formatDateTimeToParts`, `formatZonedToParts` (Story J12).

  Each returns the locale-ordered `Array<{ type, value }>` parts behind `formatDate`/`formatDateTime`/`formatZonedDateTime`'s finished strings, mirroring those functions' `(value, locale?, options?)` signature exactly. `formatZonedToParts` also emits `timeZoneName` parts when `options.timeZoneName` is set. All three return `[]` on invalid input.

  This is GMT's sanctioned substitute for a token formatter (Luxon `toFormat`, date-fns `format`), which remains deliberately excluded (roadmap Decision 1): a token pattern like `"MM/dd/yyyy"` hard-codes US field order and ships it to every locale. `formatToParts` gives the caller full control over presentation while the locale keeps control of field order — iterate the returned array instead of reassembling parts in a fixed order.

- 7ff6484: Add interval length and partitioning: `intervalLength*`, `intervalDivideEqually*`, `intervalSplitAt*`, `mergeIntervals*`, `intervalXorAll*` across `Date`/`DateTime`/`Time`/`Zoned`/`Unix`/`Utc` (Story J9).

  `intervalLength*` is `intervalCount*`'s exact-duration counterpart — it answers "how long is this interval" as a real, possibly fractional number via `Temporal.Duration.prototype.total`, rather than "how many `unit` boundaries does it touch". The same interval from `23:59` to `00:01` is `2` day boundaries via `intervalCountDateTime` but `~0.0014` days via `intervalLengthDateTime`. Zoned/Unix/Utc variants are DST-aware the same way `intervalCount*` is.

  `intervalDivideEqually*` splits an interval into `n` equal-length sub-intervals; `intervalSplitAt*` splits at arbitrary (unsorted, out-of-range-safe) points instead of by count. `PlainDate` rounds internal boundaries to the nearest whole day since it has no fractional-day representation; every other variant is exact, computed from total elapsed nanoseconds — `intervalDivideEquallyZoned` splits DST-crossing intervals by real elapsed time, not local clock time.

  `mergeIntervals*` and `intervalXorAll*` are the list-form generalizations of the existing pairwise `intervalUnion*` (B5) and `intervalXor*` (B7) — each takes a single array of `{ start, end }` records instead of two flat intervals. `intervalXorAll*` is implemented as a coverage sweep and reduces to the pairwise `intervalXor*` result for exactly two intervals.

  Updated `packages/gmt/README.md`, all four namespace READMEs (`plain`/`zoned`/`unix`/`utc`), and the `interval-ops` skill (new Core Patterns plus two Common Mistakes entries, including the required `intervalLength` vs `intervalCount` distinction).

- 7b391a4: Add named machine-format format/parse pairs: `formatRfc2822`/`parseRfc2822` (zoned), `formatHttp`/`parseHttp` (utc), `formatSql`/`parseSql` (plain), `formatRfc3339`/`parseRfc3339` (zoned) (Story J13).

  These are **fixed, non-locale-adaptive grammars** — RFC 5322 and RFC 7231 mandate English weekday/month abbreviations regardless of locale, by specification — so none of the eight take a `locale` argument, unlike GMT's `Intl`-backed formatters. `""` on invalid input for every function.

  - `formatRfc2822`/`parseRfc2822` — RFC 5322 (RFC 2822) email `Date:` header format, e.g. `"Fri, 15 Mar 2024 14:30:00 -0400"`. Parsing accepts a 1- or 2-digit day and RFC 5322's obsolete named zones (`GMT`, `UT`, and the eight North American zones); formatting always emits a zero-padded, numeric offset.
  - `formatHttp`/`parseHttp` — RFC 7231 IMF-fixdate, e.g. `"Fri, 15 Mar 2024 14:30:00 GMT"`, for `Last-Modified`/`Date`/`Expires` headers. Strict 2-digit fields and a literal `GMT` only; the obsolete RFC 850/asctime HTTP-date forms are a documented limitation, not accepted.
  - `formatSql`/`parseSql` — ANSI SQL / ODBC datetime literal, e.g. `"2024-03-15 14:30:00"`, for `DATETIME`/`TIMESTAMP` columns without a time zone. SQL's offset-carrying `TIMESTAMPTZ` literal is out of scope.
  - `formatRfc3339`/`parseRfc3339` — strict RFC 3339. This is _not_ a passthrough on GMT's existing ISO output: GMT's own zoned strings always carry a bracketed IANA zone annotation (`...+00:00[UTC]`) that RFC 3339 does not permit, so `formatRfc3339` strips it. A parallel `utc`/`unix` wrapper was deliberately not added — `Temporal.Instant.prototype.toString()` is already fully RFC 3339 compliant with no bracket to strip, so a wrapper there would be a pure passthrough.

- e9e8649: Add now-relative predicates: `isRelativeDay`, `isThisUnit`, `isPast`, `isFuture`, and their zoned counterparts `isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture` (Story J6).

  `isRelativeDay(value, offsetDays)` subsumes `isToday`/`isYesterday`/`isTomorrow` (`offsetDays: 0`/`-1`/`1`, or any other integer offset); `isThisUnit(value, unit, locale?)` subsumes `isThisWeek`/`isThisMonth`/`isThisYear`. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships one parameterized function per axis rather than date-fns's eleven near-duplicate named functions. `isPast`/`isFuture` stay separate — genuinely distinct before/after-now predicates, not one more value on an enumerable axis.

  The plain functions compare against `getToday()` and so depend on the **system clock and system timeZone** — the same call can return a different answer on hosts in different timeZones at the same instant. The zoned variants resolve "today"/"now" in the value's own timeZone instead, making them deterministic regardless of the host machine's timeZone; `isZonedPast`/`isZonedFuture` additionally compare the exact instant rather than just the calendar day, since a `ZonedDateTime` carries a full time-of-day where a `PlainDate` does not.

- 9170eb1: Add offset and DST-instant accessors: `getZonedOffset`, `getZonedOffsetAs`, `getTimeZoneOffset`, `formatTimeZoneName`, `isInDaylightSaving` (Story J10).

  GMT could construct and manipulate zoned values but couldn't report their UTC offset — `getZonedOffset(value)` returns it as a `±HH:MM` string; `getZonedOffsetAs(value, unit)` reads it as a number in `"minutes"` or `"nanoseconds"` (following J8's `getDurationUnit(value, unit)` precedent, replacing what would otherwise be a `getZonedOffsetMinutes`/`getZonedOffsetNanoseconds` pair). `getTimeZoneOffset(timeZone, instant)` looks up a zone's offset at an arbitrary instant without needing an existing zoned value in hand. `formatTimeZoneName(timeZone, locale, options?)` returns a zone's localized display name across all six `Intl.DateTimeFormatOptions` `timeZoneName` styles.

  `isInDaylightSaving(value)` is the third DST-related function in the roadmap and answers a distinct question from the other two: `hasDaylightSaving(timeZone)` asks whether a zone observes DST _at all_ (zone-level, no instant), `getDstTransitions(timeZone, year)` asks _where_ a zone's transitions fall (enumerates instants), and `isInDaylightSaving(value)` asks whether _this particular instant_ is currently in DST. `docs/dst-disambiguation.md` now documents all four (including `disambiguation`/`offset`, the orthogonal construction-time concern) as one table.

  Both `getZonedOffset`/`getZonedOffsetAs` live in `zoned/parse/`, not `zoned/get/` — per J0b's rule, they take a date _value_ rather than reporting on _now_ or a bare timezone. `getTimeZoneOffset` stays in `zoned/get/` alongside `getDstTransitions`, since neither argument is a value being described, both are coordinates for a zone-level lookup.

  Updated `packages/gmt/README.md`, `packages/gmt/src/zoned/README.md`, `docs/dst-disambiguation.md`, and the `zoned-date-ops` skill.

- cbc8384: Add plain range formatting: `formatDateRange`, `formatDateTimeRange` (Story J14).

  Plain counterparts of the existing `zoned/format/formatZonedRange` — same `(start, end, locale?, options?)` parameter order and `Intl.DateTimeFormatOptions` shape, but wrapping `Temporal.PlainDate`/`Temporal.PlainDateTime` directly since there's no timezone to reconcile between endpoints. Both use `Intl.DateTimeFormat.prototype.formatRange` under the hood, so the locale elides shared fields between `start` and `end` (`"February 3 – 5, 2024"` for same-month, `"November 3, 2024 – February 10, 2025"` once the year differs) instead of the caller having to format both ends and join them by hand. Returns `""` when either endpoint is invalid; a reversed range (`end` before `start`) still formats rather than throwing or auto-correcting.

  Updated `packages/gmt/README.md`, `packages/gmt/src/plain/README.md`, and the `format-date-time` skill.

- bffb00c: Add same-unit comparison: `areDatesEqualBy`, `areDateTimesEqualBy`, `areZonedEqualBy`, `areUnixEqualBy`, `areUtcEqualBy` (Story J5).

  Each function answers "are these two values equal at a given calendar unit?" — `areDatesEqualBy(a, b, "month")` replaces the pattern of manually truncating both values before comparing. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships one parameterized function per namespace rather than date-fns's twelve `isSameX` functions; each function's JSDoc carries the full date-fns mapping table.

  **Semantics, decided explicitly:** equality is measured by comparing the start-of-unit boundary for each value, so a unit implicitly requires every coarser unit above it to match too — `areDatesEqualBy("2023-03-15", "2024-03-15", "month")` is `false`, not `true`, because "same month" means the same month _and_ year. This matches date-fns's `isSameMonth`/`isSameWeek`/etc. and Luxon's `dt.hasSame(other, unit)` (verified against date-fns's source), not a bare "same month-of-year across any year" comparison.

  `areZonedEqualBy` compares each value's own local calendar fields in its own time zone, not the underlying instant or time zone identifier — two zoned values representing the same instant can land on different local calendar days depending on their zone, and vice versa.

- 8663839: Add token-pattern-based parsing: `parseDateWithPattern`, `parseDateTimeWithPattern`, `parseTimeWithPattern` (Story J11).

  Each decodes a string against a caller-supplied token pattern (e.g. `"MM/dd/yyyy"`, `"dd-MMM-yyyy h:mm a"`) and returns the matching ISO `PlainDate`/`PlainDateTime`/`PlainTime` string, or `""` on no match, a malformed pattern, or a shape-valid-but-not-real date/time (`"02/31/2024"` against `"MM/dd/yyyy"` still fails — the regex only proves shape, `Temporal.*.from(..., { overflow: "reject" })` proves it's real).

  This is a decoding tool for a _known, fixed_ producer format — a CSV column, a legacy API field, a partially-typed form value — not a display formatter. GMT still has no token-pattern _formatter_: hard-coding a field order like `"MM/dd/yyyy"` for output would ship US field ordering to every locale (roadmap Decision 1). Use `formatDate`/`formatDateTime`/`formatDateToParts` for locale-correct display; use these new functions only to consume input whose shape you don't control.

  Supports numeric tokens (`yyyy`/`yy`/`MM`/`M`/`dd`/`d`/`HH`/`H`/`hh`/`h`/`mm`/`m`/`ss`/`s`/`SSS`), locale-aware name tokens (`MMMM`/`MMM`/`EEEE`/`EEE`/`a`/`GGGG`/`GG`, defaulting to `"en-US"` when `locale` is omitted), and literal text via automatic literal characters or `'single quotes'`. `parseDateWithPattern`/`parseTimeWithPattern` each reject the other's tokens (returning `""`); `parseDateTimeWithPattern` accepts the full combined set.

- 77e9c80: Add week-numbering year getters: `getWeekYear`, `getLocaleWeekYear`, `getWeeksInLocaleWeekYear` (Story J4).

  `getWeekYear` reports the ISO 8601 week-numbering year a date belongs to (via `Temporal.PlainDate.yearOfWeek`), which can differ from the calendar year — 2024-12-30 is a Monday in ISO week 1 of **2025**, not 2024. Pair it with the existing `weekOfYearForDate`/`getWeekNumber` whenever bucketing by week number, since a week number alone is ambiguous across a year boundary.

  `getLocaleWeekYear` and `getWeeksInLocaleWeekYear` are the locale-relative equivalents, resolved from `locale`'s first day of week and minimal-days-in-first-week (`Intl.Locale.prototype.weekInfo`) instead of the fixed ISO rule (Monday-start, 4 minimal days). The two can disagree on the same date near a year boundary — e.g. en-US always counts Jan 1 as week 1, while ISO-style locales do not.

  All three take a `PlainDate` ISO string and return `number | null`. They live in `plain/calculate/`, not `plain/get/`, per the rule J0b established.

- 511f2de: Add weekday navigation: `nextWeekday`, `previousWeekday` (Story J7).

  Each function finds the next/previous occurrence of a given ISO day of week (1 = Monday … 7 = Sunday, matching `getDayOfWeek`/`parseDayOfWeekFromDate`) on or after/before a date. Per Decision 5 in `context/roadmap/issues/J.md`, GMT ships two parameterized functions rather than date-fns's sixteen `nextMonday`…`previousSunday` functions; each function's JSDoc carries the full date-fns mapping table.

  **`options.inclusive`** (default `false`) controls what happens when the input already falls on the target day: `false` advances/retreats a full week, matching date-fns's behavior; `true` returns the input as-is. This default is easy to get surprised by — `nextWeekday("2024-03-15", 5)` on a date that _is_ already a Friday returns the following Friday, not the input — so it's called out explicitly in both functions' JSDoc and the `compare-dates` skill's Common Mistakes.

  date-fns's `lastDayOfMonth` is not a gap this pair fills — it's already covered by GMT's existing `endOfDate(value, "month")`.

- 3ecb5a9: Move `getLocaleDayOfWeek`, `getLocaleZonedDayOfWeek`, and `getHoursInZonedDay` from the `get/` namespace to `calculate/` (Story J0b):

  - `plain/get/getLocaleDayOfWeek.ts` → `plain/calculate/getLocaleDayOfWeek.ts`
  - `zoned/get/getLocaleZonedDayOfWeek.ts` → `zoned/calculate/getLocaleZonedDayOfWeek.ts`
  - `zoned/get/getHoursInZonedDay.ts` → `zoned/calculate/getHoursInZonedDay.ts`

  `get/` namespaces are now current-moment accessors only (no argument, or timezone only, reporting a value for _now_); any function taking a date value belongs in `calculate/`. Function names, signatures, and behavior are unchanged.

  **Technically breaking for deep-subpath consumers.** Root imports (`from "@burglekitt/gmt"`) are unaffected. But anyone importing from `@burglekitt/gmt/plain/get` or `@burglekitt/gmt/zoned/get` loses these symbols — switch those imports to `@burglekitt/gmt/plain/calculate` and `@burglekitt/gmt/zoned/calculate` respectively.

## 1.12.0

### Minor Changes

- 7d45b85: Add `intervalOverlappingDays*` — the number of distinct calendar days two intervals share (Story I1):

  - `intervalOverlappingDaysDate`, `intervalOverlappingDaysDateTime`, `intervalOverlappingDaysZoned`, `intervalOverlappingDaysUnix`, `intervalOverlappingDaysUtc`

  Returns `0` when the intervals are disjoint and `null` on invalid input. Counting is inclusive of both endpoints, matching GMT's closed-interval model: `["2024-01-01", "2024-01-01"]` overlapping itself is `1` day, not `0`. This differs from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed 24-hour periods instead — compose `intervalCount*` over `intervalIntersection*`'s result for that behavior. There is no `Time` variant: `PlainTime` has no calendar.

- a0de5fb: Add `roundingMethod` option to the `formatRelative*` family (Story I2):

  - `formatRelativeDate`, `formatRelativeDateTime`, `formatRelativeTime`, `formatRelativeZoned`, `formatRelativeUnix`, `formatRelativeUtc`

  `roundingMethod?: "floor" | "ceil" | "round"` controls how the computed distance rounds to the display unit — applied to the signed fractional value, matching date-fns's `formatDistanceStrict`. Defaults to `"round"`, matching existing behavior; no call-signature changes.

- e4d5344: Add `getDstTransitions` — enumerate daylight-saving-time transition points for an IANA timezone in a given year (Story I3):

  - `getDstTransitions`

  Returns an array of `{ instant, offsetBefore, offsetAfter }` objects representing each DST transition. Returns `[]` for zones with no transitions in the requested year or on invalid input.

- 5988a93: Add `getHoursInZonedDay` — the number of hours in a specific zoned calendar day (Story I4):

  - `getHoursInZonedDay(value: string): number | null`

  Returns `23` on spring-forward days, `25` on fall-back days, and `24` on normal days — or a fractional value for zones whose DST shift isn't a whole hour (e.g. `Australia/Lord_Howe`'s 30-minute shift returns `23.5`/`24.5`). Zoned-only — this is meaningless without a timezone. Returns `null` on invalid input per GMT's number-return sentinel convention.

## 1.11.0

### Minor Changes

- a9a7c17: Add standalone, locale-aware calendar-name lookups (Story H1):

  - `getLocaleMonthNames(locale, style?)` — 12 Gregorian month names in calendar order
  - `getLocaleWeekdayNames(locale, style?)` — 7 weekday names in the locale's first-day order
  - `getLocaleMeridiems(locale)` — `[AM-label, PM-label]` day-period labels

  These are the GMT equivalents of Luxon's `Info.months` / `weekdays` / `meridiems`: they return locale-formatted calendar names without requiring a date value. All three delegate to the host runtime's `Intl` data and return `[]` for an invalid BCP 47 locale tag. `getLocaleWeekdayNames` uses locale-first-day ordering to stay consistent with `getLocaleDayOfWeek`.

- 51c3f12: Add standalone, locale-aware Gregorian era-name lookup (Story H2):

  - `getLocaleEraNames(locale, style?)` — 2-element `[BCE-label, CE-label]` array

  This is the GMT equivalent of Luxon's `Info.eras`: it returns locale-formatted era names without requiring a date value, delegating to the host runtime's `Intl` data. Returns `[]` for an invalid BCP 47 locale tag. If a locale has no distinct BCE/CE era names, both array elements contain the same string — the sentinel is reserved for invalid input only.

- d2be1e3: Add `hasDaylightSaving` — reports whether an IANA timezone observes daylight saving time at all. Returns `false` on invalid or unresolvable timezone identifiers.

## 1.10.0

### Minor Changes

- 816261a: Add `intervalCount`: `intervalCountDate`, `intervalCountTime`, `intervalCountDateTime`, `intervalCountUtc`, `intervalCountUnix`, `intervalCountZoned` — count how many calendar-unit boundaries the half-open interval `[start, end)` crosses, distinct from `diff*`'s exact elapsed duration. An interval from 23:59 to 00:01 is two minutes long but crosses two day boundaries. DST-aware for zoned and unix values, and `null` on invalid input.
- 942aafb: Add `intervalFromDuration`: `intervalFromDurationDate`, `intervalFromDurationDateTime`, `intervalFromDurationTime`, `intervalFromDurationUtc`, `intervalFromDurationUnix`, `intervalFromDurationZoned` — construct an interval from a single point plus an ISO 8601 duration, anchored at either `"start"` or `"end"` (Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param). Calendar units resolve against the point itself, no `relativeTo` needed — except `intervalFromDurationTime`, which returns `null` for a duration with a date-unit component, since `PlainTime` has no calendar to resolve it against. Returns `null` on invalid input, including a negative duration that inverts the computed span.

## 1.9.0

### Minor Changes

- 2f467df: Add `intervalContainsDate`, `intervalContainsTime`, `intervalContainsDateTime`
  (plain), `intervalContainsUtc` (utc), `intervalContainsUnix` (unix), and
  `intervalContainsZoned` (zoned) — interval containment checks. Each supports
  two modes via an optional fourth argument:

  - 3-arg: `intervalContains(start, end, point)` — true when `start <= point <= end`
  - 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — true when the
    inner interval is fully contained within the outer interval

- 49aecc4: Add `intervalIntersectionDate`, `intervalIntersectionTime`, `intervalIntersectionDateTime`
  (plain), `intervalIntersectionUtc` (utc), `intervalIntersectionUnix` (unix), and
  `intervalIntersectionZoned` (zoned) — interval intersection. Each accepts two
  intervals and returns the overlapping span, or `null` when they do not overlap:

  - Adjacent intervals (e.g. `aEnd === bStart`) share one instant and DO overlap,
    returning a single-point span.
  - Returns `null` when intervals are disjoint with a gap, or when either interval
    is invalid (`start > end`).
  - Returns `null` on malformed input (never throws).
  - Return shape: `{ start: string; end: string } | null` (or `{ start: number;
end: number } | null` for Unix).

- 9f702f6: Add `intervalsOverlapDate`, `intervalsOverlapTime`, `intervalsOverlapDateTime`
  (plain), `intervalsOverlapUtc` (utc), `intervalsOverlapUnix` (unix), and
  `intervalsOverlapZoned` (zoned) — interval overlap detection. Each accepts two
  intervals and returns `true` when they share at least one instant:

  - Adjacent intervals (e.g. `aEnd === bStart`) are treated as overlapping because
    they share the boundary instant.
  - Returns `false` when intervals are disjoint with a gap, or when either interval
    is invalid (`start > end`).
  - Returns `false` on malformed input (never throws).

- 5681f6d: Adds `intervalUnionDate`, `intervalUnionTime`, `intervalUnionDateTime` (plain), `intervalUnionUtc` (utc), `intervalUnionUnix` (unix), and `intervalUnionZoned` (zoned) — merge two intervals into their combined span when they overlap or are directly adjacent.

  - Overlapping or adjacent intervals return `{ start, end }` with the merged span. Adjacent intervals (e.g. `aEnd === bStart`) share one instant and ARE merged.
  - Returns `null` when intervals are disjoint with a gap, when either interval is invalid (`start > end`), or on malformed input (never throws).
  - Return shape: `{ start: string; end: string } | null` for plain/utc/zoned; `{ start: number; end: number } | null` for Unix.

- afb1c0a: Add interval and range validators across plain, utc, unix, and zoned namespaces.

  - `isValidDateInterval`, `isValidTimeInterval`, `isValidDateTimeInterval` (plain) — positional `(start, end)` args returning `true` when both parse and `start <= end`.
  - `isValidUtcInterval`, `isValidUnixInterval`, `isValidZonedInterval` (utc, unix, zoned) — same pattern, comparing by instant for utc/zoned.
  - `isValidDateTimeRange`, `isValidTimeRange` (plain), `isValidUtcRange`, `isValidUnixRange`, `isValidZonedRange` (utc, unix, zoned) — object-param `{ value1, value2 }` shape matching the existing `isValidDateRange` convention.

  All functions return `false` on invalid input (never throw).

- 6dbb941: Add `splitIntervalByUnit*` functions across plain, utc, unix, and zoned namespaces.

  - `splitIntervalByUnitDate`, `splitIntervalByUnitTime`, `splitIntervalByUnitDateTime` (plain) — split an interval into sub-intervals of `amount × unit`, returning an array of `{ start, end }` records.
  - `splitIntervalByUnitUtc`, `splitIntervalByUnitUnix`, `splitIntervalByUnitZoned` (utc, unix, zoned) — same pattern adapted to each Temporal environment.

  All functions return `[]` on invalid input (never throw). The final sub-interval is trimmed so its `end` never exceeds the original `end`.

- e130f96: Add interval set operations: `intervalDifference`, `intervalXor`, `intervalAbuts`, `intervalEngulfs` across plain, zoned, unix, and utc namespaces.

## 1.8.0

### Minor Changes

- 1785dd9: Add `addBusinessDays` and `subtractBusinessDays` for Mon–Fri business-day arithmetic that skips weekends. Also includes `addZonedBusinessDays` and `subtractZonedBusinessDays` for timezone-aware variants.
- f9db169: Add `clampDate`, `closestDateTo`, `clampZoned`, and `closestZonedTo` for range restriction and nearest-candidate selection in both plain and zoned date spaces.
- 63be628: Add `isBusinessDay` for fixed ISO Monday–Friday business-day checks (locale-agnostic, returns false on invalid input). Also includes `isZonedBusinessDay` for timezone-aware variants.
- 574f6f0: Add `roundTime`, `roundDateTime`, `roundDate`, `roundZoned`, `roundUnix`, and `roundUtc` for rounding time-of-day, datetime, date, zoned datetime, Unix timestamp, and UTC instant values to the nearest multiple of a unit.

### Patch Changes

- 574f6f0: Expand CI timezone matrix to 10 zones covering global offsets and edge cases, and drop Node 20 (EOL April 2026) from the test matrix.

## 1.7.0

### Minor Changes

- 54d238e: Adds `isWeekend` (plain) and `isZonedWeekend` (zoned) — locale-aware weekend checks, matching react-aria's `@internationalized/date` `isWeekend(date, locale)`.

  - `isWeekend(value, locale)` checks an ISO `PlainDate` string; `isZonedWeekend(value, locale)` checks an ISO `ZonedDateTime` string against its own local calendar day.
  - Uses `Intl.Locale.prototype.weekInfo` to resolve which days count as the weekend for a given locale — e.g. `en-US`/most locales use Saturday/Sunday, while `he-IL`/`ar-SA` use Friday/Saturday.
  - Falls back to Saturday/Sunday if the runtime can't resolve `weekInfo` data for the locale.
  - Both return `false` for invalid input (unparseable date/zoned value, or an invalid locale tag).

  This starts Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.

- 002deea: Adds `getLocaleDayOfWeek` (plain) and `getLocaleZonedDayOfWeek` (zoned) — locale-aware day-of-week index extraction.

  - `getLocaleDayOfWeek(value, locale)` returns a 0-based index where `0` = the locale's first day of week (e.g. Sunday for en-US, Monday for fr-FR, Saturday for he-IL).
  - `getLocaleZonedDayOfWeek(value, locale)` does the same for zoned ISO datetimes, reading the local calendar day.
  - Both derive the locale's first day from `Intl.Locale.prototype.weekInfo` and fall back to Monday if unavailable.
  - Both return `null` for invalid input (unparseable date/zoned value, or an invalid locale tag).
  - The formula `(isoDay - firstDay + 7) % 7` is the same one used by `getLocaleStartOfWeek`/`getLocaleZonedStartOfWeek`.

  Completes Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.

- 317a1b8: Adds `getLocaleStartOfWeek`/`getLocaleEndOfWeek` (plain) and `getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek` (zoned) — locale-aware week boundaries, matching react-aria's `@internationalized/date` `startOfWeek(date, locale)`/`endOfWeek(date, locale)`.

  - Derives the week's first day from the locale via `Intl.Locale.prototype.weekInfo` (e.g. `en-US` weeks start Sunday, `fr-FR` weeks start Monday), instead of the existing `startOfDate`/`endOfDate`/`startOfZoned`/`endOfZoned`'s explicit, ISO-biased `weekStartsOn` option.
  - Falls back to Monday if the runtime can't resolve `weekInfo` data for the locale.
  - The zoned variants accept the same `disambiguation`/`offset` options as `startOfZoned`/`endOfZoned`, controlling DST gap/overlap resolution when the week-boundary time-of-day reset lands on an ambiguous local time.
  - All four return `""` for invalid input (unparseable date/zoned value, or an invalid locale tag).

  Part of Story Group D (locale-aware calendar helpers) of the Luxon/react-aria parity roadmap.

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

  Also expands `addDuration`/`subtractDuration`'s test coverage with additional permutations (overflow-without-borrow, negative-operand cancellation, fractional-second combination, negative-result subtraction) per `context/testing-standards/index.md`'s exhaustive `it.each` coverage bar.

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
