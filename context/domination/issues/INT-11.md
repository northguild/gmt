# INT-11 — Intermodal: Container legs and terminal dwell

**Scope:** Container movement across ocean and land legs, and dwell measured the way terminals actually measure it.

## Gap

Containers move across modes (ship → rail → truck), and each handoff accrues dwell at a terminal, depot or yard. Dwell drives cost, and the cost is computed from local calendar-day boundaries rather than elapsed hours.

## Scope

- `packages/gmt/src/intermodal/calculate/containerLeg.ts`:
  - `containerLeg(leg: { mode: string, departure: string, duration: string, origin: string, destination: string, destinationZone: string }): { arrival: string, localArrival: string, mode: string, origin: string, destination: string } | null` — Arrival for a single leg. `mode` is an opaque tag.
- `packages/gmt/src/intermodal/calculate/terminalDwell.ts`:
  - `terminalDwell(entry: string, exit: string, timeZone: string): { duration: string, calendarDays: number, enter: string, exit: string } | null` — Dwell at a terminal, with local calendar days crossed.

## Design notes

- `destinationZone` is an explicit IANA zone. GMT does not map a UN/LOCODE, terminal code or port name to a timezone — that registry is parked, see [../painpoints.md](../painpoints.md).
- `calendarDays` counts local midnight boundaries crossed on a half-open basis. It is the input to charging, not the charge itself: whether those days are free, chargeable, calendar or working is INT-12's problem, because it depends on the contract rather than on the terminal.

## Corrections

The original INT-1 specced two functions that are removed here.

- **`customsClearance(arrival, port) => { clearanceStart, clearanceEnd, estimatedHours }`** is deleted. A time library cannot know how long a customs authority will take; the value would have been invented. The deterministic, legally defined part of customs timing is the *filing deadline*, which moves to INT-13.
- **`portDwell(entry, exit, port) => { inFreeTime }`**, backed by a hardcoded four-port free-time table, is replaced by `terminalDwell`, which reports dwell without judging it. Free time is set by carrier, lane, trade and service contract — **not** by port — so a per-port free-time constant encodes something that is not a fact. Free-time evaluation moves to INT-12, where the contract terms are parameters.
  ([ACL](https://www.aclcargo.com/free-time-demurrage/))

## What gmt provides (do not re-implement)

- `transitTime` / `dwellTime` / `etaAtZone` from TRAN-8 — leg and dwell arithmetic
- `floorToZone` from CORE-5 — local calendar-day boundaries
- `scheduleDelivery` from TRAN-9 — multi-leg composition

## Verification

- `containerLeg` returns the correct arrival and local arrival for a known ocean leg
- A leg arriving at 23:30 local returns a local arrival on the expected local date
- `terminalDwell` from 23:00 to 01:00 local returns `calendarDays: 2`
- `terminalDwell` where entry and exit fall on the same local date returns `calendarDays: 1`
- Dwell spanning a DST transition returns exact elapsed duration and the correct day count
- Invalid zone or inverted interval returns the sentinel
- `pnpm run validate` stays green
