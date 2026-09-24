# TRAN-8 — Transport: Transit time + ETA + dwell time

**Scope:** Core transport utilities shared across all transport modes.

## Gap

All transport modes share three basic operations: adding a duration to a departure to get an arrival, converting that arrival to zone-local time for display, and measuring how long something sat somewhere — at a terminal, depot, yard, station, gate or berth.

## Scope

- `packages/gmt/src/transport/calculate/transitTime.ts`:
  - `transitTime(departure: string, duration: string): string` — Adds an ISO duration to a departure. The departure's timezone is preserved.
- `packages/gmt/src/transport/convert/etaAtZone.ts`:
  - `etaAtZone(arrivalUtc: string, targetZone: string): string` — UTC arrival to local time in the target zone for display.
- `packages/gmt/src/transport/calculate/dwellTime.ts`:
  - `dwellTime(entry: string, exit: string, targetZone?: string): { duration: string, enter: string, exit: string, calendarDays: number } | null` — Time spent, with zone-local entry and exit. `calendarDays` counts local date boundaries crossed, which is the basis every dwell-charging regime uses.
- Docs site (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)). Transport is
  the first realm on the site, so this story also creates the shared industries index:
  - `guides/industries/index.mdx` — what an industry layer is and the rules that hold across
    all of them; links to each realm's guide, scenarios and mistakes.
  - `guides/industries/transport-legs-and-dwell.mdx` — the three functions, the zone rule and
    the half-open day count, ported from the README section.
  - Scenarios: `container-dwell-days` (`dwellTime`), `transit-across-dst` (`transitTime`),
    `arrival-on-a-fall-back-night` (`etaAtZone`).
  - `mistakes/transport.mdx` — dividing hours by 24, bare instants with no zone, a running time
    added on the wall clock, calendar durations, an offset that contradicts its zone, a fixed
    offset used as a zone, a zoneless arrival.
  - Index entries in `guides/index.mdx` and `mistakes/index.mdx`.

## Design notes

- `targetZone` is an IANA zone identifier supplied by the caller. GMT does not resolve a port, airport, terminal or station code to a zone — see the parked registries note in [../painpoints.md](../painpoints.md).
- `targetZone` defaults to the zone carried by `entry`. When `entry` and `exit` carry no zone — UTC or offset-only strings — `targetZone` is required, and its absence returns the sentinel: `calendarDays` has no meaning without a locality, and an offset is not a zone (CORE-4).
- `calendarDays` is not `duration` rounded. A container entering at 23:00 and leaving at 01:00 spans two local calendar days over two hours. Charging regimes count boundaries, not elapsed time, which is why this is returned rather than left to the caller. It is the number of distinct local dates touched — same-date entry and exit is `1` — derived from `floorToZone`, never from dividing hours by 24.
- **`dwellTime` is the one "local days crossed" primitive in the library.** Free time and demurrage (INT-12), laytime day counting (MAR-19) and hospital length of stay (HLTH-69) consume it rather than re-deriving day boundaries, so they cannot disagree about a midnight.
- `dwellTime` reports dwell without judging it. Whether those days were free, chargeable, calendar or working depends on a contract, not on the place — that is INT-12's problem.
- `transitTime` preserves the departure zone. Multi-leg journeys that change zone use `scheduleDelivery` (TRAN-9).

## Corrections

An earlier draft of the logistics realms specced `portDwell(entry, exit, port) => { inFreeTime }`, backed by a hardcoded four-port free-time table. It is replaced by `dwellTime`. Free time is set by carrier, lane, trade and service contract — **not** by port — so a per-port free-time constant encoded something that is not a fact, and resolving a port code to a zone is exactly the place registry this epic declines to bundle. Free-time evaluation moved to INT-12, where the contract terms are parameters. ([ACL](https://www.aclcargo.com/free-time-demurrage/))

The same draft wrapped a single leg as `containerLeg`, adding opaque `mode`, `origin` and `destination` tags to what is `transitTime` composed with `etaAtZone`. The tags now live on TRAN-9's `Leg`, where a multi-leg move actually needs them, and the wrapper is gone.

## What gmt provides (do not re-implement)

- `addDuration` / `subtractDuration` — duration arithmetic
- `convertUtcToZoned` / `convertZonedToZoned` — timezone conversion
- `floorToZone` from CORE-5 — local date boundaries, for `calendarDays`
- `spanMs` from CORE-2 — elapsed time
- `classifyLocal` from CORE-4 — the disambiguation vocabulary `etaAtZone`'s JSDoc uses

## Verification

- `transitTime('2024-06-15T10:00:00-04:00[America/New_York]', 'PT2H30M')` returns `'2024-06-15T12:30:00-04:00[America/New_York]'` (the first draft wrote `-05:00`, which New York does not keep in June; a bracketed zone whose offset contradicts it is rejected, as `isValidZonedDateTime` rejects it)
- `transitTime('2024-06-15T10:00:00-05:00[America/New_York]', 'PT2H')` returns the sentinel — the offset contradicts the zone
- `etaAtZone('2024-06-15T12:30:00Z', 'Asia/Tokyo')` returns `'2024-06-15T21:30:00+09:00[Asia/Tokyo]'`
- `transitTime` across a DST transition adds exact elapsed time, and the local wall time reflects the shift
- `dwellTime` from 23:00 to 01:00 local returns `calendarDays: 2` with a two-hour duration
- Entry and exit on the same local date return `calendarDays: 1`
- `dwellTime('2024-06-15T22:30:00Z', '2024-06-16T01:00:00Z', 'Europe/London')` returns `calendarDays: 2`; the same instants with `'Europe/Amsterdam'` return `calendarDays: 1` — the count depends on the zone, asserted explicitly
- UTC entry and exit with no `targetZone` return the sentinel
- Dwell spanning a DST transition returns the exact elapsed duration and the correct day count
- Inverted interval, invalid duration or invalid timezone returns the sentinel
- `battleTestTimeZones` coverage plus probe-zone transition rows for timezone-aware functions (see `context/coding-standards.md` § Calendar & zone semantics)
- Every result on the docs-site pages matches the built package, and every internal link on
  them resolves
- `pnpm run validate` stays green
