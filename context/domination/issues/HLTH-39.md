# HLTH-39 — Healthcare: De-identification date shifting

**Scope:** Consistent date shifting for research data sets, under HIPAA Safe Harbor constraints.

## Gap

Sharing clinical data for research requires removing dates that could identify a patient, while preserving the *intervals* between events — a study is useless if the gap between admission and discharge is destroyed. The standard technique is a consistent per-patient shift: every date for one patient moves by the same random offset, so intervals survive and absolute dates do not.

Two constraints make it non-trivial. The shift must be **identical within a patient and different across patients**, or intervals break or re-identification becomes possible. And HIPAA Safe Harbor requires ages above 89 to be aggregated, because a birth year plus a rare age is identifying.

## Scope

- `packages/gmt/src/health/calculate/dateShift.ts`:
  - `shiftDate(isoString: string, shiftDays: number): string` — Applies a shift, preserving time of day.
  - `shiftInterval(interval: Interval, shiftDays: number): Interval` — Preserves length exactly.
- `packages/gmt/src/health/calculate/ageCap.ts`:
  - `capAge(age: { value: number, unit: string }, options?: { threshold?: number }): { value: number, unit: string, capped: boolean }` — Aggregates ages above the threshold, defaulting to 89.
- `packages/gmt/src/health/validate/shiftConsistency.ts`:
  - `intervalsPreserved(original: Interval[], shifted: Interval[]): boolean` — Verifies a shift preserved every interval. For validating a de-identification pipeline.

## Design notes

- **GMT does not generate the shift offset and does not manage patient keys.** Deriving a per-patient offset requires a keyed pseudonymous identifier and a cryptographic function, which is a security concern with a security review, not time math. Generating one here would produce an offset that looks random and is not — the worst outcome for a de-identification tool. `shiftDays` is supplied by the caller.
- **`shiftDate` preserves time of day by default**, because the diurnal pattern of clinical events is often the research variable. Callers needing that removed truncate separately.
- **`intervalsPreserved` exists because the failure is silent.** A shift applied inconsistently across a patient's records still produces plausible dates; only interval comparison detects it. This function belongs in the pipeline's own test suite.
- Shifting across a DST boundary must preserve the exact interval, so shifts are applied as calendar days on local dates and the resulting instants may differ in elapsed time. The JSDoc must state which guarantee holds.
- Safe Harbor has seventeen other identifier categories. This story addresses dates and ages only, and the JSDoc must not imply it delivers compliance.

## What gmt provides (do not re-implement)

- `addBusinessDays` / date arithmetic from CORE-7 and existing `addZoned`
- `spanMs` / `spanWallClock` from CORE-2 — interval preservation checks
- `ageAt` from HLTH-36 — the age input to `capAge`
- `Interval` from `types/`

## Verification

- `shiftDate` by 100 days moves the date and preserves the time of day
- `shiftInterval` preserves interval length exactly
- Two events 30 days apart remain 30 days apart after an identical shift
- A shift spanning a DST transition preserves the calendar-day interval, and the elapsed-time difference is asserted rather than hidden
- `capAge` returns `capped: true` for age 92 and `false` for 89
- `capAge` with a custom threshold behaves accordingly
- `intervalsPreserved` returns `false` when one interval in a set received a different shift
- Negative shifts work symmetrically
- `pnpm run validate` stays green
