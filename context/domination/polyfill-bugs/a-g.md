# Polyfill and engine defects — § A–G

Part of [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), which explains the
format and indexes every section.

## A. Wall clock → exact time at the range limits: release request

**Defect.** Polyfill 0.5.1 throws for in-range `ZonedDateTime` values within about a day of both Instant limits
(parsing, `toZonedDateTime`, `until`/`since`, `Duration#total`/`round`/`compare` with `relativeTo`). Two commits on
`main` fix it: `05ce7a3` (clamps the offset probes to the limits) and `95237e0` (drops `CheckISODaysRange` on the
local date in `GetPossibleEpochNanoseconds`).

```js
Temporal.ZonedDateTime.from("+275760-09-13T09:00:00+10:00[Australia/Sydney]"); // 0.5.1 throws; expected a value
Temporal.ZonedDateTime.from("-271821-04-19T20:00:00[America/New_York]"); // 0.5.1 throws; expected -04:56 offset
```

Controls that must keep throwing: a wall clock one nanosecond past either limit.

**Workaround.** `zoned.A` in `internal/zonedWallClock.ts` and `zonedWallClockOperations.ts`; probes in `repros.ts`.

**Upstream.** js [#373](https://github.com/js-temporal/temporal-polyfill/issues/373) asks for a release (it closes
#341 and #347 once released). Verified on a production build of `main` `c8f344c`: 16 of 16 rows pass.

**Retires** on a release that contains `05ce7a3` and `95237e0`. Both are needed: `05ce7a3` alone leaves the minimum edge broken.

## B. `GetNamedTimeZoneNextTransition` returns `null` within one search window of the max Instant

**Defect.** When the last offset change lies within one search window (19 days) of the maximum Instant,
`GetNamedTimeZoneNextTransition` returns `null` without probing the last partial window. `startOfDay`,
`toZonedDateTime` and `hoursInDay` then throw a `TypeError`. The same code is in tc39 `main`.

```js
// America/Santiago skips local midnight at +275760-09-07T04:00Z, 6 days before the maximum
Temporal.Instant.from("+275760-09-01T00:00:00Z").toZonedDateTimeISO("America/Santiago").getTimeZoneTransition("next");
// expected +275760-09-07T01:00:00-03:00[America/Santiago]; 0.5.1 and main: null
Temporal.PlainDate.from("+275760-09-07").toZonedDateTime("America/Santiago"); // TypeError on 0.5.1 and main
```

**Workaround.** `zoned.B` (`zonedTransitionSearch.ts`, `zonedWallClock.ts`).

**Upstream.** js PR [#371](https://github.com/js-temporal/temporal-polyfill/pull/371) (closed, routed to tc39) and tc39
[#3328](https://github.com/tc39/proposal-temporal/issues/3328), both with the patch: loop on `leftMs` up to `MS_MAX`
instead of returning when `rightMs > MS_MAX`. With the patch 8 of 8 repro rows and 12 of 12 regression rows pass.

**Retires** on a js-temporal release that contains the fix.

## C. Non-ISO calendars: port-and-release request

Eight defects, one group per D-id (`pnpm compat` decides each):

| Defect | What goes wrong | Upstream source | State on js `main` |
| ------ | --------------- | --------------- | ------------------ |
| D1 | fields to ISO probes outside the legacy `Date` range near both limits (`Invalid ISO date`) | tc39 `a41eb67` + `af0cb4b` | not ported |
| D1b | the `until` month loop formats one month past the limit (hebrew, persian; islamic near the minimum). Also wrong on tc39 `main`; tc39 `196a31919d` (#3245) also corrupts the calendar cache at ordinary dates | new patch in js #370 and tc39 #3327 | not fixed |
| D2 | buddhist read through ICU's Julian/Gregorian hybrid before 1582-10-15 | tc39 `28fe786` | fixed (`2bb6ba1`) |
| D3 | Hebrew `inLeapYear` wrong for negative years (`%` sign) | tc39 `0df570c` | fixed (#361) |
| D4 | ICU4C Hebrew one day off for years 0 and earlier (ICU, not the polyfill) | ICU `5267bb5778` (ICU-23007) | n/a |
| D5 | stale "V8 bug 10529" detector (`Saka` vs `Śaka`) throws for every ISO year before 1 | tc39 `314b112` | fixed (#361) |
| D6 | `until` re-constrains the day while counting months | tc39 `1f6d6df` | fixed (`10aeb98`) |
| D7 | `until` by years throws "mixed-sign" | tc39 `0e32ee0` | fixed (#361); `main` took the whole of `196a3191` in `853fc8b` |
| D8 | Meiji starts 1868-10-23; test262 requires `ce` before Meiji 6 (1873) | tc39 `977d11e0` + `993e6322` | partly fixed (`2bb6ba1` eras) |

```js
const iso = (d) => d.withCalendar("iso8601").toString();
// D1 (test262 intl402/Temporal/PlainDate/from/extreme-dates.js)
iso(Temporal.PlainDate.from({ calendar: "hebrew", year: 279517, month: 10, day: 11 }, { overflow: "reject" })); // +275760-09-13
// D1b
Temporal.PlainDate.from("+275760-07-01").withCalendar("persian")
  .until(Temporal.PlainDate.from("+275760-09-13").withCalendar("persian"), { largestUnit: "months" }); // P2M12D
// D3: Temporal.PlainDate.from("-100000-01-01").withCalendar("hebrew").monthsInYear            // 12
// D5: Temporal.PlainDate.from("-000500-06-15").withCalendar("indian") -> -578 M03 25
// D7: hebrew 5784 month 6 day 2 .until(5785 month 6 day 1, { largestUnit: "years" })           // P12M29D
// D7b: hebrew 5784-M05L-30 .until(5785-M06-29, { largestUnit: "years" })                       // P12M29D (0.5.1 and a D7 port alone: P1Y)
// D8: Temporal.PlainDate.from("1872-12-31").withCalendar("japanese") -> era "ce", eraYear 1872
```

On 0.5.1 each row throws (`Invalid ISO date`, `Missing month converting`, `mixed-sign values not allowed`) or returns
another value (`P1Y`, `meiji|5`).

**D4 (ICU note).** ICU4C `hebrwcal.cpp` mis-applies the Kislev-length and dechiyah rules for years 0 and earlier, so
Node reads `-271821-11-05` as `-268057 M05 27` where Chromium (ICU4X) and the Dershowitz and Reingold arithmetic give
day 28. ICU `5267bb5778` (2026-07-13) fixes it; no ICU4C release has it (the latest is `release-78.3`, and Node
bundles 78.3). Nothing to file with the polyfill.

**Workarounds.** D1 to D8 in `internal/temporalCompat/` (the README's D-table lists each file and range guard). GMT
computes `coptic` and `ethiopic` through `ethioaa` and its own fields to ISO is a bisection
(`fieldSearch.ts`), so the unported coptic minimum problem (`ERA0` in #361) and tc39 #3329 cannot reach GMT.

**Upstream.** js PRs [#368](https://github.com/js-temporal/temporal-polyfill/pull/368) (D8),
[#369](https://github.com/js-temporal/temporal-polyfill/pull/369) (D1) and
[#370](https://github.com/js-temporal/temporal-polyfill/pull/370) (D1b, depends on #369), all closed and routed to
tc39; tc39 [#3327](https://github.com/tc39/proposal-temporal/issues/3327) (D1b, also reports the `196a31919d`
regression). D3, D5 and D7 are in the maintainer's PR #361, merged 2026-09-21. The loop hunk of `196a31919d` must not
be ported; D1b replaces it, and only its `CompareSurpasses` hunk is wanted (D7b), which `main` already has.

**Retires** per group, on a release (see "Waiting on a release"). The triggers are stricter than one commit: D1 needs
the field port and D1b and D3; D6 and D7 need the `196a3191` `CompareSurpasses` hunk (the `D7.leapMonthEnd` probe
checks it); D8 needs both `977d11e0` and `993e6322`; D3 and D4 leave together, and D4 needs an ICU release and a Node
that bundles it.

## D. `"UTC"` fast path in `GetPossibleEpochNanoseconds` skips `IsValidEpochNanoseconds`

**Defect.** The `"UTC"` branch of `GetPossibleEpochNanoseconds` returns an instant without validating it, so a
rounding window past the maximum Instant answers instead of throwing `RangeError`. Fixed in tc39 by #3205 (`d90d432b2f`,
for #3203).

```js
const MAX = 8640000000000000000000n, D = 86400000000000n, H = 3600000000000n;
const z = (ns, tz) => new Temporal.ZonedDateTime(ns, tz);
Temporal.Duration.from("PT49H").total({ unit: "day", relativeTo: z(MAX - 3n * D - 5n * H, "UTC") });
// 0.5.1: 2.0416666666666665. Spec and "+00:00" or Europe/London: RangeError
```

**Workaround.** `zoned.D` (`zonedWallClock.ts`).

**Upstream.** js PR [#367](https://github.com/js-temporal/temporal-polyfill/pull/367) (closed, routed to tc39; same
three lines as tc39 `d90d432`). **Retires** on a js-temporal release that ports #3205.

## E. Transition search starts in 1847, after the first TZDB transition (1844-12-31)

**Defect.** `GetNamedTimeZoneNextTransition` jumps to 1847-01-01 and the previous-transition search stops there, but
five zones cross the date line on 1844-12-31 and skip that local day: `Asia/Manila`, `Pacific/Guam`,
`Pacific/Saipan`, `Pacific/Kosrae` and `Pacific/Palau`. Offsets are right; only the transition search misses the
change, so `GetStartOfDay`, `hoursInDay`, `round` by day and `getDstTransitions(zone, 1845)` are wrong there. Same
code in tc39.

```js
Temporal.ZonedDateTime.from("1844-12-30T12:00[Asia/Manila]").hoursInDay; // 0.5.1 gives a huge value, not 24
```

**Workaround.** `zoned.E` (`internal/zonedWallClock.ts` defect 3): for a named zone and an instant before 1847 it bisects
with the existing `transitionBetween`, and uses GMT's own `GetStartOfDay`. Pinned over every zone in
`zonedWallClock.test.ts` (no zone changes offset before 1844-01-01; exactly these five change between 1844 and 1847).

**Upstream.** js PR [#372](https://github.com/js-temporal/temporal-polyfill/pull/372), tc39
[#3330](https://github.com/tc39/proposal-temporal/issues/3330), fc [#126](https://github.com/fullcalendar/temporal-polyfill/issues/126)
(fixed in 1.0.8). **Retires** on a js-temporal release that contains #372.

## F. `calendarToIsoDate` overshoot assertion from tc39 #3292 is reachable (tc39 only)

**Defect.** tc39 #3292 (`17d7ff1f94`) replaced the overshoot handling in `calendarToIsoDate()` with an assertion that
month 13 of coptic, ethiopic and ethioaa (5 or 6 days) can violate, because the search steps 8 days. js-temporal has
not ported #3292, so it does not have the bug.

```js
// tc39 main: any far-off year, month 13
Temporal.PlainDate.from({ calendar: "ethioaa", year: 18196, month: 13, day: 1 }); // assertion failure; expected +012704-11-26
```

**Workaround.** None needed; the `D10` canary group is a regression guard. GMT's fields to ISO is a bisection that
cannot skip a short month (`fieldSearch.ts`, `calendarDateFromFields.ts`), and `D10` fails only on a js-temporal release
that ports #3292 without the fix, which routes ethioaa through GMT's own path.

**Upstream.** tc39 [#3329](https://github.com/tc39/proposal-temporal/issues/3329), with the fix: search in 5-day steps
instead of 8. **Retires** nothing.

## G. CLDR calendar-alias asymmetry: `ethiopic-amete-alem` is accepted, `gregorian` is not (ICU note, not a polyfill defect)

**No ask.** CLDR `bcp47/calendar.xml` gives four calendar types a legacy alias: `gregory`/`gregorian`, `roc`/`taiwan`,
`islamic-tbla`/`islamic-tabular`, `ethioaa`/`ethiopic-amete-alem`. Only the last is usable as a Temporal calendar id.
Chromium 153 (ICU4X) and the polyfill 0.5.1 agree row for row, and so does GMT: `gregorian` stays rejected and
`ethiopic-amete-alem` stays accepted. GMT's calendar ids are exactly the ids Temporal accepts, so a string GMT
validated would otherwise throw when it reached `Temporal`; and the `Intl` fallback (`{ calendar: "taiwan" }`
formatting as Gregorian) is a silently wrong date. GMT surfaces all three as its `""`/`null` sentinel.

Documented in the JSDoc of `convertDateToCalendar`, `convertZonedToCalendar`, `isValidCalendarDate` and
`isValidCalendarZonedDateTime`. **Revisit** if an ICU release adds `islamic-tabular` and `taiwan` to its
canonicalization table, or TC39 amends `CanonicalizeCalendar`. Neither is filed.
