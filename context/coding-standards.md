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

The same three rules extend to `parseRfc2822` (`packages/gmt/src/zoned/parse/`) and `parseHttp` (`packages/gmt/src/utc/parse/`), for the same underlying reason as Decision 4: RFC 5322 and RFC 7231 date-times (`"Fri, 15 Mar 2024 14:30:00 -0400"`, `"Fri, 15 Mar 2024 14:30:00 GMT"`) are not ISO 8601 and Temporal's `.from()` cannot parse them at all — there is no `fromRFC2822`/`fromHTTPDate` equivalent to defer to, at any layer. Unlike `parse*WithPattern`, the grammar here is fixed (a hardcoded regex per format, not built from a caller-supplied pattern), which makes this an even narrower case than Decision 4's, not a broader one:

1. The regex encodes the fixed RFC grammar exactly (`regex/rfc-2822.ts`, `regex/http-date.ts`) — never hand-rolled per-call string slicing.
2. Extracted fields are **always** handed to `Temporal.PlainDateTime.from(fields, { overflow: "reject" })` for final construction and validation.
3. The try-catch and sentinel-return rules above are unchanged.

`parseSql` and `parseRfc3339` are **not** part of this exception — both validate shape with a regex and then hand the whole string to `Temporal.*.from(string)` directly (which strictly validates the calendar date on its own), never extracting or constructing a field property bag by hand. This prohibition stands for every other function in the library.

### Scoped exception: GMT's calendar-annotated date string in `convertDateToCalendar` (E1)

The same three rules extend to `internal/calendarDateString.ts`'s `parseCalendarDateValue`, used by `convertDateToCalendar` (`packages/gmt/src/plain/convert/`). GMT's calendar-annotated PlainDate string (`"5785-01-01[u-ca=hebrew]"`) is a fixed, GMT-invented grammar — deliberately diverging from Temporal's own `[u-ca=...]` string convention (which keeps ISO/proleptic-Gregorian digits and only tags the calendar) so the calendar's native year/month/day are visible in the string itself, per the story's design rationale:

1. The regex (`regex/calendar-date.ts`) encodes the fixed grammar exactly — never hand-rolled per-call string slicing.
2. Extracted fields are **always** handed to `Temporal.PlainDate.from(fields, { overflow: "reject" })` for final construction and validation — including rejecting unknown calendar identifiers, which Temporal validates on GMT's behalf.
3. The try-catch and sentinel-return rules above are unchanged.

**Which namespaces accept this grammar (E5 issue #78, extended by E7 issue #152):**

- **`plain/` `PlainDate`** — `addDate`/`subtractDate`/`diffDate`/`diffDateAsDuration` and the `Date`-suffixed `plain/interval/*` functions, plus `duration/`'s `relativeTo` option (via `internal/resolveDurationRelativeTo.ts`). `plain/` `PlainDateTime`/`PlainTime` functions have no calendar-annotated grammar of their own and simply treat a `PlainDate` annotation as invalid input.
- **`zoned/`, the ~18 calendar-aware functions** — E7 added a _separate_ GMT-native zoned grammar, `<date>T<time><offset>[u-ca=<id>[;era=<era>]][<timeZone>]` (`regex/calendar-zoned-date-time.ts`, parsed/formatted by `internal/calendarZonedString.ts`). The same three rules above apply to it: the regex encodes the fixed grammar, the extracted date half is handed to `Temporal.PlainDate.from(fields, { overflow: "reject" })` via the _existing_ `parseCalendarDateValue`, and the recomposed ISO string is handed to `Temporal.ZonedDateTime.from` for zone/offset/DST validation. In scope: `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, `convertZonedToCalendar`, and `zoned/interval/*`. These gate on the parallel `isValidCalendarZonedDateTime`/`isValidCalendarZonedInterval`.
- **`zoned/`, everything else (~72 functions), plus `utc/` and `unix/`** — reject the annotation outright (`internal/hasCalendarAnnotation.ts`, and `isValidZonedDateTime`/`isValidZonedInterval`, which E7 deliberately did NOT loosen). `zoned/` rejected it wholesale only between E5 and E7; before E5, `isValidZonedDateTime` had no gate and silently accepted Temporal's _own_ shape (see the archived E roadmap file's E5 outcome, decision D2, and E7's reversal of that verdict for the in-scope subset — `git show 9e3b22d^:context/roadmap/issues/E.md`).

**Segment ordering in the zoned grammar is `[u-ca=...]` before `[timeZone]` — the reverse of RFC 9557 — and is not re-openable.** GMT's digits are calendar-native, so the string is never valid RFC 9557 regardless; the `;era=` suffix is not valid RFC 9557 at any ordering; and the RFC-legal ordering is the dangerous one, because `Temporal.ZonedDateTime.from("5784-01-01T14:30:00-05:00[America/New_York][u-ca=hebrew]")` succeeds and silently reads a Hebrew year as an ISO year. See `regex/calendar-zoned-date-time.ts`.

Do not extend the grammar to a new namespace (e.g. `PlainDateTime`, `utc/`) without a new roadmap story — see E5's decision D1 and E7's explicit "not in scope" list.

This prohibition stands for every other function in the library.

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

| Zone                  | Transition                                          |
| --------------------- | --------------------------------------------------- |
| `Pacific/Chatham`     | 2024-09-29 spring (+45 min offset), 2024-04-07 fall |
| `Antarctica/Casey`    | 2020-10-03 (three-hour jump)                        |
| `America/New_York`    | 2024-11-03 fall-back                                |
| `Australia/Lord_Howe` | 30-minute DST                                       |
| `America/Santiago`    | 2024-09-08 (skipped local midnight)                 |
| `America/Goose_Bay`   | 2010-11-07 (60-second local midnight hour)          |
| `Pacific/Apia`        | 2011-12-30 (deleted day)                            |

### 3. startOf/endOf: the default is the real boundary

With no options, `startOf*`/`endOf*` (and the functions built on them: `areZonedEqualBy`, `intervalCount*`, quarter and locale-week variants) return the real boundary: `start ≤ input < next start`, and end = next start − 1 ns. Explicitly passing `disambiguation` or `offset` opts into wall-clock resolution. That path is unchanged for existing callers.

### 4. `roundZoned` / `roundUnix` pass TC39 through

They keep `ZonedDateTime.prototype.round` semantics exactly, including its behaviour around transitions. Their JSDoc says so; callers who need a floor use `floorToZone`. Do not "fix" them.

### 5. Repeated steps are computed from the anchor

Step k of a split or series is `start.add({ [unit]: amount * k })`, never `previous.add(…)`. Compounding clamped results drifts: Jan 31 by month must give Mar 31 and Apr 30, not Mar 29/Apr 29. This matches Temporal and Luxon's `Interval.splitBy`. Keep a no-progress guard (`compare(next, previous) <= 0` → sentinel).

### 6. Loop exhaustion → sentinel

See [§ Loop Style](#loop-style).

### 7. Validate-then-parse is intentional

See [§ Always Wrap Temporal Calls](#always-wrap-temporal-calls-in-try-catch).

## Changesets

The one rule; other docs link here.

| Change                                                         | Changeset                     |
| -------------------------------------------------------------- | ----------------------------- |
| Bug fix, including a behaviour correction to shipped API       | `patch`                       |
| Refactor, docs, tests or agent config with no behaviour change | none                          |
| New public API (function, option, namespace)                   | `minor`                       |
| Breaking change                                                | `major` — ask the owner first |

Every epic story so far adds API, so its changeset is `minor`. A fix to an earlier story is still `patch`. Run `pnpm changeset:status` to prove coverage. See `PUBLISHING.md` for the release flow.

## Linting Enforcement

The `Date` API ban is enforced at the AST level by three optional linting packages:

- `@northguild/gmt-eslint` — ESLint flat config
- `@northguild/gmt-biome` — Biome + GritQL plugins
- `@northguild/gmt-oxlint` — Oxlint JS plugin

If the linter passes, no `Date` object crept in.
