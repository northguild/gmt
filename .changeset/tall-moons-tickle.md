---
"@northguild/gmt": minor
---

Add the `span/` namespace: exact elapsed and wall-clock durations between two timestamps, as raw numbers (Story CORE-2).

`diffZoned` and `diffUnix` measure in calendar units and hand back a Temporal `Duration`. Profiling, tracing and telemetry want a number:

```typescript
import { spanMs, spanNs, spanWallClock } from "@northguild/gmt";

spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z");
// 1000

spanMs("2024-03-10T12:00:00Z", "2024-03-10T12:00:00.123456789Z");
// 123.456789 — fractional, like performance.now()

spanNs("2024-03-10T12:00:00.123456789Z", "2024-03-10T12:00:00.123456790Z");
// 1n
```

Both are signed, so `spanMs(b, a)` is exactly `-spanMs(a, b)`, and both measure exact elapsed time. That is a different question from calendar distance, and conflating the two is the most common span bug there is — a wall-clock day containing a DST transition is 23 or 25 real hours, or 24.5 in `Australia/Lord_Howe`:

```typescript
const start = "2024-03-09T12:00:00-05:00[America/New_York]";
const end = "2024-03-10T12:00:00-04:00[America/New_York]";

spanMs(start, end);
// 82800000 — 23 hours actually elapsed

spanWallClock(start, end, "hours");
// 24 — the clock face advanced a full day
```

- `spanMs` / `spanNs` accept anything `toNanoseconds` does: the full RFC 9557 instant grammar, an offset or a bracketed IANA zone, no leap seconds, no `[u-ca=...]` calendar annotation. The endpoints need not share a zone.
- `spanWallClock(start, end, "days" | "hours")` reads each endpoint's own local wall clock, so it requires a bracketed IANA zone on both — and the two may differ, which is how a flight from New York to Berlin is 12 wall-clock hours and 7 elapsed ones. It truncates toward zero, and it is not a count of midnights crossed. The wall clock is read directly rather than via an instant, so no disambiguation policy applies: an offset-less local time that never occurred (`"2024-03-10T02:30:00[America/New_York]"`) is measured as written rather than silently advanced past the DST gap.
- **`0` and `0n` are valid spans**, so invalid input returns `NaN` from `spanMs` and `null` from `spanNs` and `spanWallClock` — not the zero the rest of the library would use. This is also why `spanNs` is not `toNanoseconds(b) - toNanoseconds(a)`: those return `0n` for both the epoch and a rejected string.
- **`spanMs` returns `NaN` past `Number.MAX_SAFE_INTEGER` milliseconds** (±285,000 years, which two instants at opposite ends of `Temporal.Instant`'s range exceed). Use `spanNs` there. A span is a duration, not an instant: it reaches twice the epoch-nanosecond range, so it is not a `fromNanoseconds` input.
- **Leap seconds are not counted.** UTC repeats a second rather than numbering a 61st one, so a span across one is a second short of the physical elapsed time; against a smeared clock (Google, AWS, Meta) the error is up to a second spread over the smear window. Leap-second-exact spans need a TAI scale, which is not yet shipped.

Importable from the package root or from `@northguild/gmt/span` and `@northguild/gmt/span/calculate`.
