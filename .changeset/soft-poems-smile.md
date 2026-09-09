---
"@northguild/gmt": minor
---

Add the `precision/` namespace: nanosecond instants as `bigint`, their JSON bridge, and explicit storage truncation (Story CORE-1).

`convertZonedToUnix` and the rest of `unix/` return `number` milliseconds, which cannot carry nanosecond timestamps — a `number` holds integers exactly only to `2^53 − 1` ≈ 9.0 × 10^15, and nanoseconds since the epoch passed that in April 1970. The new namespace works in `bigint` throughout:

```typescript
import {
  toNanoseconds,
  fromNanoseconds,
  formatNanoseconds,
  parseNanoseconds,
  truncateNanoseconds,
} from "@northguild/gmt";

toNanoseconds("2024-03-10T12:00:00.123456789Z");
// 1710072000123456789n

fromNanoseconds(1710072000123456789n, "America/New_York");
// "2024-03-10T08:00:00.123456789-04:00[America/New_York]"

JSON.stringify({ observedAt: formatNanoseconds(1710072000123456789n) });
// '{"observedAt":"1710072000123456789"}' — JSON.stringify throws on a raw bigint

parseNanoseconds("1710072000123456789");
// 1710072000123456789n

truncateNanoseconds(1710072000123456789n, "us");
// 1710072000123456000n — what a PostgreSQL timestamptz column can actually hold
```

- `toNanoseconds` accepts any ISO 8601 instant string (offset or bracketed IANA zone), and rejects leap seconds and `[u-ca=...]` calendar annotations like `utc/` and `unix/` do.
- `fromNanoseconds` returns a UTC instant string, or a zoned string when given a time zone. Instant-to-local needs no disambiguation policy. Truncate first when writing to a store that holds less than nanoseconds, or the round-trip silently loses digits.
- `truncateNanoseconds` floors toward negative infinity, so pre-1970 values truncate the same way post-1970 ones do: `truncateNanoseconds(-1500n, "us")` is `-2000n`, not `-1000n`.
- Every function returns a sentinel (`""`, `0n`) on invalid input and never throws, and accepts only values inside the range `Temporal.Instant` can represent (±8_640_000_000_000_000_000_000n). `0n` is also the epoch itself, so validate first when the two must be told apart.
- `formatNanoseconds` / `parseNanoseconds` are the JSON bridge: a `bigint` cannot go into a payload as-is, so the value crosses as a canonical decimal string. Embed it as a JSON *string* — unquoted it is a JSON number, and `JSON.parse` rounds it back through a double to `1710072000123456800`. `parseNanoseconds` takes that string value (`JSON.parse(payload).observedAt`), not JSON text.
- Leap-second-aware time scales (TAI, GPS) are deliberately out of scope — these are plain instant conversions.

Importable from the package root or from `@northguild/gmt/precision`, `@northguild/gmt/precision/convert`, `/precision/format`, `/precision/parse`, and `/precision/calculate`.
