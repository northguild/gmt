---
"@northguild/gmt": minor
---

Add the `interval/` namespace: half-open `[start, end)` interval algebra over instants: overlap, containment, intersect, clamp, merge, subtract, split and sum (Story CORE-6).

Four realms need the same operation and none of them could express it: sum the parts of an interval that fall inside a set of allowed windows. Laytime counts only the hours a charter clause allows, driver hours split a duty period around mandatory rest, demurrage free time counts only working days, and a trading window counts only continuous-session time. Without one shared primitive, each realm reimplements intersection and they disagree at every boundary.

```typescript
import {
  intervalsOverlap,
  mergeIntervals,
  subtractIntervals,
  sumIntervals,
} from "@northguild/gmt";

const shift = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T17:00:00Z" };

intervalsOverlap(shift, { start: "2024-01-01T17:00:00Z", end: "2024-01-01T18:00:00Z" });
// false — touching intervals share no instant

subtractIntervals(shift, [{ start: "2024-01-01T12:00:00Z", end: "2024-01-01T13:00:00Z" }]);
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
//  { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]

sumIntervals([
  { start: "2024-01-01T09:00:00Z", end: "2024-01-01T13:00:00Z" },
  { start: "2024-01-01T12:00:00Z", end: "2024-01-01T17:00:00Z" },
]); // "PT8H" — the overlap counts once
```

- **Half-open `[start, end)`, everywhere in the namespace.** An instant `t` is inside when `start ≤ t < end`. That is SQL:2011's closed-open application-time `PERIOD`, RFC 5545's non-inclusive `DTEND` and Dijkstra's EWD831. Touching intervals do not overlap, `intersectIntervals` returns `null` for them, `mergeIntervals` joins them, and `splitIntervalAt` returns pieces that share no instant. A container gated out at exactly 17:00 has not used another day.
- **Endpoints are instants.** Each needs an offset (`Z` or `±HH:MM`), may carry a `[Zone]` annotation, and may name a different zone from the other. They compare by epoch nanoseconds, as a TC39 `Temporal.Instant` does. A leap second and an unknown critical annotation are rejected. Elective annotations and a `[u-ca=…]` calendar annotation are ignored, as `Temporal.Instant.from` ignores them, and the caller's annotated string is echoed back. Where a realm needs local-calendar edges, build them with `floorToZone` or `bucketRange` first.
- **Outputs are the caller's own strings, never re-serialised.** When two strings spell the same instant, the first argument's spelling wins (`from`'s in `subtractIntervals`, the first occurrence in `splitIntervalAt` and `mergeIntervals`). No spec covers this tie, so it is a GMT rule, chosen because a rule based on position is deterministic without inventing a canonical spelling.
- **`start === end` is a valid empty interval.** It has a position but contains no instant:
  - `intervalContains` is always `false` for it.
  - It overlaps only an interval it lies strictly inside.
  - `mergeIntervals` absorbs it into a run it touches, and drops it otherwise.
  - Removing one changes nothing.
  - An inverted interval (`start` after `end`) is invalid input, not silently swapped.
- **`sumIntervals` is covered time.** It measures the length of the union as an exact ISO 8601 duration with hours as the largest unit: exactly `Temporal.Instant.prototype.until(…, { largestUnit: "hour" })`, since an instant has no calendar to define a day (`PT49H30M`, not `P2DT1H30M`). It sums as `bigint` nanoseconds, so it stays exact past 2^53 ns and across the whole instant range. `sumIntervals([])` is `PT0S`. A New York day across spring-forward is `PT23H`.
- **Also exported:** the `Interval` type (`{ start: string; end: string }`) and `isValidInterval`. `mergeIntervals`, `subtractIntervals` and `splitIntervalAt` return `[]` both as a legitimate result (a fully covered subtraction) and as the invalid-input sentinel, and `isValidInterval` tells the two apart.

The older positional functions in `plain/`, `utc/`, `zoned/` and `unix/` `interval/` move to the same half-open rule in this release, and the `Utc` variants call these functions; that change and its migration are listed in their own entry.
