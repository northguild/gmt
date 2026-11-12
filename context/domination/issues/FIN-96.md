# FIN-96 — Finance: SWIFT dates

**Scope:** Read and write the six-digit `YYMMDD` value date of SWIFT MT messages, in the century SWIFT's own rule gives.

## Gap

SWIFT MT messages carry a six-digit value date. Most cross-border payment instructions between
banks moved to ISO 20022 on 22 November 2025, but MT 101, MT 910 and archived messages still carry
it. Field 32A carries
`6!n3!a15d` — a date, a currency and an amount — and its network validated rule says the date
"must be a valid date expressed as YYMMDD" ([painpoints § Findings — Finance](../painpoints.md#findings--finance)).
A general date parser does not read it, and a two-digit year needs a century. SWIFT states one for
value dates: its General Information reads a `YY` from 01 to 60 as 20`YY`, 2001 to 2060, and
refuses any other `YY` with error T50. A parser that applies a cut-off of its own, or asks the caller
for one, reads some dates SWIFT accepts as another year, and accepts dates SWIFT refuses.

(SWIFT Standards MT, MT 103 field 32A, in SWIFT's Knowledge Centre, which needs a login; SWIFT
_Standards MT General Information_ (Standards MT November 2025), §6.3.1 and §6.3.6, which needs
none: <https://www2.swift.com/knowledgecentre/rest/v1/publications/usgi_20250718/2.0/usgi_20250718.pdf>.)

## Scope

- `packages/gmt/src/finance/parse/parseSwiftDate.ts`:
  - `parseSwiftDate(value: string): string` — The value date of a field 30 or 32A, `YYMMDD`, to an
    ISO date, in the century SWIFT's value-date rule gives: `YY` from 01 to 60 is 20`YY`, and
    any other `YY` is refused.
- `packages/gmt/src/finance/format/formatSwiftDate.ts`:
  - `formatSwiftDate(value: string): string` — An ISO date to `YYMMDD`. Returns the sentinel for a
    year outside 2001 to 2060, the range SWIFT accepts, so a round trip never changes a century.
- `packages/gmt/src/finance/validate/isValidSwiftDate.ts`:
  - `isValidSwiftDate(value: string): boolean` — True exactly when `parseSwiftDate` returns a date
    for the same value; it calls the parser, so the two cannot disagree. False for a value that is
    not a string.
- `internal/swiftDate.ts` — the `YYMMDD` regex and SWIFT's century rule. Not in `regex/`: SWIFT
  gives a format code (`6!n`), not a pattern. It joins `context/coding-standards.md` as a scoped
  exception, as INT-15's EDI grammars did.
- `context/coding-standards.md`, the two-digit-year paragraph of the EDI exception: name SWIFT's
  value-date rule as the third mandated rule, beside RFC 5322 §4.3 and RFC 9110, applied by
  `parseSwiftDate` and `formatSwiftDate`.
- FIN-95 opens the `finance/` realm, with its subpaths, industry, guide and mistakes page; this
  story adds its functions to them.

### What returns the sentinel

- `parseSwiftDate`: a value that is not six digits; a `YY` of `00` or from `61` to `99` (T50);
  a month or day that does not exist in the year the rule gives.
- `formatSwiftDate`: a value that is not an ISO 8601 calendar date; a year before 2001 or after
  2060.

### Docs site — `apps/dox/src/content/docs/`

- Extend `guides/industries/finance-message-timestamps.mdx`: the value date, SWIFT's 2001 to 2060
  range, and why a round trip refuses a year outside it.
- Scenario `a-value-date-in-the-wrong-century.mdx`.
- Mistakes: extend `mistakes/finance.mdx`.

## Tool

**SWIFT Value Date Reader.** Enter a `YYMMDD` value and see the date SWIFT's rule gives, with the
century it chose and why; a `YY` of `00` or from `61` to `99` is shown refused with T50, and 29 February is
checked in the year the rule gives. Calls `parseSwiftDate`, `formatSwiftDate`, `isValidSwiftDate`.
Teaches: a two-digit year has no century until someone states one, and for value dates SWIFT does.

## Design notes

- **The century is SWIFT's.** For value dates in fields 30 and 32A, SWIFT's General Information fixes
  the century: 2001 to 2060. So the parser takes no window. This follows the
  coding standards' rule that GMT never picks a century where it has a choice: like RFC 5322 §4.3
  and RFC 9110, SWIFT mandates the rule, so there is no choice to make, and `parseRfc2822` and
  `parseHttpDate` are the precedent for applying it exactly.
- **The edition.** The rule is cited from _Standards MT General Information_, Standards MT
  November 2025. The November 2006 _Message Format Validation Rules_ read `YY` above 79 as
  19`YY`, from 1980; the 2025 edition reads 2001 to 2060 only, and the story follows it. If a
  later Standards Release moves the range, the story follows that edition and its rows change
  with it.
- **Leap days are checked in the year the rule gives.** `040229` is 29 February 2004 and `600229`
  29 February 2060; `050229` is refused. So the day check runs after the century is known.
- **The validator takes the value alone.** The century is fixed by the rule, so `isValidSwiftDate`
  needs no options. The grammar stays in `internal/`: a value is valid only once its century and
  range are known, which no pattern says.
- **A round trip never changes a century.** `formatSwiftDate` refuses a year outside 2001 to 2060
  rather than writing digits that would read back as another year.
- **A value date is a date.** The formatter takes an ISO calendar date only. A date-time has a
  calendar date only in some zone, so the caller states which by taking the date first.
- MT time indications (fields 13C and 13D) and which field carries which date are not part of this
  story.

## Authority — what each rule rests on

SWIFT is a multinational industry body. The User Handbook is in SWIFT's Knowledge Centre, which
needs a login. The General Information is a public PDF.

| Rule | Source |
| --- | --- |
| The date is six digits, `YYMMDD`, and must be a valid date | SWIFT MT 103, field 32A: format `6!n3!a15d`, subfield 1 Date; network validated rule "Date must be a valid date expressed as YYMMDD (Error code(s): T50)" |
| `YY` from 01 to 60 is 20`YY`; any other `YY` is refused (T50) | SWIFT _Standards MT General Information_ (Standards MT November 2025, 18 July 2025). §6.3.1 Dates, p. 44: "The six-digit date thus ranges from 2001 to 2060". §6.3.6 Value Date Ordering, p. 59, for MT 910 and categories 1 and 2 with field 30 or 32A, except n92, n95 and n96: "allowed: a year component … 'YY' in the range of 01 through 60"; "not allowed: any 'YY' component outside of this range" (error T50) |
| GMT applies the mandated rule and takes no window | **GMT rule**, [coding-standards](../../coding-standards.md): a mandated two-digit-year rule is applied exactly, as `parseRfc2822` and `parseHttpDate` apply RFC 5322 §4.3 and RFC 9110 |
| The grammar is internal; the public check is `isValidSwiftDate` | **GMT rule**, INT-15's: SWIFT gives a format code, not a pattern |
| `isValidSwiftDate` is true exactly when the parser returns a date | **GMT rule.** The validator calls the parser, so the two cannot disagree |
| A year outside 2001 to 2060 is refused by the formatter | **GMT rule** on SWIFT's range: SWIFT accepts no other year, and its digits would read back as another |
| A day that does not exist in the year the rule gives is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- FIN-95 — the `finance/` realm: its subpaths, its Dox industry, the guide and the mistakes page
  this story extends
- `isValidDate` — the ISO date the formatter takes

## Verification

- `parseSwiftDate('240615')` returns `2024-06-15`
- The range limits: `'010101'` returns `2001-01-01` and `'601231'` returns `2060-12-31`
- `'000101'`, `'610101'`, `'750101'`, `'800101'` and `'990615'` return the sentinel: `YY` `00` and
  `61` to `99` are outside 01 to 60 (T50)
- `'040229'` returns `2004-02-29` and `'600229'` returns `2060-02-29`; `'050229'` returns the sentinel
- `'24061'`, `'2406150'`, `'241315'` and `'24-06-15'` return the sentinel
- `formatSwiftDate('2024-06-15')` returns `240615`, `'2001-01-01'` returns `010101` and `'2060-12-31'` returns `601231`; `'2000-12-31'`, `'2061-01-01'` and `'2024-06-15T10:00:00'` return the sentinel
- Round-trip: `parseSwiftDate(formatSwiftDate(d))` returns `d` for every date `d` from 2001-01-01 to 2060-12-31
- `isValidSwiftDate('240615')` and `isValidSwiftDate('040229')` are `true`; `isValidSwiftDate('990615')`, `isValidSwiftDate('750101')`, `isValidSwiftDate('241315')` and `isValidSwiftDate('050229')` are `false`
- `isValidSwiftDate` agrees with `parseSwiftDate` on every parse row above; a number and `null` are `false`
- `pnpm run validate` stays green

## Decisions

- **Shapes.** Only the six-digit `YYMMDD` value date (SWIFT component `<DATE2>`, `6!n`) is read and
  written. `<DATE4>` (`YYYYMMDD`), ISO 15022 `:98A:`/`:98C:`, ISO 20022 dates, MT time indications
  (13C, 13D), field parsing (tag, currency, amount) and which field carries which date are not
  part of it.
- **Names and reach.** The names are `parseSwiftDate`, `formatSwiftDate` and `isValidSwiftDate`.
  The JSDoc states the §6.3.6 reach (MT 910 field 32A, and categories 1 and 2 with field 30
  and/or 32A, except n92, n95 and n96) and sends other six-digit dates, such as MT 700 field 31D,
  to `parseDateWithPattern`.
- **Edition.** The rule is cited from _Standards MT General Information_, Standards MT November
  2025 (§6.3.1, §6.3.6). It replaced the November 2006 _Message Format Validation Rules_, whose
  1980 to 2060 range the story first followed, after craig-o-curtis's review of #503. A later
  Standards Release that moves the range changes the two constants in `internal/swiftDate.ts` and
  the rows that pin them.
- **The century rule is SWIFT's §6.3.6 rule coded literally**, not `internal/twoDigitYear.ts`.
  `YY` from 01 to 60 is 20`YY`, and any other `YY` is refused (T50). GMT takes no window,
  as `parseRfc2822` and `parseHttpDate` take none.
- **Input is six bare ASCII digits** (`[0-9]`, never `\d`). A tag, currency, amount, whitespace or
  other digits returns the sentinel. Splitting a field into subfields is the caller's.
- **The formatter takes exactly what `isValidDate` accepts** (the AV-97 precedent): an ISO
  calendar date. A date-time names a calendar date only in a zone the caller states.
- **The formatter refuses a year outside 2001 to 2060**, because its two digits would read back as
  another year or be refused with T50.
- **Sentinels** are `""`, `""` and `false`. Nothing throws, there are no options and no new types.
  The validator calls the parser, so the two cannot disagree. Every function is O(1): no bench
  rows.
- **Plain dates only.** A value date is a `PlainDate`: no zone, no `Intl`, no locale matrix.
- **The grammar is internal.** SWIFT gives a format code, not a pattern, so the grammar lives in
  `internal/swiftDate.ts`, not in `regex/`. `coding-standards.md` extends the FIN-95 finance
  section, retitled `(FIN-95, FIN-96)`, and names SWIFT as the third mandated rule in the INT-15
  two-digit-year paragraph.
- **Dox.** One tool, the SWIFT Value Date Reader. Its decisions are recorded in
  [`dox/built.md`](../../dox/built.md) § Finance. The guide keeps its title "Finance: Message
  Timestamps" and slug, and the scenario and mistakes page compare SWIFT's rule with a home-made
  cut-off of 1930. There is no Dox changeset; the changeset for the three functions is
  `.changeset/swift-value-dates.md`.
- **Bundle budget.** The branch does not change `scripts/bundle-size.budgets.json`. Alone it
  measured 579905 B, under the 584000 it had then. Merged with `main` at HLTH-94 (#504), the root
  measures 590642 B, under `main`'s 595600. Every entry is under budget.
