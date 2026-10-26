# FIN-96 — Finance: SWIFT dates

**Scope:** Read and write the six-digit `YYMMDD` date of SWIFT MT messages, in a century the caller states.

## Gap

Payments cross SWIFT MT messages, and their value date is six digits. Field 32A carries
`6!n3!a15d` — a date, a currency and an amount — and its network validated rule says the date
"must be a valid date expressed as YYMMDD" ([painpoints § Findings — Finance](../painpoints.md#findings--finance)).
A general date parser does not read it, and a parser that does has to choose a century. Any
cut-off built into a library is right today and wrong later, and value dates near the present make
a hidden default look correct until it is not.

([SWIFT Standards MT, MT 103 field 32A](https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih006.htm) —
a mirror of SWIFT's User Handbook, whose own copy needs a login)

## Scope

- `packages/gmt/src/finance/parse/parseSwiftDate.ts`:
  - `parseSwiftDate(value: string, options: TwoDigitYearOptions): string` — `YYMMDD` to an ISO
    date. Without `options.yearWindow` the result is the sentinel.
- `packages/gmt/src/finance/format/formatSwiftDate.ts`:
  - `formatSwiftDate(value: string, options: TwoDigitYearOptions): string` — An ISO date to
    `YYMMDD`. Returns the sentinel for a year outside the window, so a round trip never changes a
    century.
- `TwoDigitYearOptions` is the type INT-15 defined; this story adds no type.
- If the `finance/` realm does not exist yet when this story starts, this story opens it, with the
  subpaths and the industry declaration its sibling story names.

### What returns the sentinel

- `parseSwiftDate`: a value that is not six digits; a month or day that does not exist in the year
  the window gives; no `yearWindow`, or one `TwoDigitYearOptions` does not accept.
- `formatSwiftDate`: a value that is not an ISO 8601 calendar date; a year outside the window; no
  `yearWindow`.

### Docs site — `apps/dox/src/content/docs/`

- Extend `guides/industries/finance-message-timestamps.mdx`: the value date, the two windows, and
  why a round trip refuses a year outside the window.
- Scenario `a-value-date-in-the-wrong-century.mdx`.
- Mistakes: extend `mistakes/finance.mdx`.

## Tool

**SWIFT Value Date Reader.** Enter a `YYMMDD` value and a window — a fixed start year or
`"rolling"` — and see the date; the same value is shown under two windows side by side, and
29 February is checked in the year the window gives. Calls `parseSwiftDate`, `formatSwiftDate`.
Teaches: a two-digit year has no century until someone states one.

## Design notes

- **The century is the caller's.** SWIFT does not say which century `YY` belongs to. The caller
  states `yearWindow`, as INT-15's pattern parsers require: a fixed start year for stored data, or
  `"rolling"` for live messages. The library holds no cut-off of its own.
- **Leap days are checked in the year the window gives.** `000229` is 29 February 2000 with a
  window starting in 2000, and invalid with one starting in 1900: 2000 was a leap year and 1900 was
  not. So the day check runs after the century is known.
- **A round trip never changes a century.** `formatSwiftDate` refuses a year outside the window
  rather than writing digits that would read back as another year.
- **A value date is a date.** The formatter takes an ISO calendar date only. A date-time has a
  calendar date only in some zone, so the caller states which by taking the date first.
- MT time indications (fields 13C and 13D) and which field carries which date are not part of this
  story.

## Authority — what each rule rests on

SWIFT is a multinational industry body. The User Handbook was read through a public mirror; SWIFT's
own copy needs a login.

| Rule | Source |
| --- | --- |
| The date is six digits, `YYMMDD`, and must be a valid date | SWIFT MT 103, field 32A: format `6!n3!a15d`, subfield 1 Date; network validated rule "Date must be a valid date expressed as YYMMDD (Error code(s): T50)" |
| The century is the caller's | **GMT rule**, INT-15's: no standard names the century of a two-digit year |
| A year outside the window is refused by the formatter | **GMT rule.** Writing it would read back as another year |
| A day that does not exist in the windowed year is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `TwoDigitYearOptions` from INT-15 — the caller-stated hundred-year window
- `internal/twoDigitYear.ts` and `internal/yearWindowStart.ts` from INT-15 — placing a two-digit
  year in that window, and reading the option
- `isValidDate` — the ISO date the formatter takes

## Verification

- `parseSwiftDate('240615', { yearWindow: 2000 })` returns `2024-06-15`; with `{}` or no options it returns the sentinel
- `parseSwiftDate('990615', { yearWindow: 1950 })` returns `1999-06-15`, and `2099-06-15` with `{ yearWindow: 2000 }`
- `parseSwiftDate('000229', { yearWindow: 2000 })` returns `2000-02-29`; with `{ yearWindow: 1900 }` it returns the sentinel
- With `{ yearWindow: 'rolling' }` and the clock faked to 2026-10-26, `'750101'` returns `2075-01-01` and `'760101'` returns `1976-01-01`
- `'24061'`, `'2406150'`, `'241315'` and `'24-06-15'` return the sentinel
- `formatSwiftDate('2024-06-15', { yearWindow: 2000 })` returns `240615`; `formatSwiftDate('1969-01-01', { yearWindow: 2000 })` returns the sentinel; `'2024-06-15T10:00:00'` returns the sentinel
- Round-trip: `parseSwiftDate(formatSwiftDate(d, w), w)` returns `d` for every date `d` inside the window `w`
- `pnpm run validate` stays green
