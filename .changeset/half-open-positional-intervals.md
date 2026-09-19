---
"@northguild/gmt": minor
---

Make the positional interval functions in `plain/`, `utc/`, `zoned/` and `unix/` half-open `[start, end)`, the rule the `interval/` namespace already follows (Story CORE-8).

Earlier releases read most of these functions' intervals as closed `[start, end]`, with both endpoints inside, and stepped one unit in from every cut to make that work: one nanosecond, one day, or one epoch unit. A result from `intervalsOverlapUtc` could then disagree with `intervalsOverlap` on the same instants. Every positional family now uses `start ≤ t < end`, as SQL:2011's closed-open `PERIOD`, RFC 5545's non-inclusive `DTEND` and EWD831 do, and the one-unit steps are gone.

```typescript
import { intervalAbutsDate, intervalContainsDate, intervalDifferenceUtc, intervalsOverlapUtc } from "@northguild/gmt";

intervalsOverlapUtc("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T17:00:00Z"); // false
intervalDifferenceUtc("2024-01-01T09:00:00Z", "2024-01-01T17:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T13:00:00Z");
// [{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }, { start: "2024-01-01T13:00:00Z", end: "2024-01-01T17:00:00Z" }]
intervalContainsDate("2024-01-01", "2024-02-01", "2024-01-31"); // true
intervalAbutsDate("2024-01-01", "2024-07-01", "2024-07-01", "2024-12-31"); // true
```

- **Which functions.** Every variant (`Date`, `DateTime`, `Time`, `Utc`, `Zoned`, `Unix`) of `intervalsOverlap*`, `intervalContains*`, `intervalEngulfs*`, `intervalIntersection*`, `intervalUnion*`, `mergeIntervals*`, `intervalDifference*`, `intervalXor*`, `intervalXorAll*`, `intervalAbuts*` and `intervalOverlappingDays*`. The `Utc` variants call `interval/`'s `intervalsOverlap`, `intervalContains`, `intersectIntervals`, `mergeIntervals` and `subtractIntervals`, so both namespaces give the same answer.
- **Touching intervals** do not overlap and have no intersection. They abut: `intervalAbuts*` is Allen's "meets", one interval's `end` equal to the other's `start`. `intervalUnion*`, `mergeIntervals*` and `intervalXor*` join them into one run.
- **Empty intervals.** `start === end` holds no instant. It abuts nothing, and it is contained or engulfed only strictly inside another interval. `intervalUnion*` ignores it, and returns `null` when both inputs are empty.
- **The tiling functions keep their output.** `intervalSplitAt*`, `splitIntervalByUnit*` and `intervalDivideEqually*` still give each piece's `end` as the next piece's `start`. Under the half-open rule those pieces share no instant, so they partition the interval.
- **Outputs are still re-serialised** in each type's canonical spelling, so a row whose value did not change returns the same string.

**`intervalCount*` counts an empty interval as `0`.** A zero-length interval holds no instant, so it touches no unit. All six families counted `1` when the point fell inside a unit.

**`intervalOverlappingDaysZoned` and `intervalOverlappingDaysUnix` return `0` for an empty intersection.** An empty interval strictly inside the other one counted as one day. `intervalOverlappingDaysUtc`, `…Date` and `…DateTime` return `0` too.

```typescript
import { intervalCountUnix, intervalOverlappingDaysUnix } from "@northguild/gmt/unix";

intervalCountUnix(1800000, 1800000, "hour"); // 0
intervalOverlappingDaysUnix(0, 172800000, 129600000, 129600000); // 0
```

**`splitIntervalByUnit*` rejects a unit its type does not have, even for an empty interval.** A zero-length interval returned a one-piece split for any unit. It now returns `[]`, as a non-empty interval does. `splitIntervalByUnitDate` accepts only date units, and `splitIntervalByUnitTime` only time units.

```typescript
import { splitIntervalByUnitDate } from "@northguild/gmt/plain";

splitIntervalByUnitDate("2024-01-01", "2024-01-01", "hour", 1); // []
```

### Breaking changes

`A` is `2024-01-01T09:00:00Z`, `B` is `…T12:00:00Z`, `C` is `…T13:00:00Z` and `D` is `…T17:00:00Z`. Each row applies to every variant of its family.

| Call | 1.15 (closed) | 1.16 (half-open) |
| --- | --- | --- |
| `intervalsOverlapUtc(A, B, B, D)` | `true` | `false` |
| `intervalContainsUtc(A, B, B)`, a point at `end` | `true` | `false` |
| `intervalIntersectionUtc(A, B, B, D)` | `{ start: B, end: B }` | `null` |
| `intervalDifferenceUtc(A, D, B, C)` | `[{ A, …T11:59:59.999999999Z }, { …T13:00:00.000000001Z, D }]` | `[{ A, B }, { C, D }]` |
| `intervalDifferenceDate("2024-01-01", "2024-12-31", "2024-06-01", "2024-07-01")` | `[{ 01-01, 05-31 }, { 07-02, 12-31 }]` | `[{ 01-01, 06-01 }, { 07-01, 12-31 }]` |
| `intervalXorUtc(A, C, B, D)`, `intervalXorAllUtc([{ A, C }, { B, D }])` | `[{ A, …T11:59:59.999999999Z }, { …T13:00:00.000000001Z, D }]` | `[{ A, B }, { C, D }]` |
| `intervalAbutsUtc(A, B, B, D)`, a shared endpoint | `false` | `true` |
| `intervalAbutsUtc(A, B, "2024-01-01T12:00:00.000000001Z", D)` | `true` | `false` |
| `intervalAbutsDate("2024-01-01", "2024-06-30", "2024-07-01", "2024-12-31")` | `true` | `false` |
| `intervalOverlappingDaysUtc("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-02T00:00:00Z", "2024-01-03T00:00:00Z")` | `1` | `0` |
| `intervalCountUnix(1800000, 1800000, "hour")` | `1` | `0` |
| `splitIntervalByUnitDate("2024-01-01", "2024-01-01", "hour", 1)` | one piece | `[]` |

Unchanged: `intervalUnionUtc(A, B, B, D)` is `{ start: A, end: D }`, `intervalIntersectionUtc(A, C, B, D)` is `{ start: B, end: C }`, `intervalSplitAtUtc(A, D, [B])` is `[{ A, B }, { B, D }]`, and `intervalCountUtc(A, D, "hour")` is `8`.

Migration:

- **An interval whose `end` was the last day, or last unit, it covers** now stops before it. Pass the next day or unit as `end`: `intervalContainsDate("2024-01-01", addDate("2024-01-31", { days: 1 }), "2024-01-31")` is `true`.
- **Code that undid the one-unit step**, for example by adding a nanosecond to a piece from `intervalDifference*`, must stop: pieces now end and start exactly at the cut.
- **Code that tested `intervalAbuts*` for a one-unit gap** now tests for a shared endpoint.
