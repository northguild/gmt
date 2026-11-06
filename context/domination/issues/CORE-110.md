# CORE-110 — Core: The weekly upgrade check compares each calendar's years with native Temporal

**Scope:** The Node leg of the weekly `temporal-polyfill` upgrade check ([CORE-92](CORE-92.md))
gains a calendar sweep beside its offset sweep. It compares every calendar's years with Node's
built-in Temporal. A difference blocks the upgrade. Adds no function and raises no pin. The issue
is #468.

## Gap

`temporal-polyfill` 1.0.8 uses the plain 33-year rule for Persian leap years
(`modFloor(25 * year + 11, 33) < 8`). ICU4X, which Node 26's built-in Temporal follows, corrects 78
years from 1502 to 2987 AP. In the year after each one, every date reads one day early: 1503 AP
M01-01 is 2124-03-20 natively and 2124-03-21 on the polyfill, and the days in 1502 AP are 365
natively and 366 on the polyfill. The report is
[fullcalendar/temporal-polyfill#127](https://github.com/fullcalendar/temporal-polyfill/issues/127).

Chinese and Dangi differ too, because the polyfill reads them from `Intl` (Decision 5).

The move onto `temporal-polyfill` ([CORE-108](CORE-108.md), #460) waits on releases that fix them.
The upgrade check compares offsets and runs the GMT suite, and neither sees a calendar year. Without
a sweep, nothing tells us when a release fixes it.

## Scope

1. **Calendar sweep.** `scripts/lib/calendar-sweep.mjs` is a pure module with no imports and no
   I/O. For every calendar both implementations accept, and every calendar year that overlaps ISO
   years -3000 to 5000, it compares the swap's value with Node's built-in `globalThis.Temporal` on
   three facts: the ISO date of the year's first day, the months in the year and the days in the
   year. The span is fixed. It does not depend on the run date.
2. **Node leg.** `scripts/polyfill-swap.mjs` runs it on the Node leg, beside the offset sweep and
   before the suite passes, so a suite timeout cannot lose it. The result is the verdict's
   `calendarSweep` field. A host with no built-in Temporal records
   `{ status: "could-not-run", message }`.
3. **Readiness.** The swap is ready only when the calendar sweep ran and no calendar differs. A
   sweep that did not run, or whose count is missing, blocks, as the offset sweep does.
4. **Report.** The job summary lists each differing calendar with the number of years, the first
   year and one example. The ready issue says every calendar matched. When releases fix the
   Persian report and the Chinese and Dangi report, and nothing else differs, the check opens that issue. That
   is the signal to take #464 out of parked.

Out of scope: any library function, raising any pin.

## What gmt provides (do not re-implement)

- The swap runner `scripts/polyfill-swap.mjs` and its verdict (`CORE-92`)
- The offset sweep `scripts/lib/offset-sweep.mjs`, whose shape the calendar sweep follows
- The verdict, summary and issue modules `canary-verdict.mjs`, `canary-summary.mjs` and
  `canary-issues.mjs`

## Verification

- On `temporal-polyfill` 1.0.8 against Node 26.12.1, the sweep compares 16 calendars and 128,762
  years in about 11 seconds. It reports Persian (156 years, first 1502), Chinese (3,889 years) and
  Dangi (3,858 years), and blocks the upgrade. The other 13 calendars match.
- Unit tests in `apps/dox/scripts/canary/calendar-sweep.test.ts` run the sweep against stand-in
  implementations. The runner, verdict, summary and issue tests cover the wiring.

## Decisions

1. **The reference is the host's built-in Temporal.** Node 26 follows ICU4X for calendars, which is
   what the polyfill must match.
2. **Both sides must agree on the calendar set.** A calendar only one side accepts is a difference
   with zero years. A calendar neither accepts is skipped.
3. **A year where one side throws and the other does not is a difference.** A year where both
   throw is skipped.
4. **The sweep fails closed.** Missing, malformed or could-not-run results all block, so a verdict
   that lost a field never reports ready. A sweep that compared nothing proves nothing: the
   calendar sweep throws when neither side accepts any listed calendar, and readiness needs a
   positive count of zones, calendars and years, so the offset sweep is held to the same rule.
5. **Chinese and Dangi block too.** On 1.0.8 the polyfill reads both lunisolar calendars from
   `Intl.DateTimeFormat`, and Node 26's `Intl` (ICU 78.3) disagrees with its built-in Temporal
   (ICU4X). Chinese differs in 3,889 years and Dangi in 3,858. Six Chinese years fall within
   1900–2100: Chinese New Year 2027 is 6 February natively and in published calendars, and 7
   February on the polyfill. Any calendar that differs blocks, whatever the source of the
   difference, so the upgrade waits for releases that fix both reports.
