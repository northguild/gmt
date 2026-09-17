---
"@northguild/gmt": minor
---

Add a `maxPieces` option to the functions that build one array element per piece, so a large range returns `[]` instead of exhausting the heap (Story CORE-8).

**Which functions.** `splitIntervalByUnitDate`, `splitIntervalByUnitDateTime`, `splitIntervalByUnitTime`, `splitIntervalByUnitUtc`, `splitIntervalByUnitUnix`, `splitIntervalByUnitZoned`, the six matching `intervalDivideEqually*` functions, `mapDatesInRange` and `mapZonedDatesInRange`. Before, each built an array as long as the range asked for. Ten thousand years of days, or a divide into billions of pieces, ran out of memory or threw a `RangeError` from inside the engine.

**The option.** `maxPieces` is a positive safe integer, and it defaults to `1_000_000`. A call that would return more pieces returns `[]`, the functions' existing invalid-input sentinel. A split stops as soon as piece `maxPieces + 1` is due, so the answer comes back in bounded time. A `maxPieces` that is not a positive safe integer also returns `[]`.

```typescript
import { intervalDivideEquallyUnix, mapDatesInRange, splitIntervalByUnitDate } from "@northguild/gmt";

splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 4 }); // [] — 5 slices
splitIntervalByUnitDate("2024-01-01", "2024-01-10", "day", 2, { maxPieces: 5 }).length; // 5
intervalDivideEquallyUnix(0, 90000000, 3, { maxPieces: 2 }); // []
mapDatesInRange("0001-01-01", "9999-12-31", 1); // [] — 3,652,059 dates is over the default
mapDatesInRange("2024-01-01", "4000-01-01", 1, { maxPieces: 2000000 }).length; // 721720
```

**Compatibility.** A call that returned more than 1,000,000 pieces now returns `[]`. Pass a larger `maxPieces` to get the array back. The engine's own array limit, 2^32 − 1 elements, still applies.

**`splitIntervalByUnitTime` no longer loops forever.** A step that carried past midnight wrapped back to the morning, so the split never reached its end. The last slice now ends at `end`.

```typescript
splitIntervalByUnitTime("20:00:00", "23:00:00", "hour", 5); // [{ start: "20:00:00", end: "23:00:00" }]
```

**`bucketRange` gives up quickly.** It already returned `[]` over 10,000 buckets, but it counted them one at a time, which took up to a minute in zones with many offset changes. It now works out from the span when the range is certainly over the limit, and returns in under a second.
