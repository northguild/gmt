# @northguild/gmt

Give Me Temporal.

`@northguild/gmt` is a Temporal-first date and time library with a simple rule set:

- ISO 8601 strings in
- ISO 8601 strings, numbers, booleans, or arrays out
- no `Date`
- plain and zoned operations kept separate

It wraps `@js-temporal/polyfill` behind a smaller, more opinionated API aimed at the cases application code actually hits: arithmetic, comparison, parsing, formatting, unix conversions, timezone conversion, and validation.

Read the [docs](https://gmt-dox.northguild.workers.dev/), or ask us on [Discord](https://discord.gg/TdvQdP3t5a).

**Why GMT:**

- **100% Temporal, Temporal-first.** GMT is built directly on the TC39 `Temporal` standard (via `@js-temporal/polyfill`) — not a custom, homegrown date/time type system like `@internationalized/date`'s own `CalendarDate`/`ZonedDateTime` classes. No `Date` object anywhere, enforced by 3 dedicated lint packages.
- **A full replacement for any and all of them.** Luxon, date-fns, Moment.js, and react-aria's `@internationalized/date` don't have parity with each other — GMT covers the combined capabilities of all four in one library, plus what none of them do alone.
- **~56× more CI test executions than all four competitors combined**: 1,124,040 from 37,468 tests run in all 10 timezones × 3 Node versions, vs. their combined 20,190.
- **~97× more test cases than `@internationalized/date`**: 37,468 vs. 386 — Adobe's own library, run at its own commit.
- **The only one of the five that tests systematically across locales in CI at all.** Zero of the four comparison libraries run a locale-test matrix; GMT mandates all 17 locales on every locale-aware function.
- **The only one that runs its entire suite under a real `TZ` env var across real-world zones.** Luxon and `@internationalized/date` have no CI timezone matrix; date-fns's zone scope is unclear; Moment.js covers 6 zones but not its full suite.
- **Explicit DST disambiguation control on both construction _and_ arithmetic** — a control none of the others expose.
- **The only actively-maintained one that's Temporal-native.** Moment.js is officially in maintenance mode; Luxon, date-fns, and `@internationalized/date` are still active but all still depend on `Date` internally.

## Install

```bash
npm install @northguild/gmt
```

```bash
pnpm add @northguild/gmt
```

## Design Philosophy

GMT enforces a strict input/output contract to keep behavior predictable and auditable:

- **Explicit inputs only**: Public APIs accept clearly defined shapes — ISO 8601 date/time strings, IANA timezone identifiers, or Unix epochs as safe integers or digit strings, in seconds or milliseconds (`{ epochUnit }`). We do not attempt to parse arbitrary or ambiguous date formats.
- **Predictable outputs**: Helpers return normalized values (ISO strings, numbers, booleans, or arrays). Invalid input yields typed fallbacks (`""`, `null`, `false` or `[]`) instead of throwing.
- **No fuzzy parsing**: Avoid "throw everything at the wall" patterns found in permissive libraries. If you need permissive parsing, perform it outside of `@northguild/gmt` and then canonicalize to the strict shapes before calling into gmt.
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

Every function is exercised across **17 locales** and a full IANA timezone matrix. The CI pipeline runs the complete suite in **30 environments** — 3 Node versions (22, 24, 26) × 10 timezones spanning every UTC offset band from Pacific/Niue (−11:00) to Pacific/Apia (+14:00):

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

**Result:** 37,468 tests across 681 files that exercise real behavior differences without redundant permutations. They run in CI as 1,124,040 executions — every one of them × 3 Node versions × 10 timezones.

## How GMT is tested, vs. the libraries it targets

GMT is measured directly against react-aria's **`@internationalized/date`**, **Luxon**, **date-fns**, and **Moment.js** — the same four libraries compared below. All numbers were verified **2026-08-22** against the exact package versions/commits below — nothing is estimated. Re-verify before citing these numbers elsewhere; library surfaces and CI configs move.

| Library                   | Version tested                          |
| ------------------------- | --------------------------------------- |
| GMT (`@northguild/gmt`)   | 1.14.2                                  |
| `@internationalized/date` | 3.12.3 (`adobe/react-spectrum@5d191ab`) |
| Luxon                     | 3.7.2 (`moment/luxon@f427515`)          |
| date-fns                  | 4.4.0 (`date-fns/date-fns@a0a3922`)     |
| Moment.js                 | 2.30.1 (`moment/moment@cf524af`)        |

| Metric                          | GMT                                                | `@internationalized/date`      | Luxon                                | date-fns                                  | Moment.js                        |
| ------------------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------------ | ----------------------------------------- | -------------------------------- |
| Test files                      | 681                                                | 6                              | 58 / 60<br>(2 didn't run<br>locally) | 256                                       | 191<br>(52 core +<br>139 locale) |
| Individual test cases           | **37,468**                                         | 386                            | 1,222                                | 3,213                                     | 3,901                            |
| Effective CI test<br>executions | **1,124,040**<br>(37,468 × 3 Node<br>× 10 timezones) | 386<br>(×1 Node)               | 4,888<br>(1,222 × 4 Node)            | 3,213<br>(×1 Node)                        | 11,703<br>(3,901 × 3 Node)       |
| CI Node.js matrix               | 22, 24, 26                                         | n/a — tests<br>React 16–canary | 20, 22, 24, 25                       | not explicit<br>(`node = "latest"`)       | LTS, LTS-1,<br>latest            |
| CI timezone matrix              | **10 zones × 3**<br>**Node, full suite**           | none found                     | none found                           | dedicated workflow,<br>zone scope unclear | 6 zones,<br>partial suite only   |
| Locale test matrix              | **17 locales**,<br>every locale fn                 | none found                     | none found                           | none found                                | none found                       |
| Real-browser CI                 | not yet                                            | yes (Playwright)               | not found                            | yes (Playwright)                          | not found                        |
| Maintenance                     | active                                             | active                         | active                               | active                                    | **maintenance<br>mode**          |

<sub>Methodology: "Test files" and the CI/maintenance rows come from each project's public CI configuration and repository file listing. "Individual test cases" for GMT, Luxon, date-fns, and Moment.js were obtained by actually cloning the repo at the commit above, installing dependencies, running the project's own test command (`vitest run` / `jest` / `node scripts/test.js`), and reading that runner's own final summary — not grepped from source. `@internationalized/date` was run by cloning `adobe/react-spectrum` at `5d191ab`, installing dependencies, and executing `npx jest packages/@internationalized/date/tests/`, yielding 386 passing tests. Luxon (39 failures) and date-fns (46 failures) had environment-dependent local failures that don't affect the total count: Luxon's suite assumes its CI container's local time zone is `America/New_York`; date-fns's experimental native-`Temporal` code path needs a global `Temporal` Node doesn't yet provide natively. Moment.js passed cleanly (0 failed) on Node 24. Sources: [GMT](https://github.com/northguild/gmt/blob/main/.github/workflows/ci.yml) · [`@internationalized/date`](https://github.com/adobe/react-spectrum/blob/main/.circleci/config.yml) · [Luxon](https://github.com/moment/luxon/blob/master/.github/workflows/test.yml) · [date-fns](https://github.com/date-fns/date-fns/tree/main/.github/workflows) · [Moment.js](https://github.com/moment/moment/tree/develop/.github/workflows).</sub>

### Feature parity

GMT has **full functional parity** with all four comparison libraries, capability for capability — with several areas where GMT goes further than any of them.

| Capability                                                                                   | Status                       | Also has it                                                              |
| -------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| Duration type<br>(ISO 8601 parse/format/arithmetic)                                          | ✅ Done                      | Luxon `Duration`                                                         |
| Interval/range math<br>(contains, overlap, union,<br>intersection, split, set ops)           | ✅ Done                      | Luxon `Interval`,<br>date-fns `areIntervalsOverlapping`                  |
| DST disambiguation control<br>on construction _and_ arithmetic                               | ✅ Done — **differentiator** | None of the others expose<br>this on arithmetic                          |
| Locale-aware calendar helpers<br>(weekend, week start/end, day-of-week)                      | ✅ Done                      | `@internationalized/date`                                                |
| Business-day arithmetic with<br>holiday calendars and roll conventions,<br>clamp/closest, time rounding    | ✅ Done                      | `temporal-kit` (arithmetic only)                                         |
| Interval rounding-out<br>(boundary count, from-duration)                                     | ✅ Done                      | Luxon                                                                    |
| Locale calendar metadata<br>(names, `hasDST`)                                                | ✅ Done                      | Luxon `Info`                                                             |
| Overlap-day count, relative<br>rounding, DST transitions, hours-in-day                       | ✅ Done                      | date-fns, `@internationalized/date`                                      |
| Field setters, token-pattern<br>parsing, named machine formats,<br>calendar-style formatting | ✅ Done                      | Luxon `.set()`,<br>`toRFC2822`/`toHTTP`/`toSQL`,<br>Moment `.calendar()` |
| Non-Gregorian calendar systems<br>(conversion + calendar-aware<br>interval/duration math)    | ✅ Done                      | `@internationalized/date`'s<br>`toCalendar`                              |

### Where GMT stands alone

Specific, sourced claims — not a repeat of the metrics above.

| Claim                                                                                                                                         | The others                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Only GMT runs its **entire** suite in CI<br>under a real `TZ` env var across 10<br>real-world zones × 3 Node versions<br>(30 full-suite runs) | Luxon/`@internationalized/date`: no<br>CI timezone matrix. date-fns: zone<br>scope unclear. Moment.js: 6 zones,<br>partial suite only |
| Only GMT enforces a mandatory<br>17-locale test matrix on every<br>locale-aware function                                                      | No CI-level or systematic<br>locale-matrix testing found<br>in any of the four                                                        |
| Only GMT exposes explicit DST<br>disambiguation control on both<br>construction _and_ arithmetic                                              | Luxon's docs call this explicitly<br>undefined; `@internationalized/date`<br>only covers construction, not arithmetic                 |
| Only GMT is Temporal-native with<br>zero `Date` usage, enforced by<br>3 dedicated lint packages                                               | Luxon, date-fns, and Moment.js all<br>still wrap or depend on `Date` internally                                                       |
| GMT's effective CI test<br>executions exceed all four<br>competitors **combined**<br>by ~56×                                                  | 1,124,040 vs. 386 + 4,888 + 3,213<br>+ 11,703 = 20,190                                                                                  |

## Package Layout

Every public function, type and regex is a flat named export of the package root, beside
`Temporal`, `Intl` and `toTemporalInstant` re-exported from `@js-temporal/polyfill`. There are no
namespace objects: a namespace is a subpath.

```typescript
import { addDate, getNow, formatRelativeZoned, Temporal } from "@northguild/gmt";
```

The fourteen namespace subpaths:

- `@northguild/gmt/calendar`: ISO week and ordinal dates, quarter and fiscal periods, zone-aware bucketing, business calendars with holiday sets and roll conventions, and operating hours with open-time SLA arithmetic
- `@northguild/gmt/duration`: ISO 8601 duration string parsing, validation, and arithmetic
- `@northguild/gmt/instant`: the instant-plus-offset pair, and explicit resolution of zoneless local wall times
- `@northguild/gmt/interval`: half-open `[start, end)` interval algebra over instants — overlap, intersect, clamp, merge, subtract, split, sum
- `@northguild/gmt/plain`: timezone-free helpers
- `@northguild/gmt/precision`: nanosecond (`bigint`) instants, their JSON bridge, storage truncation, and foreign epoch bridges
- `@northguild/gmt/span`: elapsed and wall-clock durations between two timestamps, as raw numbers
- `@northguild/gmt/transport`: transit legs as exact elapsed time, arrivals rendered where they land, and dwell measured in local calendar days
- `@northguild/gmt/intermodal`: free time, demurrage and detention counted in the terminal's local days, with the charged dates behind every count, and the invoice, dispute and resolution deadline chain with every window a caller parameter
- `@northguild/gmt/zoned`: timezone-aware helpers
- `@northguild/gmt/unix`: Unix epoch (seconds or milliseconds) helpers
- `@northguild/gmt/utc`: UTC instant helpers
- `@northguild/gmt/regex`: low-level regex building blocks
- `@northguild/gmt/types`: the shared option and unit types

Every namespace subpath except `types` also re-exports `Temporal`, `Intl` and `toTemporalInstant`, so `import { Temporal, addZoned } from "@northguild/gmt/zoned"` needs no second import.

Every namespace except `regex` and `types` also exposes its modules as subpaths,
`@northguild/gmt/<namespace>/<module>`:

```typescript
import { getZonedNow } from "@northguild/gmt/zoned";
import { addDateTime, diffDate } from "@northguild/gmt/plain/calculate";
import type { BusinessCalendar } from "@northguild/gmt/types";
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
} from "@northguild/gmt";

addDate("2026-01-01", { days: 90 });
// "2026-04-01"

addBusinessDays("2024-03-15", 1);
// "2024-03-18" (skips weekend)

subtractBusinessDays("2024-03-18", 1);
// "2024-03-15" (skips weekend)

diffDateTime("2024-03-17T12:00:00", "2024-03-17T12:30:00", "minutes");
// 30

areDatesEqual("2026-03-17", "2026-03-17T09:00:00");
// true

isBeforeDateTime("2026-03-17T09:00:00", "2026-03-17T10:00:00");
// true
```

`add*`/`subtract*` accept an optional `overflow` (`"constrain"` (default) | `"reject"`) to control out-of-range results (e.g. adding a month to Jan 31) — except `addTime`/`subtractTime`, which take no options argument because a clock time wraps (`addTime("23:00:00", { hours: 2 })` is `"01:00:00"`), as Temporal's `PlainTime#add` does — and `diff*` accept optional `smallestUnit`/`roundingIncrement`/`roundingMode` to round the computed difference:

```typescript
import { addDate, diffDate } from "@northguild/gmt";

addDate("2024-01-31", { months: 1 }, { overflow: "reject" });
// "" — Feb 31 doesn't exist and overflow: "reject" refuses to clamp it

addDate("2024-02-29", { years: 1 });
// "2025-02-28" — "constrain" (the default) clamps to the last valid day, as Temporal does

diffDate("2023-01-01", "2023-01-10", "weeks", {
  smallestUnit: "week",
  roundingMode: "halfExpand",
});
// 1
```

`setDate`/`setDateTime`/`setTime`/`setZoned`/`setUnix`/`setUtc` set one or more fields on a value in a single atomic `.with()`-based call — the safe alternative to composing `add*` calls field-by-field, which resolves each field's overflow independently and can silently diverge on multi-field updates:

```typescript
import { setDate, setZoned } from "@northguild/gmt";

setDate("2024-01-31", { month: 2 });
// "2024-02-29" (constrain, the default, clamps to the last valid day)

setZoned(
  "2024-11-03T01:45:00-05:00[America/New_York]",
  { minute: 0 },
  { disambiguation: "reject" },
);
// "2024-11-03T01:00:00-05:00[America/New_York]" — offset defaults to "prefer", as Temporal's
// ZonedDateTime#with does: the source's -05:00 is still valid, so it is kept

setZoned(
  "2024-11-03T01:45:00-05:00[America/New_York]",
  { minute: 0 },
  { disambiguation: "reject", offset: "ignore" },
);
// "" — offset "ignore" re-resolves the repeated 01:00, and "reject" fires on the fall-back overlap
```

`setZoned`/`setUnix` also accept `disambiguation` and `offset` for DST gap/overlap control (`setUtc` takes only `overflow`: a UTC wall clock is never ambiguous) — see [DST Disambiguation](../../docs/dst-disambiguation.md).

`cycleDate`/`cycleDateTime`/`cycleTime`/`cycleZoned` adjust a single field and **wrap** at that field's own min/max instead of carrying into the next larger field — the datepicker-segment-editing primitive `add*` can't express, since overflowing into the next field is exactly what `add*` is for:

```typescript
import { addDate, cycleDate, cycleZoned } from "@northguild/gmt";

cycleDate("2024-12-15", "month", 1);
// "2024-01-15" — stays in the same year

addDate("2024-12-15", { months: 1 });
// "2025-01-15" — addDate correctly overflows into the next year instead

cycleZoned("2024-03-10T01:30:00-06:00[America/Chicago]", "hour", 1);
// "2024-03-10T03:30:00-05:00[America/Chicago]" — the cycled hour lands in a spring-forward
// gap; disambiguation ("compatible" by default) resolves it the same way setZoned does
```

`cycleZoned` also accepts `disambiguation` and `offset` (default `offset: "prefer"`) for the same DST gap/overlap control as `setZoned` — see [DST Disambiguation](../../docs/dst-disambiguation.md). `options.round` on any of the four steps to the next multiple of `amount` rather than rounding to the nearest one, matching `@internationalized/date`'s `CycleOptions.round`.

`isWeekend`/`isZonedWeekend` check locale-specific weekend days (via `Intl.Locale#getWeekInfo()`, falling back to `weekInfo`) rather than assuming Saturday/Sunday:

```typescript
import { isWeekend, isZonedWeekend } from "@northguild/gmt";

isWeekend("2024-02-03", "en-US");
// true (Saturday, en-US weekend is Sat/Sun)

isWeekend("2024-02-03", "he-IL");
// true (Saturday is also part of he-IL's Fri/Sat weekend)

isZonedWeekend("2024-02-04T10:00:00+02:00[Asia/Jerusalem]", "he-IL");
// false (Sunday isn't part of he-IL's weekend)
```

`isBusinessDay` is the complement to locale-aware `isWeekend`, and shares its weekend rule with `addBusinessDays`/`subtractBusinessDays`. Called with one argument it uses fixed ISO Monday–Friday business days (Mon=1 … Fri=5), locale-agnostic and with no holidays; pass a `BusinessCalendar` to state the weekend and holidays yourself:

```typescript
import { isBusinessDay } from "@northguild/gmt";

isBusinessDay("2024-02-05");
// true (Monday)

isBusinessDay("2024-02-10");
// false (Saturday)

isBusinessDay("2024-07-04", {
  weekend: [6, 7],
  holidays: ["2024-07-04"],
  timeZone: "America/New_York",
});
// false (a holiday, though it's a Thursday)
```

### Business calendars and roll conventions

A `BusinessCalendar` is `{ weekend: number[], holidays: string[], timeZone: string }`. The weekend is explicit ISO weekday numbers because Saturday–Sunday is not universal — much of the Middle East is Friday–Saturday, and some markets keep a one-day weekend. Holidays are yours to supply: GMT bundles no holiday table on the default import path, because holiday data is jurisdictional and changes annually, sometimes with days of notice. `timeZone` records which locality the calendar describes; the business-day functions take and return local dates and never read it, so a caller holding an instant reduces it with `floorToZone` first.

`isBusinessDay`, `addBusinessDays` and `subtractBusinessDays` all take a calendar as an optional trailing argument. The rest of the family requires one — there is no default weekend to fall back on:

```typescript
import {
  businessDaysBetween,
  nextBusinessDay,
  previousBusinessDay,
  rollDate,
  mergeCalendars,
  isValidBusinessCalendar,
} from "@northguild/gmt";

const nyse = {
  weekend: [6, 7],
  holidays: ["2024-05-31", "2024-07-04"],
  timeZone: "America/New_York",
};

businessDaysBetween("2024-07-01", "2024-07-05", nyse);
// 3 — start exclusive, end inclusive, and 4 July is a holiday

nextBusinessDay("2024-07-03", nyse);
// "2024-07-05" — strictly after, skipping the holiday

previousBusinessDay("2024-07-05", nyse);
// "2024-07-03"
```

`rollDate` moves a date onto a working day by an explicit convention — `following`, `modifiedFollowing`, `preceding`, `modifiedPreceding`, `endOfMonth` or `none`. `following` and `preceding` are on-or-after and on-or-before, so they leave a working day alone; `nextBusinessDay`/`previousBusinessDay` are the strict neighbours:

```typescript
rollDate("2024-05-31", "following", nyse);
// "2024-06-03" — forward past the weekend

rollDate("2024-05-31", "modifiedFollowing", nyse);
// "2024-05-30" — backward instead, because forward leaves May

rollDate("2024-03-15", "endOfMonth", nyse);
// "2024-03-29" — March's last working day; March ends on a Sunday

rollDate("2024-06-01", "none", nyse);
// "2024-06-01" — unadjusted, Saturday or not
```

`mergeCalendars` composes jurisdictions: weekend rules and holidays union, so a date survives only if it is a working day in **every** input. That is the two-currency intersection FX settlement needs, and the two-port one an intermodal move needs:

```typescript
const london = { weekend: [6, 7], holidays: ["2024-05-06"], timeZone: "Europe/London" };

const both = mergeCalendars([nyse, london]);
// { weekend: [6, 7], holidays: ["2024-05-06", "2024-05-31", "2024-07-04"], timeZone: "America/New_York" }
// timeZone is the first calendar's; the merged set spans localities that may disagree

isBusinessDay("2024-05-06", both);
// false — a UK holiday closes the merged calendar too

mergeCalendars([]);
// null
```

`isValidBusinessCalendar` and `isValidRollConvention` narrow a candidate, so a misconfigured calendar or contract term can be told apart from bad date input when a function returns its sentinel.

`isRelativeDay`/`isThisUnit`/`isPast`/`isFuture` are now-relative predicates — `isRelativeDay` subsumes `isToday`/`isYesterday`/`isTomorrow`, `isThisUnit` subsumes `isThisWeek`/`isThisMonth`/`isThisYear`. They compare against `getToday()`, so they depend on the **system clock and system timeZone**; the zoned variants (`isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture`) resolve "today"/"now" in the value's own timeZone instead, for deterministic results regardless of the host machine's timeZone:

```typescript
import { isRelativeDay, isThisUnit, isPast, isFuture } from "@northguild/gmt";

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
import { nextWeekday, previousWeekday } from "@northguild/gmt";

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
import { isZonedRelativeDay, isZonedPast } from "@northguild/gmt";

isZonedRelativeDay("2024-03-15T10:00:00-04:00[America/New_York]", 0);
// "today" resolved in America/New_York, not the host's system timeZone

isZonedPast("2020-01-01T00:00:00Z[UTC]");
// true — compares the exact instant, not just the calendar day
```

`clampDate` restricts a date to a range, and `closestDateTo` finds the nearest candidate by calendar distance:

```typescript
import { clampDate, closestDateTo } from "@northguild/gmt";

clampDate("2024-02-01", "2024-03-01", "2024-03-31");
// "2024-03-01"

closestDateTo("2024-03-15", ["2024-03-01", "2024-03-20", "2024-03-18"]);
// "2024-03-18"
```

`getLocaleStartOfWeek`/`getLocaleEndOfWeek` (and their zoned equivalents) compute week boundaries from the locale's first day of week, instead of an ISO-Monday default:

```typescript
import { getLocaleStartOfWeek, getLocaleEndOfWeek } from "@northguild/gmt";

getLocaleStartOfWeek("2024-02-29", "en-US");
// "2024-02-25" (Sunday, en-US weeks start Sunday)

getLocaleStartOfWeek("2024-02-29", "fr-FR");
// "2024-02-26" (Monday, fr-FR weeks start Monday)

getLocaleEndOfWeek("2024-02-29", "en-US");
// "2024-03-02" (Saturday)
```

`getLocaleDayOfWeek`/`getLocaleZonedDayOfWeek` return a locale-relative day-of-week index (0 = first day of the locale's week):

```typescript
import { getLocaleDayOfWeek, getLocaleZonedDayOfWeek } from "@northguild/gmt";

getLocaleDayOfWeek("2024-02-25", "en-US");
// 0 (Sunday = first day of en-US week)

getLocaleDayOfWeek("2024-02-26", "fr-FR");
// 0 (Monday = first day of fr-FR week)

getLocaleDayOfWeek("2024-02-24", "ar-EG");
// 0 (Saturday = first day of ar-EG week)

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
} from "@northguild/gmt";

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
} from "@northguild/gmt";

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

`convertDateToCalendar` expresses a date in another calendar system. GMT writes the standard form, exactly what `Temporal.PlainDate.prototype.toString()` writes: the ISO 8601 date, then an RFC 9557 `[u-ca=<id>]` annotation naming the calendar. The digits stay ISO. The annotation says which calendar the date is presented and computed in (RFC 9557 §3.3), so the string means the same date to GMT, to Temporal and to any other RFC 9557 parser.

```typescript
import { convertDateToCalendar } from "@northguild/gmt";

convertDateToCalendar("2024-10-03", "hebrew");
// "2024-10-03[u-ca=hebrew]" — Rosh Hashanah 5785, written as its ISO date

convertDateToCalendar("2024-10-03[u-ca=hebrew]", "iso8601");
// "2024-10-03" — iso8601 writes no annotation

convertDateToCalendar("2024-10-03", "gregory");
// "2024-10-03[u-ca=gregory]" — gregory is its own calendar, so it is annotated

convertDateToCalendar("invalid", "hebrew");
// ""
```

`CalendarSystem` is `"iso8601" | "gregory" | "hebrew" | "islamic-civil" | "islamic-tbla" | "islamic-umalqura" | "japanese" | "buddhist" | "roc" | "persian" | "indian" | "ethiopic" | "ethioaa" | "coptic"`: the canonical BCP 47 / CLDR `calendar.xml` ids Temporal uses, in the annotation and as function arguments. An alias or another letter case is canonicalized the way Temporal's `withCalendar` does it (`"ethiopic-amete-alem"` writes `[u-ca=ethioaa]`, `[u-ca=HEBREW]` reads as `hebrew`), and the canonical id is always written. `gregorian`, `taiwan` and `islamic-tabular` are not calendar ids, so they return the sentinel. `chinese`, `dangi`, `islamic` and `islamic-rgsa` are not supported.

Every calendar-accepting function reads annotations the way `Temporal.PlainDate.from` / `Temporal.ZonedDateTime.from` read them. The critical flag is accepted and not written back (`"2024-10-03[!u-ca=hebrew]"` converts to `"2024-10-03[u-ca=hebrew]"`), and an unknown critical annotation is rejected. `;era=` is not RFC 9557 syntax and is rejected. A year is four digits, or a sign and six (`"+275760-09-13[u-ca=hebrew]"`), across Temporal's whole range, `-271821-04-19` to `+275760-09-13`.

**Calendar fields are read values, never string content.** The Hebrew year 5785, the Japanese era `reiwa` and year 6, and the Umm al-Qura day number are all properties of the date, so GMT never puts them in a string. No standard defines a machine-readable date string with calendar-native digits, and such a string would be ambiguous: `5785-01-01[u-ca=hebrew]` is also a valid RFC 9557 string for ISO year 5785. When you need a field for display, format the date with `Intl.DateTimeFormat` and its `calendar` option, or read it from Temporal, which every GMT entry point re-exports:

```typescript
import { Temporal } from "@northguild/gmt";

Temporal.PlainDate.from("2024-10-03[u-ca=hebrew]").year; // 5785
Temporal.PlainDate.from("2024-10-03[u-ca=japanese]").eraYear; // 6
```

The three Islamic variants are different calendars, not spellings of one. On ISO 2020-02-24, `islamic-civil` (Friday epoch) reads day 29 of month 6 of 1441, `islamic-tbla` (the same arithmetic cycle with a Thursday epoch) reads day 1 of month 7, and `islamic-umalqura` (the Saudi civil calendar, from Umm al-Qura University's published tables) reads day 30 of month 6. Month arithmetic follows each calendar's own months, so the same `+1 month` lands on different ISO dates:

```typescript
import { addDate } from "@northguild/gmt";

addDate("2020-02-24[u-ca=islamic-umalqura]", { months: 1 });
// "2020-03-24[u-ca=islamic-umalqura]"

addDate("2020-02-24[u-ca=islamic-tbla]", { months: 1 });
// "2020-03-25[u-ca=islamic-tbla]"
```

`ethiopic` and `coptic` compute in `ethioaa`. The three share months, days and arithmetic and differ only by a constant year offset, and `@js-temporal/polyfill` 0.5.1 throws reading `ethiopic` and `coptic` fields under ICU 78 or later (`Temporal.PlainDate.from("2024-10-03[u-ca=ethiopic]").year` throws there). GMT's results are the same either way, and only the written id differs. Where the polyfill or the runtime's ICU computes a calendar wrongly (Buddhist before 1582, Hebrew years ≤ 0, Indian dates before ISO year 1, dates near either range limit), GMT's arithmetic computes the specified answer instead. Each correction probes the runtime once and stays inactive where the runtime is already right.

#### Calendar-aware interval and duration arithmetic

A calendar-annotated date feeds `addDate`/`subtractDate`/`diffDate`/`diffDateAsDuration` and every `Date`-suffixed `plain/interval/*` function (`intervalContainsDate`, `intervalCountDate`, `splitIntervalByUnitDate`, and the rest). Calendar units ("add 1 month") resolve in the value's own calendar:

```typescript
import { addDate, diffDate, diffDateAsDuration, durationAs, intervalCountDate } from "@northguild/gmt";

addDate("2024-02-24[u-ca=hebrew]", { months: 1 });
// "2024-03-25[u-ca=hebrew]" — 15 Adar I 5784 to 15 Adar II; addDate("2024-02-24", { months: 1 }) is "2024-03-24"

intervalCountDate("2023-09-16[u-ca=hebrew]", "2024-10-03[u-ca=hebrew]", "month");
// 13 — Hebrew leap year 5784 has 13 months; the same ISO span touches 14 ISO months

diffDate("2024-03-11[u-ca=hebrew]", "2024-04-10[u-ca=hebrew]", "months");
// 1 — 1 Adar II to 2 Nisan; the bare ISO dates are 0 whole months apart

diffDateAsDuration("2024-08-31[u-ca=buddhist]", "2024-09-30[u-ca=buddhist]", "months");
// "P30D" — not "P1M": a month counts only once the end reaches the same day of the next month

durationAs("P1Y", "days", { relativeTo: "2023-09-16[u-ca=hebrew]" });
// 383 — Hebrew leap year 5784; relativeTo "2023-09-16" gives 366
```

Month and year differences follow Temporal's `NonISODateSurpasses` in every calendar, so a span from a month's last day into a shorter month is days, not a month. This matches the ISO calendar (`diffDateAsDuration("2024-08-31", "2024-09-30", "months")` is `"P30D"`), and applies to `diffDate*`, `intervalLength*`, `intervalCount*` and `diffZoned*` alike.

`utc/` reads a UTC string as `Temporal.Instant.from` does, so a `[u-ca=...]` annotation is ignored there: `isValidUtc("2024-01-01T00:00:00Z[u-ca=hebrew]")` is `true`. `duration/`'s `relativeTo` reads a calendar-annotated string as Temporal's `ParseTemporalRelativeToString` does: zoned when it carries a time zone annotation, otherwise a date.

Two values that name different calendars follow Temporal's `CalendarEquals`. A bare ISO string names `iso8601`.

- **Differences return the sentinel** on a mismatch, as Temporal's `until` throws: `diffDate`, `diffDateAsDuration`, `intervalCountDate`, `intervalLengthDate`, `splitIntervalByUnitDate` and `intervalOverlappingDaysDate`.
- **Ordering accepts mixed calendars**, as `Temporal.PlainDate.compare` has no calendar check: `intervalContainsDate`, `intervalsOverlapDate`, `intervalAbutsDate`, `intervalEngulfsDate` and `isValidDateInterval`.
- **Functions that return a date value** (`intervalUnionDate`, `intervalIntersectionDate`, `intervalDifferenceDate`, `intervalXorDate`, `intervalXorAllDate`, `mergeIntervalsDate`, `intervalDivideEquallyDate`, `intervalSplitAtDate`) require one shared calendar and return `null`/`[]` on a mismatch, because no calendar can be chosen for the output.

```typescript
intervalCountDate("2023-09-16[u-ca=hebrew]", "2024-10-03", "month");
// null — hebrew and iso8601

intervalContainsDate("2023-09-16[u-ca=hebrew]", "2024-10-03", "2024-01-01[u-ca=roc]");
// true — ordering compares the ISO dates
```

#### Calendar-aware zoned datetimes

A calendar-annotated `ZonedDateTime` string is the RFC 9557 form `Temporal.ZonedDateTime.prototype.toString()` writes: the time zone annotation first, then the calendar (RFC 9557 §4.1):

```
<date>T<time><offset>[<timeZone>][u-ca=<id>]

2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]
2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]
```

`convertZonedToCalendar` produces it, and `isValidCalendarZonedDateTime` validates it. A calendar annotation before the zone is not RFC 9557 and returns the sentinel:

```typescript
import { addZoned, convertZonedToCalendar } from "@northguild/gmt";

convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew");
// "2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"

convertZonedToCalendar("2024-10-03T14:30:45-04:00[u-ca=hebrew][America/New_York]", "iso8601");
// "" — the calendar annotation must follow the zone

addZoned("2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]", { months: 1 });
// "2024-03-25T14:30:00-04:00[America/New_York][u-ca=hebrew]"
// Adar I -> Adar II AND EST -> EDT, resolved in one call. No ordering of a plain/ calendar
// operation and a zoned/ conversion produces this: do the calendar step first and DST is
// applied to an already-resolved wall time; do the zoned step first and there is no calendar
// left to step in.
```

Scope: `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, `convertZonedToCalendar`, and the `zoned/interval/*` family. Everything else in `zoned/`, and `isValidZonedDateTime`, accepts `[u-ca=iso8601]` and rejects any other calendar, so a function that has not opted in fails closed rather than silently answering in the wrong calendar. `addZonedBusinessDays`/`subtractZonedBusinessDays` stay out by design: day-of-week is ISO-fixed in every supported calendar, so a tag would change nothing while implying it might.

Mixed-calendar endpoints follow the same rules as `plain/`. Ordering functions (`intervalContainsZoned`, `intervalsOverlapZoned`, `intervalAbutsZoned`, `intervalEngulfsZoned`, `isValidCalendarZonedInterval`) accept them. The value-returning set operations require one shared calendar. Differences (`diffZoned`, `diffZonedAsDuration`, `intervalCountZoned`, `intervalLengthZoned`, `splitIntervalByUnitZoned`, `intervalOverlappingDaysZoned`) return their sentinel on a mismatch for every unit, including hours, as `Temporal.ZonedDateTime.prototype.until` throws across calendars.

**Migrating strings written before 1.16.0.** Earlier releases wrote the calendar's own year, month and day (`"5785-01-01[u-ca=hebrew]"` for ISO 2024-10-03), a `;era=` suffix, the zoned calendar annotation before the zone, and the ids `gregorian`, `taiwan`, `islamic-tabular` and `ethiopic-amete-alem` (now `iso8601`, `roc`, `islamic-tbla` and `ethioaa`). No converter exists: most old strings are also valid RFC 9557 strings for a different ISO date, and the two readings cannot be told apart. `convertDateToCalendar("5785-01-01[u-ca=hebrew]", "iso8601")` returns `"5785-01-01"`. Regenerate each stored value from its ISO date with `convertDateToCalendar` or `convertZonedToCalendar`.

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
} from "@northguild/gmt";

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

> **One boundary model.** Every interval function in this section (`intervalsOverlapDate`, `intervalDifferenceUtc`, …) reads an interval as half-open, `[start, end)`: `start` is inside and `end` is not, as in the `interval/` namespace described under [Interval algebra](#interval-algebra) (SQL:2011 closed-open `PERIOD`, RFC 5545's non-inclusive `DTEND`, EWD831). Touching intervals share no instant, so they abut rather than overlap, and no function steps an endpoint by one unit. For a `Date` interval that means `end` is the first day **after** the period: pass `"2024-07-01"`, not `"2024-06-30"`, for the first half of 2024 (`addDate(lastDay, { days: 1 })`). Before 1.16.0 most positional families read intervals as closed `[start, end]`.

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
} from "@northguild/gmt";

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

- 3-arg: `intervalContains(start, end, point)` — true when `start <= point < end`
- 4-arg: `intervalContains(start, end, innerStart, innerEnd)` — true when the inner interval lies within the outer one and overlaps it, so an inner interval may share the outer `end`, but an empty inner interval at `end` is not contained

```typescript
import {
  intervalContainsDate,
  intervalContainsTime,
  intervalContainsDateTime,
  intervalContainsUtc,
  intervalContainsUnix,
  intervalContainsZoned,
} from "@northguild/gmt";

// Point-in-interval (3-arg)
intervalContainsDate("2024-01-01", "2024-12-31", "2024-06-15");
// true

intervalContainsDate("2024-01-01", "2024-12-31", "2024-12-31");
// false (the end is excluded)

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

All interval containment checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalsOverlap*` checks whether two intervals share any instant. Returns `false` when they are disjoint. Intervals that touch (one's end equals the other's start) share no instant, so they do **not** overlap, exactly as `intervalsOverlap` in `interval/`:

```typescript
import {
  intervalsOverlapDate,
  intervalsOverlapTime,
  intervalsOverlapDateTime,
  intervalsOverlapUtc,
  intervalsOverlapUnix,
  intervalsOverlapZoned,
} from "@northguild/gmt";

intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-04-01", "2024-12-31");
// true

intervalsOverlapDate("2024-01-01", "2024-06-30", "2024-06-30", "2024-12-31");
// false (touching — 2024-06-30 is outside the first interval)

intervalsOverlapUnix(0, 1700000000, 1000000, 2000000);
// true

intervalsOverlapUtc(
  "2024-01-01T09:00:00Z",
  "2024-01-01T17:00:00Z",
  "2024-01-01T17:00:00Z",
  "2024-01-01T18:00:00Z",
);
// false (touching at 17:00)
```

All overlap checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalIntersection*` returns the overlapping span of two intervals, or `null` when they do not overlap. Touching intervals share no instant, so their intersection is `null`:

```typescript
import {
  intervalIntersectionDate,
  intervalIntersectionTime,
  intervalIntersectionDateTime,
  intervalIntersectionUtc,
  intervalIntersectionUnix,
  intervalIntersectionZoned,
} from "@northguild/gmt";

intervalIntersectionDate(
  "2024-01-01",
  "2024-07-01",
  "2024-04-01",
  "2025-01-01",
);
// { start: "2024-04-01", end: "2024-07-01" }

intervalIntersectionDate(
  "2024-01-01",
  "2024-07-01",
  "2024-07-01",
  "2025-01-01",
);
// null (touching, no shared day)

intervalIntersectionUnix(0, 1700000000, 1000000, 2000000);
// { start: 1000000, end: 2000000 } (B lies inside A)

intervalIntersectionUtc(
  "2024-01-01T00:00:00Z",
  "2024-07-01T00:00:00Z",
  "2024-04-01T00:00:00Z",
  "2025-01-01T00:00:00Z",
);
// { start: "2024-04-01T00:00:00Z", end: "2024-07-01T00:00:00Z" }
```

All intersection functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalOverlappingDays*` returns how many distinct calendar dates two intervals share — the numeric counterpart to `intervalIntersection*`'s span. It counts the calendar dates that hold at least one instant of the half-open intersection `[max(aStart, bStart), min(aEnd, bEnd))`, so an empty intersection counts `0`: `intervalOverlappingDaysDate("2024-01-01", "2024-01-02", "2024-01-01", "2024-01-02")` is `1`, and touching intervals are `0`. There is no `Time` variant — `PlainTime` has no calendar, so a day count is undefined for it:

```typescript
import {
  intervalOverlappingDaysDate,
  intervalOverlappingDaysDateTime,
  intervalOverlappingDaysUtc,
  intervalOverlappingDaysUnix,
  intervalOverlappingDaysZoned,
} from "@northguild/gmt";

intervalOverlappingDaysDate(
  "2024-01-01",
  "2024-07-01",
  "2024-04-01",
  "2025-01-01",
);
// 91 (2024-04-01 through 2024-06-30)

intervalOverlappingDaysDate(
  "2024-01-01",
  "2024-07-01",
  "2024-07-01",
  "2025-01-01",
);
// 0 (touching, no shared date)

intervalOverlappingDaysUtc(
  "2024-01-17T12:00:00Z",
  "2024-01-19T00:00:00Z",
  "2024-01-10T00:00:00Z",
  "2024-01-18T06:00:00Z",
);
// 2 (18 hours of overlap touch 17 and 18 January)

intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000);
// 1 (the intersection [86400000, 172800000) is 1970-01-02 in UTC)
```

Returns `0` when the intervals do not overlap (a well-defined answer, not invalid input) and `null` on invalid input, including an inverted interval (`start > end`). `intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` count days in `aStart`'s time zone (`intervalOverlappingDaysUnix` defaults to UTC; pass `{ timeZone }`, or `"local"` for the system zone) — the same rule `intervalCountZoned`/`intervalCountUnix` use — so `intervalOverlappingDaysZoned` is **not commutative** when the two intervals carry different zones: swapping the arguments can change the answer. Both count the distinct local dates the overlap touches, so a date the zone skipped (`Pacific/Apia`, 2011-12-30) is not counted, and a fall-back that sends the clock back into the previous date counts that date too.

It counts calendar dates, not elapsed days: the 18-hour overlap above touches two dates. For the elapsed length of the overlap, compose `intervalIntersection*` with `intervalLength*`:

```typescript
const span = intervalIntersectionUtc(aStart, aEnd, bStart, bEnd);
span ? intervalLengthUtc(span.start, span.end, "day") : 0; // 0.75 for the overlap above
```

`intervalUnion*` returns the combined span of two overlapping or touching intervals, or `null` when a gap separates them. Touching intervals (one's end equals the other's start) join:

```typescript
import {
  intervalUnionDate,
  intervalUnionTime,
  intervalUnionDateTime,
  intervalUnionUtc,
  intervalUnionUnix,
  intervalUnionZoned,
} from "@northguild/gmt";

intervalUnionDate("2024-01-01", "2024-07-01", "2024-04-01", "2025-01-01");
// { start: "2024-01-01", end: "2025-01-01" }

intervalUnionDate("2024-01-01", "2024-07-01", "2024-07-01", "2025-01-01");
// { start: "2024-01-01", end: "2025-01-01" } (touching, joined)

intervalUnionDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// null (2024-06-30 lies in neither interval)

intervalUnionUnix(0, 1700000000, 1000000, 2000000);
// { start: 0, end: 1700000000 }

intervalUnionUtc(
  "2024-01-01T00:00:00Z",
  "2024-07-01T00:00:00Z",
  "2024-04-01T00:00:00Z",
  "2025-01-01T00:00:00Z",
);
// { start: "2024-01-01T00:00:00Z", end: "2025-01-01T00:00:00Z" }
```

All union functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalDifference*` returns the portion(s) of interval A not covered by interval B, as an array of `{ start, end }` records:

```typescript
import {
  intervalDifferenceDate,
  intervalDifferenceTime,
  intervalDifferenceDateTime,
  intervalDifferenceUtc,
  intervalDifferenceUnix,
  intervalDifferenceZoned,
} from "@northguild/gmt";

intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01");
// [{ start: "2024-01-01", end: "2024-06-01" }, { start: "2024-07-01", end: "2024-12-31" }]

intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31");
// [] (B fully covers A)

intervalDifferenceUnix(0, 1700000000, 1000000, 2000000);
// [{ start: 0, end: 1000000 }, { start: 2000000, end: 1700000000 }]

intervalDifferenceUtc(
  "2024-01-01T09:00:00Z",
  "2024-01-01T17:00:00Z",
  "2024-01-01T12:00:00Z",
  "2024-01-01T13:00:00Z",
);
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
```

Each piece ends exactly where B starts and resumes exactly where B ends, with no one-unit step, so the pieces and B together cover A once. `intervalDifferenceUtc` returns the same pieces as `subtractIntervals`.

All difference functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalXor*` returns the symmetric difference of two intervals — the portions covered by exactly one of them, not both — as an array of `{ start, end }` records:

```typescript
import {
  intervalXorDate,
  intervalXorTime,
  intervalXorDateTime,
  intervalXorUtc,
  intervalXorUnix,
  intervalXorZoned,
} from "@northguild/gmt";

intervalXorDate("2024-01-01", "2024-07-01", "2024-04-01", "2025-01-01");
// [{ start: "2024-01-01", end: "2024-04-01" }, { start: "2024-07-01", end: "2025-01-01" }]

intervalXorDate("2024-01-01", "2024-07-01", "2024-07-01", "2025-01-01");
// [{ start: "2024-01-01", end: "2025-01-01" }] (touching intervals share no date, so the runs join)

intervalXorUnix(0, 1700000000, 1000000, 2000000);
// [{ start: 0, end: 1000000 }, { start: 2000000, end: 1700000000 }]

intervalXorUtc(
  "2024-01-01T09:00:00Z",
  "2024-01-01T13:00:00Z",
  "2024-01-01T12:00:00Z",
  "2024-01-01T17:00:00Z",
);
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
```

All xor functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalAbuts*` checks whether two intervals are exactly adjacent, in either order: one interval's `end` equals the other's `start` (Allen's "meets"). The two then share no instant and leave no gap. Intervals separated by any gap, even one nanosecond or one epoch unit, do not abut, and an empty interval abuts nothing:

```typescript
import {
  intervalAbutsDate,
  intervalAbutsTime,
  intervalAbutsDateTime,
  intervalAbutsUtc,
  intervalAbutsUnix,
  intervalAbutsZoned,
} from "@northguild/gmt";

intervalAbutsDate("2024-01-01", "2024-07-01", "2024-07-01", "2025-01-01");
// true (the first interval ends where the second starts)

intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31");
// false (2024-06-30 lies in neither interval)

intervalAbutsDate("2024-01-01", "2024-07-01", "2024-04-01", "2025-01-01");
// false (overlap)

intervalAbutsUnix(0, 1000000, 1000000, 2000000);
// true

intervalAbutsUtc(
  "2024-01-01T09:00:00Z",
  "2024-01-01T12:00:00Z",
  "2024-01-01T12:00:00.000000001Z",
  "2024-01-01T17:00:00Z",
);
// false (1 ns apart)
```

All abuts checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`intervalEngulfs*` checks whether interval B lies within interval A and overlaps it — B may share A's `start` or `end`, but an empty B at A's `end` is not engulfed. Equivalent to the 4-argument `intervalContains*` mode:

```typescript
import {
  intervalEngulfsDate,
  intervalEngulfsTime,
  intervalEngulfsDateTime,
  intervalEngulfsUtc,
  intervalEngulfsUnix,
  intervalEngulfsZoned,
} from "@northguild/gmt";

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

All engulfs checks return `false` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

`splitIntervalByUnit*` splits an interval into sub-intervals of `amount × unit`, returning an array of `{ start, end }` records. The final sub-interval is trimmed so its `end` never exceeds the original `end`:

```typescript
import {
  splitIntervalByUnitDate,
  splitIntervalByUnitTime,
  splitIntervalByUnitDateTime,
  splitIntervalByUnitUtc,
  splitIntervalByUnitUnix,
  splitIntervalByUnitZoned,
} from "@northguild/gmt";

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

All split functions return `[]` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, non-positive amount, unsupported unit, or a unit that has no effect on the target type). A zero-length interval returns itself as the one piece (`[{ start, end }]`) for a supported unit, and `[]` for an unsupported one: `splitIntervalByUnitDate("2024-01-01", "2024-01-01", "hour", 1)` is `[]`.

`splitIntervalByUnit*`, `intervalDivideEqually*`, `mapDatesInRange` and `mapZonedDatesInRange` build one array element per piece, so each takes an optional `{ maxPieces }` (a positive safe integer, default `1_000_000`) and returns `[]` when the result would be longer. A split stops as soon as the piece past the limit is due, so a huge range answers in bounded time instead of exhausting the heap. Pass a larger `maxPieces` when a long range legitimately needs it:

```typescript
import { mapDatesInRange, splitIntervalByUnitDate } from "@northguild/gmt";

splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 4 });
// [] — 5 slices exceed the limit

mapDatesInRange("0001-01-01", "9999-12-31", 1);
// [] — 3,652,059 dates exceed the default
```

Each boundary is computed from `start` (`start + k × amount`, as Temporal and Luxon's `Interval.splitBy` do), never by stepping from the previous boundary, so month-end starts don't drift. A yearly split from February 29 likewise returns to February 29 in leap years:

```typescript
splitIntervalByUnitDate("2024-01-31", "2024-05-01", "month", 1);
// [{ start: "2024-01-31", end: "2024-02-29" }, { start: "2024-02-29", end: "2024-03-31" }, { start: "2024-03-31", end: "2024-04-30" }, { start: "2024-04-30", end: "2024-05-01" }]
```

`intervalCount*` returns how many calendar-unit boundaries an interval crosses — the number of units the half-open interval `[start, end)` touches. This is distinct from `diff*`, which measures exact elapsed duration: an interval from 23:59 to 00:01 is two minutes long but touches two days:

```typescript
import {
  intervalCountDate,
  intervalCountTime,
  intervalCountDateTime,
  intervalCountUtc,
  intervalCountUnix,
  intervalCountZoned,
} from "@northguild/gmt";

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

A zero-length interval counts `0` in every unit — the empty `[start, start)` holds no instant, so `intervalCountDate("2024-01-15", "2024-01-15", "month")` is `0`. Weeks start on Monday (ISO 8601), singular and plural units are interchangeable (`"day"` and `"days"`), and `intervalCountUnix` counts calendar boundaries in `options.timeZone`, UTC by default (`"local"` for the system zone), like `addUnix`. All count functions return `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, unsupported unit, or a unit that has no effect on the target type).

`intervalCountZoned`, `intervalCountUnix` and `intervalCountUtc` count the same local buckets `bucketRange` returns. A bucket shorter than its unit still counts once — a 20-minute range straddling 04:00 on `Pacific/Chatham`'s spring-forward day counts 2 hours, because its 03:00 hour lasts only 15 minutes — and a day the zone deleted counts not at all (`Pacific/Apia`'s 30 December 2011).

`intervalLength*` is `intervalCount*`'s exact-duration counterpart — it answers "how long is this interval" as a real, possibly fractional number, rather than "how many boundaries does it touch":

```typescript
import {
  intervalLengthDate,
  intervalLengthTime,
  intervalLengthDateTime,
  intervalLengthUtc,
  intervalLengthUnix,
  intervalLengthZoned,
} from "@northguild/gmt";

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

`intervalLength*` uses `Temporal.Duration.prototype.total`, so calendar units (month, year) resolve against the interval's own `start` rather than truncating, and zoned/unix/utc variants are DST-aware the same way `intervalCount*` is. Returns `0` for a zero-length interval, and `null` on invalid input (wrong type, malformed strings, leap seconds, inverted intervals, unsupported unit). `intervalLengthUnix` and `splitIntervalByUnitUnix` take `{ epochUnit, timeZone }` like `intervalCountUnix` (milliseconds and UTC by default): `intervalLengthUnix(0, 86400, "day", { epochUnit: "seconds" })` is `1`.

`intervalDivideEqually*` splits an interval into `n` equal-length sub-intervals, and `intervalSplitAt*` splits an interval at arbitrary points instead of by count:

```typescript
import {
  intervalDivideEquallyDate,
  intervalSplitAtDate,
} from "@northguild/gmt";

intervalDivideEquallyDate("2024-01-01", "2024-01-05", 4);
// [{ start: "2024-01-01", end: "2024-01-02" }, { start: "2024-01-02", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-04" }, { start: "2024-01-04", end: "2024-01-05" }]

intervalSplitAtDate("2024-01-01", "2024-01-10", ["2024-01-07", "2024-01-03"]);
// [{ start: "2024-01-01", end: "2024-01-03" }, { start: "2024-01-03", end: "2024-01-07" }, { start: "2024-01-07", end: "2024-01-10" }]
```

`n` must be a positive integer (`[]` otherwise), and `n` above `maxPieces` also returns `[]`; `n === 1` returns the original interval unchanged, and a zero-length interval returns `n` identical zero-length sub-intervals. Each internal boundary is `start + round((end − start) · i / n)`, an exact half rounding up — in whole days for `PlainDate`, nanoseconds for the other string variants and the arguments' own epoch unit for `intervalDivideEquallyUnix` — so the split is exact when the span divides evenly by `n`, within half a unit otherwise, and the pieces tile the range with no gap or overshoot (`intervalDivideEquallyZoned` splits DST-crossing intervals by real elapsed time, not local clock time). `intervalSplitAt*` sorts its `points` internally — they need not be pre-sorted — and drops points outside the interval or exactly on `start` or `end`, since those cannot introduce a new sub-interval. Each piece's `end` is the next piece's `start`, so under `[start, end)` the pieces partition the interval; an empty or all-dropped `points` array returns `[{ start, end }]` unsplit.

`mergeIntervals*` and `intervalXorAll*` are the list-form generalizations of `intervalUnion*` and `intervalXor*`, which are pairwise only — each takes a single array of `{ start, end }` records instead of two flat intervals:

```typescript
import { mergeIntervalsDate, intervalXorAllDate } from "@northguild/gmt";

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
// [{ start: "2024-01-01", end: "2024-01-05" }, { start: "2024-01-08", end: "2024-01-10" }, { start: "2024-01-15", end: "2024-01-20" }]
```

`mergeIntervals*` collapses overlapping or touching intervals (one's end equals the next one's start) into the minimum sorted set that does not overlap. `intervalXorAll*` returns the maximal runs covered by an odd number of the input intervals, sorted by start — for exactly two intervals the result is identical to the pairwise `intervalXor*`, and two identical intervals cancel out to `[]`. All four return `[]` for an empty list or on invalid input.

`intervalFromDuration*` constructs an interval from a single point plus an ISO 8601 duration, anchored at either end — Luxon's `Interval.after`/`Interval.before` as one function with an `anchor` param instead of two:

```typescript
import {
  intervalFromDurationDate,
  intervalFromDurationTime,
  intervalFromDurationDateTime,
  intervalFromDurationUtc,
  intervalFromDurationUnix,
  intervalFromDurationZoned,
} from "@northguild/gmt";

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

Calendar units (years/months/weeks) resolve against `value` itself, so no separate `relativeTo` is needed — except for `intervalFromDurationTime`, which returns `null` for a `duration` with a nonzero years/months/weeks/days component, since `PlainTime` has no calendar to resolve it against. `intervalFromDurationZoned` accepts the same `disambiguation`/`overflow` options as `addZoned`; `intervalFromDurationUnix` accepts `addUnix`'s `epochUnit`/`timeZone`/`overflow` options; `intervalFromDurationTime` takes no options argument, like `addTime`. A negative `duration` that inverts the computed span, or an `overflow: "reject"` result, returns `null` — same sentinel as any other invalid input.

All validators return `false` on invalid input (wrong type, malformed strings, leap seconds, mixed kinds for plain interval validators, or an epoch outside the `unix/` grammar: not a safe integer or a digit string).

### Zoned operations

```typescript
import { addZoned, formatZonedDateTime } from "@northguild/gmt";

addZoned("2026-03-07T23:00:00-05:00[America/New_York]", { hours: 2 });
// "2026-03-08T01:00:00-05:00[America/New_York]"

formatZonedDateTime("2024-03-17T14:30:45+00:00[UTC]", "en-US", {
  dateStyle: "full",
  timeStyle: "short",
});
// locale-dependent non-empty formatted string
```

Twice a year, DST creates local times that don't exist (spring-forward gap) or happen twice (fall-back overlap). Functions that attach a timezone to a plain/local value accept an optional `disambiguation` (`"compatible"` (default) | `"earlier"` | `"later"` | `"reject"`) to control how that's resolved instead of silently guessing:

```typescript
import { convertPlainDateTimeToZoned } from "@northguild/gmt";

// 2024-03-10T02:30:00 doesn't exist in America/New_York (clocks jump 2am -> 3am).
convertPlainDateTimeToZoned("2024-03-10T02:30:00", "America/New_York", {
  disambiguation: "reject",
});
// "" — no such local time exists
```

The `startOfZoned`/`endOfZoned`/`startOfQuarterForZoned`/`endOfQuarterForZoned`/`getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek` family (and their `unix/` counterparts) always return the real boundary of the unit that contains the input, in its zone: a start is never after the input and an end never before it, even when the wall-clock boundary was skipped or repeated. `Pacific/Chatham`'s 03:00 hour on its spring-forward starts at 03:45, New York's repeated 1 a.m. is its own hour, and a midnight repeated on the same date (America/Havana, 2024-11-03) stays one 25-hour day:

```typescript
import { startOfZoned } from "@northguild/gmt";

// 2024-11-03T01:45:00-05:00 is the SECOND, repeated 1am of the fall-back overlap in America/New_York.
startOfZoned("2024-11-03T01:45:00-05:00[America/New_York]", "hour");
// "2024-11-03T01:00:00-05:00[America/New_York]" — the real start of the repeated hour
```

These boundary functions follow TC39's `startOfDay()`, which takes no resolution options: they take no `disambiguation` or `offset` options, and neither does `mapZonedHoursInDay`. Resolution options belong on functions that set wall-clock fields. `getHoursInZonedDay` and `mapZonedHoursInDay` measure the input's calendar date exactly as TC39's `hoursInDay` does, which differs from `startOfZoned(…, "day")` only where a fall-back re-enters the previous date (America/Goose_Bay, 2010-11-07).

`convertPlainDateTimeToZoned`, `addZoned`, `subtractZoned` and `intervalFromDurationZoned` take no `offset` option: they resolve a plain date-time that has no UTC offset for it to act on.

`addZoned`, `subtractZoned` and `intervalFromDurationZoned` follow TC39's AddZonedDateTime: the date part of the duration (years to days) moves the wall clock, and the time part (hours and smaller) is added in exact time. `disambiguation` resolves the wall clock the date part lands on — in a spring-forward gap `"compatible"` and `"later"` move it forward, `"earlier"` back, and `"reject"` returns the sentinel; in a fall-back overlap it picks the occurrence — and never re-resolves the time part, so adding 10 minutes is always 10 real minutes. Before 1.16.0 a gap landing always moved forward. `diffZoned`, `diffZonedAsDuration` and `intervalLengthZoned` follow DifferenceZonedDateTime: days, weeks, months and years are counted on the zone's wall clock, and hours and smaller in exact time. Two values in different zones share no wall clock, so a calendar unit returns the sentinel; convert one end with `convertZonedToZoned` first:

```typescript
import { diffZoned } from "@northguild/gmt";

diffZoned("2024-03-09T12:00:00-05:00[America/New_York]", "2024-03-10T12:00:00-04:00[America/New_York]", "days");
// 1 — noon to noon across a 23-hour day

diffZoned("2024-01-01T00:00:00-05:00[America/New_York]", "2024-01-03T00:00:00+01:00[Europe/Paris]", "days");
// null — calendar unit across two time zones
```

`hasDaylightSaving` reports whether an IANA timezone observes daylight saving time at all:

```typescript
import { hasDaylightSaving } from "@northguild/gmt";

hasDaylightSaving("America/New_York");
// true

hasDaylightSaving("Asia/Tokyo");
// false

hasDaylightSaving("Invalid/Zone");
// false
```

`getDstTransitions` enumerates the exact transition instants for a timezone in a given year:

```typescript
import { getDstTransitions } from "@northguild/gmt/zoned";

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
import { isInDaylightSaving } from "@northguild/gmt/zoned";

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
import { getZonedOffset, getZonedOffsetAs } from "@northguild/gmt/zoned";

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
import { getTimeZoneOffset } from "@northguild/gmt/zoned";

getTimeZoneOffset("America/New_York", "2024-07-15T12:00:00Z");
// "-04:00"

getTimeZoneOffset("America/New_York", "2024-01-15T12:00:00Z");
// "-05:00"

getTimeZoneOffset("Invalid/Zone", "2024-07-15T12:00:00Z");
// ""
```

`formatTimeZoneName` returns a timezone's localized display name. `options.style` covers every `Intl.DateTimeFormatOptions` `timeZoneName` value:

```typescript
import { formatTimeZoneName } from "@northguild/gmt/zoned";

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
import { clampZoned, closestZonedTo } from "@northguild/gmt";

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

See [`docs/dst-disambiguation.md`](../../docs/dst-disambiguation.md) for the full explanation, including where `overflow` is and is not exposed.

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
} from "@northguild/gmt";

// Relative to "now" — auto-picks the best unit.
formatRelativeDate("2026-01-15");
// e.g. "3 months ago"

formatRelativeTime("14:30:00", "en-US", { style: "short" });
// e.g. "2 hr. ago"

formatRelativeDateTime("2026-03-17T09:00:00", "en-GB", {
  style: "long",
  numeric: "always",
});
// e.g. "in 3 hours"

// Zoned relative formatting — reference can be a ZonedDateTime, UTC string, or unix epoch.
formatRelativeZoned("2026-03-08T01:00:00-05:00[America/New_York]", "en-US");
// e.g. "tomorrow"

// Auto-picked units run from second through year, with formatRelativeDate's thresholds;
// pass largestUnit to cap them.
formatRelativeUtc("2024-03-17T14:30:45Z", "en-US", {
  reference: "2026-03-17T14:30:45Z",
});
// "2 years ago"
formatRelativeUtc("2024-03-17T14:30:45Z", "en-US", {
  reference: "2026-03-17T14:30:45Z",
  largestUnit: "day",
});
// "730 days ago"

// Unix epoch relative formatting.
formatRelativeUnix(1710685845000, "en-US", {
  epochUnit: "milliseconds",
  reference: 1805358645000,
});
// "3 years ago"

// roundingMethod ("floor" | "ceil" | "round", default "round") controls how the
// computed distance rounds to the display unit — every formatRelative* function accepts it.
formatRelativeUtc(value, "en-US", { roundingMethod: "floor" });

// formatCalendar* — a relative day label + time-of-day, joined with the
// locale's own connector (never a hardcoded "at"). Distinct from
// formatRelative*'s elapsed-time phrasing ("in 1 day"): this is Moment's
// `.calendar()` — for user-facing schedules, not elapsed-time displays.
// Within ±6 days of "now" (or an explicit `reference`) it stays relative;
// beyond that it falls back to an absolute date + time, no relative wording.
formatCalendar("2026-03-16T14:30:00", "en-US", {
  reference: "2026-03-15T09:00:00",
});
// "tomorrow at 2:30 PM"

formatCalendar("2026-03-08T14:30:00", "en-US", {
  reference: "2026-03-15T09:00:00",
});
// "March 8, 2026 at 2:30 PM" — 7 days out, beyond the threshold

formatCalendarZoned("2026-03-16T14:30:00-04:00[America/New_York]", "de-DE", {
  reference: "2026-03-15T09:00:00-04:00[America/New_York]",
});
// "morgen um 14:30" — locale's own connector, not "at"

// formatDateRange / formatDateTimeRange — plain counterparts of
// formatZonedRange (same parameter order and option shape), for a
// locale-elided range between two timezone-free values.
formatDateRange("2024-02-03", "2024-02-05", "en-US", { dateStyle: "long" });
// "February 3 - 5, 2024"

formatDateTimeRange("2024-02-03T09:00:00", "2024-02-03T17:00:00", "en-US", {
  dateStyle: "long",
  timeStyle: "short",
});
// "February 3, 2024, 9:00 AM - 5:00 PM"

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
// includes { type: "timeZoneName", value: "GMT-04:00" }
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
} from "@northguild/gmt";

// Email `Date:` headers (RFC 5322 / RFC 2822).
formatRfc2822("2024-03-15T14:30:00-04:00[America/New_York]");
// "Fri, 15 Mar 2024 14:30:00 -0400"
parseRfc2822("Fri, 15 Mar 2024 14:30:00 -0400");
// "2024-03-15T14:30:00-04:00[-04:00]"

// A receiver reads RFC 5322's full and obsolete syntax: comments, any case,
// two-digit years and zone names. A day name that contradicts the date is "".
parseRfc2822("fri,15 Mar 24 14:30 -0400 (EDT)");
// "2024-03-15T14:30:00-04:00[-04:00]"
parseRfc2822("Sat, 15 Mar 2024 14:30:00 -0400");
// "" — 15 March 2024 was a Friday

// HTTP headers (RFC 9110 IMF-fixdate) — Last-Modified, Date, Expires.
formatHttp("2024-03-15T14:30:00Z");
// "Fri, 15 Mar 2024 14:30:00 GMT"
parseHttp("Fri, 15 Mar 2024 14:30:00 GMT");
// "2024-03-15T14:30:00Z"
// parseHttp also reads the obsolete rfc850-date and asctime-date forms.
parseHttp("Sun Nov  6 08:49:37 1994");
// "1994-11-06T08:49:37Z"

// ANSI SQL / ODBC datetime literals (DATETIME/TIMESTAMP columns, no tz).
formatSql("2024-03-15T14:30:00");
// "2024-03-15 14:30:00"
parseSql("2024-03-15 14:30:00");
// "2024-03-15T14:30:00"
parseSql("2024-03-15 14:30");
// "" — the SQL literal grammar requires seconds, and a year of 0001–9999

// Strict RFC 3339 — strips the bracketed IANA zone GMT's own zoned strings
// carry, which RFC 3339 does not permit.
formatRfc3339("2024-03-15T14:30:00-04:00[America/New_York]");
// "2024-03-15T14:30:00-04:00"
parseRfc3339("2024-03-15T14:30:00-04:00");
// "2024-03-15T14:30:00-04:00[-04:00]"
```

The formatters return `""` for a value their grammar cannot express, such as a year outside `0000`–`9999` for RFC 3339 and HTTP-date or outside `0001`–`9999` for SQL, rather than writing a string no conforming parser accepts. Use Temporal's own `toString()` when you need any year.

### Unix and UTC helpers

```typescript
import { getUnixNow, getUtcNow, convertUnixToPlainDate } from "@northguild/gmt";

getUnixNow();
// 1710685845000 (milliseconds; getUnixNow({ epochUnit: "seconds" }) is 1710685845)

getUtcNow();
// "2026-03-18T11:42:33.123Z"

convertUnixToPlainDate(1710685845000, { timeZone: "UTC" });
// "2024-03-17"
```

### Nanosecond precision

`convertZonedToUnix` and friends return `number` milliseconds. Systems that record
telemetry, trades or sensor readings need nanoseconds, and a `number` cannot hold them:
integers are exact only to `2^53 − 1` ≈ 9.0 × 10^15, and nanoseconds since the epoch
passed that in April 1970. (`Date.now() * 1e6` is not a nanosecond timestamp — it is a
millisecond timestamp with three zeroes appended.) The `precision/` namespace works in
`bigint`:

```typescript
import {
  toNanoseconds,
  fromNanoseconds,
  formatNanoseconds,
  parseNanoseconds,
  truncateNanoseconds,
} from "@northguild/gmt";

toNanoseconds("2024-03-10T12:00:00.123456789Z");
// 1710072000123456789n

fromNanoseconds(1710072000123456789n);
// "2024-03-10T12:00:00.123456789Z"

fromNanoseconds(1710072000123456789n, "America/New_York");
// "2024-03-10T08:00:00.123456789-04:00[America/New_York]"
```

`JSON.stringify` throws a `TypeError` on a `bigint`, so the value crosses a wire as a
canonical decimal string:

```typescript
JSON.stringify({ observedAt: formatNanoseconds(1710072000123456789n) });
// '{"observedAt":"1710072000123456789"}'

parseNanoseconds("1710072000123456789");
// 1710072000123456789n
```

Most storage engines cannot hold nanoseconds — PostgreSQL `timestamptz` and MySQL
`DATETIME(6)` hold microseconds — so a naive write-then-read loses the last digits
silently. Truncate to the target precision first, and the round-trip is exact:

```typescript
truncateNanoseconds(1710072000123456789n, "us");
// 1710072000123456000n — safe to write to a microsecond column

truncateNanoseconds(1710072000123456789n, "ms");
// 1710072000123000000n
```

Truncation floors toward negative infinity, so pre-1970 values truncate the same way
post-1970 ones do — `truncateNanoseconds(-1500n, "us")` is `-2000n`, not `-1000n`.
Rounding toward zero would make the result jump direction either side of the epoch.

`0n` is both the epoch and the invalid-input sentinel, so `precision/validate` exists to
tell them apart. Each predicate accepts exactly what its partner parses:

```typescript
import {
  isValidInstant,
  isValidNanoseconds,
  isValidNanoPattern,
} from "@northguild/gmt";

isValidInstant("1970-01-01T00:00:00Z"); // true  — toNanoseconds returns 0n, the epoch
isValidInstant("garbage"); // false — toNanoseconds returns 0n, the sentinel

isValidNanoPattern("0"); // true  — parseNanoseconds returns 0n, the epoch
isValidNanoPattern("1e18"); // false

isValidNanoseconds(0n); // true  — in range for truncateNanoseconds / fromNanoseconds
isValidNanoseconds(0); // false — a number cannot carry a nanosecond timestamp
```

Reach for `isValidInstant` rather than `isValidUtc`: the latter gates on GMT's stricter
`<date>T<time>Z` shape and rejects the offsets and bracketed zones `toNanoseconds`
accepts, so validating with it discards valid input.

Every `precision/` function returns a sentinel (`""` for strings, `0n` for bigints) on
invalid input, and accepts only values inside the range `Temporal.Instant` can represent
(±8_640_000_000_000_000_000_000n). `0n` is also the epoch itself, so validate the input
first when the two must be told apart. Leap-second-aware time scales (TAI, GPS) are not
part of this namespace — these are plain instant conversions.

### Foreign epoch bridges

Other systems do not count from 1970. NTP counts from 1900 and rolls over in 2036, Windows
`FILETIME` counts 100-nanosecond intervals from 1601, .NET ticks count the same interval
from year 1, Excel uses a day serial with a deliberate 1900 leap-year bug, and PostgreSQL
stores microseconds from 2000-01-01. Every integration re-derives these constants, usually
wrongly:

```typescript
import {
  toNtpTimestamp,
  fromNtpTimestamp,
  toFileTime,
  fromFileTime,
  toDotNetTicks,
  fromDotNetTicks,
  toExcelSerial,
  fromExcelSerial,
  toPgMicroseconds,
  fromPgMicroseconds,
} from "@northguild/gmt";

toFileTime("1970-01-01T00:00:00Z");
// 116444736000000000n — 100 ns intervals since 1601-01-01

toDotNetTicks("1970-01-01T00:00:00Z");
// 621355968000000000n — same unit, counted from 0001-01-01

toPgMicroseconds("2024-03-10T12:00:00Z");
// 763387200000000n — microseconds since 2000-01-01
```

**NTP timestamps are era-ambiguous by design.** The seconds field is unsigned 32-bit, so it
wraps every ~136.19 years and the era is not part of the value. `fromNtpTimestamp` takes it
as an explicit argument:

```typescript
toNtpTimestamp("2036-02-07T06:28:15Z");
// 18446744069414584320n — the last second of era 0

toNtpTimestamp("2036-02-07T06:28:16Z");
// 0n — era 1 begins, and the seconds field wraps

fromNtpTimestamp(0n);
// "1900-01-01T00:00:00Z"

fromNtpTimestamp(0n, 1);
// "2036-02-07T06:28:16Z" — the same value, one era on
```

**Excel's serial 60 is the phantom 29 February 1900**, a date that never existed — 1900 was
not a leap year. Lotus 1-2-3 got it wrong and Excel keeps the bug for compatibility, so the
serial day `[60, 61)` is a hole rather than a date. "Fixing" it would put GMT one day out
from Excel for every date before March 1900:

```typescript
fromExcelSerial(59);
// "1900-02-28T00:00:00Z"

fromExcelSerial(60);
// "" — the phantom 1900-02-29

fromExcelSerial(61);
// "1900-03-01T00:00:00Z"

toExcelSerial("2024-03-10T12:00:00Z");
// 45361.5 — days, with the time of day as the fraction

toExcelSerial("2024-03-10T12:00:00Z", { system: "1904" });
// 43899.5 — the legacy Mac system, exactly 1462 days lower
```

Each bridge accepts only what its target format can actually hold, and returns the
namespace's sentinel otherwise — `toFileTime` on a pre-1601 instant is `0n`, not a negative
tick count, and `toExcelSerial` past 9999-12-31 is `null`, not an out-of-range serial.
PostgreSQL's range is the one that surprises: its timestamp domain starts at 4713 BC, which
is 40× later than the earliest instant Temporal can represent, so an in-range Temporal
instant is not automatically an in-range PostgreSQL one. Where
the target unit is coarser than a nanosecond the conversion floors toward negative infinity,
so a round trip is exact to that unit: 100 ns for `FILETIME` and .NET ticks, 1 µs for
PostgreSQL, 1 ms for Excel. NTP is the exception in the other direction — its 2^-32 s unit is
finer than a nanosecond, so `fromNtpTimestamp` rounds to the nearest nanosecond and the round
trip is exact.
### Spans

`diffZoned` measures in calendar units and returns a `Duration`. Profiling, tracing and
telemetry want a raw number, and the `span/` namespace gives one:

```typescript
import { spanMs, spanNs, spanWallClock } from "@northguild/gmt";

spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z");
// 1000

spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00.123456789Z");
// 123.456789 — fractional, like performance.now()

spanNs("2024-03-10T12:00:00.123456789Z", "2024-03-10T12:00:00.123456790Z");
// 1n
```

Both are signed — `spanMs(b, a)` is exactly `-spanMs(a, b)` — and both measure **exact
elapsed time**. That is not the same question as calendar distance, and conflating the two
is the most common span bug there is. A wall-clock day containing a DST transition is 23 or
25 hours long (24.5 in `Australia/Lord_Howe`), so:

```typescript
const start = "2024-03-09T12:00:00-05:00[America/New_York]";
const end = "2024-03-10T12:00:00-04:00[America/New_York]";

spanMs(start, end);
// 82800000 — 23 hours actually elapsed

spanWallClock(start, end, "hours");
// 24 — the clock face advanced a full day

spanWallClock(start, end, "days");
// 1
```

`spanWallClock` reads each endpoint's own local wall clock — straight off the string, never
via an instant, so DST disambiguation cannot distort it and a local time that never occurred
is measured as written. The two endpoints need not share a zone: a flight leaving New York at 23:00 and landing in Berlin at 11:00 the next local day
is 12 wall-clock hours and 7 elapsed hours. It truncates toward zero, and it is not a count
of midnights crossed.

`isValidSpan(start, end)` answers "will these two produce a span?" — true exactly when
`spanMs` and `spanNs` will return a value. It is symmetric, since a reversed pair is a
negative span rather than an invalid one. `spanWallClock` has a different input grammar and
is covered by `isValidZonedDateTime`.

Three limits, all deliberate:

- **`0` and `0n` are valid spans**, so invalid input returns `null` from all three rather
  than the zero the rest of the library uses for numbers. `null` and not `NaN`: it is the
  sentinel every other number-returning function in GMT uses, and the only one
  `strictNullChecks` forces a caller to handle — a `NaN` types as plain `number` and
  propagates silently through arithmetic.
- **`spanMs` returns `null` past `Number.MAX_SAFE_INTEGER` milliseconds** (±285,000 years,
  which two instants at opposite ends of `Temporal.Instant`'s range exceed). A
  sub-millisecond fraction counts toward that ceiling, so what comes back is always a safe
  integer or below. Use `spanNs` there; its result is a duration, not an instant, and can be
  twice the epoch-nanosecond range.
- **Leap seconds are not counted.** UTC repeats a second rather than numbering a 61st one,
  so a span across one is a second short of the physical elapsed time; against a smeared
  clock (Google, AWS, Meta) the error is up to a second spread over the smear window.

### Offset-preserving instants and local resolution

An instant orders events globally; the UTC offset in force where the event happened renders
it as the human on the ground saw it. Neither derives from the other, which is why GS1 EPCIS
2.0 requires both fields (`eventTime` plus `eventTimeZoneOffset`), UN/EDIFACT DTM has
qualifiers `303`/`304` for the pair, and DICOM appends `&ZZXX` to a `DT` value. The `instant/`
namespace is that pair:

```typescript
import { fromOffsetInstant, toOffsetInstant } from "@northguild/gmt";

toOffsetInstant("2024-07-15T12:00:00-04:00[America/New_York]");
// { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }

// Most feeds send no zone at all — the offset alone is what happened.
toOffsetInstant("2024-07-15T12:00:00-04:00");
// { instant: "2024-07-15T16:00:00Z", offset: "-04:00" }

// A UTC-only feed plus a zone you know from somewhere else.
toOffsetInstant("2024-07-15T16:00:00Z", "America/New_York");
// { instant: "2024-07-15T16:00:00Z", offset: "-04:00", timeZone: "America/New_York" }

fromOffsetInstant({ instant: "2024-07-15T16:00:00Z", offset: "-04:00" });
// "2024-07-15T12:00:00-04:00"
```

**An offset is not a zone.** `-05:00` does not identify `America/New_York` — it is every zone
sitting at `-05:00` that day, and it says nothing about what that zone will do next spring.
Store the zone for anything still to be scheduled; store the offset for anything that already
happened. `timeZone` is optional because most feeds do not send one, and a string whose
offset contradicts its own bracketed zone returns `null` rather than a guess.

The other half of the namespace is the reverse problem: a wall time that arrives with no
offset at all ("gate-out 08:00"). Resolving one needs a zone the sender did not send, plus a
policy for the two days a year the mapping is not one-to-one:

```typescript
import { classifyLocal, resolveLocal } from "@northguild/gmt";

classifyLocal("2024-11-03T01:30:00", "America/New_York"); // "ambiguous"
classifyLocal("2024-03-10T02:30:00", "America/New_York"); // "nonexistent"
classifyLocal("2024-07-15T12:00:00", "America/New_York"); // "unique"

resolveLocal("2024-11-03T01:30:00", "America/New_York");
// "2024-11-03T05:30:00Z" — the default "compatible" takes the first 01:30

resolveLocal("2024-11-03T01:30:00", "America/New_York", { disambiguation: "later" });
// "2024-11-03T06:30:00Z" — the same wall clock, an hour of real time later

resolveLocal("2024-11-03T01:30:00", "America/New_York", { disambiguation: "reject" });
// "" — ambiguous, and not guessed
```

`classifyLocal` exists so code can branch **before** a policy is applied. A demurrage clock, a
medication window or a duty limit should refuse an ambiguous wall time, or route it to a
human — not silently accept whichever of two instants an hour apart a default handed it. See
[DST Disambiguation](../../docs/dst-disambiguation.md) for the four strategies in full.

Two notes on the boundaries of this namespace:

- **`resolveLocal` returns an instant; `convertPlainDateTimeToZoned` returns a zoned string.**
  Same underlying resolution, different output and different precision — `resolveLocal` is
  exact to the nanosecond, while `convertPlainDateTimeToZoned` defaults to milliseconds.
  Neither takes an `offset` option. Reach for whichever shape you need next.
- **`offset` is `±HH:MM`, except where it is not.** A handful of zones did not run on a whole
  minute before 1972 — `Africa/Monrovia` really was `-00:44:30` — and those report
  `±HH:MM:SS`. Rounding them would put the pair thirty seconds from the event it describes.

### Calendar boundaries and zone-aware buckets

Two absences with outsized consequences, and they turn out to be the same absence twice: a
calendar boundary is not a fixed number of hours, and it is not in UTC.

**Week and period identifiers.** Vessel schedules are published by week number and retail runs
on 52/53-week fiscal calendars. Both come back as whole identifiers, not as fields to combine
by hand — a week number without its week-numbering year is ambiguous at both ends of a year:

```typescript
import { getFiscalPeriod, getIsoWeekDate, getOrdinalDate, getQuarter } from "@northguild/gmt";

getIsoWeekDate("2027-01-01"); // { year: 2026, week: 53, weekday: 5 } — week-year 2026, not 2027
getOrdinalDate("2024-12-31"); // { year: 2024, dayOfYear: 366 }
getQuarter("2024-03-31", { fiscalYearStartMonth: 4 }); // { year: 2023, quarter: 4 }

// The NRF retail calendar, stated as its published rule: "the Saturday nearest to January 31".
const nrf = { pattern: "4-5-4", yearEndsOn: "2026-01-31" } as const;

getFiscalPeriod("2024-06-15", nrf); // { year: 2024, period: 5, week: 19 }
getFiscalPeriod("2024-01-28", nrf); // { year: 2023, period: 12, week: 53 } — a 53-week year
```

52 × 7 is 364 days, so a 53rd week is inserted every five or six years and lands in the final
period. `yearEndsOn` states the *rule*, by example — years end on that date's weekday, nearest
that date's month and day — not one year's end, because GMT bundles no fiscal calendar. There
is no single correct retail calendar to bundle.

**Zone-aware bucketing.** "Group by day in `America/New_York`" over UTC timestamps is the most
common observability bug there is, and the same operation decides how many chargeable days a
container accrued, because free time is counted in terminal-local calendar days:

```typescript
import { bucketRange, floorToZone } from "@northguild/gmt";

floorToZone("2024-06-15T03:00:00Z", "day", "America/New_York"); // "2024-06-14T04:00:00Z"
floorToZone("2024-06-15T03:00:00Z", "day", "UTC");              // "2024-06-15T00:00:00Z"
```

Same instant, different calendar day — 03:00 UTC on 15 June is still 14 June in New York, and
flooring it to the UTC day is wrong for most of the world for most of the day. The zone is an
argument because GMT has no ambient one and must not acquire one.

`bucketRange` returns the boundaries spanning a range, and **the buckets are deliberately not
uniform in length**:

```typescript
bucketRange("2024-03-09T05:00:00Z", "2024-03-12T04:00:00Z", "day", "America/New_York");
// ["2024-03-09T05:00:00Z", "2024-03-10T05:00:00Z", "2024-03-11T04:00:00Z"]
// 24h, then 23h — the middle day springs forward

bucketRange("2024-11-02T04:00:00Z", "2024-11-05T05:00:00Z", "day", "America/New_York");
// ["2024-11-02T04:00:00Z", "2024-11-03T04:00:00Z", "2024-11-04T05:00:00Z"]
// 24h, then 25h — the middle day falls back
```

Forcing 24 hours here is what makes a daily aggregate drift an hour twice a year. The same
honesty applies to boundaries that do not exist: the calendar day Samoa deleted crossing the
date line is absent from the list, a local day whose midnight is skipped by a spring-forward
starts at 01:00, and in a zone that falls back by half an hour (`Australia/Lord_Howe`) the
local 01:00 hour bucket is genuinely 90 minutes long.

For a zoned or epoch value, `startOfZoned`/`startOfUnix` with no options return the same real
boundary. Do not floor with `roundZoned`/`roundUnix` and `roundingMode: "trunc"`: they follow
TC39 `ZonedDateTime.round`, which rounds the wall clock and re-resolves it in the zone, so
`"2024-09-29T03:50:00+13:45[Pacific/Chatham]"` truncated to the hour gives 04:00 — after the
input.

A pattern or a bucket unit the namespace does not recognise returns the same sentinel an
unusable date or instant does, so both unions have a type guard to narrow one that arrived as
a bare string — from config, an env var, a form:

```typescript
import { isValidFiscalPattern, isValidZoneBucketUnit } from "@northguild/gmt";

isValidFiscalPattern("4-5-4"); // true  — the NRF retail calendar
isValidFiscalPattern("4-5-5"); // false — the shape a 53-week year's last quarter takes
isValidZoneBucketUnit("day");  // true
isValidZoneBucketUnit("days"); // true  — singular or plural, as floorToZone accepts
isValidZoneBucketUnit("year"); // false — the year question is getQuarter's
```

### Interval algebra

Four realms need the same operation and none of them could express it: sum the parts of an
interval that fall inside a set of allowed windows. Laytime counts only the hours a charter
clause allows, driver hours split a duty period around mandatory rest, demurrage free time
counts only working days, and a trading window counts only continuous-session time. The
`interval/` namespace is that one shared primitive, with one boundary rule:

**Half-open `[start, end)`.** An instant `t` is inside when `start ≤ t < end`. That is SQL:2011's
closed-open `PERIOD`, RFC 5545's non-inclusive `DTEND` and Dijkstra's EWD831. A container gated
out at exactly 17:00 has not used another day, and two consecutive shifts never double-count the
instant they meet.

```typescript
import {
  clampInterval,
  intersectIntervals,
  intervalContains,
  intervalsOverlap,
  isValidInterval,
  mergeIntervals,
  splitIntervalAt,
  subtractIntervals,
  sumIntervals,
} from "@northguild/gmt";

const shift = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };

intervalContains(shift, "2024-01-01T09:00:00Z"); // true — start is inside
intervalContains(shift, "2024-01-01T17:00:00Z"); // false — end is not

intervalsOverlap(shift, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" });
// false — touching intervals share no instant
intersectIntervals(shift, { start: "2024-01-01T12:00:00Z", end: "2024-01-01T18:00:00Z" });
// { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" }
clampInterval({ start: "2024-01-01T08:00:00Z", end: "2024-01-01T12:00:00Z" }, shift);
// { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }

mergeIntervals([
  { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" },
  { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
  { start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" },
]);
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" }] — sorted, touching runs joined

const worked = subtractIntervals(shift, [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }]);
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
//  { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
sumIntervals(worked); // "PT7H"

splitIntervalAt(shift, ["2024-01-01T15:00:00Z", "2024-01-01T11:00:00Z"]);
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T11:00:00Z" },
//  { start: "2024-01-01T11:00:00Z", end: "2024-01-01T15:00:00Z" },
//  { start: "2024-01-01T15:00:00Z", end: "2024-01-01T17:00:00Z" }] — pieces share no instant

isValidInterval({ start: "2024-01-01T17:00:00Z", end: "2024-01-01T09:00:00Z" }); // false — inverted
```

- **Endpoints are instants.** An offset (`Z` or `±HH:MM`) is required and a `[Zone]` annotation is
  optional. As with a TC39 `Temporal.Instant`, endpoints compare by epoch nanoseconds, so two of
  them may name different zones. Leap seconds are rejected, and a `[u-ca=…]` annotation is ignored, as `Temporal.Instant.from` ignores it. For local-calendar
  edges, build them with `floorToZone` or `bucketRange` first.
- **Outputs are the caller's own strings**, never re-serialised. When two strings spell the same
  instant, the first argument's spelling wins. No spec covers the tie, so this is a GMT rule.
- **`start === end` is a valid empty interval.** It contains no instant, overlaps only an interval
  it lies strictly inside, and adds nothing to a sum. An inverted interval returns the sentinel:
  `false`, `null`, `[]` or `""`.
- **`sumIntervals` is covered time.** It returns the length of the union, with overlaps counted
  once, as an exact duration with hours as the largest unit. That is exactly what TC39
  `Instant.prototype.until(…, { largestUnit: "hour" })` produces, because an instant has no
  calendar that says how long a day is. So `PT49H30M` is never written `P2DT1H30M`, a New York
  spring-forward day is `PT23H`, and `sumIntervals([])` is `"PT0S"`. The sum is exact past
  2^53 nanoseconds.
- **`[]` means two things.** From `mergeIntervals`, `subtractIntervals` and `splitIntervalAt` it
  is both a legitimate result (a fully covered subtraction) and the invalid-input sentinel.
  `isValidInterval` tells them apart.

### Operating hours and open-time SLAs

A business day answers "is Thursday a working day". A terminal gate, a support desk, a customs
office and a night curfew ask a finer question: is it open right now, how many open hours have
passed, and when does an SLA measured in open hours fall due. `calendar/hours` answers them from
one `OperatingSchedule`: a zone, windows of local wall time for each ISO weekday, holiday dates,
and dated overrides.

```typescript
import {
  addOperatingTime,
  isOpenAt,
  nextCloseAt,
  nextOpenAt,
  operatingIntervals,
  operatingTimeBetween,
  recurringWindows,
} from "@northguild/gmt";
import type { OperatingSchedule } from "@northguild/gmt/types";

const nineToFive = [{ from: "09:00", to: "17:00" }];
const desk: OperatingSchedule = {
  timeZone: "America/New_York",
  weekly: { 1: nineToFive, 2: nineToFive, 3: nineToFive, 4: nineToFive, 5: nineToFive },
  holidays: ["2024-07-04"],
  overrides: [{ date: "2024-07-05", windows: [{ from: "10:00", to: "12:00" }] }],
};

operatingIntervals(desk, { start: "2024-07-04T04:00:00Z", end: "2024-07-06T04:00:00Z" });
// [{ start: "2024-07-05T14:00:00Z", end: "2024-07-05T16:00:00Z" }] — the holiday is closed, the override replaces Friday

isOpenAt("2024-06-17T14:00:00Z", desk); // true — Monday 10:00 local
nextOpenAt("2024-06-15T16:00:00Z", desk); // "2024-06-17T13:00:00Z" — Saturday noon to Monday 09:00 local
nextCloseAt("2024-06-17T14:00:00Z", desk); // "2024-06-17T21:00:00Z" — 17:00 local

operatingTimeBetween("2024-06-14T20:00:00Z", "2024-06-17T14:00:00Z", desk); // "PT2H" — Friday 16:00 to Monday 10:00
addOperatingTime("2024-06-14T20:00:00Z", "PT8H", desk); // "2024-06-17T20:00:00Z" — an 8-hour SLA from Friday 16:00: Monday 16:00
addOperatingTime("2024-06-14T20:00:00Z", "PT8H", desk, { within: "P1D" }); // "" — not due within a day

// A curfew wraps midnight and belongs to the night it starts on.
recurringWindows(
  { 6: [{ from: "23:00", to: "06:00" }] },
  { start: "2024-11-02T00:00:00Z", end: "2024-11-04T00:00:00Z" },
  "America/New_York",
);
// [{ start: "2024-11-03T03:00:00Z", end: "2024-11-03T11:00:00Z" }] — 8 hours across the fall-back night
```

- **Windows are half-open local wall time.** `{ from: "09:00", to: "17:00" }` is open at 09:00
  and closed at 17:00. A `to` at or before its `from` wraps past midnight: `23:00`–`06:00` is a
  night and `00:00`–`00:00` a whole day. A window belongs to the date it starts on, so a holiday
  or override on Friday removes or replaces a Friday-night window, and one on Saturday does not.
  Windows that overlap or touch merge, so a run of whole days is one interval.
- **Every edge goes through `resolveLocal`.** The default `disambiguation` is `"compatible"`: an
  edge in a repeated fall-back hour takes the earlier instant, and one in a skipped
  spring-forward hour moves forward by the gap. So a 23:00–06:00 window is 8 real hours across
  New York's fall-back night and 6 across its spring-forward night. `"earlier"` and `"later"`
  pick the other instant. `"reject"` guesses nothing: it returns the sentinel when a window with
  an ambiguous or nonexistent edge could change the answer, and ignores one that cannot.
- **Dates are the zone's real local dates.** Holidays and overrides are ISO dates in the
  schedule's zone. A `BusinessCalendar` can be passed as `holidays`; its `holidays` are read, and
  its `weekend` is not, because `weekly` already says which weekdays open. A date the zone
  deleted (`Pacific/Apia`, 2011-12-30) has no windows. An override wins over a holiday on the
  same date, and `windows: []` closes a date.
- **Open time is elapsed time.** `operatingTimeBetween` is the length of the open intervals
  inside `[start, end)`, the same number `sumIntervals` gives for their intersections with the
  range, with hours as the largest unit. `addOperatingTime` is its inverse: the earliest instant
  at which that much open time has passed, so a deadline that lands on a closing time is that
  closing time. Its duration is hours and smaller units: `P1D` of open time could mean 24 open
  hours or one working day, so it returns `""`.
- **Searches stop at a horizon.** `nextOpenAt`, `nextCloseAt` and `addOperatingTime` search up to
  `within` after the input (default `"P1Y"`), added in the schedule's zone so `"P1D"` is one local
  day. An answer exactly at the horizon counts; one past it returns `""`. A 24/7 schedule never
  closes, so `nextCloseAt` returns `""` for it.
- **Bounded walks.** A range or search of more than 10,000 local days (about 27 years) returns the
  sentinel rather than a truncated answer.
- **Not a recurrence engine.** A weekly pattern with dated exceptions covers gate hours, office
  hours, trading sessions and curfews. Monthly and yearly RFC 5545 rules are out of scope.

### Transport legs and dwell

Every transport mode shares three operations: add a leg's duration to a departure, show the
arrival in the zone where it lands, and measure how long something sat at a terminal, berth,
gate or yard. Every mode also gets the same two things wrong: a leg across a DST transition is a
fixed number of *elapsed* hours, and dwell is charged in *local calendar days*, not hours.

```typescript
import { dwellTime, etaAtZone, transitTime } from "@northguild/gmt";

// A leg is exact time in the departure's own zone. Four elapsed hours across the
// spring-forward: the wall clock reads 04:00, not 03:00.
transitTime("2024-03-09T23:00:00-05:00[America/New_York]", "PT4H");
// "2024-03-10T04:00:00-04:00[America/New_York]"

// A day is 24 exact hours, not "the same wall time tomorrow".
transitTime("2024-03-09T12:00:00-05:00[America/New_York]", "P1D");
// "2024-03-10T13:00:00-04:00[America/New_York]"

// The departure's form is preserved: Z stays Z, an offset stays an offset.
transitTime("2024-06-15T10:00:00Z", "PT36H"); // "2024-06-16T22:00:00Z"
transitTime("2024-06-15T10:00:00+09:00", "PT1H"); // "2024-06-15T11:00:00+09:00"
transitTime("2024-06-15T10:00:00+05:30:15", "PT1H"); // "2024-06-15T11:00:00+05:30:15"

// Calendar units need a reference point; a zone that contradicts its offset is rejected.
transitTime("2024-06-15T10:00:00Z", "P1M"); // ""
transitTime("2024-06-15T10:00:00-05:00[America/New_York]", "PT2H"); // "" (June is -04:00)

// Render a moment where it will be read. No disambiguation arises: on a fall-back night
// two arrivals an hour apart print the same wall time, and the offset tells them apart.
etaAtZone("2024-06-15T12:30:00Z", "Asia/Tokyo"); // "2024-06-15T21:30:00+09:00[Asia/Tokyo]"
etaAtZone("2024-11-03T05:30:00Z", "America/New_York"); // "2024-11-03T01:30:00-04:00[America/New_York]"
etaAtZone("2024-11-03T06:30:00Z", "America/New_York"); // "2024-11-03T01:30:00-05:00[America/New_York]"

// Dwell: exact duration, zone-local entry and exit, and the local calendar days touched.
dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/London");
// { duration: "PT2H30M",
//   enter: "2024-06-15T23:30:00+01:00[Europe/London]",
//   exit: "2024-06-16T02:00:00+01:00[Europe/London]",
//   calendarDays: 2 }

// The same two instants, one fewer day: the zone decides.
dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z", "Europe/Amsterdam");
// { duration: "PT2H30M",
//   enter: "2024-06-16T00:30:00+02:00[Europe/Amsterdam]",
//   exit: "2024-06-16T03:00:00+02:00[Europe/Amsterdam]",
//   calendarDays: 1 }

// The zone comes from targetZone or from the entry's bracketed zone. Bare instants with
// neither return null: an offset is not a place, and a day count needs one.
dwellTime("2024-06-15T22:30:00+01:00[Europe/London]", "2024-06-16T02:00:00+01:00[Europe/London]");
// { duration: "PT3H30M",
//   enter: "2024-06-15T22:30:00+01:00[Europe/London]",
//   exit: "2024-06-16T02:00:00+01:00[Europe/London]",
//   calendarDays: 2 }
dwellTime("2024-06-15T22:30:00Z", "2024-06-16T01:00:00Z"); // null

// Inverted intervals return null.
dwellTime("2024-06-16T01:00:00Z", "2024-06-15T22:30:00Z", "Europe/London"); // null
```

- **`transitTime` adds exact time.** Hours, minutes, seconds and fractions are elapsed time and a
  `D` component is 24 hours exactly, so the arrival wall clock reflects any DST shift in between.
  Years, months and weeks return `""`: no leg takes "a month" without a reference point. A
  negative duration moves backwards, which is how a departure is recovered from an arrival.
- **`etaAtZone` renders a moment.** The input is an instant (`Z`, an offset, or an offset with a
  bracketed zone), and only the instant is read; `targetZone` is where it is rendered. The zone
  is the caller's fact: GMT does not resolve a port, airport or station code to a timezone. A
  fixed offset such as `"+09:00"` is accepted as a zone, as `isValidTimeZone` accepts it.
  `dwellTime` accepts one as `targetZone` too, and counts days in that offset, which observes
  no DST.
- **`dwellTime.calendarDays` counts local dates, not hours.** It is the number of distinct
  local dates the half-open interval `[entry, exit)` touches: same date is `1`, across one
  local midnight is `2`, and an exit exactly at local midnight does not touch the new day. It
  is counted by walking the zone's real transitions, so a 23- or 25-hour local day is one day,
  a date the zone deleted (`Pacific/Apia`, 2011-12-30) is never touched, and a date the clock
  falls back into (`America/Goose_Bay`, 2010-11-07) is counted once. `duration` is the exact elapsed time with hours as the largest unit, as
  `sumIntervals` reports it.

### Free time and demurrage

Free time is the money calculation in container logistics, and none of its terms is a fact about
the port or fixed by a world standard. How many days are free, whether the day of discharge is
free day one, how free days and charged days are counted, and which clock a charge runs on are set
by the carrier's tariff and the service contract. DCSA defines what demurrage, detention and
storage are, but not how their days are counted. So every term is a parameter, no counting term has a default, and what comes back is the free-time window and the specific dates charged.

```typescript
import { chargeableDays, demurrageClock, freeTimeExpiry } from "@northguild/gmt";

const tariff = { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" };

// A Friday afternoon discharge in New York with three free calendar days: the weekend is
// consumed, and free time ends at Monday 00:00 local.
freeTimeExpiry("2024-06-14T19:00:00Z", 3, tariff);
// { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-16", expiresAt: "2024-06-17T04:00:00Z" }

// The same tariff read the other way: one more day. firstDay has no default.
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { ...tariff, firstDay: "nextDay" });
// { freeTimeStart: "2024-06-15", lastFreeDay: "2024-06-17", expiresAt: "2024-06-18T04:00:00Z" }
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { basis: "calendar", timeZone: "America/New_York" }); // null

// Working days skip the weekend, and a terminal holiday moves expiry a day.
const terminal = { weekend: [6, 7], holidays: [], timeZone: "America/New_York" };
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { ...tariff, basis: "working", calendar: terminal });
// { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-18", expiresAt: "2024-06-19T04:00:00Z" }
freeTimeExpiry("2024-06-14T19:00:00Z", 3, { ...tariff, basis: "working", calendar: { ...terminal, holidays: ["2024-06-17"] } });
// { freeTimeStart: "2024-06-14", lastFreeDay: "2024-06-19", expiresAt: "2024-06-20T04:00:00Z" }

// Expiry is half-open: out exactly as free time ends is free, one second later is a charged day,
// and the date is listed.
chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:00Z", 3, tariff);
// { freeDaysUsed: 3, chargeableDays: 0, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: [], byTier: [{ from: 1, to: null, days: 0 }] }
chargeableDays("2024-06-14T19:00:00Z", "2024-06-17T04:00:01Z", 3, tariff);
// { freeDaysUsed: 3, chargeableDays: 1, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: ["2024-06-17"], byTier: [{ from: 1, to: null, days: 1 }] }

// Charged days are counted on their own basis. Where a tariff grants free time in working days,
// the days after it are mostly charged as calendar days; some tariffs charge working days only.
const juneteenth = { ...terminal, holidays: ["2024-06-19"] };
chargeableDays("2024-06-14T19:00:00Z", "2024-06-24T15:00:00Z", 3, { ...tariff, basis: "working", calendar: juneteenth });
// { freeDaysUsed: 3, chargeableDays: 6, expiresAt: "2024-06-19T04:00:00Z",
//   chargedDates: ["2024-06-19", "2024-06-20", "2024-06-21", "2024-06-22", "2024-06-23", "2024-06-24"],
//   byTier: [{ from: 1, to: null, days: 6 }] }
chargeableDays("2024-06-14T19:00:00Z", "2024-06-24T15:00:00Z", 3, { ...tariff, basis: "working", chargeBasis: "working", calendar: juneteenth });
// { freeDaysUsed: 3, chargeableDays: 3, expiresAt: "2024-06-19T04:00:00Z",
//   chargedDates: ["2024-06-20", "2024-06-21", "2024-06-24"],
//   byTier: [{ from: 1, to: null, days: 3 }] }

// Tiers are day bands, not rates: twelve charged days in bands of 5, 5 and the rest.
chargeableDays("2024-06-14T19:00:00Z", "2024-06-28T15:00:00Z", 3, { ...tariff, tiers: [5, 10] });
// { freeDaysUsed: 3, chargeableDays: 12, expiresAt: "2024-06-17T04:00:00Z",
//   chargedDates: ["2024-06-17", "2024-06-18", "2024-06-19", "2024-06-20", "2024-06-21",
//                  "2024-06-22", "2024-06-23", "2024-06-24", "2024-06-25", "2024-06-26",
//                  "2024-06-27", "2024-06-28"],
//   byTier: [{ from: 1, to: 5, days: 5 }, { from: 6, to: 10, days: 5 }, { from: 11, to: null, days: 2 }] }

// Which two events a charge runs between, on the import or the export leg.
const imported = [
  { type: "discharged", at: "2024-06-14T19:00:00Z" },
  { type: "available", at: "2024-06-15T12:00:00Z" },
  { type: "gatedOut", at: "2024-06-20T14:30:00Z" },
  { type: "emptyReturned", at: "2024-06-27T09:00:00Z" },
];
demurrageClock(imported, "demurrage", { direction: "import" }); // { start: "2024-06-14T19:00:00Z", end: "2024-06-20T14:30:00Z" }
demurrageClock(imported, "detention", { direction: "import" }); // { start: "2024-06-20T14:30:00Z", end: "2024-06-27T09:00:00Z" }
demurrageClock(imported, "combined", { direction: "import" }); // { start: "2024-06-14T19:00:00Z", end: "2024-06-27T09:00:00Z" }
demurrageClock(imported, "demurrage", { direction: "import", startEvent: "available" }); // { start: "2024-06-15T12:00:00Z", end: "2024-06-20T14:30:00Z" }
const exported = [
  { type: "emptyReleased", at: "2024-07-01T08:00:00Z" },
  { type: "gatedIn", at: "2024-07-05T16:00:00Z" },
  { type: "loaded", at: "2024-07-09T03:00:00Z" },
];
demurrageClock(exported, "demurrage", { direction: "export" }); // { start: "2024-07-05T16:00:00Z", end: "2024-07-09T03:00:00Z" }
demurrageClock(exported, "detention", { direction: "export" }); // { start: "2024-07-01T08:00:00Z", end: "2024-07-05T16:00:00Z" }
demurrageClock([{ type: "discharged", at: "2024-06-14T19:00:00Z" }], "demurrage", { direction: "import" }); // null (no gate-out yet)
```

- **Days are the terminal's local days.** `clockStart` and `clockEnd` are instants; their local
  dates in `options.timeZone` are what is counted, over the zone's real day boundaries, the same
  ones `dwellTime` and `floorToZone` find. A 23- or 25-hour day is one day, a date the zone deleted
  is never a free or charged day, and a date the clock falls back into counts once. On the calendar
  basis with `firstDay: "eventDay"`, `freeDaysUsed + chargeableDays` is exactly
  `dwellTime(...).calendarDays` for the same dwell, except that a fall-back re-entering the day
  before the event day (Goose Bay, 7 November 2010) is a date `dwellTime` counts and a tariff
  never does.
- **`firstDay` has no default.** `"eventDay"` makes the event day free day one; `"nextDay"` starts
  free time the following counted day. The two differ by a full day of charges, so omitting it
  returns `null`.
- **`basis` counts free days; `chargeBasis` counts charged days.** `"calendar"` counts every local
  day; `"working"` counts only the working days of `options.calendar`, a `BusinessCalendar` (its
  weekend and holidays; its `timeZone` is not read), and returns `null` without one. Many tariffs
  count both in calendar days. Where a tariff grants free time in working days, the days after it
  are mostly charged as calendar days; some tariffs charge working days only. Neither has a default.
  "Calendar days excluding bank holidays" is `"working"` with an empty `weekend`.
- **Expiry is half-open.** `expiresAt` is the first instant of the local day after `lastFreeDay`, as
  a UTC instant. A gate-out at exactly `expiresAt` is not a chargeable day; one nanosecond later is.
- **`chargedDates` makes the count auditable.** It is the list a carrier's day-numbered tariff grid
  is applied to, and the dates an itemised invoice can list.
- **Tiers are day bands, not rates.** `tiers: [5, 10]` names days 1–5, 6–10 and 11 onward; `byTier`
  says how many charged days fell in each band, empty bands included, so a rate table applies by
  index. Omitted, it is the single open band. GMT computes days, never money.
- **`freeDays: 0`** is a tariff with no free time: `chargeableDays` charges every counted day from day
  one, and `freeTimeExpiry` returns `null` because there is no last free day to name.
- **`demurrageClock` selects the pair, per leg.** DCSA's glossary puts demurrage inside the terminal
  or depot and detention outside it; the carriers' published tariffs agree on the events. Import: demurrage and
  storage run from `startEvent` (`"discharged"` by default, or `"available"`) to `gatedOut`, detention
  from `gatedOut` to `emptyReturned`, and the combined clock from `startEvent` to `emptyReturned`.
  Export: demurrage and storage run from `gatedIn` to `loaded`, detention from `emptyReleased` to
  `gatedIn`, and the combined clock from `emptyReleased` to `loaded`. `direction` has no default. The
  event names follow DCSA's Track & Trace equipment events (DISC, GTOT, GTIN, LOAD). A required event
  that is missing or present twice, or an end before its start, returns `null`, and the result is an
  `Interval` in the caller's own strings, ready for `chargeableDays(start, end, …)`.

### Billing deadlines

A billing regime or service contract can set up to three windows around a demurrage or
detention invoice: one to issue it, counted from an anchor date; one to dispute it, counted from
issuance; and one to resolve the dispute, counted from the request, unless the parties
agree a date instead. The number of days in each is the caller's fact; GMT carries none of them. The arithmetic
is the function's: each deadline is a date, counted in calendar days from a date, with the anchor
as day zero and the deadline day itself inside the window.

```typescript
import { billingTimeline, convertUtcToPlainDate } from "@northguild/gmt";

const windows = { issueDays: 30, disputeDays: 30, resolutionDays: 30 };

// Charges last accrued on 1 March. Day 30 is the last day by the deadline; day 31 is not.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-30",
//   requestedByDeadline: null, resolutionDeadline: null }
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-01",
//   requestedByDeadline: null, resolutionDeadline: null }

// No invoice yet: a forecast. Only the invoice deadline is known.
billingTimeline({ anchorOn: "2026-03-01" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: null, disputeDeadline: null,
//   requestedByDeadline: null, resolutionDeadline: null }

// A dispute received on the dispute deadline, and one received a day later with a resolution
// date the parties agreed, which replaces the computed one.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19",
//   requestedByDeadline: true, resolutionDeadline: "2026-05-19" }
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-20" }, { ...windows, agreedResolutionOn: "2026-06-01" });
// { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19",
//   requestedByDeadline: false, resolutionDeadline: "2026-06-01" }

// A re-bill is anchored on the invoice it received (issued 10 March), not on the charge.
billingTimeline({ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" }, windows);
// { invoiceDeadline: "2026-04-09", issuedByDeadline: true, disputeDeadline: "2026-05-05",
//   requestedByDeadline: null, resolutionDeadline: null }

// A 14/14/45 service contract through the same chain: the numbers are the caller's.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, { issueDays: 14, disputeDays: 14, resolutionDays: 45 });
// { invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19",
//   requestedByDeadline: true, resolutionDeadline: "2026-05-02" }

// Windows have no defaults.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { disputeDays: 30, resolutionDays: 30 }); // null

// Deadlines are dates. Reduce an instant to the billing party's local date first.
convertUtcToPlainDate("2024-06-17T04:00:01Z", { timeZone: "America/New_York" }); // "2024-06-17"
```

- **Day zero is the anchor and the deadline is `anchor + days`** on the ISO calendar
  (`Temporal.PlainDate.add`); a date is by the deadline when it is on or before it
  (`Temporal.PlainDate.compare(date, deadline) <= 0`). That is the function's stated contract, not
  a reading of any rule; a regime that counts differently passes a different number. Thirty days
  across a leap day, a month end, a year end or a DST change is thirty dates, never thirty times
  24 hours: `2028-01-30` plus 30 is `2028-02-29`.
- **Deadlines are dates, never instants.** Reduce an instant to the billing party's local date
  first with `convertUtcToPlainDate(instant, { timeZone })`; the function does not guess a zone,
  and a date-time or an instant passed as a date returns `null`.
- **Windows have no defaults.** Each is a safe integer of at least `0`; a missing, negative or
  non-integer window returns `null`, because a silently defaulted window is a wrong deadline. The
  same rule as `firstDay`.
- **The anchor is whatever date the caller counts from.** The last date a charge accrued is
  `chargeableDays(...).chargedDates.at(-1)`. A party re-billing a charge it was itself billed
  passes the issuance date of the invoice it received; the chain is the same.
- **The chain fills in as its dates exist.** With only `anchorOn` the result is a forecast:
  `invoiceDeadline` is set and every other field is `null`. An invoice date sets
  `issuedByDeadline` and `disputeDeadline`; a request date sets `requestedByDeadline` and
  `resolutionDeadline`. A request without an invoice, or dated before it, is a data error and
  returns `null`; an invoice dated before the anchor is allowed, because an invoice may be issued
  while charges still accrue.
- **An agreed date replaces the computed resolution deadline.** `agreedResolutionOn` must be a
  valid date on or after `requestReceivedOn`, else `null`; it is validated even when no request
  exists, but cannot act without one. Every emitted date is bare ISO, so an input annotation such
  as `[u-ca=iso8601]` does not reach the output.
- **GMT computes dates, not liability.** `issuedByDeadline` and `requestedByDeadline` compare
  dates and say nothing else. Whether a charge is payable, whether a dispute must be heard, and
  any consequence are the consumer's, the sibling of "GMT computes days, never money".

## API Surface

For the complete API listing, see the namespace documentation on GitHub:

- [Duration API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/duration) — ISO 8601 duration parsing, validation, arithmetic, and formatting
- [Plain API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/plain) — timezone-free operations
- [Zoned API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/zoned) — IANA timezone-aware operations
- [Unix API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/unix) — Unix epoch utilities
- [Precision API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/precision) — nanosecond instants, JSON transport, storage truncation, NTP / FILETIME / .NET ticks / Excel / PostgreSQL epoch bridges
- [Span API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/span) — elapsed and wall-clock durations as raw numbers
- [Calendar API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/calendar) — ISO week and ordinal dates, quarter and fiscal periods, zone-aware bucketing, business calendars with holiday sets and roll conventions, and operating hours: open intervals, open or closed now, open time elapsed and SLA deadlines
- [Interval API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/interval) — half-open interval algebra over instants: overlap, intersect, clamp, merge, subtract, split, sum
- [Transport API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/transport) — transit legs as exact elapsed time, arrivals rendered in the zone where they land, dwell in local calendar days
- [Intermodal API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/intermodal) — free time, demurrage and detention: which clock, which start day, calendar or working days, and the charged dates an itemised invoice can list, plus the deadline chain around the invoice with every window a caller parameter
- [Instant API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/instant) — the instant-plus-offset pair, and explicit local-time resolution
- [UTC API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/utc) — UTC instant utilities
- [Regex API](https://github.com/northguild/gmt/tree/main/packages/gmt/src/regex) — composable regex patterns

## AI Agent Skills

`@northguild/gmt` ships four lightweight TanStack Intent skill files
(`skills/gmt-basics/`, `gmt-arithmetic/`, `gmt-timezone/`,
`gmt-integration/`). Each is a ~30–60 line routing pointer that carries core
rules and common pitfalls, then directs the agent to **this README** and the
source JSDoc for full API signatures and code examples.

| Skill | Task area | Load with |
| --- | --- | --- |
| `gmt-basics` | Get current values, parse, format, relative time, compare, validate | `intent load @northguild/gmt#gmt-basics` |
| `gmt-arithmetic` | Add/subtract, diff, durations, interval range math | `intent load @northguild/gmt#gmt-arithmetic` |
| `gmt-timezone` | Zoned arithmetic, formatting, DST disambiguation | `intent load @northguild/gmt#gmt-timezone` |
| `gmt-integration` | Cache keys, router/query params, lint package selection | `intent load @northguild/gmt#gmt-integration` |

Contributor skills (issue-creation, pr-contribution, new-method-implementation,
unit-test-generation, api-expansion-workflow) live under
`skills/contributor/` and are excluded from the npm tarball via
`.npmignore` — load them only when contributing to the library itself.

See the [dox site's Skills guide](https://gmt-dox.northguild.workers.dev/guides/integration/skills/)
for full install and discovery instructions.

## Agent Prompt

When working with `@northguild/gmt`, follow these rules:

1. **No `Date` object.** Use `Temporal` exclusively.
2. **String-in, string-out.** Public APIs accept ISO 8601 strings; return strings, numbers, booleans, or arrays.
3. **Invalid input returns a sentinel, never throws.** `""` for strings, `null` for numbers, `false` for booleans, `[]` for arrays.
4. **Wrap all Temporal calls in `try-catch`.** `.from()`, `.add()`, `.since()`, etc. throw `RangeError` on bad input.
5. **Keep `plain/` and `zoned/` strictly separate.** Never mix `PlainDateTime` and `ZonedDateTime`.
6. **Full locale matrix for any locale-aware function.** 17 locales, explicit rows, `expectOneOfIcu`/`expectDateTimeEqual` (from `src/test/icuVariants.ts`) where CLDR wording differs.
7. **Use pre-built mocks for error-path tests.** See `packages/gmt/src/test/mocks`.
8. **JSDoc with `@example` on every public function.** Cover valid, invalid, and edge-case inputs.

## License

MIT — See [LICENSE](../../LICENSE) for details.
