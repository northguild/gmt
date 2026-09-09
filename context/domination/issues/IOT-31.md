# IOT-31 — IoT: PTP and TAI-based device time

**Scope:** IEEE 1588 Precision Time Protocol timestamps, which count TAI rather than UTC.

## Gap

PTP shares the Unix epoch with `Date` and with every other timestamp on the device — and counts a different timescale. **PTP is TAI-based, not UTC-based.** The protocol carries a `currentUtcOffset` field (37 seconds at present) that must be applied to obtain UTC, and failing to apply it produces a silent 37-second error.

This is not a theoretical concern. It is a documented, recurring production failure across lidar, industrial control and broadcast deployments: sensor data timestamped 37 seconds away from every other clock in the system, with no error raised anywhere.

([DMC](https://www.dmcinfo.com/latest-thinking/blog/id/12639/time-sync-leap-seconds-utc-offsets-on-pxi-and-crio-using-ptp), [Ouster community](https://community.ouster.com/t/ptp-synchronisation-utc-tai-time-difference/285))

## Scope

- `packages/gmt/src/iot/convert/ptpToUtc.ts`:
  - `ptpToUtc(ptpSeconds: bigint, ptpNanoseconds: number, options: { currentUtcOffset: number, leapSecondKnown?: boolean }): string` — PTP timestamp to a UTC ISO string. `currentUtcOffset` is **required**.
  - `utcToPtp(isoString: string, options: { currentUtcOffset: number }): { seconds: bigint, nanoseconds: number } | null`
- `packages/gmt/src/iot/get/ptpOffsetAt.ts`:
  - `ptpOffsetAt(isoString: string): number` — The correct TAI−UTC offset for a date, from the shared leap-second table. For callers whose grandmaster does not advertise a trustworthy `currentUtcOffset`.
- `packages/gmt/src/iot/compare/ptpOffsetPlausible.ts`:
  - `ptpOffsetPlausible(currentUtcOffset: number, at: string): boolean` — Whether an advertised offset matches the known table for that date. Grandmasters ship with wrong or default offsets, and this catches it.

## Key constants

- PTP epoch: 1970-01-01T00:00:00 **TAI** — the same epoch value as Unix, a different timescale
- TAI − UTC = **37 seconds** currently (27 leap seconds since 1972; the last was 2016-12-31)
- The `currentUtcOffset` field default is 37; a grandmaster advertising a stale value is a common failure

## Design notes

- **`currentUtcOffset` is a required parameter with no default.** Defaulting it to 37 would make the function silently wrong after the next leap second and silently wrong for any system whose grandmaster is misconfigured — reproducing the exact bug the function exists to catch. Requiring it forces the caller to source it.
- **`ptpOffsetPlausible` is the practical safeguard.** Reading the advertised offset is not the same as trusting it, and a mismatch against the leap-second table for the timestamp's own date is strong evidence of misconfiguration.
- gPTP (IEEE 802.1AS) shares this timescale and this trap.
- The leap-second table is shared with the Space realm (SPA-48), not duplicated here.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` from CORE-1 — precision conversion
- The leap-second table from SPA-48 — TAI−UTC by date
- `toTAI` / `fromTAI` from SPA-46 — the general scale conversion this specialises

## Verification

- `ptpToUtc` with `currentUtcOffset: 37` returns a UTC instant 37 seconds behind the raw PTP value
- Omitting `currentUtcOffset` is a type error, asserted at compile time and with a runtime sentinel
- Round-trip: `utcToPtp(ptpToUtc(...))` recovers the original seconds and nanoseconds
- `ptpOffsetAt` returns 36 for a date between the 2015 and 2016 leap seconds, and 37 after
- `ptpOffsetPlausible(37, '2010-01-01T00:00:00Z')` returns `false`
- Nanosecond field outside 0–999999999 returns the sentinel
- `pnpm run validate` stays green
