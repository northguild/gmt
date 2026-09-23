# Coding Standards

## API Contract

- All public functions accept **ISO 8601 strings** (or numeric Unix epochs where the domain requires it).
- Return types: ISO strings, numbers, booleans, arrays, `bigint`, or plain objects — never `Date` objects or Temporal objects.
- Invalid input returns a typed sentinel — never throws. **This table is the single source of truth for sentinels**; every other doc links here:

| Return type                                    | Sentinel | Examples                                                |
| ---------------------------------------------- | -------- | ------------------------------------------------------- |
| `string`                                       | `""`     | `addDate`, `floorToZone`, `resolveLocal`                |
| `number`                                       | `null`   | `getDay`, `spanMs`                                      |
| `boolean`                                      | `false`  | `isValidDate`, `isAfterZoned`                           |
| array                                          | `[]`     | `bucketRange`, `splitIntervalByUnitDate`                |
| object (`{ … } \| null`)                       | `null`   | `getIsoWeekDate`, `getFiscalPeriod`, `toOffsetInstant`  |
| `bigint` (`precision/` converters and parsers) | `0n`     | `toNanoseconds`, `parseNanoseconds`, `toPgMicroseconds` |
| `span/` functions (any numeric type)           | `null`   | `spanMs`, `spanNs` (`bigint \| null`), `spanWallClock`  |

- **Arguments follow TC39's option-reading rules** (1.16.0):
  - An explicit `undefined` positional argument is the same as omitting it (`GetOption`).
  - An options argument must be omitted, `undefined` or an object. `null`, a string or a number returns the sentinel (`GetOptionsObject`). The `Intl.DateTimeFormat`-backed formatters follow ECMA-402's `CoerceOptionsToObject` instead: `null` returns `""`, and a string or number means the defaults.
  - A locale is `string | string[]` everywhere (`CanonicalizeLocaleList`). An invalid tag returns the sentinel. `[]` means the default locale where the locale is optional, and returns the sentinel where it is required (`getLocaleMonthNames([])` is `[]`).
  - Unit names are accepted singular or plural (`"day"` and `"days"`), as Temporal §13.17 does.
- **One documented exception:** the `min*`/`max*` aggregators (`minDate`, `maxZoned`, …) return `string | null`, with `null` meaning "no valid item". Do not copy that shape into new string functions.

- **`get/` namespaces hold current-moment accessors only** — no argument, or timezone only, reporting a value for _now_ (e.g. `getDay()`, `getZonedDay(timeZone)`). Any function taking a date value belongs in `calculate/` (or `parse/`, `compare/`, `format/` as its verb dictates) — see J0b, which relocated `getLocaleDayOfWeek`/`getLocaleZonedDayOfWeek` out of `get/` for violating this.

## Allowed vs. Forbidden Patterns

### Allowed

| Pattern                          | Example                                 |
| -------------------------------- | --------------------------------------- |
| ISO strings                      | `"2024-03-10"`                          |
| Temporal objects (internal only) | `Temporal.PlainDate.from("2024-03-10")` |
| Tree-shakable exports            | `export * from "./plain"`               |

### Forbidden

| Pattern               | Replacement                                |
| --------------------- | ------------------------------------------ |
| `new Date()`          | `Temporal.Now.instant()`                   |
| `date.getTime()`      | `Temporal.Instant.from(date).epochSeconds` |
| Manual string parsing | `Temporal.PlainDate.from(string)`          |
| Mutating methods      | Use Temporal's immutable methods           |

## Always Wrap Temporal Calls in Try-Catch

Temporal's static methods (`.from()`, `.add()`, `.subtract()`, `.since()`, `.until()`, etc.) throw `RangeError` on invalid input. Every call must be wrapped:

```ts
export function addDays(dateStr: string, days: number): string {
  try {
    const date = Temporal.PlainDate.from(dateStr);
    return date.add({ days }).toString();
  } catch {
    return "";
  }
}
```

- Wrap the entire block that uses Temporal methods.
- The catch block takes no argument (`catch { ... }`) — we never need the error value.
- Return the appropriate sentinel for the function's return type.
- **Validate, then parse, is intentional.** A public function runs its `isValid*` guard and then parses the same string again inside `try`. The double parse keeps each function's contract explicit and self-contained; do not "optimise" it away or flag it in review.

### Scoped exception: manual string parsing in `parse*WithPattern` (J11 / Decision 4)

"Manual string parsing" is forbidden everywhere in GMT **except** the `parseDateWithPattern` / `parseDateTimeWithPattern` / `parseTimeWithPattern` family (`packages/gmt/src/plain/parse/`, engine in `packages/gmt/src/internal/patternToken.ts`), because Temporal has no `fromFormat`-style equivalent and this is the only way to decode a caller-supplied token pattern. The exception is bound by three rules, not a blanket carve-out:

1. The regex is built **from the pattern string itself** at call time — never hand-rolled per-format string slicing.
2. Extracted fields are **always** handed to `Temporal.*.from(fields, { overflow: "reject" })` for final construction and validation — a regex match only proves shape, never validity (e.g. `"02/31/2024"` matches `"MM/dd/yyyy"` but is not a real date). Parsers reject; arithmetic clamps — see [§ Calendar & zone semantics](#calendar--zone-semantics).
3. The try-catch and sentinel-return rules above are unchanged.

The full rationale is Decision 4 of the archived J roadmap file, which no longer exists in the tree: read it with `git show 9e3b22d^:context/roadmap/issues/J.md`. This prohibition stands for every other function in the library.

### Scoped exception: fixed non-ISO grammars in `parseRfc2822`/`parseHttp` (J13)

The same three rules extend to `parseRfc2822` (`packages/gmt/src/zoned/parse/`) and `parseHttp` (`packages/gmt/src/utc/parse/`), for the same underlying reason as Decision 4: RFC 5322 and RFC 9110 date-times (`"Fri, 15 Mar 2024 14:30:00 -0400"`, `"Fri, 15 Mar 2024 14:30:00 GMT"`) are not ISO 8601 and Temporal's `.from()` cannot parse them at all — there is no `fromRFC2822`/`fromHTTPDate` equivalent to defer to, at any layer. Unlike `parse*WithPattern`, the grammar here is fixed (a hardcoded regex per format, not built from a caller-supplied pattern), which makes this an even narrower case than Decision 4's, not a broader one:

1. The regex encodes the fixed RFC grammar exactly (`regex/rfc-2822.ts`, `regex/http-date.ts`) — never hand-rolled per-call string slicing.
2. Extracted fields are **always** handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` for final construction and validation.
3. The try-catch and sentinel-return rules above are unchanged.

`parseSql` and `parseRfc3339` are **not** part of this exception — both validate shape with a regex and then hand the whole string to `Temporal.*.from(string)` directly (which strictly validates the calendar date on its own), never extracting or constructing a field property bag by hand. This prohibition stands for every other function in the library.

### Calendar-annotated strings are RFC 9557 (E1, E7)

A calendar string is the RFC 9557 form Temporal writes: the ISO 8601 date (or zoned datetime),
then a `[u-ca=<id>]` annotation. The digits are always ISO; the annotation names the calendar the
date is presented in (RFC 9557 §3.3). Output is exactly `Temporal.PlainDate#toString()` /
`Temporal.ZonedDateTime#toString()` with `calendarName: "auto"`: no annotation for `iso8601`,
`[u-ca=<id>]` for every other calendar, `gregory` included. Eras, calendar years and month codes
are read values, never string content. Decision of record:
[calendar-standards-decisions.md](./domination/research/calendar-standards-decisions.md) Q1 and
[CORE-8 § Phase 2](./domination/issues/CORE-8.md#rfc-9557-calendar-strings-decisions-of-record),
which records the native Temporal evidence for each rule below.

- **`plain/` `PlainDate`** — `regex/calendar-date.ts`: `<date>[u-ca=<id>]`. Year is Temporal's
  `DateYear` (four digits, or a sign and six; `-000000` rejected). Parsed by
  `internal/calendarDateString.ts` (GMT's strict date or date-time shape before the first `[`, then
  `Temporal.PlainDate.from` on the whole string), written by
  `internal/formatDateInCalendar.ts`.
- **`zoned/`** — `regex/calendar-zoned-date-time.ts`: `<date>T<time><offset>[<timeZone>][u-ca=<id>]`,
  the calendar annotation after the zone (RFC 9557 §4.1). Parsed by `internal/calendarZonedString.ts`
  (GMT's strict `zonedDateTimeBody` shape before the first `[`, then the whole string goes to
  `zonedDateTimeFrom`), written by `formatZonedInCalendar`.
- **The annotation.** A `u-ca` annotation, lower-case key, optionally critical (`[!u-ca=…]`). The
  id goes to Temporal's `CanonicalizeCalendar` (`internal/calendarSystemIds.ts`
  `canonicalCalendarSystem`), which folds case and CLDR aliases (`islamicc` → `islamic-civil`,
  `ethiopic-amete-alem` → `ethioaa`), and must be a `CalendarSystem`.
- **Other annotations follow Temporal's ISO grammar** (`ParseISODateTime`), read by
  `Temporal.PlainDate.from` / `Temporal.ZonedDateTime.from` in the shared parse helpers. A time zone
  annotation on a date and elective unknown annotations (`[foo=bar]`) are ignored, and the first
  `u-ca` names the calendar. An unknown critical annotation, a second `u-ca` when either is
  critical, a calendar before the zone and `;era=` are rejected.
- **A plain calendar date-time is read as its date**, as `Temporal.PlainDate.from` reads it
  (decision of 2026-09-17; replaces E5 / issue #78's date-only rule).
  `"2024-10-03T14:30[u-ca=hebrew]"` is 2024-10-03 in Hebrew, and a bare date-time is its ISO date:
  the time is dropped. The part before the first `[` must match GMT's strict `plainDate` or
  `plainDateTime` shape, as `isValidDate`/`isValidDateTime` require, before Temporal reads the
  annotations (`internal/calendarDateString.ts`): basic format, a space or lower-case `t`
  separator, a UTC offset or designator, and a leap second (second `60`) are rejected, although
  `Temporal.PlainDate.from` reads all but the designator. Output is always the date
  (`Temporal.PlainDate#toString()`).
- **The same strict extended shape gates every zoned, UTC, instant and `relativeTo` string**
  (`internal/isoStringBody.ts`): before the first `[`, a zoned string is `zonedDateTimeBody`
  (`<date>T<time>`, then nothing, `Z` or `±HH:MM[:SS[.fraction]]`), an instant `instantBody` (the
  `Z` or offset required), a UTC string `utcDateTime` (upper-case `Z`), and a `relativeTo` the
  zoned shape when it has a time zone annotation, otherwise `plainDate`/`plainDateTime`; basic
  format, a space or lower-case `t` separator, a lower-case `z`, an hour-only time or offset and a
  zoned date without a time are rejected although Temporal reads them.
- **A plain time is a bare `HH:MM[:SS[.fraction]]`** (`plainTime`): a leading time designator
  (`"T14:30"`, `"t14:30"`) is rejected, although `Temporal.PlainTime.from` reads it. The `T`
  designator belongs to date-time strings, where it separates the date from the time; GMT's strict
  extended-body rule takes the time on its own without it.
- **Calendar ids** are the canonical CLDR `bcp47/calendar.xml` / Temporal ids, in strings and as
  function arguments: `iso8601`, `gregory`, `hebrew`, `islamic-civil`, `islamic-tbla`,
  `islamic-umalqura`, `japanese`, `buddhist`, `roc`, `persian`, `indian`, `ethiopic`, `ethioaa`,
  `coptic` (the Intl Era and Month Code proposal's `table-calendar-types` without `chinese` and
  `dangi`, which GMT does not support; `islamic` and `islamic-rgsa` are not supported either).
  `gregorian`, `taiwan` and `islamic-tabular` are not calendar ids and return the sentinel. The
  alias table is Temporal's, asked of the polyfill, never a GMT copy.
- **No converter from the pre-1.16.0 calendar-native-digit strings.** No standard defines them, and
  most are also valid RFC 9557 strings, so the two readings cannot be told apart. Do not add
  heuristic detection; a stored old string is regenerated from its ISO date.
- **`ethiopic` and `coptic` compute in `ethioaa`** (`computationCalendarId`): polyfill 0.5.1 cannot
  read their fields under ICU ≥ 78, and the three share months, days and arithmetic, differing by a
  constant year. A parsed value therefore carries `ethioaa`; code that writes a string back takes the
  calendar from `calendarSystemOfDateValue` / `calendarSystemOfZonedValue`, never from `calendarId`.
- **Where it is accepted.** `plain/`: `isValidCalendarDate` and the functions gated on it
  (`convertDateToCalendar`, `addDate`, `subtractDate`, `diffDate`, `diffDateAsDuration`, the
  `Date`-suffixed `plain/interval/*`), plus `duration/`'s `relativeTo` (`internal/resolveDurationRelativeTo.ts`,
  which also accepts the zoned form). `zoned/`: `isValidCalendarZonedDateTime` /
  `isValidCalendarZonedInterval` and the functions gated on them (`convertZonedToCalendar`,
  `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, `zoned/interval/*`). Every other
  `zoned/` function, and `isValidZonedDateTime`, reads annotations as `Temporal.ZonedDateTime.from`
  does (an elective one is ignored, an unknown critical one is rejected) and accepts `[u-ca=iso8601]`,
  but rejects any other calendar, so a validator never certifies a string its own namespace refuses.
  `utc/` and the `Interval` endpoints are instants and read every annotation as
  `Temporal.Instant.from` does: a calendar annotation (`[u-ca=hebrew]`) is ignored.
- **Different calendars follow Temporal's `CalendarEquals`.** A difference between two values that
  name different calendars returns the sentinel (`diff*`, `intervalCount*`, `intervalLength*`,
  `splitIntervalByUnit*`, `intervalOverlappingDays*`; `internal/calendarDatePairPolicy.ts`,
  `calendarZonedPairPolicy.ts`), as Temporal's `until` throws. Ordering (`compare`) has no calendar
  check, so the ordering-only interval functions accept mixed calendars; value-returning interval
  set operations reject the mismatch (D4). A bare ISO string names `iso8601`. This rule
  (2026-09-17) replaces E5/E7 decision D5, which measured mixed calendars in ISO.

Every Temporal call keeps the try-catch and sentinel rules above. This is not a manual-parsing
exception: the regex restricts the shape and Temporal parses the string itself.

Do not extend the calendar grammar to a new namespace (e.g. `PlainDateTime`, `utc/`) without a new roadmap story — see E5's decision D1 and E7's explicit "not in scope" list.

## Loop Style

Avoid `while` loops in new code. Prefer `for` loops or array methods (`map`, `filter`, `reduce`, etc.). `while` loops are more error-prone and harder to reason about than bounded `for` loops.

**A bounded loop that runs out returns the sentinel, never a partial value.** When a walker, stepper or search hits its cap without converging (e.g. `zonedUnitStart`'s transition walk-back, `bucketRange`'s 10,000-boundary cap), the function returns `""` / `null` / `[]`. A plausible-looking wrong answer is worse than the documented sentinel.

## Plain / Zoned Separation

- `plain/` — timezone-free operations (`PlainDate`, `PlainTime`, `PlainDateTime`)
- `zoned/` — IANA timezone-aware operations (`ZonedDateTime`)
- Never mix the two in the same function or module.
- The other namespaces follow the same one-type-per-function rule: `utc/`, `unix/`, `instant/`, `calendar/`, `span/`, `precision/`, `duration/`, `regex/` (see `packages/gmt/src/`).

## Calendar & zone semantics

Decisions of record for date arithmetic and zone-aware boundaries. Code, tests and reviews follow these; do not re-open them without a new primary source.

### 1. TC39 Temporal is the authority

Where calendar semantics are ambiguous, GMT does what [Temporal](https://tc39.es/proposal-temporal/docs/plaindate.html) does.

- **Arithmetic clamps.** A day that does not exist follows Temporal's default `overflow: "constrain"`: `2024-02-29` plus one year is `2025-02-28`; Jan 31 plus one month is Feb 29/28.
- **Parsers reject.** `parse*` functions and the scoped grammars above use `overflow: "reject"` and return the sentinel for `"31 Feb"`. A parser must not invent a date.
- **The ecosystem agrees.** Temporal, Moment, Luxon, dayjs, spacetime and `@internationalized/date` all clamp. date-fns `setYear` is the outlier (it rolls to Mar 1).
- **The law agrees.** A period ending on a day that does not exist ends on the last day of that month: [EU Reg. 1182/71 Art 3(2)(c)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31971R1182), [UK Companies Act 2006 s390/s391](https://www.legislation.gov.uk/ukpga/2006/46/section/391), [US 26 CFR 1.441-2](https://www.law.cornell.edu/cfr/text/26/1.441-2) (52–53-week years).
- **Known divergence, documented and not built:** a "month-end" rule would put a Feb-28 anchor on 02-29 in leap years. Temporal gives 02-28, and so does GMT (e.g. `getFiscalPeriod`'s `yearEndsOn`).

### 2. Zone-aware unit boundaries are never truncate-and-re-resolve

Never compute a zoned start-of-unit by truncating the wall clock and resolving it again — `zdt.round({ roundingMode: "trunc" })`, or `.with({ … })` plus `"compatible"` disambiguation. When the truncated wall time does not exist or occurs twice, Temporal relocates it, and the "start" lands after its own input or before an earlier boundary.

- Use `internal/zonedBucket.ts` (`zonedUnitStart`, `nextZonedBucketStart`), or Temporal's own `zdt.startOfDay()` / `zdt.hoursInDay` for days.
- **Probe zones** — every boundary function is tested against these transitions:

| Zone                                                                               | Transition                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pacific/Chatham`                                                                  | 2024-09-29 spring (+45 min offset), 2024-04-07 fall                                                                                                                                          |
| `Antarctica/Casey`                                                                 | 2020-10-04 (three-hour jump)                                                                                                                                                                 |
| `America/New_York`                                                                 | 2024-11-03 fall-back                                                                                                                                                                         |
| `Australia/Lord_Howe`                                                              | 30-minute DST                                                                                                                                                                                |
| `America/Santiago`                                                                 | 2024-09-08 (skipped local midnight)                                                                                                                                                          |
| `America/Havana`                                                                   | 2024-11-03 (midnight repeated on the same date)                                                                                                                                              |
| `America/Goose_Bay`                                                                | 2010-11-07 (fall-back reopens the previous date)                                                                                                                                             |
| `Pacific/Apia`                                                                     | 2011-12-30 (deleted day)                                                                                                                                                                     |
| `Asia/Manila`, `Pacific/Guam`, `Pacific/Saipan`, `Pacific/Kosrae`, `Pacific/Palau` | 1844-12-31 (deleted day crossing the date line, before the polyfill's 1847-01-01 transition search floor; `dateLineCrossingTimeZones` in `src/test/timeZoneMatrix.ts`, workaround `zoned.E`) |

- **When a transition opens a new bucket.** Hours: when the clock lands on an hour boundary or the label jumps — New York's repeated 01:00 is its own hour, so a fall-back day has 25 hour buckets. Day and larger: only when the local label changes — Havana's repeated midnight on 2024-11-03 stays one 25-hour day (matching `hoursInDay`), while Goose_Bay's fall-back into 6 November is its own 59-minute bucket because the date changed.

### 3. Boundary functions take no resolution options (the TC39 pattern)

TC39 splits the API in two ([ZonedDateTime docs](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)): **field-setting** methods (`with`, `from`) take `disambiguation`/`offset`, while **boundary** methods take none — `startOfDay()` has no options and returns the day's earliest real instant, `round()` accepts only rounding options, and `hoursInDay` derives from `startOfDay`. GMT follows the same split.

- Field-setting functions keep their resolution options: `setZoned`/`setUnix`/`cycleZoned` take `disambiguation` and `offset` (default `"prefer"`, as `ZonedDateTime#with`); `addZoned`/`subtractZoned`, `intervalFromDurationZoned`, `convertPlainDateTimeToZoned` and `resolveLocal` take `disambiguation` only, because they resolve a plain date-time that has no offset (`PlainDateTime#toZonedDateTime` reads only `disambiguation`). An option a function cannot act on is not accepted "for consistency"; it is left off the signature.
- Boundary functions — `startOf*`/`endOf*`, quarter and locale-week variants, and everything built on them (`areZonedEqualBy`, `areUnixEqualBy`, `intervalCount*`) — **always** return the real boundary: `start ≤ input < next start`, end = next start − 1 ns. They take no `disambiguation`/`offset` options, and neither does `mapZonedHoursInDay` (the ignored options were removed in 1.16.0). Do not reintroduce an opt-in: any value, including the documented defaults, used to bring the bug back.
- **Day-length functions follow the TC39 date day.** `getHoursInZonedDay` and `mapZonedHoursInDay` use `startOfDay()`/`hoursInDay`: the day is the input's calendar date, from its earliest instant to the next date's. That equals the walker's day bucket everywhere except a fall-back that re-enters the previous date — America/Goose_Bay, 2010-11-07: an input at `2010-11-06T23:30-04:00` gets 6 November's 24 hours (ending 00:00-03:00 on the 7th, before the input), while `startOfZoned(…, "day")` returns the reopened 59-minute bucket. Documented and pinned by tests; do not "fix" one side to match the other.
- Equality helpers compare boundary **instants** when both values share a zone, so both passes of a repeated hour are different hours. Across zones `areZonedEqualBy` compares each value's own local unit label (New York 10:00 and Berlin 20:00 on the same date are the same day); `areUnixEqualBy` always resolves in one zone, so it always compares instants.

### 4. `roundZoned` / `roundUnix` pass TC39 through

They keep `ZonedDateTime.prototype.round` semantics exactly, including its behaviour around transitions. Their JSDoc says so; callers who need a floor use `floorToZone`. Do not "fix" them.

### 5. Repeated steps are computed from the anchor

For **calendar units** (years, months, weeks, days), step k of a split or series is `start.add({ [unit]: amount * k })`, never `previous.add(…)`. Compounding clamped results drifts: Jan 31 by month must give Mar 31 and Apr 30, not Mar 29/Apr 29. This matches Temporal and Luxon's `Interval.splitBy`.

- **Exact time units** (hours and smaller) never clamp, so they step from the previous boundary — `amount * k` would lose precision past 2^53.
- **A step that lands on the previous boundary is skipped, not fatal.** Anchored steps into a deleted local day (Apia, 2011-12-30) resolve to the same instant; drop that empty slice and continue. Only a step that goes backwards, or a bounded run of non-advancing steps, returns the sentinel.
- **Caps are per contract.** `bucketRange` caps at 10,000 buckets (it materialises a list); `intervalCount*` caps at 10,000 transitions (it only counts). Counts equal `bucketRange(...).length` only while `bucketRange` is within its cap.

### 6. Loop exhaustion → sentinel

See [§ Loop Style](#loop-style).

### 7. Validate-then-parse is intentional

See [§ Always Wrap Temporal Calls](#always-wrap-temporal-calls-in-try-catch).

### 8. Intervals are half-open `[start, end)`

An instant, date or time `t` is inside an interval when `start ≤ t < end`: SQL:2011's closed-open
application-time `PERIOD` (ISO/IEC 9075-2:2011), RFC 5545 §3.6.1's non-inclusive `DTEND` and
EWD831. This holds for `interval/` and for every positional `plain|utc|zoned|unix/interval`
function (all since 1.16.0). Tie-breaks and empty-interval edges follow the
[CORE-6 spec](./domination/specs/CORE-6-spec.md) §3; the rules below derive the relations that
spec has no function for.

- **No one-unit steps.** Pieces end and start exactly at a cut: no nanosecond, day or `epochUnit`
  step in `intervalDifference*`/`intervalXor*`, and no one-unit gap in `intervalAbuts*`.
- **Instant-typed variants delegate.** After its UTC-string gate, a `Utc` variant calls the
  `interval/` function with the same relation (`intervalsOverlap`, `intervalContains`,
  `intersectIntervals`, `mergeIntervals`, `subtractIntervals`). Relations with no `interval/`
  function, and the `Date`/`DateTime`/`Time` variants, use `internal/halfOpenIntervals.ts`.
- **Outputs are re-serialised** in the type's canonical spelling (`toString()`, or
  `formatDateInCalendar`). `interval/`'s echo-the-caller's-string rule applies to caller-owned
  `Interval` records only.
- **Empty intervals** (`start === end`) hold no instant:
  - *contains / engulfs:* `inner ⊆ outer` and the two overlap, so an empty `inner` counts only
    strictly inside `outer` (`[end, end)` is not contained, as the point `end` is not);
  - *union:* the single run of `mergeIntervals([a, b])`, else `null`; a stranded empty interval is
    ignored, and two empty intervals give `null`;
  - *abuts:* Allen's "meets", one non-empty interval's `end` equal to the other non-empty
    interval's `start`; an empty interval abuts nothing;
  - *XOR:* the maximal runs covered an odd number of times, sorted by start; touching pieces join;
  - *overlapping days:* the calendar days holding at least one instant of the non-empty
    intersection, so an empty intersection counts `0`;
  - *count:* a zero-length interval touches no unit and counts `0`.
- **Tiling functions partition.** `intervalSplitAt*`, `splitIntervalByUnit*` and
  `intervalDivideEqually*` give each piece's `end` as the next piece's `start`; the pieces share no
  instant. JSDoc never describes a shared endpoint as belonging to both pieces.
- **A `Date` interval excludes its `end` day.** "The last day of the period" is passed as the next
  day: `addDate(end, { days: 1 })`.

## Changesets

The one rule; other docs link here.

| Change                                                         | Changeset                                              |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Bug fix, including a behaviour correction to shipped API       | `patch`                                                |
| Refactor, docs, tests or agent config with no behaviour change | none                                                   |
| New public API (function, option, namespace)                   | `minor`                                                |
| Breaking change (removed option, changed output or signature)  | `minor`, with a **Breaking changes** migration section |

`major` is never used. GMT's users are internal, so a breaking change ships in the next minor
release (owner decision, 2026-09-17). Fix to the standard: no compatibility shim, no deprecation
period, and no "removed in a later version" wording. The changeset's **Breaking changes** section
names every affected function and shows each old call or output next to its replacement.

Every epic story so far adds API, so its changeset is `minor`. A fix to an earlier story is still `patch`. Run `pnpm changeset:status` to prove coverage. See `PUBLISHING.md` for the release flow.

## Linting Enforcement

The `Date` API ban is enforced at the AST level by three optional linting packages:

- `@northguild/gmt-eslint` — ESLint flat config
- `@northguild/gmt-biome` — Biome + GritQL plugins
- `@northguild/gmt-oxlint` — Oxlint JS plugin

If the linter passes, no `Date` object crept in.
