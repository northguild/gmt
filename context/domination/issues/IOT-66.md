# IOT-66 — IoT: Ordering under clock uncertainty

**Scope:** Timestamps that stay causally consistent across devices whose clocks disagree — hybrid logical clocks — and the rules for ordering events when each carries an uncertainty interval.

## Gap

IOT-30 estimates how wrong a device clock is and how much that estimate can be trusted. The next question every distributed system asks is "which of these two events happened first", and a physical timestamp cannot answer it once two devices are involved: their clocks differ by more than the gap between the events. Two published answers exist and both are pure time arithmetic:

- **Hybrid logical clocks** (Kulkarni et al., 2014) pair a physical timestamp with a logical counter. Sending and receiving follow two short update rules (the paper's Figure 5); the result never lags physical time (Theorem 2), stays within the clock-synchronisation uncertainty ε of it (Corollary 1, `|l.f − pt.f| ≤ ε`), keeps its counter bounded (Corollary 3), and respects causality — `e hb f ⇒ (l.e, c.e) < (l.f, c.f)` (Theorem 1). CockroachDB, MongoDB and YugabyteDB timestamp with HLCs.
- **Uncertainty intervals** (Spanner's TrueTime, Corbett et al., 2012) represent "now" as `TT.now() → [earliest, latest]`, guaranteed to contain the absolute time of the call (§3, Table 1), and make two events comparable only when their intervals do not overlap; a writer assigns a commit timestamp no less than `TT.now().latest` and waits until `TT.after(s)` before exposing it — commit wait (§4.1.2), with an expected wait of at least 2ε (§4.2.1).

The library has the ingredients (IOT-30's `uncertaintyInterval`, CORE-1's nanoseconds) and none of the rules.

([Kulkarni, Demirbas, Madappa, Avva, Leone, *Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases*, UB CSE TR 2014-04, §3.3 Figure 5](https://cse.buffalo.edu/tech-reports/2014-04.pdf), [Corbett et al., *Spanner: Google's Globally-Distributed Database*, OSDI 2012, §3, §4.1.2, §4.2.1](https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf))

## Scope

- `packages/gmt/src/iot/calculate/hybridLogicalClock.ts`:
  - `Hlc` is `{ physical: string, logical: number }` — an instant string and a counter.
  - `hlcSend(local: Hlc, nowPhysical: string): Hlc` — The local-event / send rule: `l' = max(l, pt)`; `c' = c + 1` if `l' === l`, else `0`.
  - `hlcReceive(local: Hlc, remote: Hlc, nowPhysical: string): Hlc` — The receive rule: `l' = max(l, l_remote, pt)`; `c'` per the paper's three cases.
  - `hlcCompare(a: Hlc, b: Hlc): -1 | 0 | 1` — Lexicographic on `(physical, logical)`.
  - `hlcSkew(hlc: Hlc, nowPhysical: string): string` — `l − pt`, how far the logical part has run ahead of the local physical clock; the bounded-drift property means this should stay below the clock skew, and a large value is the diagnostic.
  - `hlcToUint64` / `hlcFromUint64` — The common 48-bit-milliseconds plus 16-bit-counter packing, with the overflow behaviour stated.
- `packages/gmt/src/iot/compare/uncertaintyOrder.ts`:
  - `uncertaintyOrder(a: Interval, b: Interval): -1 | 1 | 'indeterminate'` — `-1` when `a.end ≤ b.start`, `1` when `b.end ≤ a.start`, otherwise the intervals overlap and no ordering can be asserted.
  - `commitWaitUntil(timestamp: string, uncertainty: Interval): string` — The instant after which `timestamp` is definitely in the past for every observer: `uncertainty.end`, per TrueTime's `TT.after`.
  - `isDefinitelyPast(timestamp: string, now: Interval): boolean` — `TT.after(t)`: `t < now.start`.

## Design notes

- **The rules are the paper's, verbatim in the JSDoc.** HLC's correctness argument depends on the exact four-case analysis in the receive rule (`l.j = l′.j = l.m` → `max(c.j, c.m) + 1`; `l.j = l′.j` → `c.j + 1`; `l.j = l.m` → `c.m + 1`; else `0`); a "close enough" variant loses the causality guarantee silently. Each function's JSDoc quotes the rule it implements and cites Figure 5 of the technical report.
- **`'indeterminate'` is a first-class result**, as in HLTH-35: two events whose uncertainty intervals overlap have no order, and returning one anyway is the fabrication this realm exists to prevent.
- **HLC physical parts are instants, not `bigint` seconds**, so they read as timestamps everywhere else in the library; the packed form is provided for storage and states its millisecond truncation and 16-bit counter ceiling.
- **Uncertainty intervals come from IOT-30**, so a device that measured its offset and delay can produce a TrueTime-style interval without a GPS receiver; the JSDoc is explicit that the guarantee is only as good as the interval.
- Snapshot reads, transaction protocols and consensus are the database's problem. This story stops at "which happened first, and when is it safe to say so".

## What gmt provides (do not re-implement)

- `uncertaintyInterval` / `clockOffset` from IOT-30 — the interval inputs
- `toNanoseconds` / `fromNanoseconds` from CORE-1 — exact instant arithmetic and the packed encoding
- `intervalsOverlap` from CORE-6 — the overlap test under `uncertaintyOrder`
- `spanMs` from CORE-2 — skew measurement

## Verification

- `hlcSend` on a clock whose physical part is ahead of `nowPhysical` increments the counter and keeps `physical`; when `nowPhysical` is ahead it adopts it and resets the counter to 0
- `hlcReceive` of a remote clock ahead of both local and physical adopts the remote physical and sets the counter to `remote.logical + 1`; when local and remote physicals are equal the counter is `max + 1`; when physical time is ahead of both the counter is 0 — the paper's three cases, asserted one by one
- A send followed by a receive of that message on another node always compares greater under `hlcCompare`, across a simulated skew of one second, asserted
- `hlcSkew` on a well-behaved simulation stays below the injected skew
- `hlcToUint64` round-trips; a counter of 65 536 returns the sentinel
- `uncertaintyOrder` returns `-1` for `[0, 5]` versus `[5, 10]` (touching is ordered under half-open intervals) and `'indeterminate'` for `[0, 6]` versus `[5, 10]`
- `commitWaitUntil` returns the interval's `end`; `isDefinitelyPast` is `false` at the interval's start and `true` one nanosecond before it
- `pnpm run validate` stays green
