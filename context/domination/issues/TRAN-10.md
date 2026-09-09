# TRAN-10 — Transport: Cut-off and deadline math

**Scope:** Deadlines expressed as an offset from a moving anchor, in a local timezone, rolled against a business calendar.

## Gap

Logistics runs on deadlines that are not fixed timestamps. They are offsets from an anchor event — usually vessel or flight departure — expressed in terminal-local time, and **they move when the schedule moves**. An ocean booking carries a stack of them: documentation/SI cut-off, VGM cut-off, CY gate-in cut-off, customs cut-off.

A representative shape: vessel departs Friday 18:00, so documentation closes Wednesday 17:00, VGM Thursday 10:00, gate-in Thursday 18:00. Reschedule the vessel and all four move.
([DCSA](https://dcsa.org/newsroom/cut-off-times-in-shipping), [BRF Logistics](https://brf-logistics.com/sailing-schedules-si-cut-off-port-cut-off-and-customs-cut-off/))

## Scope

- `packages/gmt/src/transport/calculate/cutoffAt.ts`:
  - `cutoffAt(anchor: string, offset: string, options: { timeZone: string, atLocalTime?: string, calendar?: BusinessCalendar, roll?: RollConvention }): string` — Subtracts `offset` from `anchor`, optionally pins the result to a fixed local time of day, and rolls off non-business days.
- `packages/gmt/src/transport/calculate/cutoffSchedule.ts`:
  - `cutoffSchedule(anchor: string, cutoffs: { name: string, offset: string, atLocalTime?: string }[], options): { name: string, at: string }[]` — The whole stack against one anchor, sorted earliest first.
- `packages/gmt/src/transport/compare/isPastCutoff.ts`:
  - `isPastCutoff(now: string, cutoff: string): boolean`
  - `timeToCutoff(now: string, cutoff: string): string` — ISO duration, negative when the cut-off has passed.

## Design notes

- **`atLocalTime` is what makes this different from subtracting a duration.** A "two days before" cut-off is almost never 48 hours before; it is 17:00 local two days prior. Subtracting `P2D` from an 18:00 departure gives 18:00, which is wrong by an hour whenever a DST transition falls between the two, and wrong by a working day whenever the tariff means close of business.
- The anchor moves. These functions are pure and take the anchor as an argument, so a schedule change is a recomputation, not a mutation. Callers should not cache cut-offs derived from an ETD.
- A cut-off that lands on a weekend or holiday rolls with `preceding` by default — a deadline never moves *later* to accommodate a closure.
- Cut-offs are local wall times, so they inherit CORE-4's ambiguity handling. A cut-off falling in a nonexistent local hour returns the sentinel rather than silently shifting.

## What gmt provides (do not re-implement)

- `resolveLocal` / `classifyLocal` from CORE-4 — local time resolution
- `rollDate` and `BusinessCalendar` from CORE-7 — non-business-day rolling
- `subtractDuration` — offset arithmetic
- `spanMs` from CORE-2 — `timeToCutoff`

## Verification

- `cutoffAt` with `atLocalTime: '17:00'` and offset `P2D` returns 17:00 local two days before, not anchor-minus-48h
- Anchor moved by one day moves every cut-off by one day
- A cut-off landing on a Sunday rolls backward to Friday with the default convention
- Across a DST transition, the local time of day is preserved and the instant offset differs
- `timeToCutoff` returns a negative duration after the cut-off
- `cutoffSchedule` returns entries sorted earliest first
- Nonexistent local time returns the sentinel
- `pnpm run validate` stays green
