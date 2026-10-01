# TRAN-57 — Transport: Schedule deviation, punctuality and timestamp classification

**Scope:** Planned versus actual: the signed deviation, its classification against a tolerance, the vocabulary that says whether a timestamp is planned, estimated, requested or actual, and the next feasible departure from a timetable.

## Gap

Every mode publishes a plan and records what happened, and every mode measures the gap the same way — yet each realm here was about to define "late" for itself. One mode counts an arrival on time under a 15-minute tolerance; another keys compensation on 60- and 120-minute thresholds; an ocean carrier's schedule reliability is measured in days. The arithmetic is identical; only the tolerance differs, and the tolerance is the caller's fact.

The second shared problem is that one field means four things. DCSA's Just-in-Time Port Call API defines `eventClassifierCode` with the enum `PLN`, `EST`, `REQ`, `ACT` — "Code for the event classifier can be ACT (Actual) PLN (Planned) EST (Estimated) REQ (Requested)" — and its Track & Trace event domain allows `ACT`/`PLN`/`EST` on shipment, transport and equipment events and adds `REQ` only for operations events, running the estimated → requested → planned → actual cycle (ETA, RTA, PTA, ATA) for every nautical service. Comparing an estimate to an actual as though both were observations is the standard visibility-dashboard bug, and nothing in the library names the classes.

([DCSA JIT Port Call OpenAPI 1.2.0-Beta-2, `eventClassifierCode`](https://raw.githubusercontent.com/dcsaorg/DCSA-OpenAPI/master/jit/v1/jit_v1.2.0-Beta-2.yaml), [DCSA `EVENT_DOMAIN` 1.0.4 (Track & Trace 2.2)](https://api.swaggerhub.com/domains/dcsaorg/EVENT_DOMAIN/1.0.4))

## Scope

One public function per file, as everywhere else. Nothing goes in `transport/get/`: see Corrections.

- `packages/gmt/src/transport/compare/scheduleDeviation.ts`:
  - `scheduleDeviation(planned: string, actual: string): string` — Signed ISO 8601 duration of exact elapsed time, hours as the largest unit; positive is late, negative early; `""` on invalid input.
- `packages/gmt/src/transport/compare/classifyPunctuality.ts`:
  - `classifyPunctuality(planned: string, actual: string, tolerance: PunctualityTolerance): Punctuality | null` — Both boundaries are outside: a deviation of `late` or more is late, one of `-early` or less is early (when `early` is given), so "on time" means strictly inside the tolerance. Without `early`, an early arrival is on time. `null` on invalid input.
- `packages/gmt/src/transport/calculate/punctualityRate.ts`:
  - `punctualityRate(pairs: PlannedActual[], tolerance: PunctualityTolerance): OnTimeRate | null` — `{ onTime, total, rate }`, the share `classifyPunctuality`'s rule calls `"onTime"`; `null` for an empty list or any invalid pair.
- `packages/gmt/src/transport/calculate/bestAvailable.ts`:
  - `bestAvailable(events: TimestampEvent[]): ClassifiedTimestamp | null` — `{ at, classifier }`: an `ACT` whenever one exists, otherwise `PLN`, else `REQ`, else `EST`, and within that class the latest `recordedAt`. The order is GMT's own convention, read from the most settled end of DCSA's port-call cycle (estimated → requested → planned → actual); DCSA defines the classes and the cycle, not a selection rule. It is documented and not configurable. `at` is echoed as written.
- `packages/gmt/src/transport/calculate/estimateDrift.ts`:
  - `estimateDrift(events: TimestampEvent[], options?: EstimateDriftOptions): DriftReport | null` — `{ first, last, drift, revisions, exceedsTolerance }`: how far the estimate moved between the first and last-recorded `EST`, for schedule-reliability reporting. With `tolerance`, `exceedsTolerance` says whether the absolute drift is greater than it — "has the estimate moved far enough that something must be redone"; without `tolerance` it is `null`.
- `packages/gmt/src/transport/calculate/nextDeparture.ts`:
  - `nextDeparture(after: string, timetable: readonly string[] | Headway, options?: NextDepartureOptions): string` — The first scheduled departure at or after `after` plus `minimumConnection` (default `"PT0S"`); `""` when none qualifies or on invalid input. A list entry is echoed as written. `Headway` is `{ headway, from, to }`, the shape of a GTFS `frequencies.txt` row, and covers ferries and shuttle services.
- `packages/gmt/src/types/transport-timestamps.ts` (exported from `@northguild/gmt/types`):
  - `TimestampClass` is `"PLN" | "EST" | "REQ" | "ACT"`, DCSA's `eventClassifierCode` vocabulary.
  - `TimestampEvent` is `{ classifier: TimestampClass, at: string, recordedAt: string }`.
  - `PunctualityTolerance` is `{ late: string, early?: string }`, ISO 8601 durations of exact time.
  - `Punctuality` is `"early" | "onTime" | "late"`.
- The result and option types live beside their function: `PlannedActual`, `OnTimeRate`, `ClassifiedTimestamp`, `EstimateDriftOptions`, `DriftReport`, `Headway`, `NextDepartureOptions`.
- Shared internals: `internal/exactDuration.ts` (`exactDurationNanoseconds`) and `internal/exactMoment.ts` (`readExactMoment` / `writeExactMoment`) hold `transitTime`'s duration and moment rules, which `transitTime` and `scheduleDelivery` now read from too; `internal/punctuality.ts` (`parsePunctualityTolerance`, `punctualityOf`) and `internal/timestampEvents.ts` (`parseTimestampEvents`) are shared by the functions above.
- The `transport/compare` and `transport/calculate` subpaths already exist, so no `package.json` export and no `gmt-modules.ts` barrel changes.

## Docs-site scope

The docs site carries these (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)); the execution spec is [context/dox/specs/tran-57-punctuality.md](../../dox/specs/tran-57-punctuality.md):

- Guide `guides/industries/transport-punctuality-and-timestamps.mdx`, one `##` per function: late as exact elapsed time (`scheduleDeviation`), on time needs a stated tolerance (`classifyPunctuality`: the 15-minute, 60/120-minute and day-based examples, both edges outside, early optional), a rate as a count under one tolerance (`punctualityRate`), one field with four meanings (`bestAvailable`), how far the estimate moved (`estimateDrift`), and the next departure a connection can make (`nextDeparture`, list and headway forms, feeding `scheduleDelivery`). Examples are labelled by their numbers only. A cross-link from `transport-multi-leg-scheduling.mdx` to `nextDeparture`, and entries in `guides/index.mdx` and `guides/industries/index.mdx`.
- Scenarios: `estimate-shown-as-actual` (`bestAvailable` against a latest-recorded-wins pick), `delay-across-fall-back` (`scheduleDeviation` against a wall-clock subtraction).
- `mistakes/transport.mdx` gains four entries: "on time" with no tolerance, an estimate compared as though it were an actual, a next departure that ignores the minimum connection, and an inclusive `to` on a headway window.
- Three tools, each with a page, a permalink, a Dox chat tool and a starter pill: **Punctuality Board** (`/tools/punctuality-board/`, `showPunctualityBoard`: `scheduleDeviation`, `classifyPunctuality`, `punctualityRate`, with the tolerance band's edges as draggable handles), **ETA Drift Chart** (`/tools/eta-drift/`, `showEtaDrift`: `bestAvailable`, `estimateDrift`, plotted by when each timestamp was recorded) and **Departure Board** (`/tools/departure-board/`, `showDepartureBoard`: `nextDeparture` on a time rail with a draggable arrival, handing its result to the Delivery Scheduler).
- Every result on the guide, the scenarios, the mistakes page and the tools matches the built package; no example names a jurisdiction or a regulator.

## Design notes

- **Tolerances are parameters; none is a default.** The docs show a 15-minute tolerance, a 60/120-minute pair and a day-based one, labelled by their numbers, so a caller can pick knowingly; "on time" without a stated tolerance is not a measurement. Both boundaries belong to the outside of the on-time window; that is this library's stated convention, not a reading of any rule.
- **`scheduleDeviation` is a span of instants.** A schedule's local time is rendered by `etaAtZone`; the deviation itself is exact elapsed time, so a delay across a DST transition is 60 minutes, not 0 or 120.
- **`bestAvailable` never mixes classes.** It returns the class with the value so the consumer can label it; a dashboard that shows an `EST` in the `ACT` column is the failure this prevents.
- **`nextDeparture` is timetable lookup, not routing.** It answers "which departure can this connection make", the input `scheduleDelivery` (TRAN-9) needs for an explicit `departure`; choosing among routes remains the consumer's problem. A departure exactly at the threshold is made, as a zero-slack connection is feasible in `scheduleDelivery`.
- OTP aggregation is included because the definition is small and the tolerance is the caller's; anything beyond a rate — percentiles, causal attribution — is the consumer's.

## Corrections

- **Placement.** `coding-standards.md` limits `get/` to current-moment accessors: no argument, or a time zone only. `bestAvailable` and `estimateDrift` take events, so they are in `transport/calculate/`, one function per file, not in a `transport/get/timestampClass.ts`. `classifyPunctuality` compares two moments and is in `transport/compare/` beside `scheduleDeviation`; `punctualityRate` aggregates a list and is in `transport/calculate/`. The four shared types are in `src/types/transport-timestamps.ts`, since three functions and the internals use them.
- **`classifyPunctuality` returns `null` on invalid input.** Its result is a string union, so `""` is not a member of it; `null` is the sentinel, as for `classifyLocal`. The signature is `Punctuality | null`.
- **`estimateDrift` returns `null` with fewer than two `EST` records.** One estimate has no drift, and reporting `PT0S` for it would invent a quantity (tracker, "No invented quantities").
- **`nextDeparture` requires every moment to carry its offset.** `after`, each list entry, `from` and `to` are instants or zoned strings with an offset, as `nextOpenAt` requires of its input; a wall time without one returns `""`. In a repeated fall-back hour an offset-less wall time names two departures, and the timetable must say which. List entries are echoed exactly as written, so the offset the caller chose travels into `scheduleDelivery` and the fall-back hour resolves there to the same instant `nextDeparture` compared.
- **The headway window is half-open, `[from, to)`.** `to` is never a departure, as a GTFS `frequencies.txt` `end_time` is not. Departures are `from + k × headway` in exact time, computed from the `from` anchor (`k` is the ceiling of the distance over the headway), never stepped, so a long window costs nothing and spacing survives a DST transition. The result is written the way `from` was written. The model is GTFS `exact_times=1`; for `exact_times=0` service the result is a nominal slot.
- **`punctualityRate` reads the tolerance once.** `late` and `early` are parsed before the first pair, so the whole list is judged under one tolerance, whatever a getter returns later.
- **Standards named, and nothing else.** DCSA (the `eventClassifierCode` vocabulary and the port-call cycle) and GTFS `frequencies.txt` (the headway row format) are named as vocabulary and format standards, which the tracker allows ("a body's _format, vocabulary, cadence or algorithm_ is a standard GMT may implement and cite"). Tolerances are labelled only by their numbers.
- The drift-against-a-tolerance test came from the advance-filing story, where it was a function that decided whether a revised estimate required a new filing under one regime's threshold. It is `estimateDrift` with the caller's `tolerance` and an `exceedsTolerance` flag; the threshold is the caller's and the consequence is the consumer's.

## What gmt provides (do not re-implement)

- `transitTime` / `etaAtZone` from TRAN-8 — `transitTime`'s moment and duration rules, extracted to `readExactMoment` / `writeExactMoment` and `exactDurationNanoseconds`, read every `nextDeparture` moment, the headway, `minimumConnection` and every tolerance; `etaAtZone` is where `scheduleDeviation` sends a caller who needs a schedule's local time
- `scheduleDelivery` from TRAN-9 — takes `nextDeparture`'s result as a leg's `departure`, and sets the zero-slack connection rule `nextDeparture` follows
- `parseInstantNanoseconds` from CORE-2 — every planned, actual, `at` and `recordedAt` compared as epoch nanoseconds
- `formatHourDuration` from CORE-6 — `estimateDrift`'s `drift` string
- `isValidInstant` — `scheduleDeviation`'s gate
- `isValidZonedDateTime` — the zoned read inside `readExactMoment`
- `isObject` / `isOptionsArgument` / `hasInstantShape` — argument guards

## Verification

- `scheduleDeviation` returns `PT14M` for a 14-minute late arrival and `-PT5M` for an early one
- `classifyPunctuality` with `late: 'PT15M'` returns `'onTime'` at 14 minutes 59 seconds and `'late'` at exactly 15 minutes — the half-open boundary, asserted
- Without `early`, any early arrival is `'onTime'`; with `early: 'PT10M'`, 11 minutes early is `'early'`
- A delay across a fall-back transition is measured as exact elapsed time
- `punctualityRate` over four pairs with one late returns `rate: 0.75`; an empty list returns the sentinel
- `bestAvailable` returns the `ACT` when present regardless of recording order, the newest `PLN` otherwise, and never an `EST` when a `REQ` exists
- `estimateDrift` over three `EST` revisions reports `revisions: 3` and the first-to-last difference; without `tolerance`, `exceedsTolerance` is `null`
- `estimateDrift` with `tolerance: 'PT8H'` reports `exceedsTolerance: true` for a nine-hour move and `false` for a seven-hour one, in either direction
- `nextDeparture` with a list skips departures before `after + minimumConnection`; with a 20-minute headway from 06:00 it returns the first multiple of 20 minutes at or after the input, and `''` after `to`
- `pnpm run validate` stays green
