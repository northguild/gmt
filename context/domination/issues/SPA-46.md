# SPA-46 — Space: TAI64 labels

**Scope:** The TAI64, TAI64N and TAI64NA label formats built on TAI.

## Gap

Space and GNSS systems store timestamps in TAI (continuous, no leap seconds). Converting TAI to UTC requires the leap-second table.

Beyond the TAI time-scale strings MAR-16 builds, one binary TAI format is in everyday infrastructure use: D. J. Bernstein's **TAI64** labels, which timestamp every line of qmail, daemontools and s6 logs. "A TAI64 label is an integer between 0 and 2^64 referring to a particular second of real time": label `s` in `[2⁶², 2⁶³)` is "the TAI second beginning exactly s − 2⁶² seconds after the beginning of 1970 TAI"; the external format is "eight 8-bit bytes in big-endian format", so `40 00 00 00 00 00 00 00` is the second that began 1970 TAI and `40 00 00 00 2a 2b 2c 2d` is "1992-06-02 08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC". TAI64N appends four bytes of nanoseconds; TAI64NA four more of attoseconds. The `@4000000…` hex spelling seen in log files is daemontools' rendering of those bytes, not part of the definition. They are TAI, so reading them as Unix seconds is off by the leap-second count.
([D. J. Bernstein, libtai, TAI64, TAI64N, and TAI64NA](https://cr.yp.to/libtai/tai64.html))

## Scope

- `toTAI` / `fromTAI` and the GNSS conversions (`gnssToUtc` / `utcToGnss`, the same for every system) are in MAR-16.
- `packages/gmt/src/timescale/convert/`, one function per file (`toTai64n.ts`, `fromTai64n.ts`, `toTai64Bytes.ts`, `fromTai64Bytes.ts`). No function takes a table argument: the leap-second table is built in.
  - `toTai64n(isoString: string): string` — The TAI64N label in the daemontools text form: `@` followed by 24 hex digits (8 big-endian bytes of TAI seconds + 2⁶², 4 bytes of nanoseconds).
  - `fromTai64n(label: string): string` — Inverse; accepts TAI64 (16 hex digits), TAI64N (24) and TAI64NA (32, attoseconds truncated to the nanosecond core), with or without the `@`.
  - `toTai64Bytes(isoString: string): Uint8Array` / `fromTai64Bytes(bytes: Uint8Array): string` — The binary external format itself, 8, 12 or 16 bytes.

## Key constants

- **TAI − UTC = +37 seconds** currently. 27 leap seconds since 1972; the last was 2016-12-31 and none has occurred since.
- TT − TAI = +32.184 seconds, exactly (see SPA-47).
- TAI64: a label's integer value is TAI seconds since 1970-01-01T00:00:00 TAI plus 2⁶² (`0x4000000000000000`).

([BIPM Annual Report on Time Activities vol. 15](https://webtai.bipm.org/ftp/pub/tai/annual-reports/bipm-annual-report/annual_report_2020.pdf))

## Tool

**Extends Satellite Clock Converter** with TAI64N labels: give a label to see its instant, or give an instant to see its label, beside the other clocks. Calls `toTai64n`, `fromTai64n`.

## Design notes

- **Every offset is a function of date**, resolved through the leap-second table. Hardcoding 37 produces a library that is correct only until the next leap second.
- **Pre-1972 UTC is not convertible by integer offset.** Before 1972-01-01 UTC used rate-adjusted "rubber seconds" with fractional offsets from TAI. `fromTAI` and `toTAI` return the sentinel before 1972 rather than extrapolating an integer count — see SPA-48.
- **TAI64 counts from 1970 TAI, not from the Unix epoch.** The two differ by the TAI − UTC offset, so a decoder that treats a label as Unix seconds is wrong by 26 s for Bernstein's own 1992 example and by 37 s today. Labels for instants before 1972-01-01 UTC have no integer TAI − UTC and return the sentinel, consistent with `fromTAI`; the JSDoc says so.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- The leap-second table from SPA-48 — TAI − UTC by date
- `toTAI` / `fromTAI` and the time-scale string grammar from MAR-16 — the TAI hinge the labels are built on

## Verification

- `toTai64Bytes('1992-06-02T08:06:43Z')` returns `40 00 00 00 2a 2b 2c 2d` — Bernstein's own worked example — and `toTai64n` of the same instant is `@400000002a2b2c2d00000000`. TAI − UTC on 1992-06-02 is 26 s (the 1991-01-01 row), which matches Bernstein's "08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC"
- `fromTai64n(toTai64n(iso))` round-trips to the nanosecond; a TAI64NA label round-trips to the nanosecond and drops attoseconds, documented
- A label of odd hex length, a byte array of a length other than 8, 12 or 16, or a label for an instant before 1972 returns the sentinel
- `pnpm run validate` stays green
