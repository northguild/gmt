# SPA-46 — Space: TAI and GPS scale conversion

**Scope:** TAI and GPS time scales, the two simplest offsets from UTC, plus the TAI64 label format built on TAI.

## Gap

Space and GNSS systems store timestamps in TAI (continuous, no leap seconds) and GPS (no leap seconds, offset from TAI by a constant). Converting either to UTC requires the leap-second table, and the offsets are frequently written down with the wrong sign.

Beyond the scale strings, one binary TAI format is in everyday infrastructure use: D. J. Bernstein's **TAI64** labels, which timestamp every line of qmail, daemontools and s6 logs. "A TAI64 label is an integer between 0 and 2^64 referring to a particular second of real time": label `s` in `[2⁶², 2⁶³)` is "the TAI second beginning exactly s − 2⁶² seconds after the beginning of 1970 TAI"; the external format is "eight 8-bit bytes in big-endian format", so `40 00 00 00 00 00 00 00` is the second that began 1970 TAI and `40 00 00 00 2a 2b 2c 2d` is "1992-06-02 08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC". TAI64N appends four bytes of nanoseconds; TAI64NA four more of attoseconds. The `@4000000…` hex spelling seen in log files is daemontools' rendering of those bytes, not part of the definition. They are TAI, so reading them as Unix seconds is off by the leap-second count.
([D. J. Bernstein, libtai, TAI64, TAI64N, and TAI64NA](https://cr.yp.to/libtai/tai64.html))

## Scope

- `packages/gmt/src/space/convert/tai.ts`:
  - `toTAI(isoString: string): string` — ISO UTC to a TAI scale string.
  - `fromTAI(taiString: string): string` — TAI to ISO UTC.
- `packages/gmt/src/space/convert/gps.ts`:
  - `toGPS(isoString: string): string` — ISO UTC to a GPS scale string.
  - `fromGPS(gpsString: string): string` — GPS to ISO UTC.
- `packages/gmt/src/space/convert/tai64.ts`:
  - `toTai64n(isoString: string): string` — The TAI64N label in the daemontools text form: `@` followed by 24 hex digits (8 big-endian bytes of TAI seconds + 2⁶², 4 bytes of nanoseconds).
  - `fromTai64n(label: string): string` — Inverse; accepts TAI64 (16 hex digits), TAI64N (24) and TAI64NA (32, attoseconds truncated to the nanosecond core), with or without the `@`.
  - `toTai64Bytes(isoString: string): Uint8Array` / `fromTai64Bytes(bytes: Uint8Array): string` — The binary external format itself, 8, 12 or 16 bytes.

## Key constants

- **TAI − UTC = +37 seconds** currently. 27 leap seconds since 1972; the last was 2016-12-31 and none has occurred since.
- **TAI − GPS = +19 seconds**, exactly and permanently, by definition.
- **GPS − UTC = +18 seconds** currently — GPS runs **ahead** of UTC. The value was **0** at the GPS epoch (1980-01-06) and grows with each leap second.
- TT − TAI = +32.184 seconds, exactly (see SPA-47).
- TAI64: a label's integer value is TAI seconds since 1970-01-01T00:00:00 TAI plus 2⁶² (`0x4000000000000000`).

([BIPM](https://www.bipm.org/documents/20126/52354616/CCTF_UTC_presentation.pdf/0a8f0954-7c00-9142-8da2-f4221c7e0269), [TimeTools](https://timetoolsltd.com/gps/what-is-gps-time/))

## String format

SPICE-style scale designators:

```text
'2026-01-01T00:00:37 TAI'
'2026-01-01T00:00:18 GPS'
```

## Design notes

- **Every offset is a function of date**, resolved through the leap-second table. Only TAI − GPS is a genuine constant. Hardcoding 37 or 18 produces a library that is correct only until the next leap second.
- **Pre-1972 UTC is not convertible by integer offset.** Before 1972-01-01 UTC used rate-adjusted "rubber seconds" with fractional offsets from TAI. `fromTAI` and `toTAI` return the sentinel before 1972 rather than extrapolating an integer count — see SPA-48.
- Before the GPS epoch, GPS time is undefined and returns the sentinel.
- **TAI64 counts from 1970 TAI, not from the Unix epoch.** The two differ by the TAI − UTC offset, so a decoder that treats a label as Unix seconds is wrong by 26 s for Bernstein's own 1992 example and by 37 s today. Labels for instants before 1972-01-01 UTC have no integer TAI − UTC and return the sentinel, consistent with `fromTAI`; the JSDoc says so.

## Corrections

The original SPA-1 stated **`GPS − UTC = -18 seconds`** and gave the example `toGPS('2026-01-01T00:00:18Z')` → `'2026-01-01T00:00:00 GPS'`. Both encode the sign backwards: GPS is *ahead* of UTC, so the correct example is `toGPS('2026-01-01T00:00:00Z')` → `'2026-01-01T00:00:18 GPS'`. The same error appeared in the original MAR-1 (see MAR-16), where it was compounded by asserting an 18-second offset at the GPS epoch, when the offset was zero.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- The leap-second table from SPA-48 — TAI − UTC by date

## Verification

- `toTAI('2026-01-01T00:00:00Z')` returns `'2026-01-01T00:00:37 TAI'`
- `toGPS('2026-01-01T00:00:00Z')` returns a GPS time **18 seconds ahead**
- Round-trip for both scales returns an equivalent UTC string
- A date between the 2012 and 2015 leap seconds uses a 35-second TAI offset, not 37
- The difference between `toTAI` and `toGPS` for any date is exactly 19 seconds
- A date before 1972-01-01 returns the sentinel from `fromTAI`
- A date before 1980-01-06 returns the sentinel from `toGPS`
- `toTai64Bytes('1992-06-02T08:06:43Z')` returns `40 00 00 00 2a 2b 2c 2d` — Bernstein's own worked example — and `toTai64n` of the same instant is `@400000002a2b2c2d00000000`
- `fromTai64n(toTai64n(iso))` round-trips to the nanosecond; a TAI64NA label round-trips to the nanosecond and drops attoseconds, documented
- A label of odd hex length, a byte array of a length other than 8, 12 or 16, or a label for an instant before 1972 returns the sentinel
- `pnpm run validate` stays green
