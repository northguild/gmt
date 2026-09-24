# MAR-60 — Maritime: Seafarer hours of rest (STCW and MLC)

**Scope:** The minimum rest and maximum work limits for watchkeepers and seafarers under the STCW Code and the Maritime Labour Convention, as interval arithmetic over a work/rest log kept in ship's time.

## Gap

Rest-hour compliance is the maritime twin of driver hours of service, enforced at every port state control inspection, and the industry runs it on spreadsheets and a handful of vendor products. The rules are short and precise, and the MLC states them in the ILO's own text:

- **MLC 2006 Standard A2.3 §5**: either "maximum hours of work shall not exceed: (i) 14 hours in any 24-hour period; and (ii) 72 hours in any seven-day period", or "minimum hours of rest shall not be less than: (i) ten hours in any 24-hour period; and (ii) 77 hours in any seven-day period".
- **§6**: hours of rest may be "divided into no more than two periods, one of which shall be at least six hours in length", and "the interval between consecutive periods of rest shall not exceed 14 hours".
- **§7**: drills are "conducted in a manner that minimizes the disturbance of rest periods and does not induce fatigue"; **§8**: a seafarer on call "shall have an adequate compensatory rest period if the normal period of rest is disturbed by call-outs"; **§13**: collective agreements may permit "exceptions to the limits set out"; **§14**: "the master may suspend the schedule" for the immediate safety of the ship, with rest afterwards.
- **STCW Code A-VIII/1** (2010 Manila amendments, in force 1 January 2012) carries the same 10/24 and 77/7 minima and the two-period rule, and its collective-agreement exceptions are bounded: "a minimum of 70 hours rest in any 7-day period", exceptions "not allowed for more than two consecutive weeks", intervals between exception periods "not less than twice the duration of the exception", rest divisible into "no more than three periods, one of which shall be at least 6 hours" with the others at least one hour, and daily exceptions "not extend beyond two 24-hour periods in any 7-day period". IMO's own text of A-VIII/1 was not reachable from this environment; those figures are from the UK MCA's reproduction (MGN 566) and the paragraph numbers (2, 3, 9) from a secondary reproduction — the JSDoc says so, and the pre-Manila 1995 text (10 hours, no 77-hour rule) must not be used.

The subtlety that defeats spreadsheets: "any 24-hour period" is every sliding window, not the calendar day, and the log is kept in **ship's time**, which the master retards and advances on passage (MAR-18). A one-hour clock retard makes a 25-hour day, and a compliant schedule can fail in the hour that appears twice.

([MLC 2006 as amended, Standard A2.3 §§5–8, 13–14, ILO consolidated text pp. 32–33](https://www.ilo.org/sites/default/files/2024-10/NORMES_MLC%20Amendments-EN_2022_Web_1.pdf), [UK MCA MGN 566 (M+F), STCW Manila amendments — hours of work, §§2.1–2.8](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/590127/MGN_566_STCW_Manila_Amendments_Hours_of_Work__Alcohol_limit_final.pdf), [IMO STCW Convention page](https://www.imo.org/en/OurWork/HumanElement/Pages/STCW-Convention.aspx))

## Scope

- `packages/gmt/src/maritime/calculate/restHours.ts`:
  - `restHoursStatus(log: DutyEntry[], at: string, options: { clock: { timeZone: string } | { shipOffsets: ShipTimeSchedule }, regime: 'mlc-rest' | 'mlc-work' | 'stcw-exception' }): { restLast24h: string, restLast7d: string, restPeriodsLast24h: number, longestRestLast24h: string, maxIntervalBetweenRests: string, exceptionWeeks: number, violations: Violation[] } | null` — The rolling-window totals at an instant and every rule broken. `'stcw-exception'` applies the bounded collective-agreement limits (70 h / 7 d, up to three periods, two consecutive weeks, two 24-hour periods in 7 days) and is selected only when the caller asserts such an agreement exists.
  - `restHoursViolations(log: DutyEntry[], range: Interval, options): Violation[]` — Every violation across a range, each with the window that failed it, for the monthly record.
- `packages/gmt/src/maritime/calculate/restPlan.ts`:
  - `planCompliant(plan: DutyEntry[], options): { compliant: boolean, firstViolation: Violation | null }` — The same rules applied to a proposed watch schedule before it is worked.
  - `restDeficit(log: DutyEntry[], at: string, options): { next24h: string, next7d: string }` — How much rest must fall in the coming windows to stay compliant, which is what a chief officer actually asks.
- `DutyEntry` is ROAD-20's shape with `status: 'rest' | 'work'`; `ShipTimeSchedule` is MAR-18's offset-in-force timeline.

## Design notes

- **Sliding windows, not days.** Every 24-hour and 7-day window ending in the range is tested, using the same rolling-window machinery ROAD-20 uses for the 60/70-hour cycle. A calendar-day implementation passes schedules the rule fails.
- **Ship's time is a first-class clock.** When `shipOffsets` is given, the 24-hour period is 24 elapsed hours regardless of clock changes, and violations report both the ship's-time and UTC bounds so the record matches the deck log. When a `timeZone` is given (a vessel on a fixed zone, or a port-state inspector's view) it is used instead.
- **Three regimes, one engine.** MLC's minimum-rest and maximum-work forms are complements over the same log; `regime` selects which limits are reported and cited so a flag-state inspection and a port-state inspection get the wording they use. The STCW exception regime is the bounded one the Manila text permits under a collective agreement, and it is never a default.
- **Drills, call-outs and the master's suspension are not modelled.** They change what counts (§§7, 8, 14) in ways that depend on facts outside the log — what was a drill, what was an emergency — so they are documented as unimplemented and the violation list is the raw one; the caller who has those facts edits the log before asking.
- GMT reports totals and violations. It does not decide fitness for duty.

## What gmt provides (do not re-implement)

- `DutyEntry` from ROAD-20 — the duty-log shape
- `shipTimeSchedule` / `toShipTime` from MAR-18 — the ship's-time clock
- `mergeIntervals` / `subtractIntervals` / `sumIntervals` / `splitIntervalAt` from CORE-6 — rest and work interval math
- `bucketRange` from CORE-5 — window walking on a fixed zone
- `spanMs` from CORE-2 — elapsed time

## Verification

- A 6 + 4 hour rest pattern in a 24-hour window is compliant; 5 + 5 is a violation (no period of at least 6 hours), asserted with the MLC A2.3 §6 citation
- Three rest periods totalling 10 hours in 24 is a violation under `'mlc-rest'` and compliant under `'stcw-exception'` when one period is 6 hours and the others at least one hour
- 15 hours between the end of one rest and the start of the next is a violation; 14 hours is not
- 77 hours of rest in 7 days passes; 76 hours 59 minutes fails under `'mlc-rest'` and passes under `'stcw-exception'` down to 70 hours; a third consecutive exception week is a violation
- The same log under `regime: 'mlc-work'` reports the 14-hour and 72-hour work limits instead, and agrees with the rest-form result on compliance
- A one-hour clock retard during a rest period lengthens that rest by one hour in `restLast24h`, and the 24-hour window is 24 elapsed hours, not "yesterday's date"
- `planCompliant` on a 4-on/8-off watch rotation returns `compliant: true`; on 6-on/6-off it returns `compliant: false` at the 6-hour-period rule
- `restDeficit` for a seafarer with 3 hours' rest in the last 14 hours reports at least 7 hours needed in the next 10
- Overlapping or unordered entries return the sentinel
- `pnpm run validate` stays green
