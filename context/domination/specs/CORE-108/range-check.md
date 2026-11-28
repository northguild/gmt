# Slice 1 — Month-range guard and D9 retarget

Runs on `@js-temporal/polyfill` 0.5.1 (the dependency does not change until slice 2). Rows from
[index § Authority](./index.md#authority--what-each-rule-rests-on): the range, `CalendarDateAdd`,
`IsValidEpochNanoseconds`, `IsValidDuration`, 13 months, 353 days, the bound, always-on.

## The defect (measured, Node 26, `temporal-polyfill` 1.0.8)

1.0.8 does in-range non-ISO month arithmetic in bounded work (3,000,000 months: ≤ 7 ms in every GMT
calendar), but it throws `RangeError` for an out-of-range month amount only after work linear in
the amount, with no `Intl` read. `{ months: 4294967295 }`:

| Call | Time |
| ---- | ---- |
| `PlainDate(hebrew).add` | 5,028 ms |
| `PlainDate(indian).add` | 2,899 ms |
| `PlainYearMonth(hebrew).add` | 3,329 ms |
| `Duration.total` relativeTo PlainDate(hebrew) / ZonedDateTime(hebrew) | 3.9 s / 16 s |
| `PlainDate(persian / ethioaa / coptic / islamic-*)` | 0.3–1.4 s |
| iso8601, gregory, japanese, buddhist, roc | 0 ms |

Firefox and WebKit run it 3–4× slower, which is the one swap-only failure of the CORE-92 run:
`largeMonthArithmetic.test.ts` › `addZoned(… [u-ca=ethioaa], { months: 4294967295 })`, 1,187–1,365 ms.
GMT's plain path never reaches the slow call (D9's `isLargeMonthSpan` branch is ungated); the zoned
path does (`addWithCalendarCompat` is gated on a probe that is false on 1.0.8). After slice 3
deletes `largeMonthSpan.ts`, every path would reach it.

Year amounts are not affected: `{ years: 4294967295 }` throws in 3 ms.

## The bound

`MAX_MONTHS_IN_RANGE = 13 × (⌈200,000,001 / 353⌉ + 1) = 13 × 566,574 = 7,365,462`

- 200,000,001: days from −271821-04-19 to +275760-09-13 (`ISODateWithinLimits`).
- 353: the shortest year in any GMT calendar, so the range holds at most ⌈200,000,001 / 353⌉ whole
  years; `+ 1` covers the partial years at both ends.
- 13: the most months in any year.

Write the constant as that expression in code, with a one-line comment per factor, not as the literal.

**Why |months| > bound proves the result is out of range.** `IsValidDuration` gives every non-zero
field one sign, so years, weeks and days never offset months; any months amount larger than the most
months between two in-range dates lands outside the range from every in-range start. The spec then
throws `RangeError`, so the guard's throw changes no result. A ZonedDateTime's range is narrower than
a PlainDate's, so the bound holds for it too.

## Guard

`packages/gmt/src/internal/temporalCompat/monthRange.ts`, exported through `temporalCompat/index.ts`
(README Rule 1). `assertMonthsInRange(months)` throws
`new RangeError("months amount past Temporal's date range")` when `Math.abs(months) > MAX_MONTHS_IN_RANGE`,
and reads nothing from `Temporal`. It takes the number, not a Duration, so callers pass
`duration.months` after they have a `Temporal.Duration` (parsing stays where it is).

### Call sites

Every internal place a caller-supplied duration with months meets a date. Build the list first:
`grep -rnE '\.(add|subtract|total|round)\(|Duration\.compare\(' packages/gmt/src --include='*.ts'`
minus tests, then keep each hit whose receiver is a `PlainDate`, `PlainDateTime`, `PlainYearMonth`
or `ZonedDateTime`, or whose options carry `relativeTo`. Put the call at the narrowest shared helper,
not in every public function. Known helpers:

- `calendarDateAdd` (`temporalCompat/calendarDateArithmetic.ts`)
- `addToZoned`, `subtractFromZoned`, `addToZonedDisambiguated` (`internal/zonedWallClockOperations.ts`)
- the relativeTo paths in `internal/resolveDurationRelativeTo.ts`, `internal/exactDuration.ts`,
  `internal/zonedWallClockDifference.ts` (`Duration.compare` at lines ~352, ~367)
- `addYearMonth` / year-month arithmetic, `addDateTime`, `intervalFromDuration{Date,DateTime,Zoned}`

Record the final list as a table in the module header (helper → public functions that reach it).
A helper slice 3 deletes must hand its guard call to the code that replaces it; slice 3 checks this.

## temporalCompat README

Rule 2 ("dormant unless needed") gains one sentence: a guard that fires only where the spec throws
is always on, because its answer is the spec's and a probe would cost what it saves. The D9 row in
§ Workarounds becomes the retargeted text below; § Removal steps 9 is rewritten in slice 3.

## D9 retarget

Same defect class, both halves: non-ISO month arithmetic costs work linear in the amount.
0.5.1 has both halves (in-range OOM, handled by `largeMonthSpan.ts`); 1.0.8 has only the out-of-range
half (handled by the guard). This slice adds the guard alongside `largeMonthSpan.ts`; slice 3 removes
`largeMonthSpan.ts`.

New canary-only repro in `repros.ts` (D9), raw `Temporal`, no GMT code:

- `t1` = time for `Temporal.PlainDate.from("2024-01-15[u-ca=hebrew]").add({ months: 40_000_000 })`
- `t2` = the same with `400_000_000`; both must throw `RangeError` (anything else fails the repro)
- run `t1` first; fails at once, without `t2`, when `t1` > 5,000 ms (absolute ceiling)
- otherwise passes when `t2 < 3 × t1 + 10` ms (bounded work); linear work gives `t2 ≈ 10 × t1`

Measure with `performance.now()`. On 1.0.8, `t1` is ~0.5 s on Node and ~2 s in a browser, under the
ceiling, so the ratio decides and fails (linear). On 0.5.1 the polyfill stops at the range limit but
`t1` alone is ~12-30 s, so the ceiling fails it without `t2` (the page timeout is 60 s). D9 stays
"still needed" on both polyfills. Keep the old D9
repros (the `formatToParts` read count, `D9_INTL_READ_LIMIT`, `D9_MONTHS`) until slice 3.

## Tests

`monthRange.test.ts` (new):

| Row | Expected | Why |
| --- | -------- | --- |
| `assertMonthsInRange(7_365_462)` | no throw | the bound itself |
| `assertMonthsInRange(7_365_463)` / `(-7_365_463)` | RangeError | one past, both signs |
| `assertMonthsInRange(4294967295)` | RangeError | largest valid months field |
| `MAX_MONTHS_IN_RANGE` | `13 * (Math.ceil(200_000_001 / 353) + 1)` | the derivation, not a pasted literal |
| for each id in `calendarSystemIds.ts`: `gmt.diffDate("-271821-04-19[u-ca=<id>]", "+275760-09-13[u-ca=<id>]", "months")` | `< MAX_MONTHS_IN_RANGE` | the bound covers every GMT calendar; run in `runInBoundedChild` (0.5.1 needs D9 for it) |
| same, hebrew | `6_772_637` | the real maximum; cross-check `floor((235y − 234) / 19)` (D–R) in a scratch script |

Public rows: README Rule 5 forbids mocking Temporal, so no spy rows. Public rows are timing rows in
`largeMonthArithmetic.test.ts` (child process, `MAX_CALL_MS = 1_000`), one per family, hebrew date,
`{ months: 4294967295 }` / `P4294967295M`, expected the existing sentinel:
`addDate`, `subtractDate`, `addDateTime`, `addYearMonth`, `addZoned`, `subtractZoned`,
`totalDuration` (relativeTo date and zoned), `totalUnits`, `addDuration` and `subtractDuration`
(relativeTo), `normalizeDuration` (relativeTo), `compareDurations` (relativeTo), each
`intervalFromDuration*` that takes months, and any other public function the call-site table lists.

**Red evidence.** These rows may pass on 0.5.1 already. Show red the way CORE-92's job does: in this
worktree only, `npm pkg set --prefix packages/gmt devDependencies.temporal-polyfill=1.0.8`,
`pnpm install --no-frozen-lockfile`, run the file with `vitest.swap.config.ts --fsModuleCache=false`
(at least the zoned rows fail), add the guard, rerun green, then revert `package.json` and the
lockfile. Record both runs in the review notes.

Also in `largeMonthArithmetic.test.ts`: the bound rows `months: 7365462` → `""` and `7365463` → `""` on hebrew
(same answer either side of the guard). Update the file header: it describes 0.5.1's OOM; add the
1.0.8 out-of-range throw.

## Done when

Suite green on 0.5.1; `pnpm compat` shows D9 still needed; the swap-config run was red before the
guard and green after it.
