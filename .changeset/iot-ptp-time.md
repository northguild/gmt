---
"@northguild/gmt": minor
---

New `iot` area: convert a Precision Time Protocol (PTP) timestamp to UTC and back. The functions are in `@northguild/gmt/iot`, in `@northguild/gmt/iot/convert` and in `@northguild/gmt/iot/validate`.

A PTP timestamp counts seconds and nanoseconds from 1970-01-01T00:00:00 TAI. It shares its epoch value with Unix time but counts a different time scale, so it is ahead of UTC by the offset the grandmaster announces: 37 seconds since 2017. A receiver that skips that step leaves sensor data 37 seconds ahead of every other clock, and nothing raises an error.

- `ptpToUtc(timestamp, currentUtcOffset)` returns the UTC instant as a string ending in `Z`, or `""`.
- `utcToPtp(value, currentUtcOffset)` is the inverse. It returns a `PtpTimestamp`, or `null`.
- `isValidPtpTimestamp(value)` is `true` for a record whose members are in range, and narrows the type. The three functions share one reader, so they cannot disagree.
- `PtpTimestamp` is `{ seconds: bigint; nanoseconds: number }`. `ptpToUtc` and `isValidPtpTimestamp` also accept `seconds` as a safe-integer `number`. `utcToPtp` always returns a `bigint`.

```typescript
import { ptpToUtc, utcToPtp } from "@northguild/gmt/iot";

ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 37); // "2024-01-01T00:00:00Z"
ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 0); // "2024-01-01T00:00:37Z"
utcToPtp("2024-01-01T02:00:00+02:00", 37); // { seconds: 1704067237n, nanoseconds: 0 }
ptpToUtc({ seconds: 0n, nanoseconds: 0 }, 37); // ""
```

- **The offset is required.** There is no default. `currentUtcOffset` is the TAI minus UTC value your grandmaster announces, an integer from -32768 to 32767. A fixed 37 would hide a grandmaster that announces something else. It means something only when the grandmaster marks it valid and is on the PTP time scale, so check `currentUtcOffsetValid` and `ptpTimescale` before you call.
- **The functions use the offset you give them.** They do not read the leap-second table. To check a grandmaster, compare its offset with `taiMinusUtc` for the same date.
- **Seconds run from 0 to 2^48 - 1.** The 80-bit PTP timestamp has 32 bits of nanoseconds, which leaves 48 bits of seconds. Nanoseconds run from 0 to 999999999.
- **Nothing before 1970 is accepted.** `ptpToUtc` returns `""` when the result would fall before 1970-01-01T00:00:00Z, which in practice means a clock that has not been set. `utcToPtp` returns `null` for an instant before that date, so the two stay inverse.
- **A leap second is not written.** A UTC second of `60` returns `null`. During an insertion the grandmaster announces the new offset, and you pass it.
- **A result past year 9999** is written in the expanded form, such as `+010000-01-01T00:00:00Z`, up to Temporal's limit.
- **A value that cannot be read returns the empty result.** `ptpToUtc` returns `""`, `utcToPtp` returns `null` and `isValidPtpTimestamp` returns `false`. This includes a missing member, a `number` `seconds` that is not a safe integer and an offset that is not an integer.
