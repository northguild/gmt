# FIN-73 — Finance: Financial message timestamps — FIX and SWIFT MT

**Scope:** Parsing and formatting the date and time fields of the two message standards trading and payments run on, at the precision each allows.

## Gap

Every order, execution and market-data tick in electronic trading crosses a FIX session, and FIX does not use ISO 8601. Its `UTCTimestamp` is "in either YYYYMMDD-HH:MM:SS (whole seconds) or YYYYMMDD-HH:MM:SS.sss* format", with "3 digits to convey milliseconds, 6 digits to convey microseconds, 9 digits to convey nanoseconds, 12 digits to convey picoseconds", and "SS = 00-60 (60 only if UTC leap second)" — the standard's own example runs `19981231-23:59:59`, `19981231-23:59:60`, `19990101-00:00:00`. `TZTimestamp` is `YYYYMMDD-HH:MM:SS.sss*[Z | [ + | - hh[:mm]]]`, `TZTimeOnly` `HH:MM[:SS][Z | [ + | - hh[:mm]]]`, `MonthYear` "YYYYMM, YYYYMMDD, YYYYMMWW" with "WW = w1, w2, w3, w4, w5", and `LocalMktDate` a "Date of Local Market (as opposed to UTC)". Payments cross SWIFT MT messages whose value dates (field 32A, `6!n3!a15d`) "must be a valid date expressed as YYMMDD", whose time indications (field 13C, `/8c/4!n1!x4!n`) carry `HHMM`, a sign and an offset "against the UTC (Coordinated Universal Time - ISO 8601)", and whose MT 900/910 date-time indications (field 13D, `6!n4!n1!x4!n`) add the date. Regulators then require trading timestamps to a stated granularity: MiFID II RTS 25 Table 2 sets one second, one millisecond or one microsecond depending on the activity, and a maximum divergence from UTC to match.

None of these formats is parseable by a general date library, all of them are simple, and getting the fraction width or the leap-second rule wrong corrupts a regulatory record.

([FIX Latest data types](https://fiximate.fixtrading.org/en/FIX.Latest/fix_datatypes.html), [SWIFT Standards MT, MT 103 field 32A](https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih006.htm) and [field 13C](https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih002.htm), [MT 900 format specification](https://pinas.synology.me/Swift_Manual/2015/books/us9m/afc.htm) — mirrors of SWIFT's User Handbook, whose own copy needs a login, [Commission Delegated Regulation (EU) 2017/574 (RTS 25), Annex Tables 1 and 2](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0574))

## Scope

- `packages/gmt/src/finance/parse/fixTimestamp.ts`:
  - `parseFixUtcTimestamp(value: string): { instant: string, precision: 'second' | 'millisecond' | 'microsecond' | 'nanosecond' | 'picosecond', leapSecond: boolean } | null` — `60` in the seconds field is accepted only on a date in the leap-second table (SPA-48) and is reported.
  - `formatFixUtcTimestamp(isoString: string, options: { precision: 'second' | 'millisecond' | 'microsecond' | 'nanosecond' | 'picosecond' }): string` — Picoseconds beyond GMT's nanosecond core are zero-padded, documented.
  - `parseFixUtcTimeOnly(value: string)`, `parseFixUtcDateOnly(value: string)`, `parseFixLocalMktDate(value: string): { date: string }` and `parseFixLocalMktTime(value: string): { time: string }` — The local forms return calendar values, never instants.
  - `parseFixTzTimestamp(value: string): { instant: string, offset: string, precision } | null` — `YYYYMMDD-HH:MM[:SS[.fff…]][Z | [+-]hh[:mm]]`.
  - `parseFixMonthYear(value: string): { year: number, month: number, day?: number, weekOfMonth?: 1 | 2 | 3 | 4 | 5 } | null` — `YYYYMM`, `YYYYMMDD`, `YYYYMMw1`…`w5`.
- `packages/gmt/src/finance/parse/swiftDate.ts`:
  - `parseSwiftDate(value: string, options: { centuryPivot: number }): string | null` — `YYMMDD`; the pivot is required.
  - `formatSwiftDate(isoDate: string): string`
  - `parseSwiftTimeIndication(value: string): { code: string, time: string, offset: string } | null` — Field 13C `/8c/HHMM±HHMM`, offset hours 00–13.
  - `parseSwiftDateTimeIndication(value: string, options: { centuryPivot: number }): { date: string, time: string, offset: string } | null` — Field 13D `YYMMDDHHMM±HHMM`.
- `packages/gmt/src/finance/validate/rts25Granularity.ts`:
  - `rts25Requirement(subject: { role: 'venue', gatewayLatencyOverOneMs: boolean } | { role: 'member', activity: 'hft' | 'voice' | 'rfqHuman' | 'negotiated' | 'other' }): { maxDivergenceFromUtc: string, granularity: string, clause: string }` — Annex Table 1 (venues: over 1 ms latency → 1 ms / 1 ms; otherwise 100 µs / 1 µs) and Table 2 (members: HFT 100 µs / 1 µs; voice, human-intervention RFQ and negotiated transactions 1 s / 1 s; any other 1 ms / 1 ms) as documented constants with the clause.
  - `meetsRts25Granularity(precision, subject): boolean`

## Design notes

- **Precision is detected from the digit count and reported, never widened.** A FIX engine that emits milliseconds must not be read back as nanoseconds with zeros; downstream latency analysis depends on knowing what was measured. The same rule as HLTH-34's FHIR precision.
- **The leap second is validated, not pattern-matched.** `60` is well-formed on any date and valid on 27 of them; SPA-48's table decides, exactly as SPA-52 does for CCSDS ASCII codes.
- **Local market dates and times are not instants**, and the return types say so. Resolving them needs the market's zone, which the message does not carry; the caller supplies it through CORE-4.
- **SWIFT's century pivot is required**, as in MAR-59's NMEA dates. Value dates are near the present so any pivot works in practice, which is exactly why a hidden default would go unnoticed until it did not.
- **RTS 25 values are documentation with a clause, exported as constants** because they are a regulation's numbers, not GMT's judgement; the function exists so a checker cites the table rather than retyping it.
- FIX session-level fields (`SendingTime`, `TransactTime`) and application-level fields all use these types; which field carries what is the FIX dictionary's concern and out of scope.

## What gmt provides (do not re-implement)

- `toNanoseconds` / `fromNanoseconds` / `truncateNanoseconds` from CORE-1 — sub-second precision
- `isLeapSecond` from SPA-48 — validating a `60` seconds field
- `toOffsetInstant` / `resolveLocal` from CORE-4 — `TZTimestamp` and local market values
- `regex/` — pattern matchers

## Verification

- `parseFixUtcTimestamp('20240615-14:30:00.123456')` returns the instant with `precision: 'microsecond'`; `'.123456789012'` returns `'picosecond'` and truncates to the nanosecond in `instant`, documented
- `parseFixUtcTimestamp('20161231-23:59:60')` returns `leapSecond: true`; `'20171231-23:59:60'` returns the sentinel
- `formatFixUtcTimestamp` round-trips each precision; picoseconds are zero-padded
- `parseFixTzTimestamp('20240615-09:30:00+05:30')` returns the instant and `'+05:30'`; `'20240615-09:30Z'` returns UTC at minute precision
- `parseFixMonthYear('202406w3')` returns `weekOfMonth: 3`; `'20240615'` returns `day: 15`; `'202413'` returns the sentinel
- `parseFixLocalMktDate('20240615')` returns a date and no instant
- `parseSwiftDate('240615', { centuryPivot: 50 })` returns `'2024-06-15'`; `formatSwiftDate` round-trips; `parseSwiftTimeIndication('/CLSTIME/0915+0100')` (SWIFT's own example) returns the code, `09:15` and `+01:00`; an offset of `+1400` returns the sentinel (hours are 00–13); `parseSwiftDateTimeIndication('2406151230+0100', { centuryPivot: 50 })` returns date, time and offset
- `rts25Requirement({ role: 'member', activity: 'hft' })` returns `maxDivergenceFromUtc: 'PT0.0001S'`, `granularity: 'PT0.000001S'` with the Table 2 clause; `{ role: 'venue', gatewayLatencyOverOneMs: true }` returns 1 ms / 1 ms from Table 1; `meetsRts25Granularity('millisecond', hft)` is `false` and `meetsRts25Granularity('millisecond', other)` is `true`
- Malformed separators, out-of-range fields and unknown activities return the sentinel
- `pnpm run validate` stays green
