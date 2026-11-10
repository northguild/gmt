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
- `packages/gmt/src/finance/validate/isValidFixUtcTimestamp.ts`:
  - `isValidFixUtcTimestamp(value: string): boolean`,
    `isValidFixUtcTimestamp(value: {} | null | undefined | void): boolean` and
    `isValidFixUtcTimestamp(value: unknown): value is string` — the overload trio every
    one-argument `isValid*` validator uses. True exactly when `parseFixUtcTimestamp` returns a
    value; it calls the parser, so the two cannot disagree. False for a value that is not a
    string, a `String` object included, and a true result narrows an `unknown` value to `string`.
- `internal/fixUtcTimestamp.ts` — the one `UTCTimestamp` regex: digits, dash, colons, and a fraction
  of 0, 3, 6, 9 or 12 digits. Not in `regex/`: the FIX Trading Community states the format in prose,
  not as a pattern. It joins `context/coding-standards.md` as a scoped exception, as INT-15's EDI
  grammars did.
- `packages/gmt/src/types/fix.ts` — `FixPrecision` (`"second"`, `"millisecond"`, `"microsecond"`,
  `"nanosecond"`, `"picosecond"`) and `FixUtcTimestamp`.
- This story opens the `finance/` realm: the `@northguild/gmt/finance`,
  `@northguild/gmt/finance/parse`, `@northguild/gmt/finance/format` and
  `@northguild/gmt/finance/validate` subpaths (`package.json` `exports` and `typesVersions`, the dox
  `gmt-modules.ts` barrel), and the Finance industry in `apps/dox/src/data/industries.json`, with
  namespace `finance`; its glyph in `INDUSTRY_ICON_PATHS` (`apps/dox/src/lib/industry-tags.ts`), and
  its hub text in `apps/dox/src/lib/industry-overview.ts`: three to five problems, each answered by
  a function the industry may name, in that file's wording rules. `context/dox/built.md` names all
  three as what a new industry takes, and `industry-tags.test.ts` and `industry-overview.test.ts`
  fail without them. Finance declares no `drawsOn`, so its hub text names only `finance` functions.

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

[Design notes](FIN-95/design-notes.md): precision from the digit count, the picosecond digits
kept apart, cut and never rounded, the leap second checked against the table, one public check
and no public pattern, no local time written, and another width left to the parties.

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
| The grammar is internal; the public check is `isValidFixUtcTimestamp` | **GMT rule**, INT-15's: FIX states the format in prose and publishes no pattern |
| `isValidFixUtcTimestamp` is true exactly when the parser returns a value | **GMT rule.** The validator calls the parser, so the two cannot disagree |
| Another width returns the sentinel | **GMT rule.** FIX names the precision of four widths only; another is "used with bilateral agreement", which no value carries |
| Picoseconds returned apart from the instant | **GMT rule.** Temporal holds nanoseconds; a parser does not cut a value without saying so |
| The formatter cuts, never rounds | **GMT rule.** Rounding can move a value into the next second, minute or day |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `LEAP_SECOND_STEPS` and `taiOfUtc` (`internal/leapSeconds.ts`) from SPA-48 — the leap-second
  table, which a seconds field of `60` is checked against in both directions
- `parseUtcReading` and `MAX_FOUR_DIGIT_YEAR` (`internal/utcReading.ts`) from MAR-16 — reading the
  formatter's instant, second 60 included, and the four-digit year bound
- `isoYearString` from INT-15 — writing the year as four digits

## Verification

- `parseFixUtcTimestamp('20240615-14:30:00.123456')` returns `{ instant: '2024-06-15T14:30:00.123456Z', precision: 'microsecond', leapSecond: false, picoseconds: 0 }`
- `'20240615-14:30:00'` returns `precision: 'second'`; `'20240615-14:30:00.123'` returns `'millisecond'`; `'20240615-14:30:00.123456789'` returns `'nanosecond'`
- `'20240615-14:30:00.123456789012'` returns `instant: '2024-06-15T14:30:00.123456789Z'`, `precision: 'picosecond'`, `picoseconds: 12`
- `'20161231-23:59:60'` returns `instant: '2016-12-31T23:59:60Z'`, `leapSecond: true`; `'20171231-23:59:60'` returns the sentinel, because no second was inserted that day; FIX's own example `'19981231-23:59:60'` returns `leapSecond: true`
- `'20240615-14:30:00.12'`, `'20240615 14:30:00'`, `'2024-06-15T14:30:00Z'`, `'20240230-00:00:00'` and `'20240615-24:00:00'` return the sentinel
- `formatFixUtcTimestamp('2024-06-15T16:30:00.123456789+02:00', 'millisecond')` returns `20240615-14:30:00.123`; `'second'` returns `20240615-14:30:00`; `'picosecond'` returns `20240615-14:30:00.123456789000`
- `formatFixUtcTimestamp('2016-12-31T23:59:60Z', 'second')` returns `20161231-23:59:60`; `'2017-12-31T23:59:60Z'` and `'2024-06-15T14:30:00'` return the sentinel
- Round-trip: `parseFixUtcTimestamp(formatFixUtcTimestamp(iso, p))` returns `iso` cut to `p`, with `precision: p`, for each of the five precisions
- `isValidFixUtcTimestamp('20240615-14:30:00.123')` and `'20161231-23:59:60'` are `true`; `'20171231-23:59:60'`, `'20240615-14:30:00.12'` and `'2024-06-15T14:30:00Z'` are `false`
- `isValidFixUtcTimestamp` agrees with `parseFixUtcTimestamp` on every parse row above; a number, `null` and `undefined` are `false`
- `pnpm run validate` stays green

## Decisions

- **Precision names.** `FixPrecision` is singular in the type: `"second"`, `"millisecond"`,
  `"microsecond"`, `"nanosecond"`, `"picosecond"`. `formatFixUtcTimestamp` also accepts the plural
  at run time, as the API Contract's unit rule says; the parser always reports the singular. The
  names are compared against the five literal strings, so `"toString"` and `"__proto__"` are
  refused.
- **Another width is refused.** FIX names the precision of four widths (3, 6, 9, 12 digits) and
  says other widths are "used with bilateral agreement". No value carries that agreement, so the
  parser returns `null` for 1, 2, 4, 5 or any other count of fraction digits.
- **The leap second is checked against the table, not the pattern.** A seconds field of `60` is
  well-formed on any day and real on 27. The parser accepts it only for one of the 27 inserted
  leap seconds in SPA-48's closed table and returns `…T23:59:60…Z`, the string `fromTAI` writes.
  The formatter takes that string back (in `Z` or any offset spelling), so a leap second
  round-trips; a second 60 on any other day, and any `60` before 1972, returns the sentinel.
  `coding-standards.md` names the `finance/` FIX functions beside `timescale/` and `gnss/` as the
  ones that read and write second 60.
- **What the formatter takes.** An instant in GMT's instant grammar: `Z` or a numeric offset, an
  optional bracketed zone, a fraction of 1 to 9 digits. It converts to UTC first. A local
  date-time with no offset returns `""`, since it names no UTC second until `resolveLocal` gives
  one; the function converts no wall time and takes no disambiguation option. A year outside
  0000–9999 once in UTC returns `""`.
- **Picoseconds are returned apart.** Temporal holds nanoseconds and FIX allows picoseconds. The
  parser puts the first nine fraction digits in `instant` and digits 10 to 12 in `picoseconds`
  (0–999, and `0` at every other precision), so nothing is cut without saying so. The formatter
  under `"picosecond"` writes the nine nanosecond digits and `000`.
- **The digits sent are kept.** `instant` carries the fraction digits as sent, up to the ninth:
  `.100Z` stays `.100Z`, not `.1Z`. The digit count is a fact about the measurement, so a
  millisecond stamp is never widened to nanoseconds. `instant` is therefore not always the string
  `Temporal.Instant#toString()` writes.
- **The formatter cuts and never rounds.** Rounding could move a stamp into the next second,
  minute or day.
- **No options argument on the formatter.** It takes the instant and the precision only. An
  optional third argument can be added later without breaking a caller, so nothing is reserved.
- **The grammar is internal.** FIX states the format in prose and publishes no pattern, so
  `FIX_UTC_TIMESTAMP` lives in `internal/fixUtcTimestamp.ts`, not in `regex/`. It proves shape and
  a seconds field of 00–60; month, day, hour and minute ranges go to
  `Temporal.PlainDateTime.from(fields, { overflow: "reject" })`. The public check is
  `isValidFixUtcTimestamp`. The rule is the scoped exception in `coding-standards.md` § finance
  message grammars.
- **The validator's overload trio** replaces the issue's first signature `value: string`, as every
  one-argument `isValid*` validator does.
- **FIN-96 inherits the realm.** The `finance/{parse,format,validate}/` layout, the barrels, the
  four subpaths, the sentinels (parser `null`, formatter `""`, validator calls the parser), the
  coding-standards section and the Dox Finance industry. No helper is shared and no
  `types/finance.ts` umbrella exists; FIN-96 adds `types/swift.ts` if it needs a type.
