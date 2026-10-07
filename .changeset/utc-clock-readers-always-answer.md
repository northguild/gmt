---
"@northguild/gmt": minor
---

The 19 UTC and Unix clock readers that take no argument now always return a value. Their documentation no longer lists `""` as a result on failure, and they no longer contain a try/catch.

Reading the UTC clock cannot fail on a conformant clock, so the documented `""` was a result no caller could receive. ECMA-262 defines `Date.now()` as a whole number of milliseconds within the range of a time value (±8.64e15 ms). TC39 Temporal builds `Temporal.Now.instant()` from that reading and keeps it inside the `Instant` range. None of these functions reads the time zone of the machine: `getUtcNow` formats the instant as it is, and the others convert it with an explicit `"UTC"`, which is always a valid time zone.

The functions are:

- **`utc`:** `getUtcNow`, `getUtcYear`, `getUtcMonth`, `getUtcDay`, `getUtcHour`, `getUtcMinute`, `getUtcSecond`, `getUtcMillisecond`, `getUtcMicrosecond` and `getUtcNanosecond`.
- **`unix`:** `getUnixYear`, `getUnixMonth`, `getUnixDay`, `getUnixHour`, `getUnixMinute`, `getUnixSecond`, `getUnixMillisecond`, `getUnixMicrosecond` and `getUnixNanosecond`.

```typescript
import { getUtcNow } from "@northguild/gmt";

const now = getUtcNow(); // "2024-02-29T00:00:00Z"

// Earlier releases documented "" on failure, so callers wrote a check like this one.
// It can never be true. Delete it.
if (!now) throw new Error("clock unavailable");
```

### What this means for callers

- **The declared return type is still `string`.** No call site stops compiling.
- **A check such as `if (!getUtcNow())` is now dead code.** You can delete it.
- **On a conformant clock the output is unchanged.** You can see a difference only if you replace `Date.now` with a function that returns a non-integer, or mock `Temporal.Now.instant` to throw in a test. These functions then throw, where they returned `""` before.

You do not need to change any code.

Unchanged: the readers that take an argument (`getUtcNowUnit`, `getUnixNowUnit`, `getUnixNow` and the `getZoned*` readers) and the readers of the system time zone (`getNow`, `getToday` and the other `plain` readers, and `getSystemTimeZone`) keep their empty result (`""` or `null`).
