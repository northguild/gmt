# Range-Edge Correctness Audit (CORE-6)

**Research Date:** 2026-09-14  
**Purpose:** Record every range-edge defect found while building CORE-6, its root cause, fix and covering tests, the call sites proven safe, the `@js-temporal/polyfill` defects found along the way, and the zero-known-bugs rule that came out of it.

---

## 1. How this started

The CORE-6 legacy-documentation pass pinned 9 real defects as `it.fails` rows and filed them to a later story. The owner ruled that GMT never ships a known bug. Every defect is fixed in the story that finds it, and the search widens to the whole bug class. That ruling is now [AGENTS.md Core Rule 12](../../../AGENTS.md#core-rules-quick-reference), with `scripts/test-markers.mjs check` enforcing it in `pnpm run validate`.

The 9 pinned rows led to a library-wide audit of every `±1`-unit step, run against the built package. Every defect below was reproduced before it was fixed, and each fix started from a failing test whose expected value came from the function's contract, confirmed with a plain Temporal computation.

---

## 2. Root cause shared by the interval defects

Most of the older positional interval functions treat an interval as closed, `[start, end]`. To find where an interval stops, they computed `end + 1 unit` (1 ns, 1 day, or 1 epoch unit for Unix). Two things break that at the edges of the representable range:

| Edge | What happens | Example |
|---|---|---|
| `PlainTime` midnight | `PlainTime` has no date, so `23:59:59.999999999 + 1 ns` wraps to `00:00:00` | `intervalXorAllTime([{ start: "22:00:00", end: "23:59:59.999999999" }])` returned `[]` |
| Maximum value | `+1` past the last representable `PlainDate`/`PlainDateTime`/`Instant` throws; the catch returned the sentinel | `intervalAbutsUtc` at `+275760-09-13T00:00:00Z` returned `false` for intervals that abut |

A `+1` or `−1` step is safe only when a strict comparison already proves the result stays in range. For example, `bStart − 1` runs only after `aStart < bStart` has been established.

---

## 3. Defects fixed

| # | Functions | Defect | Fix |
|---|---|---|---|
| A | `intervalAbuts{Time,Date,DateTime,Utc,Zoned}` | `aEnd + 1` wrapped (Time) or threw (max) | `internal/closedAbuts.ts`: step the *later* start down, which cannot wrap or overflow |
| B | `intervalXorAll{Time,Date,DateTime,Utc,Zoned,Unix}` | The sweep's close event sat at `end + 1` | `internal/closedXorSweep.ts`: open/close events, and never computes `end + 1` |
| C | `transitionAtOrBefore` (`internal/zonedBucket.ts`), used by `startOfZoned`, `startOfQuarterForZoned`, `floorToZone`, `startOfUnix`, `intervalCountZoned`, `intervalCountUnix`, `getLocaleZonedStartOfWeek` | `zoned + 1 ns` threw at the max instant; the catch dropped the transition, so boundaries came out an hour off in DST zones | Look for a transition exactly on the value from `zoned − 1 ns` instead |
| D | `endOf{Date,DateTime,Utc,Zoned,Unix}` for month, week, quarter and year; `roundDate`, `roundDateTime`, `intervalCountDate`, `intervalCountDateTime`; `getLocaleZonedEndOfWeek` | Built the unit's start, which is below the minimum in the earliest month, so returned a sentinel although the answer exists | Compute the end forward from the input (`getStartOfNextDateUnit`, `getDaysIntoDateUnit`, `getStartOfNextDateTimeUnit`, `zonedUnitEnd`) |
| E | Every `unix/interval` function | Accepted fractional or unsafe numbers (`intervalXorUnix(0,1,0.5,2)` returned a negative piece) and `""` as epoch 0 | `internal/unixEpochValue.ts`: safe integers only; empty strings rejected |
| D9 | `hasCalendarAnnotation`, used by `spanNs`, `toNanoseconds`, `isValidInstant`, `isValidInterval`, zoned validators | Matched only `[u-ca=`, so the critical-flag form `[!u-ca=hebrew]` passed and was read in the wrong calendar | Match `/\[!?u-ca=/` |

Found and fixed during the same pass:

- `intervalDifference*` (all six families): when B lay entirely before A, the remaining piece started at `bEnd + 1`, inside the gap.
- `endOfDate` / `endOfDateTime` with Sunday-first weeks: `(6 − 7) % 7` is `−1` in JavaScript, so a Sunday's week ended on the previous Saturday.
- Wrong, unpinned JSDoc examples in `roundDate`, `roundDateTime` and `endOfDateTime`.
- `intervalXorZoned` JSDoc said touching intervals give one piece. They give two, each stopping one nanosecond short of the shared instant. Only a shared start or a shared end gives one piece. Both cases are now pinned by tests.
- `isValidUnixRange` and `isValidUnixInterval` accepted fractional, unsafe, empty and whitespace-only epochs that the Unix interval functions reject.
- 66 test files had `$aStart..$aEnd` in their test names, which Vitest reads as a property path and renders as `undefined`. The names now use `$aStart to $aEnd`.

---

## 4. Call sites proven safe

Each was probed at the minimum and maximum edges (and midnight for `PlainTime`) and returned the correct value.

- **Pairwise `intervalXor*` and `intervalDifference*` steps.** `bStart − 1` runs only under `aStart < bStart`, and `bEnd + 1` only under `aEnd > bEnd`.
- **`intervalXorAll*` `point − 1`.** The closing point is always greater than the run start.
- **`intervalOverlappingDays*` `+ 1`.** It adds to a day count, not a date.
- **`zonedBucket.ts` `transition − 1 ns`.** A real transition sits far above the minimum instant.
- **`advanceBusinessDays`, `fiscalCalendar`, `getDstTransitions`, `endOfQuarterFor*`, `mapZonedHoursInDay`.** Each overflows only when the true answer is itself out of range, so the sentinel is correct there.

---

## 5. `@js-temporal/polyfill` 0.5.1 defects

GMT imports `@js-temporal/polyfill` everywhere (dependency `^0.5.1`) and never uses a runtime's built-in Temporal, so polyfill defects reach every GMT user.

### 5.1 Wall-clock → instant fails in the last hours of the range

- **Symptom.** In IANA zones ahead of UTC, every wall-clock → instant conversion throws `RangeError: Invalid time value` from `+275760-09-13T00:00:00.001` local onward. That is the last *offset* hours of the range: 10 h for `Australia/Sydney`, 14 h for `Pacific/Kiritimati`.
  - `Temporal.ZonedDateTime.from("+275760-09-13T09:00:00+10:00[Australia/Sydney]")` throws.
  - So do `PlainDateTime#toZonedDateTime`, `add` with calendar units, `with`, `round` and `startOfDay`.
- **Spec verdict: the input must parse.** `ToTemporalZonedDateTime` → `InterpretISODateTimeOffset` with `offset: "reject"`:
  1. `CheckISODaysRange(+275760-09-13)` passes, because the epoch-day count is exactly 10⁸.
  2. `GetPossibleEpochNanoseconds` → `GetNamedTimeZoneEpochNanoseconds` returns nsMaxInstant, which passes `IsValidEpochNanoseconds`.
  3. The candidate offset matches.

  Source: tc39/proposal-temporal `spec/abstractops.html`, `spec/instant.html`, `spec/zoneddatetime.html` at `main`. test262 `built-ins/Temporal/ZonedDateTime/from/argument-string-limits.js` expects the analogous offset-zone strings to succeed.
- **Root cause.** In polyfill 0.5.1 `lib/ecmascript.ts`, `GetNamedTimeZoneEpochNanoseconds` clamps its one-day-later probe back to the out-of-range value instead of to `NS_MAX`. `GetFormatterParts` then calls `Intl.DateTimeFormat#format` past 8.64e15 ms, which throws.
- **Built-in Temporal is correct.** Tested 2026-09-14:

  | Runtime | Result |
  |---|---|
  | `@js-temporal/polyfill` 0.5.1 (latest on npm; a fresh install is byte-identical) | throws |
  | Chromium 152 built-in `Temporal` | all cases correct |
  | Node 24.21.0 | no `Temporal` by default |
  | Node 24.21.0 `--harmony-temporal` (V8) | all cases correct |

- **Upstream status.** Fixed on js-temporal/temporal-polyfill `main` by commit `05ce7a3` ("Polyfill: Correctly handle limits in GetNamedTimeZoneEpochNanoseconds", ported from tc39/proposal-temporal `0096343850`, merged via PR #359 on 2026-04-22). No release includes it. No duplicate issue exists. A release request is drafted for the owner to file.
- **GMT decision (owner).** Waiting would ship a known bug, so GMT routes every wall-clock → instant conversion through internal helpers.
- **Implementation:** `internal/zonedWallClock.ts` and `internal/zonedWallClockOperations.ts` rebuild the spec steps (`GetPossibleEpochNanoseconds` with the corrected clamp, `GetEpochNanosecondsFor`, `InterpretISODateTimeOffset`, `GetStartOfDay`) from operations the polyfill gets right at the limits.
  - Each wrapper calls the polyfill first and keeps its answer whenever it has one.
  - It recomputes only when the polyfill throws, the zone is a named non-UTC zone, and the date is within 31 days of a limit. Otherwise it re-throws the polyfill's error, so invalid input still returns each function's sentinel.
- **Coverage:**
  - 104 `ZonedDateTime.from` call sites, including `parseCalendarZonedValue` and its 55 callers.
  - 23 targeted rewrites of `toZonedDateTime`, `startOfDay`, `hoursInDay` and calendar-unit `add`/`subtract`/`with`/`round`.
  - UTC-only and fixed-offset paths are unchanged, because the polyfill handles them correctly.
- **Removal:** the fallback goes once a fixed polyfill release is GMT's dependency floor.

### 5.2 Next-transition lookup stops short of the maximum

- **Symptom:**
  - `Temporal.PlainDate.from("+275760-09-07").toZonedDateTime("America/Santiago")` throws `TypeError: Cannot read properties of null (reading 'sign')`.
  - `getTimeZoneTransition("next")` misses Santiago's transition at `+275760-09-07T04:00:00Z`.
  - The same date in `America/New_York` works, and so does `+275760-09-01` in Santiago.
- **Correct result:** 7 September starts at `+275760-09-07T01:00:00-03:00[America/Santiago]` and is 23 hours long. 6 September is 24 hours, and it failed too.
- **Root cause:** the polyfill's `GetNamedTimeZoneNextTransition` returns `null` as soon as its search step would pass the maximum (`if (rightMs > MS_MAX) return null`), without checking the remaining days. `GetStartOfDay` then reads that `null`.
- **Upstream status:** still present on polyfill `main`. Only the step size changed, and it still overshoots. This is an open defect, reported separately from 5.1.
- **GMT fix:** start of day finds the transition by bisection. The next transition walks back from the maximum when the polyfill returns `null` within three years of it.
- **Functions corrected:** `getDstTransitions`, `getHoursInZonedDay`, `mapZonedHoursInDay`, `roundZoned`/`roundUnix` to a day, and the zone-bucket code behind `intervalCountZoned`. For example, 22:00 → 03:00 across the skipped hour now counts 4 hours, not 5.

### 5.3 Zoned differences near the maximum

- **Without a `smallestUnit`, the spec returns a value.** `DifferenceZonedDateTime` resolves one wall-clock time that is never later than the later operand. `total`, `round` and duration `compare` resolve the end of a one-unit window that stays in range. Chromium 152 returns every value. Polyfill 0.5.1 throws in zones ahead of UTC because of the clamp bug in §5.1, and `05ce7a3` fixes it.
- **Affected GMT functions:** `diffUnix`, `diffUnixAsDuration`, `intervalLengthZoned`, `intervalLengthUnix`, `durationAs`, `normalizeDuration`, `compareDurations`, and `formatRelative*`.
- **Examples:**
  - `durationAs("PT49H", "days", { relativeTo: "+275760-09-10T05:00:00+10:00[Australia/Sydney]" })` is `2.0416666666666665`.
  - `compareDurations("P3D", "PT73H", same)` is `-1`.
- **GMT fix (done):** `internal/zonedWallClockDifference.ts` rebuilds the spec steps and runs only when the polyfill throws near a limit.
  - **Spec steps rebuilt:** `DifferenceZonedDateTime`, `DifferenceZonedDateTimeWithRounding`, `RoundRelativeDuration`, `ComputeNudgeWindow`, `NudgeToCalendarUnit`, `NudgeToZonedTime`, `BubbleRelativeDuration`.
  - **Routed functions:** `diffUnix`, `diffUtc`, `diffZoned` and their `*AsDuration` forms, `intervalLength{Zoned,Unix,Utc}`, `durationAs`, `normalizeDuration`, `compareDurations`, and `formatRelative{Zoned,Utc,Unix}`.
  - **Coverage:** rows at both the maximum (Sydney, Kiritimati) and the minimum (New York, Honolulu), each checked against Chromium 152 and Chrome for Testing 153.
- **The minimum edge is a separate upstream defect.** `05ce7a3` fixes the maximum side only. With it applied, the polyfill still throws on every minimum-edge row.
- **Node 24's `--harmony-temporal` build is not a usable oracle.** It throws on several of these cases, and it returns `-2` where `NudgeToCalendarUnit` gives `-2.0416666666666665`.
- **With a `smallestUnit`, or a nudge window that passes the maximum, the spec throws.** `ComputeNudgeWindow`, `NudgeToZonedTime` and `BubbleRelativeDuration` resolve a point past the end of the range, in every zone. Chromium agrees, so GMT's sentinel is correct there.

### 5.4 `UTC` skips the range check in the polyfill

- **The spec:** `GetPossibleEpochNanoseconds` must throw a `RangeError` for any out-of-range candidate, including in `UTC`.
- **The polyfill:** its `"UTC"` fast path returns `[GetUTCEpochNanoseconds]` without that check, and it is unchanged on `main`.
- **The effect:** near the maximum in `UTC`, rounded differences and totals return values where the spec and Chromium throw. `+00:00` and `Europe/London` already throw correctly. For example, `intervalLengthUtc` over `[max − 2d 1h, max]` in days returned `2.0416666666666665`.
- **GMT decision:** follow the spec and return the sentinel, so `UTC` behaves like `+00:00`.

### 5.5 Non-ISO calendars

- **Fields → ISO date near the limits:** `calendarToIsoDate` bisects outside the legacy `Date` range and throws `Invalid ISO date`. The spec and test262 `intl402/Temporal/PlainDate/from/extreme-dates.js` require success, and Chromium round-trips every calendar at both edges.
  - The windows that fail in 0.5.1:

    | Calendar | Near the maximum | Near the minimum |
    |---|---|---|
    | buddhist | 32 d | 2 d |
    | hebrew | 6 d | none |
    | islamic-civil and islamic-umalqura | 9 d | 276 d |
    | islamic-tbla | 9 d | 275 d |
    | persian | none | 357 d |

  - The defect is still present on polyfill `main`.
- **Wrong values at ordinary dates:**
  - Buddhist reads are wrong for every date before 1582-10-15: `1000-01-01` reads as 1542-M12-27, where Chromium gives 1543-M01-01.
  - Hebrew is one day off in the far past near the minimum.
- **Reach into GMT:**
  - `isValidCalendarDate("279517-10-11[u-ca=hebrew]")` returned `false`.
  - `convertDateToCalendar("+275760-09-13", "hebrew")` produced a string GMT could not read back.
  - `convertDateToCalendar("1000-01-01", "buddhist")` returned `1542-12-27`.
- **Out of reach:** coptic, ethiopic, chinese and dangi fail at every date in 0.5.1, but GMT does not expose them directly.
- **GMT decision:** fix every supported calendar in GMT in this branch. A spec is in `specs/CORE-6-calendar-correctness-spec.md`.

### 5.6 Upstream

- **Drafts for the owner to file:**
  - A: a release request for `05ce7a3`.
  - B: the Santiago next-transition bug (§5.2).
  - C: the calendar near-limit bug, plus the ordinary-date calendar defects.
  - D: the `UTC` range check.
- **Status:** none were posted by an agent.
- **The minimum date:** the spec's default `offset: "reject"` rejects any local date of `-271821-04-19`, including the string New York prints for the minimum instant. GMT follows the spec and returns the sentinel. V8 deviates and accepts it.

---

## 6. Rule and enforcement

- **Rule:** [AGENTS.md Core Rule 12](../../../AGENTS.md#core-rules-quick-reference) and [testing standards § Zero known bugs](../../testing-standards/references/index.md#zero-known-bugs).
- **Expected values:** [testing standards § Know the correct value before writing the assertion](../../testing-standards/references/index.md#know-the-correct-value-before-writing-the-assertion). A test states what the function should return, never what it currently returns.
- **Gate:** `node scripts/test-markers.mjs check`, run by `pnpm run validate`. It fails on `it.fails`, `.skip`, `.todo`, `.only`, `xit`/`xdescribe`, `skipIf`/`runIf`, and "known defect" or "known bug" notes.
- **Agents:** `tdd-dev` fixes every defect it finds in the same run. `tester` reports defects as blocking and never pins them. `gmt-reviewer` re-derives expected values from the spec and reports a wrong one as blocking. `driver` and `master` treat a reported defect as a blocker. `finalizer` refuses to close a story that carries one.

---

## Sources

- TC39 Temporal specification, tc39/proposal-temporal `spec/*.html` (`main`, commit e8cc03f).
- test262: `built-ins/Temporal/ZonedDateTime/from/argument-string-limits.js`.
- js-temporal/temporal-polyfill: v0.5.1 `lib/ecmascript.ts`; commit `05ce7a3`; PR #359.
- Reproductions: GMT's built `dist` (Node 24.21.0), Chromium 152 via Playwright, Node `--harmony-temporal`.
- GMT specification: [CORE-6 spec](../specs/CORE-6-spec.md), [CORE-6 issue](../issues/CORE-6.md), [coding-standards § 8 half-open intervals](../../coding-standards.md#8-intervals-are-half-open-start-end).
