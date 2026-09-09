# CORE-3 — Core: Foreign epoch bridges

**Scope:** Convert between ISO 8601 and the epoch formats GMT's consumers actually receive from other systems.

## Gap

Every integration re-derives the same handful of magic numbers, usually wrongly. NTP counts from 1900 and rolls over in 2036; Windows `FILETIME` counts 100-nanosecond intervals from 1601; .NET ticks count the same interval from year 1; Excel uses a day serial with a deliberate 1900 leap-year bug; PostgreSQL stores microseconds internally from 2000-01-01. None of these are in GMT, so every consumer hardcodes constants.

## Scope

- `packages/gmt/src/precision/convert/`, one file per direction:
  - `toNtpTimestamp(isoString: string): bigint` / `fromNtpTimestamp(value: bigint, era?: number): string` — 64-bit NTP timestamp: 32-bit seconds since 1900-01-01, 32-bit fraction. `era` selects the 136-year era; era 0 ends 2036-02-07.
  - `toFileTime(isoString: string): bigint` / `fromFileTime(value: bigint): string` — 100 ns intervals since 1601-01-01 UTC.
  - `toDotNetTicks(isoString: string): bigint` / `fromDotNetTicks(value: bigint): string` — 100 ns intervals since 0001-01-01.
  - `toExcelSerial(isoString: string): number` / `fromExcelSerial(value: number): string` — Day serial. Honours the 1900 system's phantom 29 February 1900 and supports the 1904 system via an option.
  - `toPgMicroseconds(isoString: string): bigint` / `fromPgMicroseconds(value: bigint): string` — Microseconds since 2000-01-01, PostgreSQL's internal representation.
- All return sentinels on invalid input.

## Key constants

| Format | Epoch | Unit | Notes |
| --- | --- | --- | --- |
| NTP | 1900-01-01 | 2^-32 s | Unsigned 32-bit seconds; era 0 rolls over 2036-02-07 |
| FILETIME | 1601-01-01 | 100 ns | Unix delta is 11 644 473 600 s = 116 444 736 000 000 000 ticks |
| .NET ticks | 0001-01-01 | 100 ns | Same unit as FILETIME, different epoch |
| Excel (1900) | 1899-12-30 | 1 day | Serial 60 is the non-existent 1900-02-29 |
| Excel (1904) | 1904-01-01 | 1 day | Legacy Mac option |
| PostgreSQL | 2000-01-01 | 1 µs | Internal storage; the wire protocol converts to Unix epoch |

Sources: [FILETIME epoch](https://devblogs.microsoft.com/oldnewthing/20090306-00/?p=18913), [NTP eras](https://www.eecis.udel.edu/~mills/y2k.html), [.NET ticks](https://www.epochconverter.com/dotnet).

## Design notes

- NTP's seconds field is unsigned 32-bit, so it wraps every ~136.19 years into a new era. `fromNtpTimestamp` cannot disambiguate era from the value alone — hence the explicit `era` parameter, defaulting to 0. This is the same class of ambiguity as the aviation `DDHHMM` problem (AV-28).
- Excel's 1900 leap-year bug is deliberate Lotus 1-2-3 compatibility, not a rounding artefact. Serials at or below 60 need special handling, and silently "fixing" it makes GMT disagree with Excel.
- These are instant conversions. None of them involve leap seconds.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — every bridge routes through nanoseconds
- `truncateNanoseconds` from CORE-1 — for the microsecond and 100 ns targets

## Verification

- Round-trip for every pair: `fromX(toX(iso))` returns an equivalent ISO string
- `toFileTime('1970-01-01T00:00:00Z')` returns `116444736000000000n`
- `fromNtpTimestamp` with era 0 at the maximum value yields 2036-02-07
- `fromExcelSerial(60)` is documented and asserted against Excel's phantom 1900-02-29
- 1904-system option shifts results by exactly 1462 days
- Invalid input returns sentinels
- `pnpm run validate` stays green
