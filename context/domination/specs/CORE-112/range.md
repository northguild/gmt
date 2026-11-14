# CORE-112 slice 3 — ranges: D16 on strings, D17, and the range year

Read with [index.md](./index.md). Three parts with different status:

| Part | Status |
| --- | --- |
| 3a. D16 zone-name repair on the `formatRange` string | **ready**, first in the build order (removes the live abort) |
| 3b. D17 day-period repair | **ready**, keeps its parts call on SpiderMonkey only (reasoned below) |
| 3c. Calendar year in `formatRange` text | built: the acceptance gate passed (below); `internal/weekYearRange.ts` |

## Why no range parts call may reach V8

A range pattern is ICU's interval pattern, not the single pattern: `resolvedOptions` does not
describe it, and it adds date fields to a time-only skeleton when the endpoints are on different
days. On Node 26.12.1, 955 `formatRangeToParts` calls abort across 217 formatters, 12 of them
`{ hour, minute }` (my, non-Gregorian calendars). The crash signal is read off the single
pattern, which is not the interval pattern, so it cannot clear a range formatter: the only safe
rule is that `formatRangeToParts` is never called on V8.

## 3a. D16 — `repairRangeText`

New `packages/gmt/src/internal/repairRangeText.ts` beside `repairRangeParts.ts` (which stays for
D17, 3b):

```ts
/**
 * The range text with the carrier's zone names replaced by the requested ones (defect D16).
 * @returns the repaired text, or `null` when a zone name cannot be given to an endpoint
 */
export function repairRangeText(
  text: string,
  carrierNames: readonly [string | undefined, string | undefined],
  wantedNames: readonly [string | undefined, string | undefined],
): string | null;
```

`rangeWithRepairedParts` in `zoned/format/formatZonedRange.ts`, zone branch:

1. `want` and `carrier` from `cachedFormatter` as today (both guarded by slice 1).
2. `ca`, `cb` = the `timeZoneName` part of `carrier.formatToParts(ms1)` and `(ms2)`;
   `wa`, `wb` = the same from `want`. These are single-date parts and go through the guard.
3. `text = carrier.formatRange(ms1, ms2)`; return `repairRangeText(text, [ca, cb], [wa, wb])`.

The rule (prototype `textRepair`, `<scratchpad>/woy/d16text.mjs`). **GMT rule**, the same
attribution `repairRangeParts` uses today, read off the string:

- `ca` or `cb` undefined → `null`.
- `ca !== cb`: find every occurrence of the longer name first, then the shorter, skipping any
  overlapping an earlier hit; each hit of `ca` becomes `wa`, each hit of `cb` becomes `wb`.
  Reason: a name printed for one endpoint only is that endpoint's (ECMA-402
  PartitionDateTimeRangePattern gives each part one source).
- `ca === cb`: two hits → the first is the start's (`wa`), the second the end's (`wb`), since an
  interval pattern writes the start's fields before the end's (UTS #35 Part 4 §2.6); one hit →
  a shared part, `wa` (today's shared rule: `cb` only when it differs from `ca`); zero or more than
  two → `null`.
- Replace hits left to right; text outside hits is untouched.

`null` → `formatZonedRange` returns `""`. It never happened in the validation (below). Returning the
carrier's short name instead would be the defect's own output, which GMT does not ship.

Measured: 662 locales × 8 zones (America/New_York, Europe/London, Asia/Kolkata,
Australia/Lord_Howe, UTC, Europe/Dublin, America/Sao_Paulo, Pacific/Chatham) × 4 styles
(`long`, `longGeneric`, `shortOffset`, `longOffset`) × 3 option sets × 6 pairs (1 h apart, across
the 2026 March and October changes, 2 to 9 days apart): **379,200 of 379,200 identical** to today's parts merge, 0
`null`. 352 year-bearing formatters (2,112 cases) in the affected locale families were left out
of the comparison because the parts merge itself would abort; with slice 1 they take guarded
single parts and the same rule.

## 3b. D17 — keep the parts merge, SpiderMonkey only

The D17 gate (`isRangeDayPeriodCompatNeeded()`) is a behavioural probe that is true only on
SpiderMonkey, which has no `UDAT_YEAR_WOY_FIELD` abort. Every V8 without the fix prints the
flexible day period in ranges (checked: Node 22.22.2, 24.19.0, 24.21.0, 26.8.2, 26.10.0, 26.12.1,
26.13.0 all print `10 in the morning – 12 noon`), so the D17 branch is unreachable on any V8 that
can abort, and a later V8 carries `0426b0d1045d`. So the D17 branch keeps `formatRangeToParts`
and `repairRangeParts` stays for it unchanged.
Owner question 4 offers the alternative: a string repair through AM/PM markers from an
`{ hour: "numeric", hour12: true }` twin, which can only be validated in Firefox CI.

Branch order in `rangeWithRepairedParts`: when the D17 gate is on, the parts merge handles both
types as today (the gate being on already rules out an aborting V8); otherwise the D16 branch is
the string repair of 3a. No engine has both today (D16: V8, JSC; D17: SpiderMonkey); a test with
both gates stubbed on pins the order.

## 3c. The calendar year in `formatRange`

`formatDateRange`, `formatDateTimeRange` and `formatZonedRange` print the week-year in range text
too, on every engine: kok-u-ca-japanese 2018-12-27 → 2019-12-27 prints
`27-12-30 H – 27-12-2019 R` (end year should be `1`); my-u-ca-buddhist prints `2026` for 2569;
kok-u-ca-roc prints `बुधवार, 10-7-2024 ROC – शुक्रार-12-7-113` (113 is right; 2024 should be 113).
The single-date verdict does not decide it: the interval pattern is a different pattern.

Prototype: `<scratchpad>/woy3c/core.mjs` (`format` and `formatRange` calls only).

```ts
/**
 * Whether the formatter's range pattern prints a week-based year where the calendar year is meant
 * (defect D24 in ranges). Computed once per formatter, on its first range call.
 */
export function rangeYearVerdict(formatter: Intl.DateTimeFormat, options: Intl.DateTimeFormatOptions): boolean;

/**
 * The range text with each week-based year run replaced by the endpoint's calendar year.
 * @returns the repaired text, or `null` when the year runs cannot be located or a run is not
 *   one whole week-year value
 */
export function repairRangeYear(
  formatter: Intl.DateTimeFormat,
  options: Intl.DateTimeFormatOptions,
  startMs: number,
  endMs: number,
): string | null;
```

**Verdict.** Probe ranges from the locale's first day of the week (`Intl.Locale` week info):
ICU calendar-year boundaries from 2024 on weekday offsets 1–6 from that day, where `Y` and `y`
differ, with day, month, year and time ranges on both sides, and day, month, year, time and
cross-era ranges in an earlier era. A digit run is a year run when it moves exactly as a year
under a shift of one or both endpoints by k years (k never a multiple of 100; for chinese and
dangi including multiples of 60; the weekday held still when the pattern prints one, except at
multiples of 60; a run whose value is unchanged does not count). Each year run is compared with
ICU's calendar year for its endpoint (`und-u-ca-<cal>`, `{ year: "numeric" }`, the source the
single repair uses), signed with the locale's minus; under `year: "2-digit"` only the last two
digits (ECMA-402 FormatDateTimePattern), except chinese and dangi, whose related year prints at
full width. A formatter whose range text holds no decimal year is not flagged. A probe whose year
runs cannot be located counts as flagged.

**Repair.** Only the runs found wrong, and only when the run holds one whole week-year value
(within one of the extended or ISO year, or its last two digits). The run is rewritten with the
locale's minus and ICU's calendar year in the formatter's numbering system, ungrouped, at the
width printed (full, or the last two digits padded); every other character is kept. `null` →
the caller returns `""`, as in 3a.

**Where.** The verdict is lazy: no range probe runs when a formatter is built, only on its first
range call, and the verdict is kept per formatter (dropped with the formatter cache). Every
`formatRange` call in the library goes through it: `formatDateRange`, `formatDateTimeRange`, both
`formatZonedRange` paths, and the guarded stand-in's `formatRange`.

**Gate (passed).** 662 locales × 16 calendars × 30 option sets = 317,760 formatters, in child
processes on Node 26.12.1:

| Check | Result |
| --- | --- |
| Verdict against the aborting set (a `Y` in the interval pattern) | flagged 217, `Y` 217, FP 0, FN 0, unlocated 0 |
| Repair on the flagged set (217 × 7 ranges) | `null` 0 |
| Brute-force Temporal oracle (`formatRangeToParts` on every formatter that does not abort, 2.22M range calls) | `Y` not flagged 0, flagged not `Y` 0 |
| Repair against WebKit 26.6 `formatRangeToParts` (2,604 cases) | 2,510 match Temporal, 94 match ICU's year (pre-epoch, below), wrong 0 |

Cost: verdict mean 5.77 ms (p50 3.78, p99 25.4, max 172.5), about 93 `format`/`formatRange`
calls; chinese, dangi and japanese are the slowest (p99 ≈ 40–48 ms). Repair: mean 0.22 ms per
range, flagged formatters only.

**Pre-epoch years.** At ISO year −1 the repair writes ICU's calendar year, as every unflagged
formatter prints it. For indian (`-79 Śaka`) and persian (`-622 AP`) that is Temporal's `eraYear`
too (intl era/monthCode Table 2: one era, signed era year). For islamic (`-642 AH`, Temporal
`643 bh`) and japanese (`-645 Taika`, Temporal `2 bce`) ICU 78 is wrong on every formatter; those
are defects of their own (ICU-23327; ICU-23341, fixed in ICU 79.1), not part of `Y`.

## Edge cases for tests (values in [tests.md](./tests.md))

- The my-u-ca-buddhist zoned range above returns a string, no abort (child process on unfixed V8).
- `ca !== cb` across a change (Europe/London 2026-03-28 → 03-30, `long`): `Greenwich Mean Time`
  / `British Summer Time` each on its endpoint.
- `ca === cb` with two hits (3 days apart, `longOffset`), with one hit (1 h apart, shared).
- A zone name that contains the other (`GMT` inside `GMT+1`): the longer is matched first.
- `shortOffset` / `longOffset`, where the engine prints no zone name at all in the range: the
  carrier's `short` is in the text and is replaced.
- The source test of slice 4: `formatRangeToParts` appears only in the D17 branch and the probes.
