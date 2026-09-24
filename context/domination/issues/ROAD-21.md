# ROAD-21 — Road: EU Regulation 561/2006 driver hours

**Scope:** European driving time, break and rest limits, including the 2020 Mobility Package amendments.

## Gap

EU driver hours are structurally different from FMCSA — they constrain continuous driving and mandate rest periods, rather than bounding a daily window — so they cannot be modelled as parameter changes to ROAD-20. Any operator running cross-Atlantic or UK/EU traffic needs both.

Two definitions in Article 4 decide most of the arithmetic and are routinely implemented wrongly:

- **A "week" is fixed**: "the period of time between 00.00 on Monday and 24.00 on Sunday" (Art 4(i)). The weekly limit is per fixed week, and the 90-hour limit for "any two consecutive weeks" (Art 6(3)) is over adjacent fixed weeks, not a rolling 14 × 24 hours.
- **"Daily driving time" is between rests**, "the total accumulated driving time between the end of one daily rest period and the beginning of the following daily rest period or between a daily rest period and a weekly rest period" (Art 4(k)) — not a calendar day.

([Regulation (EC) 561/2006, consolidated 2020-08-20](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02006R0561-20200820), [DfT simplified guidance](https://assets.publishing.service.gov.uk/media/5e14b5b040f0b65dbed713a0/simplified-guidance-eu-drivers-hours-working-time-rules.pdf))

## Scope

- `packages/gmt/src/road/calculate/euDriverStatus.ts`:
  - `euDriverStatus(log: DutyEntry[], at: string, options: { timeZone: string }): { continuousDrivingRemaining: string, dailyDrivingRemaining: string, weeklyRemaining: string, fortnightRemaining: string, breakDue: string | null, extendedDaysUsed: number, violations: Violation[] } | null`
- `packages/gmt/src/road/calculate/euRest.ts`:
  - `dailyRestStatus(log: DutyEntry[], at: string, options): { satisfied: boolean, reducedUsed: number, requiredBy: string }` — Tracks how many reduced daily rests have been used since the last weekly rest.
  - `weeklyRestStatus(log: DutyEntry[], at: string, options): { satisfied: boolean, reduced: boolean, requiredBy: string, compensationDueBy: string | null }`
  - `weeklyRestPattern(log: DutyEntry[], at: string, options: { international?: boolean }): { lastTwoWeeks: ('regular' | 'reduced' | 'none')[], lastFourWeeks: ('regular' | 'reduced' | 'none')[], compliant: boolean }` — The Art 8(6) pattern: two-week rule by default, the four-week "at least four, of which at least two regular" rule under the third sub-paragraph when `international` is set.
  - `weeklyRestDueBy(log: DutyEntry[], at: string, options): string` — The end of six 24-hour periods from the end of the previous weekly rest (Art 8(6) second sub-paragraph).
  - `returnHomeDue(log: DutyEntry[], at: string): string` — When the driver must next be able to return to the employer's operational centre or their residence: four consecutive weeks from the last return, or the start of the compensating regular rest after two consecutive reduced weekly rests (Art 8(8a)). The JSDoc says the second case is what the text states and that "three weeks" is a consequence of 8(6b), not a rule.
- `packages/gmt/src/road/get/euWeek.ts`:
  - `euWeekFor(instant: string, timeZone: string): Interval` — The fixed Monday 00:00 to Sunday 24:00 week an instant falls in.

## EU limits (Regulation (EC) No 561/2006)

| Limit | Rule | Article |
| --- | --- | --- |
| Continuous driving | 45-minute break after 4½ hours at the latest; splittable as 15 minutes then 30 minutes, in that order | 7 |
| Daily driving | 9 hours, extendable to 10 hours no more than twice a week | 6(1) |
| Weekly driving | 56 hours, per fixed week | 6(2), 4(i) |
| Fortnightly driving | 90 hours across any two consecutive fixed weeks | 6(3) |
| Daily rest | 11 consecutive hours (or 3 + 9 split), reducible to 9 hours up to three times between weekly rests | 4(g), 8(2), 8(4) |
| Weekly rest | 45 consecutive hours, reducible to 24 hours; in any two consecutive weeks "two regular weekly rest periods; or one regular weekly rest period and one reduced weekly rest period of at least 24 hours"; a weekly rest "shall start no later than at the end of six 24-hour periods from the end of the previous weekly rest period" | 4(h), 8(6) first and second sub-paragraphs |
| International carriage | "outside the Member State of establishment, take two consecutive reduced weekly rest periods provided that the driver in any four consecutive weeks takes at least four weekly rest periods, of which at least two shall be regular" | 8(6) third sub-paragraph |
| Compensation | Reductions "compensated by an equivalent period of rest taken en bloc before the end of the third week following the week in question"; after two consecutive reduced rests the next weekly rest is preceded by the compensating rest | 8(6b) |
| Multi-manning | A new daily rest of at least nine hours "within 30 hours of the end of a daily or weekly rest period" | 8(5) |
| Return home | The employer organises work so the driver can return "within each period of four consecutive weeks, in order to spend at least one regular weekly rest period"; after two consecutive reduced rests, before the start of the compensating regular rest | 8(8a) |
| Ferry / train | A regular daily rest or reduced weekly rest "may be interrupted not more than twice by other activities not exceeding one hour in total"; a regular weekly rest only if the journey is scheduled for 8 hours or more and the driver has a sleeper cabin | 9(1) |

## Design notes

- **The split break is ordered.** 15 minutes followed by 30 minutes satisfies the requirement; 30 then 15 does not. Implementations that merely sum to 45 minutes are wrong.
- **Weeks are fixed and the fortnight slides by a week, not a day.** `euWeekFor` is exported so the consumer never re-derives it, and `fortnightRemaining` is computed over the current fixed week plus the previous one.
- **Reduced rests are quota-limited**, and the quotas reset on different events: reduced daily rests reset at the weekly rest, reduced weekly rests alternate. This state cannot be derived from the current day alone, which is why the log is the input rather than a running total.
- **Tachographs record UTC.** Driver-facing limits are expressed against local time, so the timezone is required and the two must not be conflated. This is a frequent source of one-hour errors at DST transitions.
- Multi-manning, the working-time directive (2002/15/EC) and national derogations are out of scope. Document as unimplemented.

## Corrections

The first draft described the fortnight as "a rolling window, not alternating fixed pairs". Half of that is right: the pairs are not fixed, but the units are fixed weeks (Art 4(i)), so the window advances one week at a time. A rolling 336-hour window over-restricts a legal schedule and under-restricts an illegal one.

## What gmt provides (do not re-implement)

- `mergeIntervals` / `subtractIntervals` / `sumIntervals` from CORE-6 — interval math
- `bucketRange` / `floorToZone` from CORE-5 — fixed weekly buckets in local time
- `DutyEntry` from ROAD-20 — the same duty-status shape

## Verification

- A 15-then-30 split satisfies the break; 30-then-15 produces a violation
- Driving 4 hours 31 minutes without a break produces a violation
- A 10-hour driving day is legal twice in a week and a violation the third time
- Weekly total above 56 hours produces a violation with the fortnight still under 90
- Two adjacent fixed weeks totalling 91 hours produce a fortnight violation; the same hours straddling three fixed weeks with no adjacent pair above 90 do not — asserted to pin the fixed-week rule
- `euWeekFor` on a Sunday 23:59 and the following Monday 00:00 returns different weeks
- A 9-hour daily rest is accepted three times between weekly rests and rejected the fourth
- A 24-hour weekly rest is accepted only with a regular rest in the adjacent week, unless `international: true`, in which case two consecutive reduced rests pass when the four-week window holds at least four weekly rests with two regular, and `compensationDueBy` is the end of the third following week
- `weeklyRestDueBy` is exactly six 24-hour periods after the previous weekly rest ended
- `returnHomeDue` is four weeks after the last return, or the start of the compensating regular rest after two consecutive reduced weekly rests
- A log spanning a DST transition uses local day boundaries and exact elapsed driving time
- `pnpm run validate` stays green
