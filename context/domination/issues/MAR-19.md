# MAR-19 — Maritime: Laytime and laycan

**Scope:** Charter-party laytime — when the clock starts, which hours count, and how much time was used.

## Gap

Laytime is the most precise time arithmetic in commercial shipping. It settles disputes worth six figures a day, and it was entirely absent from the epic. The calculation has three parts, each of which is a contract term rather than a physical fact:

- **Laycan** — the laydays/cancelling window in which the vessel must present.
- **Commencement** — the Notice of Readiness triggers the clock, but not immediately. The classic rule: NOR tendered before noon starts laytime at 13:00 the same day; tendered after noon, at 08:00 the next day. Turn time may be interposed.
- **Exceptions** — which hours count at all. SHEX excludes Sundays and holidays; SHINC includes them; weather working days exclude time when weather stops work; WIBON and WIPON govern whether the vessel must be in berth or in port to tender.

Sources: [HandyBulk](https://www.handybulk.com/laytime-calculation-in-ship-chartering-complete-guide-to-laydays-nor-demurrage-and-time-sheets/), [Maritime Optima](https://maritimeoptima.com/shipping-academy/laytime).

## Scope

- `packages/gmt/src/maritime/calculate/laycan.ts`:
  - `isWithinLaycan(arrivedAt: string, laycan: { from: string, until: string }, timeZone: string): { withinWindow: boolean, cancellable: boolean }`
- `packages/gmt/src/maritime/calculate/laytimeCommencement.ts`:
  - `laytimeCommencement(norTenderedAt: string, options: { timeZone: string, rule: 'standard' | 'immediate' | 'turnTime', turnTime?: string }): string` — When the clock starts. `'standard'` implements the before-noon/after-noon rule.
- `packages/gmt/src/maritime/calculate/laytimeUsed.ts`:
  - `laytimeUsed(start: string, end: string, options: { timeZone: string, exceptions: LaytimeException[], calendar?: BusinessCalendar }): { used: string, excluded: string, periods: Interval[] } | null`
  - `laytimeBalance(allowed: string, used: string): { demurrage: string, despatch: string }` — Exactly one of the two is non-zero.
- `LaytimeException` is `{ kind: 'shex' | 'weather' | 'holiday' | 'custom', interval?: Interval }`.

## Design notes

- **Exceptions are interval subtraction**, which is why CORE-6 exists. SHEX removes Sundays and holidays from the counted period; weather exceptions remove caller-supplied intervals when work stopped. Both compose through `subtractIntervals`, so they cannot disagree about boundaries.
- **Weather exceptions are observations, not predictions.** GMT cannot know when weather stopped work; the caller supplies the intervals from the statement of facts. This is the same principle that removed `customsClearance` (INT-13).
- **The before-noon rule is local time at the port**, so it inherits CORE-4's resolution. A NOR tendered at exactly 12:00:00 is "before noon" on a half-open basis, consistent with the rest of the library.
- Demurrage and despatch are durations here, not money. Rates are the consumer's problem.
- The rule set is a parameter because charter parties vary. GMT implements the common conventions; it does not assert that any of them is the default.

## What gmt provides (do not re-implement)

- `subtractIntervals` / `mergeIntervals` / `sumIntervals` from CORE-6 — exception handling
- `BusinessCalendar` from CORE-7 — holiday sets for SHEX
- `resolveLocal` from CORE-4 — the local noon boundary
- `floorToZone` from CORE-5 — local day boundaries

## Verification

- NOR tendered at 11:00 local starts laytime at 13:00 the same day
- NOR tendered at 13:00 local starts laytime at 08:00 the next day
- NOR tendered at exactly 12:00:00 is treated as before noon, asserted explicitly
- SHEX excludes a Sunday inside the period; SHINC includes it, and the two results differ by 24 hours
- A supplied weather interval reduces `used` by exactly its length
- Overlapping SHEX and weather exceptions are not double-counted
- `laytimeBalance` returns demurrage when used exceeds allowed, despatch when it does not, and never both
- `isWithinLaycan` returns `cancellable: true` after the cancelling date
- `pnpm run validate` stays green
