---
name: gmt-finance
description: >
  Financial messaging dates and timestamps in @northguild/gmt/finance — the FIX
  UTCTimestamp (YYYYMMDD-HH:MM:SS[.sss*]) read, written and checked:
  parseFixUtcTimestamp (precision from the digit count, picoseconds apart,
  second 60 only on a real leap second), formatFixUtcTimestamp (cut, never
  rounded, at a counterparty's precision) and isValidFixUtcTimestamp; and the
  SWIFT MT value date (YYMMDD): parseSwiftDate, formatSwiftDate and
  isValidSwiftDate, in the century SWIFT's own rule gives. Reads
  the docs site (llms.txt) and the installed package's JSDoc; a routing
  pointer, not an API dump.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/finance-message-timestamps.mdx'
  - 'northguild/gmt:packages/gmt/src/finance/format/index.ts'
  - 'northguild/gmt:packages/gmt/src/finance/parse/index.ts'
  - 'northguild/gmt:packages/gmt/src/finance/validate/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/fix.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.21.0'
---

# GMT Finance

Use this skill when the task is reading or writing a timestamp from a FIX
message: `SendingTime`, `TransactTime` and every other field of the
`UTCTimestamp` data type, and the six-digit value date of a SWIFT MT message
(`30` and `32A`). TAI and the leap-second table are in the
`gmt-integration` skill.

## When to load

- The user has a FIX `UTCTimestamp` such as `20240615-14:30:00.123456` to read,
  or an instant to write in that form at a counterparty's precision.
- The user asks whether a FIX timestamp is valid, or what precision it states.
- The user has a SWIFT MT value date such as `240615` (`YYMMDD`) to read, or an
  ISO date to write in that form, or asks which century a `YY` means.

## Core rules

1. **A FIX `UTCTimestamp` is not ISO 8601.** It is `YYYYMMDD-HH:MM:SS`, with an
   optional `.` and 3, 6, 9 or 12 fraction digits, in UTC with no `Z`. No
   `Temporal.*.from` reads it, and a pattern cannot say whether a day exists or
   a `60` is real. Use the three functions, not a regular expression.
2. **The digit count is the precision, and it is never widened.**
   `parseFixUtcTimestamp` returns `{ instant, precision, leapSecond, picoseconds }`
   or `null`. A millisecond stamp stays `"millisecond"`; reading it as
   nanoseconds claims a precision nobody measured.
   ```typescript
   parseFixUtcTimestamp("20240615-14:30:00.123456");
   // { instant: "2024-06-15T14:30:00.123456Z", precision: "microsecond", leapSecond: false, picoseconds: 0 }
   parseFixUtcTimestamp("20240615-14:30:00.123456789012");
   // { instant: "2024-06-15T14:30:00.123456789Z", precision: "picosecond", leapSecond: false, picoseconds: 12 }
   parseFixUtcTimestamp("20240615-14:30:00.12"); // null: two digits is not a FIX width
   ```
   - `instant` keeps the digits sent up to the ninth, so `.100` stays `.100Z`.
   - An instant holds nanoseconds. Digits 10 to 12 of a picosecond stamp come
     back in `picoseconds` (0 to 999), so keep them if you need them.
3. **`60` is real on 27 days only.** A seconds field of `60` is accepted only for
   one of the 27 inserted leap seconds, and `instant` is then `…T23:59:60Z`.
   ```typescript
   parseFixUtcTimestamp("20161231-23:59:60"); // { instant: "2016-12-31T23:59:60Z", precision: "second", leapSecond: true, picoseconds: 0 }
   parseFixUtcTimestamp("20171231-23:59:60"); // null
   ```
   `finance/`, `timescale/` and `gnss/` read and write that string; every other
   GMT function rejects `:60`, so do not pass the instant on.
4. **Write at the counterparty's precision.** `formatFixUtcTimestamp(instant, precision)`
   converts to UTC, cuts to the precision and never rounds, so a stamp cannot
   move into the next second or day. `"picosecond"` pads `000`. It takes an
   instant with `Z` or an offset; a local date-time returns `""`, because it
   names no UTC second until `resolveLocal` gives one.
   ```typescript
   formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "millisecond"); // "20240615-14:30:00.123"
   formatFixUtcTimestamp("2024-06-15T16:30:00.123456789+02:00", "picosecond"); // "20240615-14:30:00.123456789000"
   formatFixUtcTimestamp("2024-06-15T14:30:00", "second"); // ""
   ```
5. **Validate before you trust.** `isValidFixUtcTimestamp(value)` is `true`
   exactly when the parser returns a value, and it narrows `unknown` to `string`.
   Other widths are a bilateral agreement the value does not carry, so the
   parser returns `null` for them.
6. **A SWIFT value date is `YYMMDD`, and SWIFT chooses the century.** For
   field 32A of MT 910, and fields 30 and 32A of category 1 and 2 messages
   other than n92, n95 and n96, a `YY` above 79 is 19`YY` and the rest is
   20`YY`; a year after 2060 is refused (error T50). The range is 1980 to 2060,
   limits included. There are no options and no window to pass. The day is
   checked in the year the rule gives, so `000229` is real and `850229` is not.
   ```typescript
   parseSwiftDate("240615"); // "2024-06-15"
   parseSwiftDate("990615"); // "1999-06-15"
   parseSwiftDate("000229"); // "2000-02-29"
   parseSwiftDate("750101"); // "": 2075 is past 2060
   formatSwiftDate("2024-06-15"); // "240615"
   formatSwiftDate("1924-06-15"); // "": its digits would read back as 2024
   isValidSwiftDate("750101"); // false
   ```
   - Pass the bare six digits. A tag, currency, amount or space returns `""`;
     splitting a field into subfields is yours.
   - `formatSwiftDate` takes an ISO calendar date. A date-time returns `""`:
     take the date first, in the zone you mean.
   - Other six-digit dates, such as field 31D of an MT 700, are not covered by
     SWIFT's value-date rule: read them with `parseDateWithPattern`.
7. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://northguild.dev/gmt/llms.txt`, and each page has a `.md`
   twin that holds its text. The JSDoc ships in the installed package:
   `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **FIX `UTCTimestamp`** (`@northguild/gmt/finance`): `parseFixUtcTimestamp`,
  `formatFixUtcTimestamp`, `isValidFixUtcTimestamp`, types `FixPrecision`,
  `FixUtcTimestamp`
- **SWIFT MT value date** (`@northguild/gmt/finance`): `parseSwiftDate`,
  `formatSwiftDate`, `isValidSwiftDate`

## References

- [finance reference](https://northguild.dev/gmt/reference/finance/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Integration skill](../gmt-integration/SKILL.md)
