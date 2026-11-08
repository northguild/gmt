# SPA-46 — Space: TAI64 text labels

**Scope:** The TAI64, TAI64N and TAI64NA labels built on TAI, in their hex text form.

## Gap

Space and GNSS systems store timestamps in TAI (continuous, no leap seconds). Converting TAI to UTC requires the leap-second table.

Beyond the TAI time-scale strings MAR-16 builds, one binary TAI format is in everyday infrastructure use: D. J. Bernstein's **TAI64** labels, which daemontools' multilog and s6-log write at the start of each log line when timestamping is on. "A TAI64 label is an integer between 0 and 2^64 referring to a particular second of real time": label `s` in `[2⁶², 2⁶³)` is "the TAI second beginning exactly s − 2⁶² seconds after the beginning of 1970 TAI"; the external format is "eight 8-bit bytes in big-endian format", so `40 00 00 00 00 00 00 00` is the second that began 1970 TAI and `40 00 00 00 2a 2b 2c 2d` is "1992-06-02 08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC". TAI64N appends four bytes of nanoseconds; TAI64NA four more of attoseconds. The `@4000000…` hex spelling seen in log files is daemontools' rendering of those bytes, not part of the definition. This story reads and writes that text form, the one found in log files. They are TAI, so reading them as Unix seconds is off by the leap-second count.
([D. J. Bernstein, libtai, TAI64, TAI64N, and TAI64NA](https://cr.yp.to/libtai/tai64.html))

## Scope

- `toTAI` / `fromTAI` and the GNSS conversions (`gnssToUtc` / `utcToGnss`, the same for every system) are in MAR-16.
- `packages/gmt/src/timescale/convert/`, one function per file (`toTai64n.ts`, `fromTai64n.ts`). No function takes a table argument: the leap-second table is built in.
  - `toTai64n(isoString: string): string` — The TAI64N label in the daemontools text form: `@` followed by 24 hex digits (8 big-endian bytes of TAI seconds + 2⁶², 4 bytes of nanoseconds).
  - `fromTai64n(label: string): string` — Inverse; accepts TAI64 (16 hex digits), TAI64N (24) and TAI64NA (32, attoseconds truncated to the nanosecond core), with or without the `@`.

## Key constants

- **TAI − UTC = +37 seconds** currently. 27 leap seconds since 1972; the last was 2016-12-31 and none has occurred since.
- TT − TAI = +32.184 seconds, exactly (see SPA-47).
- TAI64: a label's integer value is TAI seconds since 1970-01-01T00:00:00 TAI plus 2⁶² (`0x4000000000000000`).

([BIPM Annual Report on Time Activities vol. 15](https://webtai.bipm.org/ftp/pub/tai/annual-reports/bipm-annual-report/annual_report_2020.pdf))

## Tool

**TAI64N Log Reader** (`/tools/tai64n-log-reader/`), a standalone tool: paste up to 12 daemontools, multilog or s6 log lines and read each line's label as a UTC instant, a TAI reading and the TAI − UTC offset at that instant, with the inserted second marked; a last box writes a label from an instant. Calls `fromTai64n`, `toTai64n`, `toTAI`, `taiMinusUtc` and `isLeapSecond`. Its rules are in `context/dox/built.md`.

## Design notes

- **Every offset is a function of date**, resolved through the leap-second table. Hardcoding 37 produces a library that is correct only until the next leap second.
- **Pre-1972 UTC is not convertible by integer offset.** Before 1972-01-01 UTC used rate-adjusted "rubber seconds" with fractional offsets from TAI. `fromTAI` and `toTAI` return the sentinel before 1972 rather than extrapolating an integer count — see SPA-48.
- **TAI64 counts from 1970 TAI, not from the Unix epoch.** The two differ by the TAI − UTC offset, so a decoder that treats a label as Unix seconds is wrong by 26 s for Bernstein's own 1992 example and by 37 s today. Labels for instants before 1972-01-01 UTC have no integer TAI − UTC and return the sentinel, consistent with `fromTAI`; the JSDoc says so.

## What gmt provides (do not re-implement)

- `floorDivide` and `NANOSECONDS_PER_SECOND` from CORE-3 — split the TAI nanoseconds into seconds and a remainder
- `hexValue` from CORE-56 — read a hex digit
- The leap-second table from SPA-48 — TAI − UTC by date
- `toTAI` / `fromTAI` and the time-scale string grammar from MAR-16 — the TAI hinge the labels are built on

## Verification

- `toTai64n('1992-06-02T08:06:43Z')` returns `@400000002a2b2c2d00000000` — Bernstein's own worked example, `40 00 00 00 2a 2b 2c 2d`, written as hex text with zero nanoseconds. TAI − UTC on 1992-06-02 is 26 s (the 1991-01-01 row), which matches Bernstein's "08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC"
- `fromTai64n(toTai64n(iso))` round-trips to the nanosecond; a TAI64NA label round-trips to the nanosecond and drops attoseconds, documented
- A label of a hex length other than 16, 24 or 32, a label with a non-hex character, or a label for an instant before 1972 returns the sentinel
- `pnpm run validate` stays green

## Decisions

Settled by the owner. They are the current rules for this code.

- The two public functions are `toTai64n` and `fromTai64n`, in `timescale/convert/`. Both take and return strings, take no options and no table argument, and return `""` on any refusal.
- Labels decode as true TAI, as Bernstein's definition states. `fromTai64n` reads every TAI64 label as the TAI second `label − 2⁶²` after 1970 TAI, so it reads a label written on a UTC clock by daemontools 27 s early (daemontools adds only `2⁶² + 10` to the Unix time). s6 on a UTC clock writes true TAI. Both JSDocs state this in one bullet with the 27 s figure. GMT does not read "Unix + 10" labels, and there is no follow-up story.
- The whole label is the input. A log line, or any text around the label, returns `""`.
- `fromTai64n` reads 16 (TAI64), 24 (TAI64N) and 32 (TAI64NA) hex digits, with or without `@`, in either case. `toTai64n` writes `@` and 24 lowercase digits only; there is no TAI64 or TAI64NA writer and no validator. Attoseconds are checked and then truncated, never rounded.
- Both functions go through the existing TAI hinge (`parseUtcReading` → `taiOfUtc`, `utcOfTai` → `formatUtcReading`, `LEAP_SECOND_STEPS`). The label is `2⁶² + floor(tai / 10⁹)` seconds and `tai mod 10⁹` nanoseconds. An inserted second has its own label and reads back as `…T23:59:60Z`.
- An instant before 1972-01-01 UTC has no integer TAI − UTC, so it returns `""`, as `toTAI` and `fromTAI` do. Years are four digits in both directions (`LAST_FOUR_DIGIT_UTC_NANOSECONDS`), and labels of `2⁶³` and above are reserved and return `""`.
- The shared grammar, reader and writer live in `internal/tai64Label.ts` (`TAI64_SECONDS_OFFSET`, `tai64LabelText`, `parseTai64Label`, `formatTai64nLabel`). `LAST_FOUR_DIGIT_UTC_NANOSECONDS` is a four-digit-year rule, not a TAI64 one, so it lives beside `MAX_FOUR_DIGIT_YEAR` in `internal/utcReading.ts`. `coding-standards.md` carries the scoped exception for TAI64 text labels in `timescale/convert`.
- The root bundle budget in `scripts/bundle-size.budgets.json` rose from 568700 to 569400 B (+700 B). The measured size is 569313 B, which leaves 87 B. This is a reviewed raise, with CORE-106 and CORE-104 as precedents.
- The Dox tool is the TAI64N Log Reader at `/tools/tai64n-log-reader/`; its rules are in `context/dox/built.md`.
