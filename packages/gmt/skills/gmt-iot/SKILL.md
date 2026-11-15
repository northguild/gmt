---
name: gmt-iot
description: >
  Precision Time Protocol (PTP) timestamps in @northguild/gmt/iot — the
  timestamp counts TAI, not UTC, and the receiver subtracts the
  currentUtcOffset its grandmaster announces: ptpToUtc, utcToPtp,
  isValidPtpTimestamp and the PtpTimestamp type { seconds, nanoseconds }.
  Skipping the offset leaves sensor data 37 seconds ahead of every other clock
  with no error. The offset is required and has no default. Reads the docs
  site (llms.txt) and the installed package's JSDoc; a routing pointer, not an
  API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/iot-ptp-time.mdx'
  - 'northguild/gmt:packages/gmt/src/iot/convert/index.ts'
  - 'northguild/gmt:packages/gmt/src/iot/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/ptp.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT IoT

Use this skill when the task is reading, writing or checking a PTP (IEEE 1588)
timestamp: a count of seconds and nanoseconds from a sensor, a lidar unit, a
network card or a PTP log, which has to become a UTC instant or come from one.

## When to load

- The user has a PTP, gPTP or hardware timestamp and needs a UTC time.
- Sensor data sits about 37 seconds away from other clocks, with no error.
- The user asks which `currentUtcOffset` to use, or what the grandmaster
  announces.

## Core rules

1. **A PTP timestamp counts TAI, not UTC.** The PTP epoch is 1970-01-01T00:00:00
   TAI, and the count is not affected by leap seconds. It shares its epoch
   value with Unix time but counts a different time scale. Reading it as Unix
   time leaves the result ahead by the UTC offset (37 seconds since 2017) and
   raises no error.
2. **The offset is the grandmaster's, and it is required.**
   `currentUtcOffset` is TAI minus UTC in seconds, announced in the Announce
   message. `ptpToUtc` and `utcToPtp` apply the number you pass and never read
   the leap-second table. There is no default, because a constant would hide a
   wrong announcement.
   ```typescript
   ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 37); // "2024-01-01T00:00:00Z"
   ptpToUtc({ seconds: 1704067237n, nanoseconds: 0 }, 0); // "2024-01-01T00:00:37Z" (the 37-second error)
   ptpToUtc({ seconds: 1704067237, nanoseconds: 500000000 }, 37); // "2024-01-01T00:00:00.5Z"
   ```
3. **Writing goes the other way.** `utcToPtp` reads an ISO 8601 instant with `Z`
   or an offset and returns `{ seconds: bigint, nanoseconds }`.
   ```typescript
   utcToPtp("2024-01-01T02:00:00+02:00", 37); // { seconds: 1704067237n, nanoseconds: 0 }
   ```
4. **Check the two flags before you call.** The offset means something only
   when the grandmaster announces `currentUtcOffsetValid` true and
   `ptpTimescale` true (RFC 8575). The functions take the number alone, so the
   caller checks the flags. `timeTraceable` says whether to trust it at all.
5. **Sentinels, never exceptions.** `ptpToUtc` returns `""`, `utcToPtp` returns
   `null` and `isValidPtpTimestamp` returns `false`. That covers `seconds`
   outside 0 to 2^48 - 1, a `number` that is not a safe integer, `nanoseconds`
   outside 0 to 999999999, an offset that is not an integer from -32768 to
   32767, a missing member, a UTC second of `60`, and a result before
   1970-01-01T00:00:00Z.
   ```typescript
   ptpToUtc({ seconds: 0n, nanoseconds: 0 }, 37); // ""
   isValidPtpTimestamp({ seconds: 2n ** 48n, nanoseconds: 0 }); // false
   ```
6. **Validate before you trust.** `isValidPtpTimestamp(value)` is a type
   predicate for the record check. A record that passes can still convert to a
   time before 1970, which `ptpToUtc` refuses.
7. **Check a grandmaster against the table.** To see whether an announced
   offset is right for a date, compare it with `taiMinusUtc` (`@northguild/gmt`
   leap-second functions) for the result. A grandmaster still announcing `36`
   gives `2024-01-01T00:00:01Z` for the same record.
8. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://northguild.dev/gmt/llms.txt`, and each page has a `.md`
   twin that holds its text. The JSDoc ships in the installed package:
   `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **PTP time** (`@northguild/gmt/iot`): `ptpToUtc`, `utcToPtp`,
  `isValidPtpTimestamp`
- **Type**: `PtpTimestamp` is `{ seconds: bigint; nanoseconds: number }`;
  `ptpToUtc` and `isValidPtpTimestamp` also take `seconds` as a safe-integer
  `number`

## References

- [iot reference](https://northguild.dev/gmt/reference/iot/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT GNSS skill](../gmt-gnss/SKILL.md)
