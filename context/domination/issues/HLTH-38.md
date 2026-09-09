# HLTH-38 — Healthcare: Medication administration windows

**Scope:** Expanding a FHIR `Timing` into concrete administration windows, including across DST transitions.

## Gap

Medication schedules are expressed as a frequency and a period (`BID`, `TID`, every eight hours) bounded by a treatment period, and a system has to turn that into actual times. The temporal hazard is well known to anyone who has run a hospital system through a clock change: **on a spring-forward night the 02:00 dose does not exist, and on a fall-back night it occurs twice.** Naive expansion either skips or duplicates a medication administration.

The same problem applies to any schedule anchored to local time, but here the failure mode is a clinical incident.

## Scope

- `packages/gmt/src/health/calculate/timingWindows.ts`:
  - `expandTiming(timing: { frequency: number, period: number, periodUnit: 'h' | 'd' | 'wk', boundsPeriod: Interval, timeOfDay?: string[] }, options: { timeZone: string, dstPolicy: 'preserveWallClock' | 'preserveInterval' }): { at: string, wallClock: string, dstAnomaly?: 'skipped' | 'repeated' }[] | null`
- `packages/gmt/src/health/calculate/administrationWindow.ts`:
  - `administrationWindow(scheduledAt: string, tolerance: string): Interval` — The window in which an administration counts as on time.
  - `classifyAdministration(administeredAt: string, scheduledAt: string, tolerance: string): 'early' | 'onTime' | 'late' | 'missed'`

## Design notes

- **`dstPolicy` is required and has no default.** The two policies give different, both-defensible answers, and the choice is clinical rather than technical:
  - `'preserveWallClock'` keeps doses at 08:00 / 20:00 local, so one interval on a transition day is 23 or 25 hours.
  - `'preserveInterval'` keeps doses exactly 12 hours apart, so the local time shifts.
  For a drug with a strict interval requirement the second is correct; for most oral regimens the first is. GMT must not choose.
- **`dstAnomaly` is reported, never silently resolved.** A dose falling in a nonexistent local hour is flagged `'skipped'`, and one in a repeated hour is flagged `'repeated'`, so the consumer can surface it rather than discovering it in an administration record.
- `'missed'` is distinct from `'late'` and is determined by the tolerance window, which is caller-supplied — tolerance varies by drug and by institutional policy.
- This expands a schedule. It does not decide whether a dose is due, which depends on clinical state GMT has no access to.

## What gmt provides (do not re-implement)

- `resolveLocal` / `classifyLocal` from CORE-4 — nonexistent and ambiguous local times, which is precisely the DST anomaly detection
- `bucketRange` from CORE-5 — zone-aware interval walking
- `intervalContains` from CORE-6 — window membership
- `addDuration` — interval arithmetic

## Verification

- `BID` at 08:00 and 20:00 over a week yields fourteen windows
- On a spring-forward date with a 02:00 dose, `'preserveWallClock'` reports `dstAnomaly: 'skipped'`
- On a fall-back date with a 02:00 dose, the same policy reports `'repeated'` and yields two candidate instants
- `'preserveInterval'` across the same transition keeps consecutive doses exactly the stated duration apart, and the local wall time shifts
- `'preserveWallClock'` across the same transition yields one 23-hour and one 25-hour gap in the respective directions
- An eight-hourly schedule bounded by a two-day period yields six windows
- `classifyAdministration` returns `'onTime'` at the tolerance boundary and `'late'` one second beyond
- Missing `dstPolicy` returns the sentinel
- Full IANA timezone coverage
- `pnpm run validate` stays green
