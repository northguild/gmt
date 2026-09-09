# ROAD-21 — Road: EU Regulation 561/2006 driver hours

**Scope:** European driving time, break and rest limits.

## Gap

EU driver hours are structurally different from FMCSA — they constrain continuous driving and mandate rest periods, rather than bounding a daily window — so they cannot be modelled as parameter changes to ROAD-20. Any operator running cross-Atlantic or UK/EU traffic needs both.

## Scope

- `packages/gmt/src/road/calculate/euDriverStatus.ts`:
  - `euDriverStatus(log: DutyEntry[], at: string, options: { timeZone: string }): { continuousDrivingRemaining: string, dailyDrivingRemaining: string, weeklyRemaining: string, fortnightRemaining: string, breakDue: string | null, violations: Violation[] } | null`
- `packages/gmt/src/road/calculate/euRest.ts`:
  - `dailyRestStatus(log: DutyEntry[], at: string, options): { satisfied: boolean, reducedUsed: number, requiredBy: string }` — Tracks how many reduced daily rests have been used since the last weekly rest.
  - `weeklyRestStatus(log: DutyEntry[], at: string, options): { satisfied: boolean, reduced: boolean, requiredBy: string }`

## EU limits (Regulation (EC) No 561/2006)

| Limit | Rule |
| --- | --- |
| Continuous driving | 45-minute break after 4½ hours at the latest; splittable as 15 minutes then 30 minutes, in that order |
| Daily driving | 9 hours, extendable to 10 hours no more than twice a week |
| Weekly driving | 56 hours |
| Fortnightly driving | 90 hours across any two consecutive weeks |
| Daily rest | 11 consecutive hours, reducible to 9 hours up to three times between weekly rest periods |
| Weekly rest | 45 consecutive hours, reducible to 24 hours every second week |

([EUR-Lex 561/2006 consolidated](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:02006R0561-20200820), [DfT simplified guidance](https://assets.publishing.service.gov.uk/media/5e14b5b040f0b65dbed713a0/simplified-guidance-eu-drivers-hours-working-time-rules.pdf))

## Design notes

- **The split break is ordered.** 15 minutes followed by 30 minutes satisfies the requirement; 30 then 15 does not. Implementations that merely sum to 45 minutes are wrong.
- **The fortnight limit is any two consecutive weeks**, not alternating fixed pairs, so it is a rolling window.
- **Reduced rests are quota-limited**, and the quotas reset on different events: reduced daily rests reset at the weekly rest, reduced weekly rests alternate. This state cannot be derived from the current day alone, which is why the log is the input rather than a running total.
- **Tachographs record UTC.** Driver-facing limits are expressed against local time, so the timezone is required and the two must not be conflated. This is a frequent source of one-hour errors at DST transitions.
- Multi-manning, ferry/train derogations and the working-time directive are out of scope. Document as unimplemented.

## What gmt provides (do not re-implement)

- `mergeIntervals` / `subtractIntervals` / `sumIntervals` from CORE-6 — interval math
- `bucketRange` from CORE-5 — rolling weekly and fortnightly windows
- `DutyEntry` from ROAD-20 — the same duty-status shape

## Verification

- A 15-then-30 split satisfies the break; 30-then-15 produces a violation
- Driving 4 hours 31 minutes without a break produces a violation
- A 10-hour driving day is legal twice in a week and a violation the third time
- Weekly total above 56 hours produces a violation with the fortnight still under 90
- A 9-hour daily rest is accepted three times between weekly rests and rejected the fourth
- A 24-hour weekly rest is accepted only every second week
- The fortnight window is asserted as rolling, not as fixed week pairs
- A log spanning a DST transition uses local day boundaries and exact elapsed driving time
- `pnpm run validate` stays green
