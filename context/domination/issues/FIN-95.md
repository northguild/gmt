# FIN-95 — Finance: FIX UTC timestamps

**Scope:** Read and write the FIX `UTCTimestamp`, at the precision its digits state and with the leap second checked against the table.

## Gap

Every order, execution and market-data message in electronic trading crosses a FIX session, and
FIX does not use ISO 8601. Its `UTCTimestamp` is `YYYYMMDD-HH:MM:SS` or `YYYYMMDD-HH:MM:SS.sss*`,
with 3, 6, 9 or 12 fraction digits for milliseconds, microseconds, nanoseconds and picoseconds,
and "SS = 00-60 (60 only if UTC leap second)". No general date library parses it
([painpoints § Findings — Finance](../painpoints.md#findings--finance)).

Two errors corrupt an audit record. Reading back a millisecond stamp as nanoseconds with zeros
claims a precision nobody measured, and latency analysis depends on knowing what was measured. A
pattern that allows `60` on any day accepts a second that never happened on all but 27 days.

([FIX Latest, data types: `UTCTimestamp`](https://orchimate.org/fixtrading/fix-latest/datatypes?ref=fiximate))

## Scope

- `packages/gmt/src/finance/parse/parseFixUtcTimestamp.ts`:
  - `parseFixUtcTimestamp(value: string): FixUtcTimestamp | null` — Returns
    `{ instant, precision, leapSecond, picoseconds }`.
- `packages/gmt/src/finance/format/formatFixUtcTimestamp.ts`:
  - `formatFixUtcTimestamp(value: string, precision: FixPrecision): string`
- `packages/gmt/src/types/fix.ts` — `FixPrecision` (`"second"`, `"millisecond"`, `"microsecond"`,
  `"nanosecond"`, `"picosecond"`) and `FixUtcTimestamp`.
- This story opens the `finance/` realm: the `@northguild/gmt/finance`,
  `@northguild/gmt/finance/parse` and `@northguild/gmt/finance/format` subpaths (`package.json`
  `exports` and `typesVersions`, the dox `gmt-modules.ts` barrel), and the Finance industry in
  `apps/dox/src/data/industries.json`, with namespace `finance`.

### The result of `parseFixUtcTimestamp`

| Member | Value |
| --- | --- |
| `instant` | The UTC instant, ending in `Z`, with the fraction digits sent up to the ninth. During an inserted leap second it is `…T23:59:60…Z` |
| `precision` | From the number of fraction digits: none `"second"`, 3 `"millisecond"`, 6 `"microsecond"`, 9 `"nanosecond"`, 12 `"picosecond"` |
| `leapSecond` | `true` when the seconds field is `60` |
| `picoseconds` | Digits 10 to 12 of a 12-digit fraction, as an integer from 0 to 999; `0` at every other precision |

### What returns the sentinel

- A value that does not match the format, with its colons, dash and period; a fraction of a length
  other than 0, 3, 6, 9 or 12; a month, day, hour or minute out of range or a day the month does not
  have; a seconds field of `60` on a second that was not an inserted leap second.
- In `formatFixUtcTimestamp`: a value that is not an ISO 8601 instant with `Z` or an offset; a year
  outside 0000–9999 once converted to UTC; a second of `60` that is not an inserted leap second.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/industries/finance-message-timestamps.mdx`: the format, precision by digit count,
  picoseconds, the leap second, and writing at a counterparty's precision.
- Scenarios `a-millisecond-stamp-read-as-nanoseconds.mdx`, `second-sixty-on-an-ordinary-day.mdx`.
- Mistakes: `mistakes/finance.mdx`.
- Indexes: `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`.

## Tool

**FIX Timestamp Reader.** Paste a `UTCTimestamp` and see the instant, the precision its digits
state and whether it is a leap second; a picosecond stamp shows the three digits below the
nanosecond separately. A second panel writes an instant at all five precisions. Calls
`parseFixUtcTimestamp`, `formatFixUtcTimestamp`. Teaches: the number of digits is a fact about the
measurement, and `60` is real on 27 days.

## Design notes

- **Precision comes from the digit count and is reported, never widened.** A millisecond stamp
  returns `"millisecond"` and an instant with three fraction digits.
- **Nothing is dropped silently.** Temporal holds nanoseconds, and FIX allows picoseconds. The
  parser puts the first nine digits in `instant` and the last three in `picoseconds`, so a caller
  who needs them keeps them. INT-15 refuses a fraction longer than nine digits for the same reason:
  a parser must not cut a value without saying so.
- **The formatter cuts to the precision and never rounds**, as INT-15's formatters do. Under
  `"picosecond"` it writes the nine nanosecond digits and then `000`: the value holds nothing finer.
  This widens the field to the width the counterparty asked for, as INT-15 writes `14:30:00` as
  `14300000` under `HHMMSSDD`.
- **The leap second is checked against the table, not the pattern.** `60` is well-formed on any day
  and real on 27. The parser accepts it only where `isLeapSecond` (SPA-48) does, and returns the
  instant as `…T23:59:60Z`, the string `fromTAI` writes. The formatter takes that string back, so a
  leap second round-trips.
- **A local time is not written.** `UTCTimestamp` is UTC. A local date-time with no offset names no
  UTC second until a zone is supplied, so the formatter returns the sentinel for one; `resolveLocal`
  gives the instant first.
- **Another width is the parties' agreement, not the standard's.** FIX says "Other number of digits
  may be used with bilateral agreement". The precision of such a width is whatever the parties
  agreed, which no value states, so the parser returns the sentinel and the caller who has the
  agreement reads it with `parseDateTimeWithPattern` or its own code.
- Which FIX field carries which timestamp (`SendingTime`, `TransactTime`) is the FIX dictionary's
  concern. This story reads and writes the data type.

## Authority — what each rule rests on

The FIX Trading Community publishes FIX, a multinational industry standard. FIX Latest was read
through the FIX Orchestra data-type browser, to which FIXimate now redirects.

| Rule | Source |
| --- | --- |
| The format, with colons, dash and period required | FIX Latest, `UTCTimestamp`: "in either YYYYMMDD-HH:MM:SS (whole seconds) or YYYYMMDD-HH:MM:SS.sss* format, colons, dash, and period required" |
| Field ranges, and `60` only for a leap second | FIX Latest, `UTCTimestamp`: "YYYY = 0000-9999, MM = 01-12, DD = 01-31, HH = 00-23, MM = 00-59, SS = 00-60 (60 only if UTC leap second)" |
| 3, 6, 9 and 12 fraction digits | FIX Latest, `UTCTimestamp`: "3 digits to convey milliseconds, 6 digits to convey microseconds, 9 digits to convey nanoseconds, 12 digits to convey picoseconds" |
| No fraction means no period | FIX Latest, `UTCTimestamp`: "The fractions of seconds may be empty when no fractions of seconds are conveyed (in such a case the period is not conveyed)" |
| A leap-second sequence | FIX Latest, `UTCTimestamp` examples: `19981231-23:59:59`, `19981231-23:59:60`, `19990101-00:00:00` |
| `60` is valid on the 27 inserted seconds only | IERS leap-second table, built in by SPA-48 (Bulletin C 72; closed by CGPM 2026 Resolution 5) |
| Another width returns the sentinel | **GMT rule.** FIX names the precision of four widths only; another is "used with bilateral agreement", which no value carries |
| Picoseconds returned apart from the instant | **GMT rule.** Temporal holds nanoseconds; a parser does not cut a value without saying so |
| The formatter cuts, never rounds | **GMT rule.** Rounding can move a value into the next second, minute or day |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `toNanoseconds`, `fromNanoseconds`, `truncateNanoseconds` from CORE-1 — sub-second precision
- `isLeapSecond` from SPA-48 — checking a seconds field of `60` against the leap-second table, and
  the internal second-60 reading and writing behind `fromTAI`
- `resolveLocal` from CORE-4 — the instant of a local time, before it is written

## Verification

- `parseFixUtcTimestamp('20240615-14:30:00.123456')` returns `{ instant: '2024-06-15T14:30:00.123456Z', precision: 'microsecond', leapSecond: false, picoseconds: 0 }`
- `'20240615-14:30:00'` returns `precision: 'second'`; `'20240615-14:30:00.123'` returns `'millisecond'`; `'20240615-14:30:00.123456789'` returns `'nanosecond'`
- `'20240615-14:30:00.123456789012'` returns `instant: '2024-06-15T14:30:00.123456789Z'`, `precision: 'picosecond'`, `picoseconds: 12`
- `'20161231-23:59:60'` returns `instant: '2016-12-31T23:59:60Z'`, `leapSecond: true`; `'20171231-23:59:60'` returns the sentinel, because no second was inserted that day; FIX's own example `'19981231-23:59:60'` returns `leapSecond: true`
- `'20240615-14:30:00.12'`, `'20240615 14:30:00'`, `'2024-06-15T14:30:00Z'`, `'20240230-00:00:00'` and `'20240615-24:00:00'` return the sentinel
- `formatFixUtcTimestamp('2024-06-15T16:30:00.123456789+02:00', 'millisecond')` returns `20240615-14:30:00.123`; `'second'` returns `20240615-14:30:00`; `'picosecond'` returns `20240615-14:30:00.123456789000`
- `formatFixUtcTimestamp('2016-12-31T23:59:60Z', 'second')` returns `20161231-23:59:60`; `'2017-12-31T23:59:60Z'` and `'2024-06-15T14:30:00'` return the sentinel
- Round-trip: `parseFixUtcTimestamp(formatFixUtcTimestamp(iso, p))` returns `iso` cut to `p`, with `precision: p`, for each of the five precisions
- `pnpm run validate` stays green
