---
"@northguild/gmt": minor
---

Five new functions convert between UTC and the two scales spacecraft navigation and Earth ephemerides use: Terrestrial Time (TT) and Geocentric Coordinate Time (TCG).

- `toTT(isoString)` returns the TT label of a UTC instant, and `fromTT(ttString)` reads one back. TT is TAI plus exactly 32.184 seconds.
- `toTCG(isoString)` returns the TCG label of a UTC instant, and `fromTCG(tcgString)` reads one back. TCG runs ahead of TT at a fixed rate that IAU Resolution B1.9 defines, and the two agree at the TT instant `1977-01-01T00:00:32.184`.
- `tcgMinusTt(isoString)` returns the gap TCG − TT in seconds, or `null` when there is no answer. It is the same offset `toTCG` applies.

```typescript
import { fromTCG, tcgMinusTt, toTCG, toTT } from "@northguild/gmt/timescale";

toTT("2026-01-01T00:00:00Z"); // "2026-01-01T00:01:09.184 TT"
toTCG("2026-01-01T00:00:00Z"); // "2026-01-01T00:01:10.261661917 TCG"
fromTCG("2026-01-01T00:01:10.261661917 TCG"); // "2026-01-01T00:00:00Z"
tcgMinusTt("2026-01-01T00:00:00Z"); // 1.077661917
```

The strings follow the form of the TAI labels: a date-time, one space, then the scale name `TT` or `TCG`, with a four-digit year. The names `TDT` and `ET` are not read. The inputs are the ones `toTAI` reads, including the 27 inserted `23:59:60` seconds, and both labels have no second 60. Every function returns `""` (or `null` for `tcgMinusTt`) for an instant before 1972-01-01 UTC, a result past year 9999, or invalid input.

Results are floored to the nanosecond, in both directions, so `fromTCG(toTCG(x))` gives back `x` for every nanosecond. About one TCG nanosecond in 1.4 billion is not the result of any UTC nanosecond, and `fromTCG` reads it as the UTC instant of the next one.

`toTAI` and `fromTAI` are unchanged in behaviour. Their `@returns` lines now say what they return, and `fromTAI` lost a check for second 60 that could never be true, because the parser already refuses it for TAI.
