# Temporal polyfill swap: `@js-temporal/polyfill` or `temporal-polyfill`

**Purpose:** Record whether GMT should replace `@js-temporal/polyfill` with `temporal-polyfill`
(fullcalendar/temporal-polyfill), what the swap costs, and what tells us to make it.

**Checked against:** `@js-temporal/polyfill` 0.5.1 and `temporal-polyfill` 1.0.8 through its
`/full/implementation` entry, on Node 26.12.1 (ICU 78.3, tzdata 2026e), with Node's built-in
`Temporal` as the tie-breaker. The probe results in § 3 and the defects in § 4.4 and § 4.5 were
measured on 1.0.7, in Node, Playwright Chromium and Playwright WebKit 26.6; 1.0.8 fixes § 4.4 and
§ 4.5 (§ 4.6). `temporal-polyfill` 1.0.6 was checked on Node the same way; its results stay in
§ 4.1–§ 4.3, because the offset sweep of § 4.3 is the check's proof that it finds a real defect.

---

## 1. The choice

`temporal-polyfill` 1.0.8 fixes most of the defects GMT works around today, the three defects found
in 1.0.6 (§ 4.1–§ 4.3), and the two found in 1.0.7: a backward transition search that stopped about
three years after the current date, which failed 12 GMT tests (§ 4.4), and transitions before 1847
that it did not find (§ 4.5). On Node, the swap check finds no test that fails on 1.0.8 and passes
on `@js-temporal/polyfill` (0 of 71,340 tests), and the offset sweep finds no zone where it differs
from `Intl.DateTimeFormat` (0 zones). The move itself is CORE-108 (#460). GMT swaps when a
`temporal-polyfill` release passes the whole GMT suite and the offset sweep (§ 6).

## 2. How it was tested

In a throwaway copy of the repo, `packages/gmt` depended on `temporal-polyfill` instead of
`@js-temporal/polyfill`, and `src/internal/temporal.ts` (the only file that names the
implementation) imported from `temporal-polyfill/full/implementation`. Then:

- `tsc --noEmit` in `packages/gmt`;
- the full `packages/gmt` Vitest suite;
- every repro in `internal/temporalCompat/repros.ts`, run through `runRepro` and `reproPasses`;
- one sample from each failure group, run on all three implementations;
- the D18 and D19 probes in Playwright WebKit 26.6, on both polyfills (1.0.6);
- every probe in Playwright Chromium and WebKit 26.6 (1.0.7).

Editing the seam fails one test of its own: `internal/temporal.test.ts` › "names the polyfill
itself" asserts the seam names `@js-temporal/polyfill`. The CORE-92 check therefore swaps the
implementation with a Vitest alias and leaves the seam alone.

## 3. What `temporal-polyfill` fixes

Workaround probes passing on 1.0.7, out of each group's total (118 probes):

| Group | Passing | Group | Passing |
|---|---|---|---|
| D1 | 27 / 27 | D13 | 8 / 8 |
| D2 | 2 / 2 | D14 | 1 / 1 |
| D3 + D4 | 3 / 3 | D15 | 1 / 1 |
| D5 | 1 / 1 | D16 | **2 / 6** |
| D6 | 11 / 11 | D17 | 1 / 1 |
| D7 | 2 / 2 | D18 (WebKit) | 6 / 6 |
| D8 | 3 / 3 | D19 (WebKit) | **0 / 1** |
| D9 | 4 / 4 | D20 | 2 / 2 |
| D10 | 2 / 2 | D21 | 1 / 1 |
| D11 | 6 / 6 | D22 | **6 / 8** |
| D12 | 2 / 2 | zoned.A | 10 / 10 |
| | | zoned.B | 3 / 3 |
| | | zoned.D | 2 / 2 |
| | | zoned.E | **0 / 5** |

Every probe passes in 22 of the 26 groups. Two of those say nothing about the swap: D10 is a guard
whose probes pass on 0.5.1 too, and D17 is a Firefox defect that neither a Node nor this browser run
judges. 1.0.6 failed two more groups: D13 (6 / 8) and zoned.A (9 / 10).

The four groups that fail:

- **D16** is an ICU defect in the engine, so no polyfill fixes it.
- **D19**: in WebKit, 1.0.7 answers false for `Etc/UTC` equals `UTC`, as 1.0.6 did. 1.0.6 takes a
  non-primary identifier's primary from `resolvedOptions().timeZone`, which JavaScriptCore no
  longer canonicalizes. It passes on Node. The maintainers closed the report of it,
  fullcalendar #118 (not ours), as a known limitation.
- **D22**: the two failing probes ask for lengths that have no value in the standard today
  (tc39/proposal-temporal#3336, an open question), and 1.0.7 returns values for them.
- **zoned.E**: § 4.5.

D18 counts among the fixes: in WebKit, 0.5.1 reads ISO `0621-01-01` as `islamic-civil` year 2 and
1.0.7 reads year -1, as V8 does. A passing probe proves only the case it probes: on 1.0.6, D13's
probes passed for `America/Boa_Vista` and `Europe/Riga`, yet § 4.3 found the same class of
defect in 11 other zones.

## 4. What `temporal-polyfill` breaks

On 1.0.7, 14 of 71,333 tests failed. On 1.0.8, none fails that passes on `@js-temporal/polyfill`
(0 of 71,340 tests, Node), and the sweep lists no zone. Twelve come from § 4.4. One is `internal/temporal.test.ts` ›
"names the polyfill itself", which fails only because the run edited the seam (§ 2). One is a GMT
test bug: `plain/get/getNow.test.ts` asserts a strictly later reading of a frozen clock, and 1.0.7's
clock adds no sub-millisecond part, which the standard does not require (Temporal § 2.3.1
HostSystemUTCEpochNanoseconds). CORE-92 fixed that test.

On 1.0.6, 102 of 66,793 tests failed (the suite has grown since), from the three defects in
§ 4.1–§ 4.3. 1.0.7 fixes all three.

In every sample below, Node's built-in `Temporal` and `@js-temporal/polyfill` agree, and
`temporal-polyfill` differs.

### 4.1 Malformed RFC 9557 annotations accepted (1.0.6, about 50 tests; fixed in 1.0.7)

| Input to `PlainDate.from` | Built-in and 0.5.1 | 1.0.6 |
|---|---|---|
| `2024-10-03[]` | `RangeError` | `2024-10-03` |
| `2024-10-03[u-ca=hebrew][Asia/Tokyo]` | `RangeError` | `2024-10-03[u-ca=hebrew]` |
| `2024-10-03[u-ca=japanese;era=reiwa]` | `RangeError` | `2024-10-03` |

RFC 9557 puts the time zone annotation before every other annotation, and an annotation is never
empty. Tests: `test/annotationGrammar.test.ts`, the `isValid*` validators,
`internal/calendarValueOfZoned.test.ts`, `internal/calendarDateString.test.ts`.

### 4.2 Exact instants at the range limits rejected (1.0.6, about 15 tests; fixed in 1.0.7)

| Input to `ZonedDateTime.from` | Built-in and 0.5.1 | 1.0.6 |
|---|---|---|
| `-271821-04-20T00:00:00Z[Asia/Tokyo]` | `-271821-04-20T09:18:59+09:19[Asia/Tokyo]` | `RangeError` |
| `+275760-09-13T00:00:00Z[America/New_York]` | `+275760-09-12T20:00:00-04:00[America/New_York]` | `RangeError` |

Both instants are the limits of the `Instant` range, which TC39 Temporal accepts. Tests:
`zoned/classify/classifyStoredZoned.test.ts`, `zoned/calculate/addZoned.test.ts`,
`internal/zonedWallClock.test.ts`.

### 4.3 Wrong offset between two close offset changes (1.0.6, about 20 tests; fixed in 1.0.7)

When two offset changes come close together, 1.0.6 skips the period between them and reads the
wrong UTC offset all through it. A wall-clock time in that period converts to an instant an hour
off, and the transition search steps over both changes.

| Question | Built-in and 0.5.1 | 1.0.6 |
|---|---|---|
| `ZonedDateTime.from("2018-06-01T12:00[Africa/Casablanca]").toInstant()` | `2018-06-01T12:00:00Z` | `2018-06-01T11:00:00Z` |
| `hoursInDay` on 2018-05-13, `Africa/Casablanca` | 25 | 24 |
| `hoursInDay` on 2018-06-17, `Africa/Casablanca` | 23 | 24 |
| Next transition after 1976-03-28T00:30Z, `Africa/El_Aaiun` | `1976-04-14T01:00:00Z` | `1976-05-01T00:00:00Z` |

It is not limited to daylight-time pauses. A sweep compared each polyfill's offset with
`Intl.DateTimeFormat`'s (`timeZoneName: "longOffset"`) at 12:00 UTC on every day from 1970 to 2030,
in all 418 zones Node 26.12.1 lists (tzdata 2026e). 0.5.1 matched on every day. So did 1.0.7, swept
the same way to the end of 2036.
1.0.6 was wrong in 11 zones:

| Zone | Days wrong | When |
|---|---|---|
| `Africa/Casablanca` | 178 | Ramadan in 2012 and 2018–2021 |
| `Africa/Cairo` | 72 | Ramadan in 2010 and 2014 |
| `Europe/Chisinau` | 42 | 1990 |
| `Asia/Tomsk` | 31 | 2002 |
| `Pacific/Fiji` | 28 | 2020–2021 |
| `America/Argentina/San_Luis` | 22 | 2007–2008 |
| `America/Argentina/Ushuaia` | 21 | 2004 |
| `America/Argentina/Catamarca`, `La_Rioja`, `Rio_Gallegos` | 19 each | 2004 |
| `Africa/El_Aaiun` | 17 | 1976 |

`Africa/El_Aaiun` in 1976 is not a pause either. It has three offsets: −01 until 14 April, +00 until
1 May, then +01 (D13's trigger in `scripts/lib/workarounds.mjs`). 1.0.6 drops the +00 period and
reads −01 up to 1 May.

Which future dates it reaches depends on the time zone data the runtime carries. With tzdata 2026a,
`Africa/Casablanca` is also wrong in the Ramadan periods of 2029 and 2030 (265 days in all). tzdata
2026e keeps Morocco on +00 all year from 2026, so those periods are gone there. Any later pair of
close offset changes in the data meets the same defect.

Eight of the 11 zones (`Europe/Chisinau`, `Asia/Tomsk`, `Pacific/Fiji` and the five Argentine
zones) have no rows in the GMT suite, so the suite alone cannot catch this defect. It is the class
of `fullcalendar/temporal-polyfill` #73 (two offset changes inside one search window), which 1.0
fixed for that issue's own repros (`America/Noronha` and `America/Boa_Vista` in 2000).

Tests: `zoned/get/getDstTransitions.test.ts`, `zoned/calculate/getHoursInZonedDay.test.ts`,
`internal/zonedTransitionSearch.test.ts`, the Casablanca rows of `classifyStoredZoned.test.ts`.

### 4.4 Backward transition search stops about three years ahead (1.0.7, 12 tests; fixed in 1.0.8)

From any instant more than 94,867,200 s (1,098 days) after the current time,
`getTimeZoneTransition("previous")` returns the last transition before that horizon, not the last
one before the instant. `IntlTimeZone.getTransition` clamps a backward search to start at
`getCurrentEpochSec() + 94867200`.

| From, `America/New_York` | Built-in and 0.5.1 | 1.0.7 (run 2026-11-04) |
|---|---|---|
| `2030-06-15T00:00Z` | `2030-03-10T07:00:00Z` | `2029-11-04T06:00:00Z` |
| `3000-06-01T00:00Z` | `3000-03-09T07:00:00Z` | `2029-11-04T06:00:00Z` |

Temporal § 11.1.4 GetNamedTimeZonePreviousTransition returns "the last time zone UTC offset
transition strictly before" the instant in the IANA data, with no horizon. `getTimeZoneTransition("next")`,
`offset`, `hoursInDay` and `startOfDay` are right on the same dates. The answer depends on the
day the code runs; every failing test asks about year 3000 or the end of the `Instant` range, so
all 12 fail whatever the run date.

Tests: `internal/zonedTransitionSearch.test.ts` (2), `zoned/calculate/startOfZoned.test.ts` (2),
`zoned/compare/isInDaylightSaving.test.ts` (2), `unix/calculate/startOfUnix.test.ts`,
`unix/interval/intervalCountUnix.test.ts`, `calendar/calculate/floorToZone.test.ts`,
`zoned/calculate/getLocaleZonedStartOfWeek.test.ts`, `zoned/calculate/startOfQuarterForZoned.test.ts`,
`zoned/interval/intervalCountZoned.test.ts`.

### 4.5 Transitions before 1847 not found (1.0.7, no test fails; fixed in 1.0.8)

1.0.7 finds no transition before 1847-01-01, so `Asia/Manila`, `Pacific/Guam`, `Pacific/Kosrae`,
`Pacific/Palau` and `Pacific/Saipan` miss their change on 31 December 1844. Its search starts at
`minPossibleTransitionSec` (1847-01-01T00:00:00Z). `@js-temporal/polyfill`
has the same defect (js #372, tc39 #3330), and GMT's zoned.E code corrects it on both, so no GMT
test fails; only zoned.E's probes do.

### 4.6 Upstream

| Defect | Issue | State |
|---|---|---|
| § 4.1 Malformed annotations accepted | [#119](https://github.com/fullcalendar/temporal-polyfill/issues/119) | Fixed in 1.0.7 |
| § 4.2 Range-limit instants rejected | [#120](https://github.com/fullcalendar/temporal-polyfill/issues/120) | Fixed in 1.0.7 |
| § 4.3 Wrong offset between two close offset changes (follow-up to #73) | [#121](https://github.com/fullcalendar/temporal-polyfill/issues/121) | Fixed in 1.0.7 |
| § 4.4 Backward search stops about three years ahead | [#125](https://github.com/fullcalendar/temporal-polyfill/issues/125) | Fixed in 1.0.8 |
| § 4.5 Transitions before 1847 not found | [#126](https://github.com/fullcalendar/temporal-polyfill/issues/126) | Fixed in 1.0.8 |
| Persian: 78 years from 1502 to 2987 AP get the wrong leap year | [#127](https://github.com/fullcalendar/temporal-polyfill/issues/127) | Open; our fix is PR [#131](https://github.com/fullcalendar/temporal-polyfill/pull/131) |
| Chinese and Dangi read from `Intl`, which differs from native Temporal | [#128](https://github.com/fullcalendar/temporal-polyfill/issues/128) | Open; our fix is PR [#132](https://github.com/fullcalendar/temporal-polyfill/pull/132) |

The `/upstream/` tracker lists all seven reports and both PRs, closed ones included, as credit.

## 5. What a swap costs

| Part | Work |
|---|---|
| The seam | One import line in `src/internal/temporal.ts`. The package exports `Temporal`, `Intl` and `toTemporalInstant`, as GMT re-exports them |
| Types | About 238 type errors, nearly all from 12 helper type names the package does not export (`DateTimeUnit`, `SmallestUnit`, `RoundingMode`, `ToStringPrecisionOptions`, `PluralUnit`, `DifferenceOptions`, `DurationRoundTo`, `LargestUnit`, `TotalUnit`, `ToInstantOptions`, `ArithmeticOptions`, `ZonedDateTimeAssignmentOptions`). A short alias file in GMT covers them. Also 7 `@ts-expect-error` lines that no longer fire, and `ZonedDateTimeLike` without `timeZone` and `offset` |
| Dox | 68 files under `apps/dox/src` import `@js-temporal/polyfill` directly and move with it |
| Compat tooling | `scripts/lib/workarounds.mjs`, `scripts/temporal-compat.mjs`, the native suite and the upstream tracker name `@js-temporal/polyfill` in triggers and version checks |
| Workarounds | Delete the groups whose probes all pass; keep zoned.E, D16, D19 and D22; add one for each defect in § 4 that the release still has (none in 1.0.8 on Node) |
| Seam test | `internal/temporal.test.ts` asserts the package name |

What a swap gains: most of `internal/temporalCompat/` deleted, a smaller polyfill (23.3 kB min+gzip for
`temporal-polyfill/full/implementation`, against 44.2 kB for `@js-temporal/polyfill`, both bundled
and gzipped with the settings of `scripts/bundle-size.mjs`), and a
maintained release line.

## 6. When to swap

The swap is due when a `temporal-polyfill` release, imported through `/full/implementation`, passes
the whole `packages/gmt` suite on Node and in the three browsers the native suite runs, and the
offset sweep of § 4.3 finds no zone where it differs from `Intl.DateTimeFormat`. A Node run alone is
not enough: D17, D18 and D19 show only in a browser, and D19 shows in 1.0.6 and 1.0.7. The suite
alone is not enough either: it named only three of the 11 zones 1.0.6 got wrong (§ 4.3). Then nothing in
§ 4 needs a workaround, and § 5 is cleanup. CORE-92
adds this check to the weekly Temporal oracle run, which opens an issue when it holds.

## 7. Design notes for the swap

- **Import `/full/implementation`, not `/full`.** `/full` returns the runtime's built-in `Temporal`
  where one exists, which would change GMT's behaviour by engine. The native suite already measures
  the built-in implementations; the seam must stay one known implementation.
- **The default entry is not enough.** `temporal-polyfill` without `/full` supports only `iso8601`
  and `gregory`. GMT needs every calendar `/full` lists.
- **One implementation everywhere.** `packages/gmt` and `apps/dox` move in the same change, so Dox
  never mixes objects from two polyfills.
- **Trap: Vitest 5's file-system module cache is keyed by path, not contents.** It lives in
  `node_modules/.vitest-cache`. A package upgraded in place under the same path (a swap run that
  installs a newer `temporal-polyfill` over an older one) runs from the old cached transform and
  reports the old release's results. `scripts/native-suite.mjs` passes `--fsModuleCache=false` to
  every pass, control and swap, so each pass reads the files on disk. Any new script that runs the
  suite against an installed candidate does the same.
