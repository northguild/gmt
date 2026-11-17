# Temporal polyfill swap: `@js-temporal/polyfill` or `temporal-polyfill`

**Purpose:** Record whether GMT should replace `@js-temporal/polyfill` with `temporal-polyfill`
(fullcalendar/temporal-polyfill), what the swap costs, and what tells us to make it.

**Checked against:** `@js-temporal/polyfill` 0.5.1 and `temporal-polyfill` 1.0.8 through its
`/full/implementation` entry, on Node 26.12.1 (ICU 78.3, tzdata 2026e), with Node's built-in
`Temporal` as the tie-breaker. The browser probes ran in Playwright Chromium and WebKit 26.6.

---

## 1. The choice

`temporal-polyfill` 1.0.8 fixes most of the defects GMT works around today. On Node, the swap check
finds no test that fails on 1.0.8 and passes on `@js-temporal/polyfill` (0 of 71,340 tests), and the
offset sweep finds no zone where it differs from `Intl.DateTimeFormat` (0 zones). The move itself is
CORE-108 (#460). GMT swaps when a `temporal-polyfill` release passes the whole GMT suite and the
offset sweep (§ 6).

## 2. How it was tested

In a throwaway copy of the repo, `packages/gmt` depended on `temporal-polyfill` instead of
`@js-temporal/polyfill`, and `src/internal/temporal.ts` (the only file that names the
implementation) imported from `temporal-polyfill/full/implementation`. Then:

- `tsc --noEmit` in `packages/gmt`;
- the full `packages/gmt` Vitest suite;
- every repro in `internal/temporalCompat/repros.ts`, run through `runRepro` and `reproPasses`;
- every probe in Playwright Chromium and WebKit 26.6.

Editing the seam fails one test of its own: `internal/temporal.test.ts` › "names the polyfill
itself" asserts the seam names `@js-temporal/polyfill`. The CORE-92 check therefore swaps the
implementation with a Vitest alias and leaves the seam alone.

## 3. What `temporal-polyfill` fixes

1.0.8 passes every workaround probe in 22 of the 26 groups (118 probes in all). Two of those say
nothing about the swap: D10 is a guard whose probes pass on 0.5.1 too, and D17 is a Firefox defect
that neither a Node nor a Chromium or WebKit run judges.

The four groups that fail:

- **D16** (2 / 6) is an ICU defect in the engine, so no polyfill fixes it.
- **D19** (0 / 1): in WebKit, `Etc/UTC` equals `UTC` answers false. The package takes a non-primary
  identifier's primary from `resolvedOptions().timeZone`, which JavaScriptCore no longer
  canonicalizes. It passes on Node. The maintainers closed the report, fullcalendar #118 (not ours),
  as a known limitation.
- **D22** (6 / 8): the two failing probes ask for lengths that have no value in the standard today
  (tc39/proposal-temporal#3336, an open question), and the package returns values for them.
- **zoned.E** (0 / 5): transitions before 1847-01-01 are not found, because the search starts at
  `minPossibleTransitionSec`. `Asia/Manila`, `Pacific/Guam`, `Pacific/Kosrae`, `Pacific/Palau` and
  `Pacific/Saipan` miss their change on 31 December 1844. `@js-temporal/polyfill` has the same
  defect (js #372, tc39 #3330); GMT's zoned.E code corrects it on both.

A passing probe proves only the case it probes: the offset sweep of § 4 found a whole class of
defects that D13's probes missed.

## 4. What `temporal-polyfill` broke, and the check that finds it

Earlier releases failed the GMT suite in five ways, all fixed by 1.0.8 (§ 4.6). In every case
Node's built-in `Temporal` and `@js-temporal/polyfill` agree, and `temporal-polyfill` differed.

- **Malformed RFC 9557 annotations accepted.** `2024-10-03[]` and `2024-10-03[u-ca=hebrew][Asia/Tokyo]`
  parsed. RFC 9557 puts the time zone annotation before every other annotation, and an annotation is
  never empty. Tests: `test/annotationGrammar.test.ts`, the `isValid*` validators.
- **Exact instants at the range limits rejected.** `-271821-04-20T00:00:00Z[Asia/Tokyo]` and
  `+275760-09-13T00:00:00Z[America/New_York]` threw. Both are limits of the `Instant` range.
  Tests: `zoned/classify/classifyStoredZoned.test.ts`, `zoned/calculate/addZoned.test.ts`.
- **Wrong offset between two close offset changes.** The package skipped the period between the
  changes and read the wrong UTC offset all through it, so a wall-clock time converted to an instant
  an hour off. 11 zones were wrong, among them `Africa/Casablanca` (Ramadan 2012 and 2018–2021),
  `Africa/Cairo`, `Pacific/Fiji`, `Africa/El_Aaiun` (1976, three offsets in 4 months) and five
  Argentine zones; eight of the 11 have no rows in the GMT suite, so the suite alone cannot catch
  this class. Tests: `internal/zonedTransitionSearch.test.ts`,
  `zoned/get/getDstTransitions.test.ts`.
- **Backward transition search stopped about three years ahead.** From any instant more than
  94,867,200 s after the current time, `getTimeZoneTransition("previous")` returned the last
  transition before that horizon, not the last one before the instant. Temporal § 11.1.4
  GetNamedTimeZonePreviousTransition has no horizon. The answer depended on the day the code ran.
- **Transitions before 1847 not found** (§ 3, zoned.E).

**The offset sweep** is the proof that the check finds a real defect. It compares each polyfill's
offset with `Intl.DateTimeFormat`'s (`timeZoneName: "longOffset"`) at 12:00 UTC on every day from
1970 to 2036, in every zone the runtime lists. 0.5.1 and 1.0.8 match on every day; 1.0.6 was wrong
in the 11 zones above.

One more failure was not a polyfill defect: `plain/get/getNow.test.ts` asserted a strictly later
reading of a frozen clock, and the package's clock adds no sub-millisecond part, which the standard
does not require (Temporal § 2.3.1 HostSystemUTCEpochNanoseconds). CORE-92 fixed that test.

### 4.6 Upstream

| Defect | Issue | State |
|---|---|---|
| Malformed annotations accepted | [#119](https://github.com/fullcalendar/temporal-polyfill/issues/119) | Fixed in 1.0.7 |
| Range-limit instants rejected | [#120](https://github.com/fullcalendar/temporal-polyfill/issues/120) | Fixed in 1.0.7 |
| Wrong offset between two close offset changes (follow-up to #73) | [#121](https://github.com/fullcalendar/temporal-polyfill/issues/121) | Fixed in 1.0.7 |
| Backward search stops about three years ahead | [#125](https://github.com/fullcalendar/temporal-polyfill/issues/125) | Fixed in 1.0.8 |
| Transitions before 1847 not found | [#126](https://github.com/fullcalendar/temporal-polyfill/issues/126) | Fixed in 1.0.8 |
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
offset sweep of § 4 finds no zone where it differs from `Intl.DateTimeFormat`. A Node run alone is
not enough: D17, D18 and D19 show only in a browser, and D19 shows in 1.0.6 and 1.0.7. The suite
alone is not enough either: it named only three of the 11 zones 1.0.6 got wrong (§ 4). Then nothing in
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
