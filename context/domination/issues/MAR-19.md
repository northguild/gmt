# MAR-19 — Maritime: Laytime, laycan and the laytime statement

**Scope:** Charter-party laytime — when the clock starts, which hours count, how much time was used, and what is owed — using the industry's own definitions.

## Gap

Laytime is the most precise time arithmetic in commercial shipping. It settles disputes worth six figures a day, and it was entirely absent from the epic. The calculation has four parts, each of which is a contract term rather than a physical fact:

- **Laycan** — the laydays/cancelling window in which the vessel must present.
- **Commencement** — the Notice of Readiness triggers the clock, but not immediately. Gencon 1994 clause 6(c): laytime shall "commence at 13.00 hours, if notice of readiness is given up to and including 12.00 hours", and "at 06.00 hours next working day if notice given during office hours after 12.00 hours"; "Time used before commencement of laytime shall count." Turn time may be interposed.
- **Exceptions** — which hours count at all, and the BIMCO *Laytime Definitions for Charter Parties 2013* say exactly what each phrase means: a WEATHER WORKING DAY (no. 15) deducts weather interruptions **pro rata** to the working time lost, a WEATHER WORKING DAY OF 24 CONSECUTIVE HOURS (no. 16) deducts the **actual** interruption, and a WEATHER WORKING DAY OF 24 HOURS (no. 17) is 24 hours assembled from one or more working days; EXCEPTED days (no. 19) "do not count as Laytime even if loading or discharging is carried out on them", but UNLESS USED (no. 22) makes "actual time used" count; UNLESS SOONER COMMENCED (no. 20) starts laytime early when work starts during turn-time; REVERSIBLE LAYTIME (no. 24) is the charterer's option "to add together the time allowed for loading and discharging"; TO AVERAGE LAYTIME (no. 23) sets time saved at one port against excess at the other.
- **Settlement** — DEMURRAGE (no. 30) "shall not be subject to exceptions which apply to Laytime unless specifically stated in the Charter Party" — the definitions' form of "once on demurrage, always on demurrage". DESPATCH is owed for time saved, and the two despatch clauses differ by exactly the excepted periods: ON ALL WORKING TIME SAVED (no. 32) runs to laytime expiry "excluding any periods excepted from the Laytime"; ON ALL TIME SAVED (no. 33) "including periods excepted".

Every one of those is interval arithmetic over a statement of facts, and the disputes arise from applying the wrong definition.

([BIMCO Laytime Definitions for Charter Parties 2013, nos. 5, 8–10, 14–33](https://www.bimco.org/media/qy2neqim/laytime-definitions-for-charter-parties-2013-v2.pdf), [Gencon 1994 Part II clause 6(c) and clause 7](https://consemaracademy.com/wp-content/uploads/2024/01/GENCON-1994.pdf))

## Scope

- `packages/gmt/src/maritime/calculate/laycan.ts`:
  - `isWithinLaycan(arrivedAt: string, laycan: { from: string, until: string }, timeZone: string): { withinWindow: boolean, cancellable: boolean }`
- `packages/gmt/src/maritime/calculate/laytimeCommencement.ts`:
  - `laytimeCommencement(norTenderedAt: string, options: { timeZone: string, rule: 'gencon94' | 'immediate' | 'noticeTime', noticeTime?: string, officeHours?: OperatingSchedule }): string` — When the clock starts. `'gencon94'` implements clause 6(c): 13:00 the same day for NOR up to and including 12:00, 06:00 the next working day for NOR in office hours after 12:00; `officeHours` decides "office hours" and "working day". `'noticeTime'` adds a fixed period.
- `packages/gmt/src/maritime/calculate/laytimeUsed.ts`:
  - `laytimeUsed(start: string, end: string, options: { timeZone: string, dayDefinition: 'day' | 'calendarDay' | 'conventionalDay', exceptions: LaytimeException[], calendar?: BusinessCalendar, unlessUsed?: Interval[], onDemurrageFrom?: string, demurrageExceptions?: boolean }): { used: string, excluded: string, periods: Interval[], onDemurrage: string } | null` — Time counted, time excluded, and — after laytime expires — time on demurrage, to which exceptions no longer apply (BIMCO no. 30) unless the caller says the charter states otherwise.
  - `LaytimeException` is `{ kind: 'shex' | 'shinc' | 'weatherWorkingDay' | 'weatherWorkingDay24Consecutive' | 'weatherWorkingDay24' | 'holiday' | 'custom', interval?: Interval, workingHoursLost?: string }` — the three BIMCO weather definitions are separate kinds because they deduct differently.
- `packages/gmt/src/maritime/calculate/laytimeAllowance.ts`:
  - `laytimeAllowed(rate: { kind: 'perHatchPerDay' | 'perWorkingHatchPerDay', dailyRatePerHatch: number, hatches: number | { hold: string, hatches: number, quantity: number }[], quantity: number } | { kind: 'fixed', duration: string }): string | null` — BIMCO nos. 6 and 7, including the twin-hatch and two-gang counting rules.
  - `laytimeBalance(allowed: string, used: string, options?: { reversible?: { loading: string, discharging: string }, average?: boolean }): { demurrage: string, despatch: string }` — Exactly one is non-zero; `reversible` pools the two allowances (no. 24) and `average` sets one port's saving against the other's excess (no. 23).
  - `despatchTime(completedAt: string, laytimeExpiresAt: string, basis: 'allWorkingTimeSaved' | 'allTimeSaved', excepted: Interval[]): string` — nos. 32 and 33.
- `packages/gmt/src/maritime/format/laytimeStatement.ts`:
  - `laytimeStatement(input): { lines: { from: string, to: string, description: string, counted: string, excluded: string, runningTotal: string }[], allowed: string, used: string, balance: { demurrage: string, despatch: string } }` — The time sheet a claim is settled on: every counted and excepted period in order with running totals, from the same intervals the calculation used, so the statement cannot disagree with the number.

## Design notes

- **Exceptions are interval subtraction**, which is why CORE-6 exists. SHEX removes Sundays and holidays; weather exceptions remove caller-supplied intervals from the statement of facts. Both compose through `subtractIntervals`, so they cannot disagree about boundaries. The three weather definitions differ in *what* is subtracted — the pro-rata working time (no. 15), the actual interruption (no. 16), or the actual interruption from an assembled 24-hour day (no. 17) — and the JSDoc quotes each.
- **Weather exceptions are observations, not predictions.** GMT cannot know when weather stopped work; the caller supplies the intervals. This is the same principle that removed `customsClearance` (see TRAN-10's Corrections).
- **Once on demurrage, always on demurrage is the default, and it is cited to BIMCO no. 30.** After `onDemurrageFrom` (or the computed expiry) exceptions stop applying; a charter that says otherwise passes `demurrageExceptions: true`.
- **The Gencon rule is Gencon's, not folklore.** The first draft wrote 08:00 for the next-working-day start; the printed form says **06:00**, and the same clause makes time used before commencement count, which is why `laytimeUsed` accepts a `start` earlier than the commencement it computed. Other forms differ and are other `rule` values when their text is cited.
- **A DAY is not a CALENDAR DAY.** BIMCO no. 8 is "twenty-four (24) consecutive hours", pro rata for part; no. 9 runs 0000–2400; no. 10 runs from any identified time. `dayDefinition` selects which, because "3 days" laytime differs by up to 24 hours between them.
- **Noon is half-open.** A NOR tendered at exactly 12:00:00 is "up to and including 12.00 hours" in Gencon's words, so it is before noon; the test asserts it.
- Demurrage and despatch are durations here, not money. Rates are the consumer's problem. Demurrage time bars (claims within a stated number of days with documents) are deadlines for TRAN-10's model and are not here.

## What gmt provides (do not re-implement)

- `subtractIntervals` / `mergeIntervals` / `sumIntervals` / `splitIntervalAt` from CORE-6 — exception handling and the time sheet
- `BusinessCalendar` from CORE-7 — holiday sets for SHEX
- `OperatingSchedule` / `isOpenAt` / `nextOpenAt` from CORE-55 — office hours and working days for commencement
- `resolveLocal` from CORE-4 — the local noon boundary
- `dwellTime` from TRAN-8 — local day counting for day-based allowances

## Verification

- NOR tendered at 11:00 local starts laytime at 13:00 the same day; at 13:00 local it starts at 06:00 the next working day — asserted against Gencon 6(c), not 08:00
- NOR tendered at exactly 12:00:00 is treated as up to and including noon, asserted explicitly
- NOR tendered at 13:00 on a Friday with Monday–Friday office hours starts laytime at 06:00 Monday
- Work started at 14:00 before a 06:00 commencement counts from 14:00 when the charter has Gencon's "time used before commencement shall count"
- SHEX excludes a Sunday inside the period; SHINC includes it, and the two results differ by 24 hours
- A supplied weather interval reduces `used` by exactly its length under `weatherWorkingDay24Consecutive`; under `weatherWorkingDay` a two-hour interruption in an eight-hour working day reduces `used` by one quarter of a day, asserted against no. 15's pro-rata wording
- Overlapping SHEX and weather exceptions are not double-counted
- A Sunday after laytime has expired counts as time on demurrage, not excepted, unless `demurrageExceptions: true`
- `laytimeAllowed` with 5,000 t at 1,000 t per hatch per day over five hatches, one of them a twin parallel pair, returns the BIMCO no. 6 result (four hatches, 1.25 days)
- `laytimeBalance` returns demurrage when used exceeds allowed, despatch when it does not, and never both; with `reversible` a loading excess is absorbed by a discharging saving
- `despatchTime` on `'allWorkingTimeSaved'` excludes an excepted Sunday between completion and expiry; on `'allTimeSaved'` it includes it, and the two differ by 24 hours
- `laytimeStatement` running totals end at `used`, and every line's interval appears in `periods`
- `isWithinLaycan` returns `cancellable: true` after the cancelling date
- `pnpm run validate` stays green
