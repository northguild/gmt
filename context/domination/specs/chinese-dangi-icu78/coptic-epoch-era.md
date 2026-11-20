# Phase 2 — D34: WebKit changes the Coptic era in the middle of 1 Tout AM 1

Read with [index.md](index.md). Model: D32 (`internal/islamicEpochEra.ts`), the same engine
mechanism for the Islamic calendars. WebKit only: on every other engine the probe passes because
the defect is not there.

## The defect (measured, WebKit 26.6 Linux and macOS, against Node 26.12.1 and Chromium 153)

JavaScriptCore's Coptic era override compares the instant with a fixed constant,
**0284-08-29T07:52:58.000Z** (local midnight in America/Los_Angeles, whose LMT is −7:52:58), not the
local calendar date. The override came with WebKit/WebKit#81144. Intl era/monthCode Table 2 gives
`coptic` one era, `am`, for every year, and §4.1.12 reads the era from the calendar date, so every
instant of one local day prints one era.

| Case | Call | Node, Chromium (and GMT on every host after this phase) | WebKit today |
| --- | --- | --- | --- |
| a | `formatDate("0284-08-29", "en-u-ca-coptic", {era:"short", year:"numeric", month:"short", day:"numeric"})` | `Tout 1, 1 AM` | `Tout 1, 1 Anno Martyrum` (also in `de` and `ar`; parts give era `Anno Martyrum`) |
| b | `formatZonedDateTime(convertPlainDateTimeToZoned("0284-08-29T00:30", tz), "en-u-ca-coptic", {era:"short", year:"numeric", hour:"numeric"})` | `AM` at every hour, every zone | UTC: `Anno Martyrum` at 00:30 and 07:00, `AM` at 09:00 and 23:30. Asia/Tokyo: `Anno Martyrum` through 09:00 local. LA and Honolulu: `AM` |
| c | `formatDateRange("0284-08-28", "0284-08-30", "en-u-ca-coptic", {era:"short", year:"numeric", month:"short", day:"numeric"})` | `Nasie 5, 0 - Tout 2, 1 AM` | `Nasie 5, 0 AM - Tout 2, 1 AM` |
| c | same, `-000001-07-10` to `0300-01-01` | the engine's range, era once | an extra `AM` after the start |
| c | `formatZonedRange`, `formatDateTimeRange` across AM 1, every zone including LA, even with no `era` option | era once | era after both ends |
| c | any of the above with `era: "long"` | `Epep 18, -285 - Toba 5, 16 Anno Martyrum` | the same (hosts agree) |
| c | a range that does not cross AM 1 | agree | agree |

Raw WebKit also has D31 (signed years before AM 1), so `repairCopticEra` is already active there.

## Step 1 — bisect (c) before writing code

Case (c) differs in every zone, so it is not only the epoch constant. Every crossing range's start is
before the constant. Hypothesis: a reader that does not go through the shift reads the start's era
differently on WebKit, and the D29 detector then rebuilds the range as the two singles joined
(`format(start) + " - " + format(end)`), which prints the era twice. Candidates, in order:
`localFieldsOf` (`rangeFieldValues.ts:36`), `rangeFieldsText` (`rangeFields.ts`), `rangeVerdict`
(`rangeDetector.ts`), `formatRangeChecked` (`weekYearRange.ts`).

`tdd-dev` runs case (c) in Playwright WebKit with each candidate logged and records which one
first differs from Node. Then:

- **Same cause** (a reader sees the constant's era): fixed by the `localFieldsOf` twin below; no
  new id.
- **Separate cause** (for example the start's era in year ≤ 0, which D31 owns): give it id **D36**
  in this phase, with its own probe, repro, README rows, step and `WHAT_BREAKS` entry, following
  this slice's shape. Report it to the main session before building it.

## Design

**Probe** — `capabilities.ts`, after `isIslamicEpochEraCompatNeeded`:

```ts
/**
 * True when this runtime changes the Coptic era in the middle of 1 Tout AM 1 (defect D34).
 * Intl era/monthCode Table 2 and §4.1.12: … The probe formats ISO 0284-08-29 at 00:00 and 23:00
 * UTC with en-u-ca-coptic, { era: "short", year: "numeric", timeZone: "UTC" }: both must print
 * the same era name (digits, signs and spaces taken out).
 */
export function isCopticEpochEraCompatNeeded(): boolean // engineDefect("D34", …)
```

**Repro** — `repros.ts`, beside D32: `defect: "D34"`, `calendar: "iso8601"`, name
`copticEraOnEpochDay`, expected `"one era"`, `run` the same comparison as the probe (written out,
not imported: repros never call probes). Add `"D34"` to `CanaryDefectId` and its JSDoc.

**Repair** — `internal/copticEra.ts`:

- Activation: `isCopticEraCompatNeeded() || isCopticEpochEraCompatNeeded()`.
- `endpointOf(ms)`: `before` becomes `year <= 0 || (epochRisk && localDateIs(ms, "0284-08-29"))`
  where `epochRisk = isCopticEpochEraCompatNeeded()`. An epoch-day instant moves forward one
  28-year cycle (10227 days, 1461 weeks: month, day, weekday and time of day stay), the engine
  prints the pattern and its own `am` name, and the year is written back as 1 through the existing
  `yearText` (`Intl.NumberFormat`, formatter's numbering system). A D31 date (year ≤ 0) is unchanged.
- The range path moves an end on or before local 0284-08-29 by the same rule; the pair logic and
  the year-run replacement are unchanged.
- Update the module JSDoc: D31 and D34, both sources.

**Twin for field readers** — export from `copticEra.ts`:

```ts
/**
 * The instant a coptic date at risk is read at, with its true year, or null: the calendar is not
 * coptic, neither D31 nor D34 is present, or the local date is after 0284-08-29.
 * @example copticEpochTwin(Date.UTC(284, 7, 29), "UTC") // { ms: one cycle later, year: 1 } on WebKit
 */
export function copticEpochTwin(ms: number, timeZone: string): { ms: number; year: number } | null;
```

`localFieldsOf` calls it after `epochTwin` when `resolved.calendar === "coptic"` and writes
`fields.year` from `year` in latin digits (the reader is `numberingSystem: "latn"`). Year ≤ 0 belongs
here too: `localFieldsOf` calls the exported `copticFieldTwin`, which returns the epoch-day twin
first, else (while D31 is active and the coptic year is ≤ 0) the D31 cycle-shifted instant with the
true signed year, so a range across 1 Tout AM 1 prints its era once on WebKit.

`formatterCache.ts` needs no change: `repairCopticEra` already sits in `construct`.

## Tests (`internal/copticEra.test.ts`, public functions; expected values are Node's text)

| Row | Expected on every host |
| --- | --- |
| case (a) in `en`, `de`, `ar` | Node 26.12.1's text, written out (`Tout 1, 1 AM` in `en`); parts: era `AM` |
| case (b), zones UTC, Asia/Tokyo, America/Los_Angeles, Pacific/Honolulu, hours 00:30, 07:00, 09:00, 23:30 | era `AM` at every row |
| `0284-08-28` (Nasie 5, 0) at 23:30 Honolulu | the D31 text Node prints |
| case (c), all four range shapes | Node's text (`Nasie 5, 0 - Tout 2, 1 AM`, …) |
| `era: "long"` range | `Epep 18, -285 - Toba 5, 16 Anno Martyrum` (unchanged; guards against over-repair) |
| `0284-08-30`, `2024-07-10` | the engine's own text (no wrapper effect) |

Add `capabilities.test.ts` rows: `isCopticEpochEraCompatNeeded()` is `false` on Node and Chromium,
`true` on WebKit (a ternary on the engine, as the D32 rows do). `yearPrintingDormant.test.ts`: one
D34 row asserting the engine's own text when the probe is stubbed to pass.

## Compat rows

- README Workarounds row **D34**, after D33, shaped like D32: defect (fixed instant, Table 2,
  §4.1.12, seen on WebKit 26.6 Linux and macOS), files (`copticEra.ts`, `copticEpochTwin`, `copticFieldTwin`,
  `localFieldsOf`, `isCopticEpochEraCompatNeeded`), when active (a coptic formatter that can show
  an era or year, while the probe fails; an instant whose local date is 0284-08-29 moves one cycle).
- Removal-trigger row **D34**: "Every WebKit's compat check passes the `D34` repro: `en-u-ca-coptic`
  prints the same era at the first and the last hour of 0284-08-29 in UTC. The expected value is
  Intl era/monthCode Table 2's single era, so GMT owns no era data. Upstream: WebKit 331724 (see
  below)."
- Removal step **34**: "**D34:** delete `isCopticEpochEraCompatNeeded` in `capabilities.ts`, its term
  in `repairCopticEra`'s activation and `endpointOf`, `copticEpochTwin` and its call in
  `localFieldsOf`, the `D34` repro and `"D34"`, the D34 entry in `scripts/lib/workarounds.mjs`,
  `WHAT_BREAKS.D34`, and the D34 row in `temporal-compat.json`. Keep every D34 row of
  `copticEra.test.ts`: the era is the proposal's and holds either way." "After every step" is
  renumbered once, after phase 3: 36, or 37 if step 1 adds D36.
- `scripts/lib/workarounds.mjs`: entry with `defects: ["D34"]`, `engines: ["webkit"]`, title "D34 —
  the Coptic era changes in the middle of 1 Tout AM 1 (internal/copticEra.ts)", trigger and steps as
  above.
- `WHAT_BREAKS.D34`: [filings-and-text.md](filings-and-text.md).

## The WebKit report — none needed

WebKit PR WebKit/WebKit#81144 (bug 331724, open, unreviewed) already fixes the epoch-day case: its
stress test formats `0284-08-29T00:00:00Z` in UTC with the Coptic calendar and fails on
`Anno Martyrum`. No comment is posted. Record it in `context/domination/polyfill-bugs/af-ag.md`
§ AG under a new bullet "D34, Coptic epoch day", and add a `status.md` "Waiting on a release" row:
"`D34`: the Coptic era changes in the middle of 1 Tout AM 1 in WebKit (§ AG) | WebKit/WebKit#81144
| A WebKit that switches the era at the start of the day". If the range bisect finds a separate
cause (D36), report it to the main session; any filing for it needs the owner's approval of the
exact text.
