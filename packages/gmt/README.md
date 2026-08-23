# @burglekitt/gmt

Give Me Temporal.

`@burglekitt/gmt` is a Temporal-first date and time library with a simple rule set:

- ISO 8601 strings in
- ISO 8601 strings, numbers, booleans, or arrays out
- no `Date`
- plain and zoned operations kept separate

It wraps `@js-temporal/polyfill` behind a smaller, more opinionated API aimed at the cases application code actually hits: arithmetic, comparison, parsing, formatting, unix conversions, timezone conversion, and validation.

**Status:** pre-alpha. Expect API movement while the surface is still being filled out.

## Install

```bash
npm install @burglekitt/gmt
```

```bash
pnpm add @burglekitt/gmt
```

## Design Philosophy

GMT enforces a strict input/output contract to keep behavior predictable and auditable:

- **Explicit inputs only**: Public APIs accept clearly defined shapes — ISO 8601 date/time strings, IANA timezone identifiers, or numeric Unix epoch values (explicitly seconds or milliseconds). We do not attempt to parse arbitrary or ambiguous date formats.
- **Predictable outputs**: Helpers return normalized values (ISO strings, numbers, booleans, or arrays). Invalid input yields typed fallbacks (`""`, `null`, or `false`) instead of throwing.
- **No fuzzy parsing**: Avoid "throw everything at the wall" patterns found in permissive libraries. If you need permissive parsing, perform it outside of `@burglekitt/gmt` and then canonicalize to the strict shapes before calling into gmt.
- **Developer comfort with standards**: The library's goal is to make developers comfortable and deliberate with ISO 8601, IANA timezones, UTC instants, and Unix epochs by keeping APIs small and explicit.

## Core Rules

| Rule                    | Current behavior                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------- |
| String-first API        | Public helpers consume ISO strings and return normalized strings where appropriate |
| Temporal-only internals | `Temporal` does the parsing and timezone math                                      |
| Plain/zoned separation  | `plain/*` is timezone-free, `zoned/*` is timezone-aware                            |
| No-throw public helpers | Invalid input returns a typed fallback instead of throwing                         |

Invalid input fallbacks are consistent across the library:

- string-returning helpers return `""`
- number-returning helpers return `null`
- boolean-returning helpers return `false`
- array-returning helpers return `[]`

## Testing

Every function is exercised across **17 locales** and a full IANA timezone matrix. The CI pipeline runs the complete suite in **20 environments** — 2 Node versions (22, 24) × 10 timezones spanning every UTC offset band from Pacific/Niue (−11:00) to Pacific/Apia (+13:00):

| Timezone            | UTC Offset      |
| ------------------- | --------------- |
| Pacific/Niue        | −11:00          |
| America/New_York    | −05:00 / −04:00 |
| UTC                 | ±00:00          |
| Europe/London       | ±00:00 / +01:00 |
| Asia/Kolkata        | +05:30          |
| Asia/Kathmandu      | +05:45          |
| Asia/Shanghai       | +08:00          |
| Australia/Lord_Howe | +10:00 / +11:00 |
| Pacific/Chatham     | +12:45 / +13:45 |
| Pacific/Apia        | +13:00 / +14:00 |

This guarantees that DST transitions, leap seconds, half-hour offsets, and locale-specific weekend boundaries are all covered — not just the happy path.

### Testing strategy

GMT's test suite balances **thoroughness** against **maintenance burden** by testing behavior, not permutations.

**What we test exhaustively:**

- **17-locale matrix** — every locale-aware function is exercised across all 17 `MustTestLocales` (en-US, en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT, sv-SE, zh-CN, zh-TW, ja-JP, ko-KR, ar-SA, he-IL, ru-RU, tr-TR, is-IS). This covers script direction, first-day-of-week differences, and calendar metadata.
- **Timezone battle matrix** — every zoned function is exercised across 10 IANA timezones spanning every UTC offset band from Pacific/Niue (−11:00) to Pacific/Apia (+14:00), including DST-transition and half-hour-offset zones.
- **Zero-length and identity cases** — every interval and arithmetic function is tested with zero-length inputs, identity operations, and boundary-adjacent values.
- **Invalid-input sentinels** — every public function is tested for the documented fallback behavior (`""`, `null`, `false`, `[]`) on malformed strings, wrong types, leap seconds, and inverted intervals.

**What we collapse:**

- **Non-string input tables** — functions that guard with `typeof x !== "string"` return the same sentinel for `null`, `undefined`, `123`, `true`, `[]`, and `{}`. We test one representative non-string per argument position rather than all six types × N positions. The collapse is safe because all non-string types hit the identical early-return code path.
- **Redundant permutations** — adjacent/disjoint/reversed interval cases that produce identical results are not duplicated across every function variant. The `plain/`, `zoned/`, `utc/`, and `unix/` families share the same mathematical behavior; each family gets the minimum set of cases needed to prove correctness.

**Result:** 15,475 tests across 526 files that exercise real behavior differences without redundant permutations. The suite runs in CI as 309,500 executions (15,475 × 2 Node versions × 10 timezones).

## How GMT is tested, vs. the libraries it targets

GMT's roadmap (see [context/roadmap](https://github.com/burglekitt/gmt/tree/main/context/roadmap)) is explicitly scoped against react-aria's **`@internationalized/date`**, **Luxon**, **date-fns**, and **Moment.js** — the same four libraries compared below. All numbers were verified **2026-08-22** against the exact package versions/commits below — nothing is estimated. Re-verify before citing these numbers elsewhere; library surfaces and CI configs move.

| Library                   | Version tested                          |
| ------------------------- | --------------------------------------- |
| GMT (`@burglekitt/gmt`)   | 1.12.0                                  |
| `@internationalized/date` | 3.12.3 (`adobe/react-spectrum@5d191ab`) |
| Luxon                     | 3.7.2 (`moment/luxon@f427515`)          |
| date-fns                  | 4.4.0 (`date-fns/date-fns@a0a3922`)     |
| Moment.js                 | 2.30.1 (`moment/moment@cf524af`)        |

| Metric                          | GMT                                                | `@internationalized/date`      | Luxon                                | date-fns                                  | Moment.js                        |
| ------------------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------------ | ----------------------------------------- | -------------------------------- |
| Test files                      | 526                                                | 6                              | 58 / 60<br>(2 didn't run<br>locally) | 256                                       | 191<br>(52 core +<br>139 locale) |
| Individual test cases           | **15,475**                                         | 386                            | 1,222                                | 3,213                                     | 3,901                            |
| Effective CI test<br>executions | **309,500**<br>(15,475 × 2 Node<br>× 10 timezones) | 386<br>(×1 Node)               | 4,888<br>(1,222 × 4 Node)            | 3,213<br>(×1 Node)                        | 11,703<br>(3,901 × 3 Node)       |
| CI Node.js matrix               | 22, 24                                             | n/a — tests<br>React 16–canary | 20, 22, 24, 25                       | not explicit<br>(`node = "latest"`)       | LTS, LTS-1,<br>latest            |
| CI timezone matrix              | **10 zones × 2**<br>**Node, full suite**           | none found                     | none found                           | dedicated workflow,<br>zone scope unclear | 6 zones,<br>partial suite only   |
| Locale test matrix              | **17 locales**,<br>every locale fn                 | none found                     | none found                           | none found                                | none found                       |
| Real-browser CI                 | not yet                                            | yes (Playwright)               | not found                            | yes (Playwright)                          | not found                        |
| Maintenance                     | active                                             | active                         | active                               | active                                    | **maintenance<br>mode**          |

<sub>Methodology: "Test files" and the CI/maintenance rows come from each project's public CI configuration and repository file listing. "Individual test cases" for GMT, Luxon, date-fns, and Moment.js were obtained by actually cloning the repo at the commit above, installing dependencies, running the project's own test command (`vitest run` / `jest` / `node scripts/test.js`), and reading that runner's own final summary — not grepped from source. `@internationalized/date` was run by cloning `adobe/react-spectrum` at `5d191ab`, installing dependencies, and executing `npx jest packages/@internationalized/date/tests/`, yielding 386 passing tests. Luxon (39 failures) and date-fns (46 failures) had environment-dependent local failures that don't affect the total count: Luxon's suite assumes its CI container's local time zone is `America/New_York`; date-fns's experimental native-`Temporal` code path needs a global `Temporal` Node doesn't yet provide natively. Moment.js passed cleanly (0 failed) on Node 24. Sources: [GMT](https://github.com/burglekitt/gmt/blob/main/.github/workflows/ci.yml) · [`@internationalized/date`](https://github.com/adobe/react-spectrum/blob/main/.circleci/config.yml) · [Luxon](https://github.com/moment/luxon/blob/master/.github/workflows/test.yml) · [date-fns](https://github.com/date-fns/date-fns/tree/main/.github/workflows) · [Moment.js](https://github.com/moment/moment/tree/develop/.github/workflows).</sub>

### Functionality parity progress

GMT's roadmap tracks parity against the same four libraries story-by-story, with each gap sourced against the specific competitor function it closes — see [context/roadmap](https://github.com/burglekitt/gmt/tree/main/context/roadmap) for the full, source-verified audit trail. This is a live snapshot, not a finished-parity claim: ✅ shipped, 🟡 in progress, ⏳ backlog and not yet scheduled.

| Capability                                                                         | Status                       | Also has it                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| Duration type<br>(ISO 8601 parse/format/arithmetic)                                | ✅ Done                      | Luxon `Duration`                                                         |
| Interval/range math<br>(contains, overlap, union,<br>intersection, split, set ops) | ✅ Done                      | Luxon `Interval`,<br>date-fns `areIntervalsOverlapping`                  |
| DST disambiguation control<br>on construction _and_ arithmetic                     | ✅ Done — **differentiator** | None of the others expose<br>this on arithmetic                          |
| Locale-aware calendar helpers<br>(weekend, week start/end, day-of-week)            | ✅ Done                      | `@internationalized/date`                                                |
| Business-day arithmetic,<br>clamp/closest, time rounding                           | ✅ Done                      | `temporal-kit`                                                           |
| Interval rounding-out<br>(boundary count, from-duration)                           | ✅ Done                      | Luxon                                                                    |
| Locale calendar metadata<br>(names, `hasDST`)                                      | ✅ Done                      | Luxon `Info`                                                             |
| Overlap-day count, relative<br>rounding, DST transitions, hours-in-day             | ✅ Done                      | date-fns, `@internationalized/date`                                      |
| Field setters, token-pattern<br>parsing, named machine formats,<br>calendar-style formatting        | ✅ Done | Luxon `.set()`,<br>`toRFC2822`/`toHTTP`/`toSQL`,<br>Moment `.calendar()` |
| Non-Gregorian calendar systems<br>(Hebrew done; Islamic, solar,<br>Ethiopic backlog) | 🟡 In progress | `@internationalized/date`'s<br>`toCalendar` |

<sub>Status reflects [context/roadmap/tracker.md](https://github.com/burglekitt/gmt/tree/main/context/roadmap/tracker.md) as of this writing.</sub>

### Where GMT stands alone

Specific, sourced claims — not a repeat of the metrics above.

| Claim                                                                                                                                         | The others                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Only GMT runs its **entire** suite in CI<br>under a real `TZ` env var across 10<br>real-world zones × 2 Node versions<br>(20 full-suite runs) | Luxon/`@internationalized/date`: no<br>CI timezone matrix. date-fns: zone<br>scope unclear. Moment.js: 6 zones,<br>partial suite only |
| Only GMT enforces a mandatory<br>17-locale test matrix on every<br>locale-aware function                                                      | No CI-level or systematic<br>locale-matrix testing found<br>in any of the four                                                        |
| Only GMT exposes explicit DST<br>disambiguation control on both<br>construction _and_ arithmetic                                              | Luxon's docs call this explicitly<br>undefined; `@internationalized/date`<br>only covers construction, not arithmetic                 |
| Only GMT is Temporal-native with<br>zero `Date` usage, enforced by<br>3 dedicated lint packages                                               | Luxon, date-fns, and Moment.js all<br>still wrap or depend on `Date` internally                                                       |
| GMT's effective CI test<br>executions exceed all four<br>competitors **combined**<br>by ~15×                                                  | 318,020 vs. 386 + 4,888 + 3,213<br>+ 11,703 = 20,190                                                                                  |

## Package Layout

The package exports seven top-level namespaces:

```typescript
import {
  Temporal,
  duration,
  plain,
  zoned,
  unix,
  utc,
  regex,
} from "@burglekitt/gmt";
```

- `Temporal`: re-exported from `@js-temporal/polyfill`
- `duration`: ISO 8601 duration string parsing, validation, and arithmetic
- `plain`: timezone-free helpers
- `zoned`: timezone-aware helpers
- `unix`: Unix epoch (seconds or milliseconds) helpers
- `utc`: UTC instant helpers
- `regex`: low-level regex building blocks

You can also import subpaths directly:

```typescript
import { addDate, getNow, formatRelativeZoned } from "@burglekitt/gmt";
```

## Quick Start

### Plain arithmetic and comparisons

```typescript
import {
  addDate,
  addBusinessDays,
  subtractBusinessDays,
  areDatesEqual,
  diffDateTime,
  isBeforeDateTime,
} from "@burglekitt/gmt";

addDate("2026-01-01", 90, "day");
// "2026-03-32" is impossible, so Temporal normalizes correctly -> "2026-04-01"

addBusinessDays("2024-03-15", 1);
// "2024-03-18" (skips weekend)

subtractBusinessDays("2024-03-18", 1);
// "2024-03-15" (skips weekend)

diffDateTime("2024-03-17T12:00:00", "2024-03-17T12:30:00", "minute");
// 30

areDatesEqual("2026-03-17", "2026-03-17T09:00:00");
// true

isBeforeDateTime("2026-03-17T09:00:00", "2026-03-17T10:00:00");
// true
```

`add*`/`subtract*` accept an optional `overflow` (`"constrain"` (default) | `"reject"`) to control out-of-range results (e.g. adding a month to Jan 31), and `diff*` accept optional `smallestUnit`/`roundingIncrement`/`roundingMode` to round the computed difference:

```typescript
import { addDate, diffDate } from "@burglekitt/gmt";

addDate("2024-01-31", { months: 1 }, { overflow: "reject" });
// "" — Feb 31 doesn't exist and overflow: "reject" refuses to clamp it

diffDate("2023-01-01", "2023-01-10", "week", {
  smallestUnit: "week",
  roundingMode: "halfExpand",
});
// 1
```

`setDate`/`setDateTime`/`setTime`/`setZoned`/`setUnix`/`setUtc` set one or more fields on a value in a single atomic `.with()`-based call — the safe alternative to composing `add*` calls field-by-field, which resolves each field's overflow independently and can silently diverge on multi-field updates:

```typescript
import { setDate, setZoned } from "@burglekitt/gmt";

setDate("2024-01-31", { month: 2 });
// "2024-02-29" (constrain, the default, clamps to the last valid day)

setZoned(
  "2024-11-03T01:45:00-05:00[America/New_York]",
  { minute: 0 },
  {
    disambiguation: "reject",
  },
);
// "" — offset defaults to "ignore" so disambiguation actually fires on this fall-back overlap
```

`setZoned`/`setUnix`/`setUtc` also accept `disambiguation` and `offset` for DST gap/overlap control — see [DST Disambiguation](../../docs/dst-disambiguation.md).

`isWeekend`/`isZonedWeekend` check locale-specific weekend days (via `Intl.Locale`'s `weekInfo`) rather than assuming Saturday/Sunday:

```typescript
import { isWeekend, isZonedWeekend } from "@burglekitt/gmt";

isWeekend("2024-02-03", "en-US");
// true (Saturday, en-US weekend is Sat/Sun)

isWeekend("2024-02-03", "he-IL");
// true (Saturday is also part of he-IL's Fri/Sat weekend)

isZonedWeekend("2024-02-04T10:00:00+02:00[Asia/Jerusalem]", "he-IL");
// false (Sunday isn't part of he-IL's weekend)
```

`isBusinessDay` returns true for fixed ISO Monday–Friday business days (Mon=1 … Fri=5), locale-agnostic and with no holiday calendar. It's the complement to locale-aware `isWeekend` and matches the boundary that `addBusinessDays`/`subtractBusinessDays` use:

```typescript
import { isBusinessDay } from "@burglekitt/gmt";

isBusinessDay("2024-02-05");
// true (Monday)

isBusinessDay("2024-02-10");
// false (Saturday)
```

`isRelativeDay`/`isThisUnit`/`isPast`/`isFuture` are now-relative predicates — `isRelativeDay` subsumes `isToday`/`isYesterday`/`isTomorrow`, `isThisUnit` subsumes `isThisWeek`/`isThisMonth`/`isThisYear`. They compare against `getToday()`, so they depend on the **system clock and system timeZone**; the zoned variants (`isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture`) resolve "today"/"now" in the value's own timeZone instead, for deterministic results regardless of the host machine's timeZone:

```typescript
import { isRelativeDay, isThisUnit, isPast, isFuture } from "@burglekitt/gmt";

isRelativeDay("2024-03-15", 0);
// true, if today is 2024-03-15 ("isToday")

isThisUnit("2024-02-26", "week", "fr-FR");
// locale-aware week boundary — fr-FR weeks start Monday

isPast("2024-03-14");
// true, if today is 2024-03-15 (strictly before, not on-or-before)

isFuture("2024-03-16");
// true, if today is 2024-03-15 (strictly after, not on-or-before)
```

`nextWeekday`/`previousWeekday` find the next/previous occurrence of a given ISO day of week (1 = Monday … 7 = Sunday, matching `getDayOfWeek`) on or after/before a date, replacing date-fns's sixteen `next*`/`previous*` functions with two parameterized calls. `options.inclusive` (default `false`) controls what happens when the input already falls on the target day — `false` advances/retreats a full week, matching date-fns:

```typescript
import { nextWeekday, previousWeekday } from "@burglekitt/gmt";

nextWeekday("2024-03-13", 5);
// "2024-03-15" (Wednesday -> next Friday)

nextWeekday("2024-03-15", 5);
// "2024-03-22" (already a Friday -> advances a full week by default)

nextWeekday("2024-03-15", 5, { inclusive: true });
// "2024-03-15" (already a Friday -> returned as-is)

previousWeekday("2024-03-13", 5);
// "2024-03-08" (Wednesday -> previous Friday)
```

```typescript
import { isZonedRelativeDay, isZonedPast } from "@burglekitt/gmt";

isZonedRelativeDay("2024-03-15T10:00:00-04:00[America/New_York]", 0);
// "today" resolved in America/New_York, not the host's system timeZone

isZonedPast("2020-01-01T00:00:00Z[UTC]");
// true — compares the exact instant, not just the calendar day
```

`clampDate` restricts a date to a range, and `closestDateTo` finds the nearest candidate by calendar distance:

```typescript
import { clampDate, closestDateTo } from "@burglekitt/gmt";

clampDate("2024-02-01", "2024-03-01", "2024-03-31");
// "2024-03-01"

closestDateTo("2024-03-15", ["2024-03-01", "2024-03-20", "2024-03-18"]);
// "2024-03-18"
```

`getLocaleStartOfWeek`/`getLocaleEndOfWeek` (and their zoned equivalents) compute week boundaries from the locale's first day of week, instead of an ISO-Monday default:

```typescript
import { getLocaleStartOfWeek, getLocaleEndOfWeek } from "@burglekitt/gmt";

getLocaleStartOfWeek("2024-02-29", "en-US");
// "2024-02-25" (Sunday, en-US weeks start Sunday)

getLocaleStartOfWeek("2024-02-29", "fr-FR");
// "2024-02-26" (Monday, fr-FR weeks start Monday)

getLocaleEndOfWeek("2024-02-29", "en-US");
// "2024-03-02" (Saturday)
```

`getLocaleDayOfWeek`/`getLocaleZonedDayOfWeek` return a locale-relative day-of-week index (0 = first day of the locale's week):

```typescript
import { getLocaleDayOfWeek, getLocaleZonedDayOfWeek } from "@burglekitt/gmt";

getLocaleDayOfWeek("2024-02-25", "en-US");
// 0 (Sunday = first day of en-US week)

getLocaleDayOfWeek("2024-02-26", "fr-FR");
// 0 (Monday = first day of fr-FR week)

getLocaleDayOfWeek("2024-02-24", "he-IL");
// 0 (Saturday = first day of he-IL week)

getLocaleZonedDayOfWeek("2024-02-25T12:00:00+00:00[UTC]", "en-US");
// 0
```

`getLocaleEraNames`/`getLocaleMonthNames`/`getLocaleWeekdayNames`/`getLocaleMeridiems` return standalone, locale-aware calendar names with no date value required — the GMT equivalents of Luxon's `Info.eras`/`Info.months`/`Info.weekdays`/`Info.meridiems`:

```typescript
import {
  getLocaleEraNames,
  getLocaleMonthNames,
  getLocaleWeekdayNames,
  getLocaleMeridiems,
} from "@burglekitt/gmt";

getLocaleEraNames("en-US");
// ["Before Christ", "Anno Domini"]

getLocaleEraNames("ja-JP", "short");
// ["紀元前", "西暦"]

getLocaleMonthNames("en-US");
// ["January", "February", ... "December"]

getLocaleMonthNames("de-DE", "short");
// ["Jan", "Feb", "Mär", ... "Dez"]

getLocaleWeekdayNames("en-US");
// ["Sunday", "Monday", ... "Saturday"] (locale-first-day order)

getLocaleWeekdayNames("fr-FR");
// ["lundi", "mardi", ... "dimanche"]

getLocaleMeridiems("en-US");
// ["AM", "PM"]

getLocaleMeridiems("zh-CN");
// ["上午", "下午"]
```

`getLocaleWeekdayNames` returns names in the locale's first-day order, consistent with `getLocaleDayOfWeek` (index 0 is the locale's first day of the week). All four delegate to the host runtime's `Intl` data, so their output depends on the runtime's ICU build.

### Parsing

`parseDateWithPattern`/`parseDateTimeWithPattern`/`parseTimeWithPattern` decode a known, fixed producer format — a CSV column, a legacy API field, or a partially-typed form value — against a caller-supplied token pattern. This is for **decoding**, not display: the pattern hard-codes field order, so `formatDate`/`formatDateToParts` remain the correct choice for locale-correct output.

```typescript
import {
  parseDateWithPattern,
  parseDateTimeWithPattern,
  parseTimeWithPattern,
} from "@burglekitt/gmt";

parseDateWithPattern("03/15/2024", "MM/dd/yyyy");
// "2024-03-15"

parseDateTimeWithPattern("15-Mar-2024 14:30", "dd-MMM-yyyy HH:mm");
// "2024-03-15T14:30:00"

parseTimeWithPattern("02:30:45 PM", "hh:mm:ss a");
// "14:30:45"

parseDateWithPattern("02/31/2024", "MM/dd/yyyy");
// "" — shape-valid but not a real date; Temporal validates after the regex match
```

Supported tokens include `yyyy`/`MM`/`dd`/`HH`/`mm`/`ss`/`SSS` for fixed-width fields, `M`/`d`/`H`/`h`/`m`/`s` for variable-width, `MMMM`/`MMM`/`EEEE`/`EEE`/`a`/`GGGG`/`GG` for locale-aware names, and `'single quotes'` for literal text. A `locale` parameter (default `"en-US"`) controls name-token matching. Invalid input, no-match, and malformed patterns all return `""`.

### Calendar systems

GMT's `CalendarSystem` type (`"gregorian" | "hebrew"`, extended by later stories) and `convertDateToCalendar` express a date in a non-Gregorian calendar system, built entirely on Temporal's native calendar support — no bundled leap-year tables or ported arithmetic.

```typescript
import { convertDateToCalendar } from "@burglekitt/gmt";

convertDateToCalendar("2024-10-03", "hebrew");
// "5785-01-01[u-ca=hebrew]" — Rosh Hashanah 5785

convertDateToCalendar("5785-01-01[u-ca=hebrew]", "gregorian");
// "2024-10-03" — round-trips back

convertDateToCalendar("invalid", "hebrew");
// ""
```

The output string shape is the key design decision here, and it deliberately **diverges from Temporal's own** `[u-ca=...]` convention. Temporal's `Temporal.PlainDate.prototype.toString()` always keeps the ISO/proleptic-Gregorian year-month-day digits and only tags the calendar (`"2024-10-03[u-ca=hebrew]"` — still literally October 3rd's Gregorian digits). That hides the calendar's own fields behind calendar-aware accessors, which GMT's string-only contract has no place for. GMT's annotated string instead carries the **calendar-native** year/month/day — Hebrew year 5785, not 2024 — so the calendar-system concept is visible directly in the string, not just in an object property. A plain, unannotated ISO string is always treated as (and always produced for) the `"gregorian"` calendar, so every existing GMT function keeps working unchanged.

Hebrew years can run 12 or 13 months (7 leap years per 19-year Metonic cycle insert a 13th month, Adar I, before the regular Adar); `convertDateToCalendar` resolves this the same way Temporal does internally, via ordinal month numbers (`1`-`13`) rather than fixed month names, so no month-counting logic lives in GMT itself.

### Durations

```typescript
import {
  absDuration,
  addDuration,
  compareDurations,
  diffDateAsDuration,
  durationAs,
  formatDuration,
  getDurationSign,
  getDurationUnit,
  isValidDuration,
  negateDuration,
  normalizeDuration,
  parseDuration,
  subtractDuration,
} from "@burglekitt/gmt";

isValidDuration("P1DT2H30M");
// true

parseDuration("P1DT2H30M");
// "P1DT2H30M"

parseDuration("PT1.5S", { smallestUnit: "second", roundingMode: "trunc" });
// "PT1S"

parseDuration("not a duration");
// ""

addDuration("P1D", "PT2H");
// "P1DT2H"

subtractDuration("P1D", "PT2H");
// "PT22H"

normalizeDuration("PT90M", { largestUnit: "hour" });
// "PT1H30M"

normalizeDuration("P45D", { largestUnit: "month", relativeTo: "2024-01-01" });
// "P1M14D"

getDurationUnit("P1DT2H30M", "hours");
// 2 — the hours component as stored

durationAs("P1DT2H30M", "hours");
// 26.5 — the whole duration totalled into hours

durationAs("P1M", "days");
// null — a calendar unit needs a relativeTo anchor

durationAs("P1M", "days", { relativeTo: "2024-02-01" });
// 29

negateDuration("P1DT2H");
// "-P1DT2H"

absDuration("-P1DT2H");
// "P1DT2H"

getDurationSign("-P1DT2H");
// -1

compareDurations("PT60M", "PT1H");
// 0 — equal by length, not by spelling

compareDurations("P1M", "P30D", { relativeTo: "2024-01-01" });
// 1 — January is 31 days; relativeTo "2024-02-01" gives -1

formatDuration("P1DT2H30M", "en-US");
// "1 day, 2 hours, and 30 minutes"

formatDuration("P1DT2H30M", "en-US", { style: "short" });
// "1 day, 2 hr, & 30 min"

formatDuration("P1DT0H30M", "en-US");
// "1 day and 30 minutes"

diffDateAsDuration("2024-03-10", "2024-04-05", "days");
// "P26D" — bridges diffDate to an ISO duration string instead of a single-unit number
```

`getDurationUnit` reads a component as stored, while `durationAs` converts the whole duration — `getDurationUnit("PT90M", "hours")` is `0` but `durationAs("PT90M", "hours")` is `1.5`. `durationAs` and `compareDurations` return `null` when a calendar unit (year/month/week) is involved without a `relativeTo` anchor, the same documented constraint `normalizeDuration` carries; `negateDuration`, `absDuration`, `getDurationSign`, and `getDurationUnit` are sign/field reads and never need one.

`diffDateAsDuration`/`diffDateTimeAsDuration`/`diffZonedAsDuration`/`diffUnixAsDuration`/`diffUtcAsDuration` are sibling functions to `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc`, returning an ISO 8601 duration string (sentinel `""`) instead of a single-unit number (sentinel `null`). They take a single `unit` (not an array) to set the duration's `largestUnit`.

### Intervals

Interval and range validators are available in two API shapes — **range validators** (matching `isValidDateRange`'s `{ value1, value2, options? }` object-param shape) and **interval validators** (`(start, end)` positional args, `start <= end` always):

```typescript
import {
  isValidDateInterval,
  isValidTimeInterval,
  isValidDateTimeInterval,
  isValidDateRange,
  isValidTimeRange,
  isValidDateTimeRange,
  isValidUtcRange,
  isValidUnixRange,
  isValidZonedRange,
  isValidUtcInterval,
  isValidUnixInterval,
  isValidZonedInterval,
} from "@burglekitt/gmt";

// Interval validators — positional args, start <= end
isValidDateInterval("2024-01-01", "2024-12-31");
// true

isValidTimeInterval("09:00:00", "17:00:00");
// true

isValidDateTimeInterval("2024-01-01T10:00:00", "2024-12-31T23:59:59");
// true

isValidZonedInterval(
  "2024-01-01T10:00:00+00:00[UTC]",
  "2024-12-31T23:59:59+00:00[UTC]",
);
// true

// Range validators — object params, with optional allowEqual
isValidDateRange({ value1: "2024-01-01", value2: "2024-12-31" });
// true

isValidTimeRange({ value1: "09:00:00", value2: "17:00:00" });
// true

isValidZonedRange({
  value1: "2024-01-01T10:00:00+00:00[UTC]",
  value2: "2024-12-31T23:59:59+00:00[UTC]",
});
// true
```

Interval containment checks (`intervalContains*`) test whether a point or inner interval falls within an outer interval. Each supports two modes via an optional fourth argument:

- 3-arg: `intervalContains(start, end, point)` — true when `start <= point <= end`
- 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — true when the inner interval is fully contained

```typescript
import {
  intervalContainsDate,
  intervalContainsTime,
  intervalContainsDateTime,
  intervalContainsUtc,
  intervalContainsUnix,
  intervalContainsZoned,
} from "@burglekitt/gmt";

// Point-in-interval (3-arg)
intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15");
// true

intervalContainsTime("09:00:00", "17:00:00", "12:00:00");
// true

intervalContainsUtc(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
  "2024-06-15T12:00:00Z",
);
// true

intervalContainsUnix(0, 1700000000, 170000000);
// true

intervalContainsZoned(
  "2024-01-01T00:00:00+00:00[UTC]",
  "2024-12-31T23:59:59+00:00[UTC]",
  "2024-06-15T12:00:00+00:00[UTC]",
);
// true

// Interval-in-interval (4-arg)
intervalContainsDate("2024-01-01", "2024-12-31", "2024-03-01", "2024-09-01");
// true

intervalContainsTime("09:00:00", "17:00:00", "10:00:00", "16:00:00");
// true
```

All interval containment checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalsOverlap*` checks whether two intervals share any time. Returns `true` when intervals overlap, `false` when they are disjoint or only adjacent (touching at a single instant with no shared time):

```typescript
import {
  intervalsOverlapDate,
  intervalsOverlapTime,
  intervalsOverlapDateTime,
  intervalsOverlapUtc,
  intervalsOverlapUnix,
  intervalsOverlapZoned,
} from "@burglekitt/gmt";

intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// true

intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// false (adjacent, no shared time)

intervalsOverlapUnix(0, 1700000000, 1000000, 2000000);
// true

intervalsOverlapUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// true
```

All overlap checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalIntersection*` returns the overlapping span of two intervals, or `null` when they do not overlap. Adjacent intervals (sharing one instant) count as overlapping and return a single-point span:

```typescript
import {
  intervalIntersectionDate,
  intervalIntersectionTime,
  intervalIntersectionDateTime,
  intervalIntersectionUtc,
  intervalIntersectionUnix,
  intervalIntersectionZoned,
} from "@burglekitt/gmt";

intervalIntersectionDate(
  "2024-01-01",
  "2024-06-30",
  "2024-04-01",
  "2024-12-31",
);
// { start: "2024-04-01", end: "2024-06-30" }

intervalIntersectionDate(
  "2024-01-01",
  "2024-06-30",
  "2024-06-30",
  "2024-12-31",
);
// { start: "2024-06-30", end: "2024-06-30" } (adjacent, shares one instant)

intervalIntersectionDate(
  "2024-01-01",
  "2024-06-30",
  "2024-07-01",
  "2024-12-31",
);
// null (disjoint)

intervalIntersectionUnix(0, 1700000000, 1000000, 2000000);
// { start: 1000000, end: 1700000000 }

intervalIntersectionUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// { start: "2024-04-01T00:00:00Z", end: "2024-06-30T23:59:59Z" }
```

All intersection functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalOverlappingDays*` returns how many distinct calendar dates two intervals share — the numeric counterpart to `intervalIntersection*`'s span. Counting is inclusive of both endpoints of the closed intersection `[max(aStart, bStart), min(aEnd, bEnd)]`, so `intervalOverlappingDaysDate("2024-01-01", "2024-01-01", "2024-01-01", "2024-01-01")` is `1`, not `0`. There is no `Time` variant — `PlainTime` has no calendar, so a day count is undefined for it:

```typescript
import {
  intervalOverlappingDaysDate,
  intervalOverlappingDaysDateTime,
  intervalOverlappingDaysUtc,
  intervalOverlappingDaysUnix,
  intervalOverlappingDaysZoned,
} from "@burglekitt/gmt";

intervalOverlappingDaysDate(
  "2024-01-01",
  "2024-06-30",
  "2024-04-01",
  "2024-12-31",
);
// 91

intervalOverlappingDaysDate(
  "2024-01-01",
  "2024-06-30",
  "2024-06-30",
  "2024-12-31",
);
// 1 (adjacent, shares one date)

intervalOverlappingDaysDate(
  "2024-01-01",
  "2024-06-30",
  "2024-07-01",
  "2024-12-31",
);
// 0 (disjoint)

intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000, {
  timeZone: "UTC",
});
// 2
```

Returns `0` when the intervals do not overlap (a well-defined answer, not invalid input) and `null` on invalid input, including an inverted interval (`start > end`). `intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` count days in `aStart`'s time zone (`intervalOverlappingDaysUnix` defaults to the system time zone, overridable via `{ timeZone }`) — the same rule `intervalCountZoned`/`intervalCountUnix` use — so `intervalOverlappingDaysZoned` is **not commutative** when the two intervals carry different zones: swapping the arguments can change the answer.

This deliberately diverges from date-fns's `getOverlappingDaysInIntervals`, which rounds up elapsed 24-hour periods instead of counting calendar dates — its own doc example (`Jan 10–20` vs `Jan 17–21`) returns `3` there and `4` here. To reproduce date-fns's number, compose `intervalIntersection*` with `intervalCount*`:

```typescript
const span = intervalIntersectionDate(aStart, aEnd, bStart, bEnd);
span ? intervalCountDate(span.start, span.end, "day") : 0; // date-fns semantics
```

`intervalUnion*` returns the combined span of two overlapping or adjacent intervals, or `null` when they are disjoint with a gap. Adjacent intervals (sharing one instant) count as mergeable:

```typescript
import {
  intervalUnionDate,
  intervalUnionTime,
  intervalUnionDateTime,
  intervalUnionUtc,
  intervalUnionUnix,
  intervalUnionZoned,
} from "@burglekitt/gmt";

intervalUnionDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" }

intervalUnionDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// { start: "2024-01-01", end: "2024-12-31" } (adjacent, merged)

intervalUnionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// null (disjoint with a gap)

intervalUnionUnix(0, 1700000000, 1000000, 2000000);
// { start: 0, end: 1700000000 }

intervalUnionUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// { start: "2024-01-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }
```

All union functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalDifference*` returns the portion(s) of interval A not covered by interval B, as an array of `{ start, end }` records:

```typescript
import {
  intervalDifferenceDate,
  intervalDifferenceTime,
  intervalDifferenceDateTime,
  intervalDifferenceUtc,
  intervalDifferenceUnix,
  intervalDifferenceZoned,
} from "@burglekitt/gmt";

intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01");
// [{ start: "2024-01-01", end: "2024-05-31" }, { start: "2024-07-02", end: "2024-12-31" }]

intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31");
// [] (B fully covers A)

intervalDifferenceUnix(0, 1700000000, 1000000, 2000000);
// [{ start: 0, end: 999999 }, { start: 2000001, end: 1700000000 }]

intervalDifferenceUtc(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
  "2024-06-01T00:00:00Z",
  "2024-07-01T00:00:00Z",
);
// [{ start: "2024-01-01T00:00:00Z", end: "2024-05-31T23:59:59Z" }, { start: "2024-07-02T00:00:00Z", end: "2024-12-31T23:59:59Z" }]
```

All difference functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalXor*` returns the symmetric difference of two intervals — the portions covered by exactly one of them, not both — as an array of `{ start, end }` records:

```typescript
import {
  intervalXorDate,
  intervalXorTime,
  intervalXorDateTime,
  intervalXorUtc,
  intervalXorUnix,
  intervalXorZoned,
} from "@burglekitt/gmt";

intervalXorDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// [{ start: "2024-01-01", end: "2024-03-31" }, { start: "2024-07-01", end: "2024-12-31" }]

intervalXorDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// [{ start: "2024-01-01", end: "2024-06-29" }, { start: "2024-07-01", end: "2024-12-31" }] (adjacent)

intervalXorUnix(0, 1700000000, 1000000, 2000000);
// [{ start: 0, end: 999999 }, { start: 2000001, end: 1700000000 }]

intervalXorUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-04-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
);
// [{ start: "2024-01-01T00:00:00Z", end: "2024-03-31T23:59:59Z" }, { start: "2024-07-01T00:00:00Z", end: "2024-12-31T23:59:59Z" }]
```

All xor functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalAbuts*` checks whether two intervals are exactly adjacent — one's end equals the other's start with zero gap and zero overlap:

```typescript
import {
  intervalAbutsDate,
  intervalAbutsTime,
  intervalAbutsDateTime,
  intervalAbutsUtc,
  intervalAbutsUnix,
  intervalAbutsZoned,
} from "@burglekitt/gmt";

intervalAbutsDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// true

intervalAbutsDate("2024-01-01", "2024-06-29", "2024-06-30", "2024-12-31");
// false (one-day gap)

intervalAbutsDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// false (overlap)

intervalAbutsUnix(0, 1000000, 1000000, 2000000);
// true

intervalAbutsUtc(
  "2024-01-01T00:00:00Z",
  "2024-06-30T23:59:59Z",
  "2024-06-30T23:59:59Z",
  "2024-12-31T23:59:59Z",
);
// true
```

All abuts checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`intervalEngulfs*` checks whether interval B is fully contained within interval A — every instant of B falls within A. Equivalent to the 4-argument `intervalContains*` mode:

```typescript
import {
  intervalEngulfsDate,
  intervalEngulfsTime,
  intervalEngulfsDateTime,
  intervalEngulfsUtc,
  intervalEngulfsUnix,
  intervalEngulfsZoned,
} from "@burglekitt/gmt";

intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01");
// true

intervalEngulfsDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31");
// true (equal intervals)

intervalEngulfsDate("2024-06-01", "2024-07-01", "2024-01-01", "2024-12-31");
// false

intervalEngulfsUnix(0, 1700000000, 1000000, 2000000);
// true

intervalEngulfsUtc(
  "2024-01-01T00:00:00Z",
  "2024-12-31T23:59:59Z",
  "2024-06-01T00:00:00Z",
  "2024-07-01T00:00:00Z",
);
// true
```

All engulfs checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-finite values for Unix).

`splitIntervalByUnit*` splits an interval into sub-intervals of `amount × unit`, returning an array of `{ start, end }` records. The final sub-interval is trimmed so its `end` never exceeds the original `end`:

```typescript
import {
  splitIntervalByUnitDate,
  splitIntervalByUnitTime,
  splitIntervalByUnitDateTime,
  splitIntervalByUnitUtc,
  splitIntervalByUnitUnix,
  splitIntervalByUnitZoned,
} from "@burglekitt/gmt";

splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2);
// [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-05" }, { start: "2024-01-05", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-09" }, { start: "2024-01-09", end: "2024-01-10" }]

splitIntervalByUnitUtc(
  "2024-01-01T00:00:00Z",
  "2024-01-02T00:00:00Z",
  "hour",
  6,
);
// [{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T06:00:00Z" }, { start: "2024-01-01T06:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" }, { start: "2024-01-01T18:00:00Z", end: "2024-01-02T00:00:00Z" }]

splitIntervalByUnitUnix(0, 86400000, "hour", 6);
// [{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]
```

All split functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-positive amount, unsupported unit, or a unit that has no effect on the target type).

`intervalCount*` returns how many calendar-unit boundaries an interval crosses — the number of units the half-open interval `[start, end)` touches. This is distinct from `diff*`, which measures exact elapsed duration: an interval from 23:59 to 00:01 is two minutes long but touches two days:

```typescript
import {
  intervalCountDate,
  intervalCountTime,
  intervalCountDateTime,
  intervalCountUtc,
  intervalCountUnix,
  intervalCountZoned,
} from "@burglekitt/gmt";

intervalCountDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");
// 2 (two minutes long, but two days touched)

intervalCountDate("2024-01-01", "2024-01-03", "day");
// 2 (the end boundary is excluded)

intervalCountDate("2024-01-15", "2024-03-10", "month");
// 3

intervalCountTime("12:30:00", "13:00:00", "hour");
// 1

intervalCountZoned(
  "2024-03-10T00:00:00-05:00[America/New_York]",
  "2024-03-11T00:00:00-04:00[America/New_York]",
  "hour",
);
// 23 (the spring-forward local day is 23 hours long)

intervalCountUnix(0, 86400000, "hour");
// 24
```

Zero-length intervals count `1` when they sit mid-unit and `0` when they sit exactly on a unit boundary — `intervalCountDate("2024-01-15", "2024-01-15", "month")` is `1`, while `intervalCountDate("2024-01-01", "2024-01-01", "month")` is `0`. Weeks start on Monday (ISO 8601), singular and plural units are interchangeable (`"day"` and `"days"`), and `intervalCountUnix` uses the system timeZone for calendar boundaries (consistent with `addUnix`). All count functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, unsupported unit, or a unit that has no effect on the target type).

`intervalLength*` is `intervalCount*`'s exact-duration counterpart — it answers "how long is this interval" as a real, possibly fractional number, rather than "how many boundaries does it touch":

```typescript
import {
  intervalLengthDate,
  intervalLengthTime,
  intervalLengthDateTime,
  intervalLengthUtc,
  intervalLengthUnix,
  intervalLengthZoned,
} from "@burglekitt/gmt";

intervalLengthDateTime("2024-01-01T23:59:00", "2024-01-02T00:01:00", "day");
// 0.001388888888888889 (the same interval intervalCount* reports as 2 day boundaries)

intervalLengthDate("2024-01-01", "2024-01-16", "month");
// 0.4838709677419355 (15 of January's 31 days)

intervalLengthZoned(
  "2024-03-10T00:00:00-05:00[America/New_York]",
  "2024-03-11T00:00:00-04:00[America/New_York]",
  "hour",
);
// 23 (spring-forward local day is 23 real hours)
```

`intervalLength*` uses `Temporal.Duration.prototype.total`, so calendar units (month, year) resolve against the interval's own `start` rather than truncating, and zoned/unix/utc variants are DST-aware the same way `intervalCount*` is. Returns `0` for a zero-length interval, and `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, unsupported unit).

`intervalDivideEqually*` splits an interval into `n` equal-length sub-intervals, and `intervalSplitAt*` splits an interval at arbitrary points instead of by count:

```typescript
import {
  intervalDivideEquallyDate,
  intervalSplitAtDate,
} from "@burglekitt/gmt";

intervalDivideEquallyDate("2024-01-01", "2024-01-05", 4);
// [{ start: "2024-01-01", end: "2024-01-02" }, { start: "2024-01-02", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-04" }, { start: "2024-01-04", end: "2024-01-05" }]

intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-07", "2024-01-03"]);
// [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-10" }]
```

`n` must be a positive integer (`[]` otherwise); `n === 1` returns the original interval unchanged, and a zero-length interval returns `n` identical zero-length sub-intervals. Non-fractional types (`PlainDate`) round internal boundaries to the nearest whole unit; every other variant is exact, computed from total elapsed nanoseconds (`intervalDivideEquallyZoned` splits DST-crossing intervals by real elapsed time, not local clock time). `intervalSplitAt*` sorts its `points` internally — they need not be pre-sorted — and drops points outside `[start, end]` or exactly on a boundary, since those cannot introduce a new sub-interval; an empty or all-dropped `points` array returns `[{ start, end }]` unsplit.

`mergeIntervals*` and `intervalXorAll*` are the list-form generalizations of `intervalUnion*` and `intervalXor*`, which are pairwise only — each takes a single array of `{ start, end }` records instead of two flat intervals:

```typescript
import { mergeIntervalsDate, intervalXorAllDate } from "@burglekitt/gmt";

mergeIntervalsDate([
  { start: "2024-01-01", end: "2024-01-10" },
  { start: "2024-01-05", end: "2024-01-15" },
]);
// [{ start: "2024-01-01", end: "2024-01-15" }]

intervalXorAllDate([
  { start: "2024-01-01", end: "2024-01-10" },
  { start: "2024-01-05", end: "2024-01-15" },
  { start: "2024-01-08", end: "2024-01-20" },
]);
// [{ start: "2024-01-01", end: "2024-01-04" }, { start: "2024-01-08", end: "2024-01-10" }, { start: "2024-01-16", end: "2024-01-20" }]
```

`mergeIntervals*` collapses overlapping or adjacent intervals (shared endpoint) into the minimum non-overlapping set. `intervalXorAll*` returns the set covered by an odd number of the input intervals — for exactly two intervals the result is identical to the pairwise `intervalXor*`, and two identical intervals cancel out to `[]`. All four return `[]` for an empty list or on invalid input.

`intervalFromDuration*` constructs an interval from a single point plus an ISO 8601 duration, anchored at either end — Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param instead of two:

```typescript
import {
  intervalFromDurationDate,
  intervalFromDurationTime,
  intervalFromDurationDateTime,
  intervalFromDurationUtc,
  intervalFromDurationUnix,
  intervalFromDurationZoned,
} from "@burglekitt/gmt";

intervalFromDurationDate("2024-01-01", "P1M", "start");
// { start: "2024-01-01", end: "2024-02-01" }

intervalFromDurationDate("2024-02-01", "P1M", "end");
// { start: "2024-01-01", end: "2024-02-01" }

intervalFromDurationZoned(
  "2024-03-09T02:30:00-05:00[America/New_York]",
  "P1D",
  "start",
);
// { start: "2024-03-09T02:30:00-05:00[America/New_York]", end: "2024-03-10T03:30:00-04:00[America/New_York]" } (spring-forward day is 23 hours long)

intervalFromDurationTime("12:00:00", "P1D", "start");
// null (PlainTime has no calendar — a date-unit duration needs a relativeTo it can't supply)
```

Calendar units (years/months/weeks) resolve against `value` itself, so no separate `relativeTo` is needed — except for `intervalFromDurationTime`, which returns `null` for a `duration` with a nonzero years/months/weeks/days component, since `PlainTime` has no calendar to resolve it against. `intervalFromDurationZoned` accepts the same `disambiguation`/`offset`/`overflow` options as `addZoned`; `intervalFromDurationUnix` accepts `addUnix`'s `epochUnit`/`timeZone`/`overflow` options. A negative `duration` that inverts the computed span, or an `overflow: "reject"` result, returns `null` — same sentinel as any other invalid input.

All validators return `false` on invalid input (wrong type, malformed strings, leap seconds, mixed kinds for plain interval validators, non-finite values for Unix).

### Zoned operations

```typescript
import { addZoned, formatZonedDateTime } from "@burglekitt/gmt";

addZoned("2026-03-07T23:00:00-05:00[America/New_York]", 2, "hour");
// "2026-03-08T01:00:00-05:00[America/New_York]"

formatZonedDateTime("2024-03-17T14:30:45+00:00[UTC]", "en-US", {
  dateStyle: "full",
  timeStyle: "short",
});
// locale-dependent non-empty formatted string
```

Twice a year, DST creates local times that don't exist (spring-forward gap) or happen twice (fall-back overlap). Functions that attach a timezone to a plain/local value accept an optional `disambiguation` (`"compatible"` (default) | `"earlier"` | `"later"` | `"reject"`) to control how that's resolved instead of silently guessing:

```typescript
import { convertPlainDateTimeToZoned } from "@burglekitt/gmt";

// 2024-03-10T02:30:00 doesn't exist in America/New_York (clocks jump 2am -> 3am).
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists
```

The `startOfZoned`/`endOfZoned`/`startOfQuarterForZoned`/`endOfQuarterForZoned`/`mapZonedHoursInDay` family (and their `unix/` counterparts) also accept `disambiguation`, plus an `offset` option (`"prefer"` | `"use"` | `"ignore"` (default) | `"reject"`) that controls whether the source's existing UTC offset is kept when computing the new boundary. **`offset` must stay at its default (`"ignore"`) for `disambiguation` to take effect** — Temporal's own default (`"prefer"`) keeps the source offset whenever still valid, which silently makes `disambiguation` a no-op:

```typescript
import { startOfZoned } from "@burglekitt/gmt";

// 2024-11-03T01:45:00-05:00 is the SECOND, repeated 1am of the fall-back overlap in America/New_York.
const source = "2024-11-03T01:45:00-05:00[America/New_York]";

startOfZoned(source, "hour", { disambiguation: "reject" });
// "" — offset defaults to "ignore", so disambiguation actually fires and "reject" throws

startOfZoned(source, "hour", { disambiguation: "reject", offset: "prefer" });
// "2024-11-03T01:00:00-05:00[America/New_York]" — offset:"prefer" keeps the source's
// still-valid -05:00 offset, so disambiguation is never consulted and "reject" never fires
```

`convertPlainDateTimeToZoned` and `addZoned`/`subtractZoned` also accept `offset` for API consistency, but it's permanently inert on both — their construction path never has a stored offset for it to act on.

`hasDaylightSaving` reports whether an IANA timezone observes daylight saving time at all:

```typescript
import { hasDaylightSaving } from "@burglekitt/gmt";

hasDaylightSaving("America/New_York");
// true

hasDaylightSaving("Asia/Tokyo");
// false

hasDaylightSaving("Invalid/Zone");
// false
```

`getDstTransitions` enumerates the exact transition instants for a timezone in a given year:

```typescript
import { getDstTransitions } from "@burglekitt/gmt/zoned";

getDstTransitions("America/New_York", 2024);
// [
//   { instant: "2024-03-10T07:00:00Z", offsetBefore: "-05:00", offsetAfter: "-04:00" },
//   { instant: "2024-11-03T06:00:00Z", offsetBefore: "-04:00", offsetAfter: "-05:00" }
// ]

getDstTransitions("Asia/Tokyo", 2024);
// []

getDstTransitions("Invalid/Zone", 2024);
// []
```

Each object's `instant` is a UTC ISO 8601 string; `offsetBefore`/`offsetAfter` are `±HH:MM` offset strings. Returns `[]` for zones with no transitions in the requested year and on invalid input.

**Four DST-related questions, four different functions.** The names are close enough to be misread, so here's the map:

| Question                                                                        | Function                                      | Scope                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Does this zone observe DST at all?                                              | `hasDaylightSaving(timeZone)`                 | Zone-level, no instant                               |
| Where do this zone's transitions fall?                                          | `getDstTransitions(timeZone, year)`           | Enumerates instants                                  |
| Is _this particular instant_ currently in DST?                                  | `isInDaylightSaving(value)`                   | A single zoned value                                 |
| What should happen when construction lands on an ambiguous/nonexistent instant? | `disambiguation` / `offset` options (Group C) | Orthogonal — a construction-time choice, not a query |

`isInDaylightSaving` answers the third question:

```typescript
import { isInDaylightSaving } from "@burglekitt/gmt/zoned";

isInDaylightSaving("2024-07-15T12:00:00-04:00[America/New_York]");
// true

isInDaylightSaving("2024-01-15T12:00:00-05:00[America/New_York]");
// false

// Southern-hemisphere DST spans the new year.
isInDaylightSaving("2024-01-15T12:00:00+11:00[Australia/Sydney]");
// true

isInDaylightSaving("2024-07-15T12:00:00+09:00[Asia/Tokyo]");
// false — Asia/Tokyo has no DST, so this is always false

isInDaylightSaving("invalid");
// false
```

`getZonedOffset` and `getZonedOffsetAs` read a zoned value's UTC offset — the former as a `±HH:MM` string, the latter as a number in minutes or nanoseconds:

```typescript
import { getZonedOffset, getZonedOffsetAs } from "@burglekitt/gmt/zoned";

getZonedOffset("2024-07-15T12:00:00-04:00[America/New_York]");
// "-04:00"

getZonedOffsetAs("2024-07-15T12:00:00-04:00[America/New_York]", "minutes");
// -240

getZonedOffsetAs("2024-05-15T12:00:00+05:45[Asia/Kathmandu]", "minutes");
// 345 — GMT has half- and quarter-hour offsets too, not just whole hours

getZonedOffset("invalid");
// ""
```

`getTimeZoneOffset` looks up a timezone's offset at a given instant without needing an existing zoned value in hand:

```typescript
import { getTimeZoneOffset } from "@burglekitt/gmt/zoned";

getTimeZoneOffset("America/New_York", "2024-07-15T12:00:00Z");
// "-04:00"

getTimeZoneOffset("America/New_York", "2024-01-15T12:00:00Z");
// "-05:00"

getTimeZoneOffset("Invalid/Zone", "2024-07-15T12:00:00Z");
// ""
```

`formatTimeZoneName` returns a timezone's localized display name. `options.style` covers every `Intl.DateTimeFormatOptions` `timeZoneName` value:

```typescript
import { formatTimeZoneName } from "@burglekitt/gmt/zoned";

formatTimeZoneName("America/New_York", "en-US", { style: "shortGeneric" });
// "ET" — season-independent

formatTimeZoneName("America/New_York", "en-US", { style: "longGeneric" });
// "Eastern Time" — season-independent

formatTimeZoneName("America/New_York", "en-US", { style: "long" });
// "Eastern Standard Time" or "Eastern Daylight Time", depending on the current date

formatTimeZoneName("Invalid/Zone", "en-US");
// ""
```

The `"short"`/`"long"`/`"shortOffset"`/`"longOffset"` styles name the zone's _current_ offset — for a DST-observing zone the label flips between standard and daylight names depending on when this is called, since there's no instant parameter to pin it to (this matches how `Intl.DateTimeFormat.prototype.format()` itself defaults to "now" with no argument). The `"shortGeneric"`/`"longGeneric"` styles are season-independent and don't have this issue — prefer them for a name that won't change twice a year.

`clampZoned` restricts a zoned datetime to a range, and `closestZonedTo` finds the nearest candidate by temporal distance:

```typescript
import { clampZoned, closestZonedTo } from "@burglekitt/gmt";

clampZoned(
  "2024-02-01T12:00:00[America/New_York]",
  "2024-03-01T00:00:00[America/New_York]",
  "2024-03-31T23:59:59[America/New_York]",
);
// "2024-03-01T00:00:00-05:00[America/New_York]"

closestZonedTo("2024-03-15T12:00:00[America/New_York]", [
  "2024-03-01T00:00:00[America/New_York]",
  "2024-03-20T00:00:00[America/New_York]",
  "2024-03-18T00:00:00[America/New_York]",
]);
// "2024-03-18T00:00:00-04:00[America/New_York]"
```

See [`docs/dst-disambiguation.md`](../../docs/dst-disambiguation.md) for the full explanation, including why `overflow` was deliberately left off the public API.

### Formatting

```typescript
import {
  formatDate,
  formatRelativeDate,
  formatTime,
  formatRelativeTime,
  formatDateTime,
  formatRelativeDateTime,
  formatCalendar,
  formatDateRange,
  formatDateTimeRange,
  formatDateToParts,
  formatDateTimeToParts,
  formatZonedDateTime,
  formatZonedRange,
  formatZonedToParts,
  formatRelativeZoned,
  formatCalendarZoned,
  formatUtc,
  formatRelativeUtc,
  formatCalendarUtc,
  formatUnix,
  formatRelativeUnix,
  formatCalendarUnix,
} from "@burglekitt/gmt";

// Relative to "now" — auto-picks the best unit.
formatRelativeDate("2026-01-15");
// e.g. "3 months ago"

formatRelativeTime("14:30:00", "en-US", { style: "short" });
// e.g. "2 hours ago"

formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", {
  style: "long",
  numeric: "always",
});
// e.g. "17 March, 2026 at 09:00"

// Zoned relative formatting — reference can be a ZonedDateTime, UTC string, or unix epoch.
formatRelativeZoned("2026-03-08T01:00:00-05:00[America/New_York]", "en-US");
// e.g. "tomorrow"

formatRelativeUtc("2024-03-17T14:30:45+00:00[UTC]", "en-US");
// e.g. "2 years ago"

// Unix epoch relative formatting.
formatRelativeUnix(1710685845000, "en-US", { epochUnit: "milliseconds" });
// e.g. "3 years ago"

// roundingMethod ("floor" | "ceil" | "round", default "round") controls how the
// computed distance rounds to the display unit — every formatRelative* function accepts it.
formatRelativeUtc(value, "en-US", { roundingMethod: "floor" });

// formatCalendar* — a relative day label + time-of-day, joined with the
// locale's own connector (never a hardcoded "at"). Distinct from
// formatRelative*'s elapsed-time phrasing ("in 1 day"): this is Moment's
// `.calendar()` — for user-facing schedules, not elapsed-time displays.
// Within ±6 days of "now" (or an explicit `reference`) it stays relative;
// beyond that it falls back to an absolute date + time, no relative wording.
formatCalendar("2026-03-16T14:30:00", "en-US", { reference: "2026-03-15T09:00:00" });
// "tomorrow at 2:30 PM"

formatCalendar("2026-03-08T14:30:00", "en-US", { reference: "2026-03-15T09:00:00" });
// "March 8, 2026 at 2:30 PM" — 7 days out, beyond the threshold

formatCalendarZoned("2026-03-16T14:30:00-04:00[America/New_York]", "de-DE", {
  reference: "2026-03-15T09:00:00-04:00[America/New_York]",
});
// "morgen um 14:30" — locale's own connector, not "at"

// formatDateRange / formatDateTimeRange — plain counterparts of
// formatZonedRange (same parameter order and option shape), for a
// locale-elided range between two timezone-free values.
formatDateRange("2024-02-03", "2024-02-05", "en-US", { dateStyle: "long" });
// "February 3 – 5, 2024"

formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "en-US", {
  dateStyle: "long",
  timeStyle: "short",
});
// "February 3, 2024, 9:00 AM – 5:00 PM"

// formatDateToParts / formatDateTimeToParts / formatZonedToParts return the
// locale-ordered Array<{ type, value }> parts behind the strings above,
// instead of a finished string — GMT's substitute for a token formatter.
// Iterate the array as returned; reassembling parts in a fixed order
// reintroduces the locale-ordering bug formatToParts exists to avoid.
formatDateToParts("2024-03-15", "en-US");
// [{ type: "month", value: "3" }, { type: "literal", value: "/" },
//  { type: "day", value: "15" }, { type: "literal", value: "/" },
//  { type: "year", value: "2024" }]

formatDateToParts("2024-03-15", "fr-FR");
// day comes before month, same locale-order guarantee as formatDate:
// [{ type: "day", value: "15" }, { type: "literal", value: "/" },
//  { type: "month", value: "3" }, { type: "literal", value: "/" },
//  { type: "year", value: "2024" }]

formatZonedToParts("2024-03-15T14:30:00-04:00[America/New_York]", "en-US", {
  timeZoneName: "longOffset",
});
// includes { type: "timeZoneName", value: "GMT-4" }
```

### Named machine formats

Fixed, non-locale-adaptive grammars for interchange with email, HTTP, SQL, and
RFC 3339 consumers — none of these take a `locale` argument, since the
grammar itself is constant (English weekday/month names where the format
mandates them).

```typescript
import {
  formatRfc2822,
  parseRfc2822,
  formatHttp,
  parseHttp,
  formatSql,
  parseSql,
  formatRfc3339,
  parseRfc3339,
} from "@burglekitt/gmt";

// Email `Date:` headers (RFC 5322 / RFC 2822).
formatRfc2822("2024-03-15T14:30:00-04:00[America/New_York]");
// "Fri, 15 Mar 2024 14:30:00 -0400"
parseRfc2822("Fri, 15 Mar 2024 14:30:00 -0400");
// "2024-03-15T14:30:00-04:00[-04:00]"

// HTTP headers (RFC 7231 IMF-fixdate) — Last-Modified, Date, Expires.
formatHttp("2024-03-15T14:30:00Z");
// "Fri, 15 Mar 2024 14:30:00 GMT"
parseHttp("Fri, 15 Mar 2024 14:30:00 GMT");
// "2024-03-15T14:30:00Z"

// ANSI SQL / ODBC datetime literals (DATETIME/TIMESTAMP columns, no tz).
formatSql("2024-03-15T14:30:00");
// "2024-03-15 14:30:00"
parseSql("2024-03-15 14:30:00");
// "2024-03-15T14:30:00"

// Strict RFC 3339 — strips the bracketed IANA zone GMT's own zoned strings
// carry, which RFC 3339 does not permit.
formatRfc3339("2024-03-15T14:30:00-04:00[America/New_York]");
// "2024-03-15T14:30:00-04:00"
parseRfc3339("2024-03-15T14:30:00-04:00");
// "2024-03-15T14:30:00-04:00[-04:00]"
```

### Unix and UTC helpers

```typescript
import { getUnixNow, getUtcNow, convertUnixToPlainDate } from "@burglekitt/gmt";

getUnixNow("milliseconds");
// 1710685845000

getUtcNow();
// "2026-03-18T11:42:33.123Z"

convertUnixToPlainDate(1710685845);
// "2024-03-17"
```

## API Surface

For the complete API listing, see the namespace documentation on GitHub:

- [Duration API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/duration) — ISO 8601 duration parsing, validation, arithmetic, and formatting
- [Plain API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/plain) — timezone-free operations
- [Zoned API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/zoned) — IANA timezone-aware operations
- [Unix API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/unix) — Unix epoch utilities
- [UTC API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/utc) — UTC instant utilities
- [Regex API](https://github.com/burglekitt/gmt/tree/main/packages/gmt/src/regex) — composable regex patterns

## Agent Prompt

When working with `@burglekitt/gmt`, follow these rules:

1. **No `Date` object.** Use `Temporal` exclusively.
2. **String-in, string-out.** Public APIs accept ISO 8601 strings; return strings, numbers, booleans, or arrays.
3. **Invalid input returns a sentinel, never throws.** `""` for strings, `null` for numbers, `false` for booleans, `[]` for arrays.
4. **Wrap all Temporal calls in `try-catch`.** `.from()`, `.add()`, `.since()`, etc. throw `RangeError` on bad input.
5. **Keep `plain/` and `zoned/` strictly separate.** Never mix `PlainDateTime` and `ZonedDateTime`.
6. **Full locale matrix for any locale-aware function.** 17 locales, explicit rows, `hasFullIcu` ternaries where output differs.
7. **Use pre-built mocks for error-path tests.** See `packages/gmt/src/test/mocks`.
8. **JSDoc with `@example` on every public function.** Cover valid, invalid, and edge-case inputs.

## License

MIT — See [LICENSE](../../LICENSE) for details.
