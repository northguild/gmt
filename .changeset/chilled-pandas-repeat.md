---
"@northguild/gmt": minor
---

Add foreign epoch bridges to `precision/convert/`: NTP, Windows `FILETIME`, .NET ticks, Excel day serials, and PostgreSQL's internal microseconds (Story CORE-3).

Nothing else counts from 1970. NTP counts from 1900 and rolls over in 2036; `FILETIME` counts 100-nanosecond intervals from 1601; .NET ticks count the same interval from year 1; Excel uses a day serial carrying a deliberate 1900 leap-year bug; PostgreSQL stores microseconds from 2000-01-01. None of it was in gmt, so every integration hardcoded the constants — usually wrongly.

```typescript
import {
  toNtpTimestamp,
  fromNtpTimestamp,
  toFileTime,
  fromFileTime,
  toDotNetTicks,
  fromDotNetTicks,
  toExcelSerial,
  fromExcelSerial,
  toPgMicroseconds,
  fromPgMicroseconds,
} from "@northguild/gmt";

toFileTime("1970-01-01T00:00:00Z");
// 116444736000000000n — 100 ns intervals since 1601-01-01

toDotNetTicks("1970-01-01T00:00:00Z");
// 621355968000000000n — same unit, counted from 0001-01-01

toPgMicroseconds("2024-03-10T12:00:00Z");
// 763387200000000n — microseconds since 2000-01-01

toExcelSerial("2024-03-10T12:00:00Z");
// 45361.5 — days, with the time of day as the fraction
```

- **NTP timestamps are era-ambiguous by design.** The seconds field is unsigned 32-bit, so it wraps every ~136.19 years and the value carries no era. `toNtpTimestamp("2036-02-07T06:28:15Z")` is `18446744069414584320n`, the last second of era 0, and the next second is `0n` again — the wire format's own ambiguity, not a gmt limitation, so instants outside era 0 wrap rather than being rejected. `fromNtpTimestamp` takes the era as an explicit second argument, defaulting to 0.
- **Excel's serial 60 is the phantom 29 February 1900** — a date that never existed, since 1900 was not a leap year. Lotus 1-2-3 got it wrong and Excel keeps the bug for compatibility, so `fromExcelSerial(60)` is `""`: 59 is 1900-02-28 and 61 is 1900-03-01, and mapping 60 onto either neighbour would put gmt one day out from Excel for every earlier date. `{ system: "1904" }` selects the legacy Mac system, whose serials are exactly 1462 lower and which has no phantom day.
- **Each bridge accepts only what its target format can hold**, and returns the namespace's sentinel otherwise rather than an out-of-range number: `toFileTime` on a pre-1601 instant is `0n`, not a negative tick count, and `toExcelSerial` past 9999-12-31 is `null`. The ranges are the formats' own — unsigned 64-bit for `FILETIME`, `DateTime.MinValue`/`MaxValue` for .NET ticks, serials 1–2958465 (or 0–2957003 in the 1904 system) for Excel, and PostgreSQL's `MIN_TIMESTAMP` (4713 BC) for `timestamptz`, which is 40× later than the earliest instant Temporal can represent.
- **Round trips are exact to the target format's unit.** Where that unit is coarser than a nanosecond, the conversion floors toward negative infinity so the grid stays uniform either side of the epoch: 100 ns for `FILETIME` and .NET ticks, 1 µs for PostgreSQL, 1 ms for Excel. NTP is the exception in the other direction — its 2^-32 s unit is finer than a nanosecond, so `fromNtpTimestamp` rounds to the nearest nanosecond, which is what makes the round trip exact rather than one nanosecond early.
- Every bridge returns a sentinel (`""`, `0n`, `null`) on invalid input and never throws. For the `bigint`-returning ones `0n` is also their own epoch — 1900-01-01 for NTP, 1601-01-01 for `FILETIME`, 0001-01-01 for .NET ticks, 2000-01-01 for PostgreSQL — so validate the input first when the two must be told apart.
- These are plain instant conversions; no leap seconds are involved in any of them.

`toNanoseconds` now delegates to a shared internal instant parser, so all six functions in the namespace that take an instant string apply one leap-second and calendar-annotation gate. Its behaviour is unchanged.
