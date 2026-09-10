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
- **`0` and `0n` are valid spans**, so invalid input returns `null` from all three rather than the zero the rest of the library would use. `null` and not `NaN`, because it is the sentinel GMT already uses for every number-returning function and the only one `strictNullChecks` forces a caller to handle — a `NaN` types as plain `number` and propagates silently through arithmetic. This is also why `spanNs` is not `toNanoseconds(b) - toNanoseconds(a)`: those return `0n` for both the epoch and a rejected string.
- **`spanMs` returns `null` past `Number.MAX_SAFE_INTEGER` milliseconds** (±285,000 years, which two instants at opposite ends of `Temporal.Instant`'s range exceed). Use `spanNs` there. A span is a duration, not an instant: it reaches twice the epoch-nanosecond range, so it is not a `fromNanoseconds` input.
- **Leap seconds are not counted.** UTC repeats a second rather than numbering a 61st one, so a span across one is a second short of the physical elapsed time; against a smeared clock (Google, AWS, Meta) the error is up to a second spread over the smear window. Leap-second-exact spans need a TAI scale, which is not yet shipped.

### Validators for both namespaces

`precision/` and `span/` were the only namespaces with no `validate/` module, and in `precision/` that was not cosmetic: `0n` is simultaneously the epoch and the invalid-input sentinel, and there was no public predicate to tell them apart. `toNanoseconds`' own JSDoc suggested `isValidUtc`, which gates on GMT's stricter `<date>T<time>Z` shape and returns `false` for the offsets, bracketed zones, space separators and basic-format strings `toNanoseconds` accepts — so following that advice discarded valid input.

```typescript
import {
  isValidInstant,
  isValidNanoseconds,
  isValidNanoPattern,
  isValidSpan,
} from "@northguild/gmt";

isValidInstant("1970-01-01T00:00:00Z"); // true  — toNanoseconds returns 0n, the epoch
isValidInstant("garbage"); // false — toNanoseconds returns 0n, the sentinel
isValidInstant("2024-03-10 12:00:00Z"); // true  — isValidUtc says false

isValidNanoPattern("0"); // true  — parseNanoseconds returns 0n, the epoch
isValidNanoseconds(0n); // true; isValidNanoseconds(0) is false — a number cannot carry one

isValidSpan("2024-03-10T12:00:00Z", "2024-03-10T12:00:01Z"); // true
```

Each predicate accepts exactly what its partner parses, and `parseNanoseconds` now defers to `isValidNanoPattern` so the two cannot drift apart. `isValidSpan` is symmetric — a reversed pair is a negative span, not an invalid one — and is true for a pair whose span exceeds `spanMs`'s range, since that is a limit on the result rather than the inputs; `spanNs` still returns the exact `bigint`.

`regex/` gains `instantLeapSecond` (the wider leap-second grammar the full instant parser needs, alongside the existing `leapSecond`) and `nanosecondDecimal`.

Importable from the package root or from `@northguild/gmt/span`, `@northguild/gmt/span/calculate`, `@northguild/gmt/span/validate` and `@northguild/gmt/precision/validate`.
