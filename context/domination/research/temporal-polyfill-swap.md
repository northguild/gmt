# Temporal polyfill swap: `@js-temporal/polyfill` or `temporal-polyfill`

**Purpose:** Record whether GMT should replace `@js-temporal/polyfill` with `temporal-polyfill`
(fullcalendar/temporal-polyfill), what the swap costs, and what tells us to make it.

**Checked against:** `@js-temporal/polyfill` 0.5.1, `temporal-polyfill` 1.0.6 through its
`/full/implementation` entry, Node 26.12.1 (ICU 78.3), with Node's built-in `Temporal` as the
tie-breaker. The WebKit-only groups D18 and D19 were also probed in Playwright WebKit 26.6.

---

## 1. The choice

GMT stays on `@js-temporal/polyfill`. `temporal-polyfill` 1.0.6 fixes most of the defects GMT works
around today, but it has three defects of its own. The GMT suite catches all three, and an offset
sweep shows the third reaches 11 zones (§ 4.3). Under the zero-known-bugs rule
([AGENTS.md Core Rule 12](../../../AGENTS.md#core-rules-quick-reference)) each would need a new
workaround before a swap could ship. GMT swaps when a `temporal-polyfill` release passes the whole
GMT suite and the offset sweep (§ 6).

## 2. How it was tested

In a throwaway copy of the repo, `packages/gmt` depended on `temporal-polyfill` instead of
`@js-temporal/polyfill`, and `src/internal/temporal.ts` (the only file that names the
implementation) imported from `temporal-polyfill/full/implementation`. Then:

- `tsc --noEmit` in `packages/gmt`;
- the full `packages/gmt` Vitest suite;
- every repro in `internal/temporalCompat/repros.ts`, run through `runRepro` and `reproPasses`;
- one sample from each failure group, run on all three implementations;
- the D18 and D19 probes in Playwright WebKit 26.6, on both polyfills.

## 3. What `temporal-polyfill` fixes

Workaround probes passing, out of each group's total:

| Group | Passing | Group | Passing |
|---|---|---|---|
| D1 | 27 / 27 | D11 | 6 / 6 |
| D2 | 2 / 2 | D12 | 2 / 2 |
| D3 + D4 | 3 / 3 | D13 | **6 / 8** |
| D5 | 1 / 1 | D14 | 1 / 1 |
| D6 | 11 / 11 | D15 | 1 / 1 |
| D7 | 2 / 2 | D16 | **2 / 6** |
| D8 | 3 / 3 | D17 | 1 / 1 |
| D9 | 4 / 4 | D18 (WebKit) | 6 / 6 |
| D10 | 2 / 2 | D19 (WebKit) | **0 / 1** |
| | | zoned.A | **9 / 10** |
| | | zoned.B | 3 / 3 |
| | | zoned.D | 2 / 2 |
| | | zoned.E | **0 / 5** |

Every probe passes in 17 of the 22 groups. Two of those say nothing about the swap: D10 is a guard
whose probes pass on 0.5.1 too, and D17 is a Firefox defect that a Node run cannot judge. That leaves
15 groups the swap would retire. D18 counts among them: in WebKit, 0.5.1 reads ISO `0621-01-01` as
`islamic-civil` year 2 and 1.0.6 reads year -1, as V8 does. D19 does not: 1.0.6 also answers false
for `Etc/UTC` equals `UTC` in WebKit, because it too takes a non-primary identifier's primary from
`resolvedOptions().timeZone`. D16 is an ICU defect in the engine, so no polyfill fixes it. A
passing probe proves only the case it probes: D13's probes pass for `America/Boa_Vista` and
`Europe/Riga`, yet § 4.3 shows the same class of defect in 11 other zones.

## 4. What `temporal-polyfill` breaks

102 of 66,793 tests fail. In every sample below, Node's built-in `Temporal` and
`@js-temporal/polyfill` agree, and `temporal-polyfill` differs.

### 4.1 Malformed RFC 9557 annotations accepted (about 50 tests)

| Input to `PlainDate.from` | Built-in and 0.5.1 | 1.0.6 |
|---|---|---|
| `2024-10-03[]` | `RangeError` | `2024-10-03` |
| `2024-10-03[u-ca=hebrew][Asia/Tokyo]` | `RangeError` | `2024-10-03[u-ca=hebrew]` |
| `2024-10-03[u-ca=japanese;era=reiwa]` | `RangeError` | `2024-10-03` |

RFC 9557 puts the time zone annotation before every other annotation, and an annotation is never
empty. Tests: `test/annotationGrammar.test.ts`, the `isValid*` validators,
`internal/calendarValueOfZoned.test.ts`, `internal/calendarDateString.test.ts`.

### 4.2 Exact instants at the range limits rejected (about 15 tests)

| Input to `ZonedDateTime.from` | Built-in and 0.5.1 | 1.0.6 |
|---|---|---|
| `-271821-04-20T00:00:00Z[Asia/Tokyo]` | `-271821-04-20T09:18:59+09:19[Asia/Tokyo]` | `RangeError` |
| `+275760-09-13T00:00:00Z[America/New_York]` | `+275760-09-12T20:00:00-04:00[America/New_York]` | `RangeError` |

Both instants are the limits of the `Instant` range, which TC39 Temporal accepts. Tests:
`zoned/classify/classifyStoredZoned.test.ts`, `zoned/calculate/addZoned.test.ts`,
`internal/zonedWallClock.test.ts`.

### 4.3 Wrong offset between two close offset changes (about 20 tests)

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
in all 418 zones Node 26.12.1 lists (tzdata 2026e). 0.5.1 matched on every day. 1.0.6 was wrong in
11 zones:

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

### 4.4 Upstream

None of the three defects is reported to `fullcalendar/temporal-polyfill` yet. The owner files them
from drafts, § 4.3 as a follow-up to #73. § 6 waits on a release that fixes them.

## 5. What a swap costs

| Part | Work |
|---|---|
| The seam | One import line in `src/internal/temporal.ts`. The package exports `Temporal`, `Intl` and `toTemporalInstant`, as GMT re-exports them |
| Types | About 238 type errors, nearly all from 12 helper type names the package does not export (`DateTimeUnit`, `SmallestUnit`, `RoundingMode`, `ToStringPrecisionOptions`, `PluralUnit`, `DifferenceOptions`, `DurationRoundTo`, `LargestUnit`, `TotalUnit`, `ToInstantOptions`, `ArithmeticOptions`, `ZonedDateTimeAssignmentOptions`). A short alias file in GMT covers them. Also 7 `@ts-expect-error` lines that no longer fire, and `ZonedDateTimeLike` without `timeZone` and `offset` |
| Dox | 68 files under `apps/dox/src` import `@js-temporal/polyfill` directly and move with it |
| Compat tooling | `scripts/lib/workarounds.mjs`, `scripts/temporal-compat.mjs`, the native suite and the upstream tracker name `@js-temporal/polyfill` in triggers and version checks |
| Workarounds | Delete the groups whose probes all pass; keep zoned.A, zoned.E, D13, D16 and D19; add one for each defect in § 4 unless a release has fixed it. The § 4.3 workaround must correct the offset lookup, not only the transition search |
| Seam test | `internal/temporal.test.ts` asserts the package name |

What a swap gains: most of `internal/temporalCompat/` deleted, a smaller polyfill (19.5 kB, or
23.3 kB for `/full`, against 52.1 kB min+gzip, by the package's own size comparison), and a
maintained release line.

## 6. When to swap

The swap is due when a `temporal-polyfill` release, imported through `/full/implementation`, passes
the whole `packages/gmt` suite on Node and in the three browsers the native suite runs, and the
offset sweep of § 4.3 finds no zone where it differs from `Intl.DateTimeFormat`. A Node run alone is
not enough: D17, D18 and D19 show only in a browser, and D19 shows in 1.0.6. The suite alone is not
enough either: it names only three of the 11 zones in § 4.3. Then nothing in
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
