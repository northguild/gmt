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

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — every bridge routes through epoch
  nanoseconds. The `from*` direction calls `fromNanoseconds` directly; the `to*` direction
  shares `toNanoseconds`' parser (`internal/instantEpochNanoseconds`) rather than
  `toNanoseconds` itself, whose `0n` sentinel cannot be told apart from the Unix epoch.
- `truncateNanoseconds` from CORE-1 — for the microsecond target. The 100 ns targets need a
  unit it does not accept, so they floor with `internal/floorDivide` instead.

## Verification

- Round-trip for every pair: `fromX(toX(iso))` returns an equivalent ISO string
- `toFileTime('1970-01-01T00:00:00Z')` returns `116444736000000000n`
- `fromNtpTimestamp` with era 0 at the maximum value yields 2036-02-07
- `fromExcelSerial(60)` is documented and asserted against Excel's phantom 1900-02-29
- 1904-system option shifts results by exactly 1462 days
- Invalid input returns sentinels
- `pnpm run validate` stays green

## Outcome (delivered)

Shipped as ten functions in `packages/gmt/src/precision/convert/` — `toNtpTimestamp` /
`fromNtpTimestamp`, `toFileTime` / `fromFileTime`, `toDotNetTicks` / `fromDotNetTicks`,
`toExcelSerial` / `fromExcelSerial`, `toPgMicroseconds` / `fromPgMicroseconds` — plus three
internal modules and the README, skill and dox updates. Decisions taken while building it:

- **The spec's names were kept as written.** They already satisfy CORE-1's binding rule —
  each names the operation and the namespace verb (`convert`), not a downstream use case.
- **One internal module owns every constant: `internal/foreignEpochs.ts`.** The story's own
  gap statement is that these magic numbers get re-derived wrongly, so they are declared
  once and `foreignEpochs.test.ts` asserts each against a `Temporal.PlainDate.until` day
  count — a different route to the answer than the epoch-offset arithmetic that consumes
  them, so a transcription error cannot cancel itself out.
- **`toNanoseconds` was refactored onto a shared `internal/instantEpochNanoseconds`**, which
  returns `bigint | null`. The bridges could not chain through the public `toNanoseconds`:
  its `0n` sentinel is indistinguishable from the Unix epoch, so `toFileTime("garbage")`
  would have returned the FILETIME for 1970 instead of the sentinel. `toNanoseconds` is now
  `instantEpochNanoseconds(isoString) ?? 0n`, its behaviour unchanged, and all six
  namespace functions that take an instant string share the one leap-second and
  calendar-annotation gate.
- **NTP wraps; the other four reject.** These are different truths, not an inconsistency.
  NTP's 64-bit format represents every instant, just modulo the era, so `toNtpTimestamp`
  produces the true wire value for any input and lets it roll — the ambiguity the story's
  own `era` parameter already acknowledges. FILETIME, .NET ticks and Excel have hard bounds
  with no wrapping convention, so an instant outside them is invalid input and returns the
  sentinel, per the epic's "no invented quantities" rule. A negative FILETIME or an Excel
  serial of 2958466 would be a lie about the format.
- **`fromNtpTimestamp` rounds to the nearest nanosecond; every other `from*` is exact.** NTP
  is the only format here whose unit (2^-32 s, ~233 ps) is *finer* than a nanosecond.
  Flooring in both directions loses one unit — `fromNtpTimestamp(toNtpTimestamp(x))` came
  back one nanosecond early — because for a non-integral `n·r`, `floor(floor(n·r)/r)` is
  `n − 1`. Rounding on the way back is what makes the round trip exact. The one wart, now
  documented and tested: the top two values of an era (`2^64 − 1`, `2^64 − 2`) round onto the
  next era's first instant, since the last 0.47 ns of an era has no nanosecond of its own.
  `toNtpTimestamp` cannot produce either from a nanosecond-precision instant, so the round
  trip is unaffected.
- **Excel serials round to the millisecond.** A serial is a `double`, whose resolution is
  ~0.6 µs near 2024 and ~40 µs near 9999 — coarser than a nanosecond everywhere in Excel's
  range, so the nanosecond digits have nowhere to go. `fromExcelSerial` snaps to the
  millisecond grid *before* making its range and phantom-day comparisons, so the value it
  checks is the value it builds; 20 000 random serials round-trip exactly.
- **`toExcelSerial` splits the day count from the intra-day remainder** rather than doing one
  `Number(...) / 86400e9`. It keeps the whole-day part exact, which is what Excel actually
  stores, and measurably lowers the error on the fraction.
- **`toExcelSerial` range-checks the rounded serial, not the exact instant.** Checking the
  `double` guarantees a returned number is always a serial Excel accepts. The cost, stated in
  the JSDoc and pinned by a test, is that the last ~20 µs of 9999-12-31 returns `null`: a
  `double` near serial 2958465 resolves to only ~40 µs, so those instants round to exactly
  2958466. Gating on the exact instant instead would hand back that 2958466 — a serial Excel
  rejects on the way in — so the sentinel is the more honest of the two.
- **`ExcelDateSystem` is `"1900" | "1904"`, a string-literal union**, matching every other
  GMT option union (`"constrain" | "reject"`, `"ms" | "us"`) and rendering as a dropdown in
  the dox playground rather than a free number field. The option follows the library's
  options-object convention: `options?.system ?? "1900"`, so an explicit `null`/`undefined`
  defaults rather than failing — unlike CORE-1's rest-tuple positional optionals, which
  reject an explicit `undefined`. `fromNtpTimestamp`'s `era` is positional, so it uses the
  rest-tuple convention instead.
- **The PostgreSQL bridges gate on `MIN_TIMESTAMP`, not on int64.** The first cut had no
  target-range check at all, on the reasoning that int64 microseconds are wider than
  `Temporal.Instant` — true, but PostgreSQL's *timestamp* domain is narrower than its int64
  storage: it starts at `-004713-11-24T00:00:00Z` (Julian Day 0, the manual's "4713 BC" in
  the Julian calendar), 40× later than Temporal's minimum, so `toPgMicroseconds` was handing
  back values PostgreSQL rejects on insert while the docs claimed every bridge accepts only
  what its target can hold. Both directions now gate on `MIN_PG_MICROSECONDS`. The upper end
  needs no constant: PostgreSQL's `END_TIMESTAMP` (294276 AD) is past what `Temporal` can
  represent, so the instant range binds there first.
- **New internal helpers:** `internal/floorDivide.ts` (BigInt `/` truncates toward zero,
  which would collide the last tick before an epoch with the first tick after it) and
  `internal/instantEpochNanoseconds.ts`, both with sibling tests.
