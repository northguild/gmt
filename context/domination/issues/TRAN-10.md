# TRAN-10 — Transport: Cut-off and deadline math

**Scope:** Deadlines expressed as an offset from a moving anchor, in a local timezone, rolled against a business calendar.

## Gap

Logistics runs on deadlines that are not fixed timestamps. They are offsets from an anchor event — usually vessel or flight departure — expressed in terminal-local time, and **they move when the schedule moves**. An ocean booking carries a stack of them: documentation/SI cut-off, VGM cut-off, CY gate-in cut-off, customs cut-off.

A representative shape: vessel departs Friday 18:00, so documentation closes Wednesday 17:00, VGM Thursday 10:00, gate-in Thursday 18:00. Reschedule the vessel and all four move.
([DCSA](https://dcsa.org/newsroom/cut-off-times-in-shipping), [BRF Logistics](https://brf-logistics.com/sailing-schedules-si-cut-off-port-cut-off-and-customs-cut-off/))

Advance filing and pre-arrival notice deadlines are the same shape with a stricter anchor rule. They are stated as hours before a named cargo or vessel event, and the event differs by regime — loading, departure from the load port, or arrival at the first port — so the same offset from the wrong event is late by days. The anchor is the caller's event, with no default; GMT ships no regime table.

## Scope

- `packages/gmt/src/transport/calculate/cutoffAt.ts`:
  - `cutoffAt(anchor: string, offset: string, options: { timeZone: string, atLocalTime?: string, calendar?: BusinessCalendar, roll?: RollConvention }): string` — Subtracts `offset` from `anchor`, optionally pins the result to a fixed local time of day, and rolls off non-business days.
- `packages/gmt/src/transport/calculate/cutoffSchedule.ts`:
  - `cutoffSchedule(anchor: string, cutoffs: { name: string, offset: string, atLocalTime?: string }[], options): { name: string, at: string }[]` — The whole stack against one anchor, sorted earliest first.
- `packages/gmt/src/transport/compare/isPastCutoff.ts`:
  - `isPastCutoff(now: string, cutoff: string): boolean`
  - `timeToCutoff(now: string, cutoff: string): string` — ISO duration, negative when the cut-off has passed.
- Docs site (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)):
  - `guides/industries/transport-legs-and-dwell.mdx` gains "Deadlines from an anchor", one `##` per function: the cut-off stack, `atLocalTime` versus subtracting a duration, and the anchor — `cutoffAt(loading, 'PT24H', …)` beside `cutoffAt(departure, 'PT24H', …)` for the same shipment, a 96-hour offset from arrival, a 2-day offset pinned to 17:00 local. Examples are labelled by their numbers only.
  - Scenarios: `filing-anchored-to-the-wrong-event` (`cutoffAt`), `two-days-before-is-not-48-hours` (`cutoffAt`).
  - `mistakes/transport.mdx` gains an entry: an offset counted from departure when the rule says loading, and a `P2D` subtraction where the rule means 17:00 local.
  - Index entries in `guides/industries/index.mdx` and `mistakes/index.mdx`.

## Design notes

- **`atLocalTime` is what makes this different from subtracting a duration.** A "two days before" cut-off is almost never 48 hours before; it is 17:00 local two days prior. Subtracting `P2D` from an 18:00 departure gives 18:00, which is wrong by an hour whenever a DST transition falls between the two, and wrong by a working day whenever the tariff means close of business.
- The anchor moves. These functions are pure and take the anchor as an argument, so a schedule change is a recomputation, not a mutation. Callers should not cache cut-offs derived from an ETD.
- A cut-off that lands on a weekend or holiday rolls with `preceding` by default — a deadline never moves *later* to accommodate a closure.
- Cut-offs are local wall times, so they inherit CORE-4's ambiguity handling. A cut-off falling in a nonexistent local hour returns the sentinel rather than silently shifting.
- **The anchor is the caller's event.** Loading, departure and arrival are different instants; `cutoffAt` takes one and never guesses which a rule means. An instant offset with no `atLocalTime` is the advance-filing shape; `atLocalTime` is the ocean cut-off shape. Both are the same function.

## Corrections

- The advance-filing story specced `filingDeadline`, `filingStatus` and an opt-in regime table keyed by filing scheme. `filingDeadline` was `cutoffAt` without `atLocalTime`; `filingStatus` was `isPastCutoff` plus `timeToCutoff`; the table was law and is not shipped (tracker, "GMT tracks no law"). What survives is the lesson that the anchor is the caller's event, recorded in the design note above and shown in the guide. Its ETA-movement test — whether a revised estimate has moved far enough to require a new filing — is TRAN-57's `estimateDrift` against a tolerance.

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
- Anchoring the same 24-hour offset to departure rather than loading yields a different deadline, asserted side by side; a 96-hour offset from arrival is exact elapsed time across a DST transition
- A deadline landing on a holiday with `roll: 'preceding'` moves backward, never forward
- Every result on the guide, the scenarios and the mistakes page matches the built package; no example names a jurisdiction or a filing scheme
- `pnpm run validate` stays green
