# FIN-96 — Finance: SWIFT dates

**Scope:** Read and write the six-digit `YYMMDD` value date of SWIFT MT messages, in the century SWIFT's own rule gives.

## Gap

Payments cross SWIFT MT messages, and their value date is six digits. Field 32A carries
`6!n3!a15d` — a date, a currency and an amount — and its network validated rule says the date
"must be a valid date expressed as YYMMDD" ([painpoints § Findings — Finance](../painpoints.md#findings--finance)).
A general date parser does not read it, and a two-digit year needs a century. SWIFT states one for
value dates: its validation rules read `YY` above 79 as 19`YY` and the rest as 20`YY`, and refuse
a year after 2060 with error T50. A parser that applies a cut-off of its own, or asks the caller
for one, reads some dates SWIFT accepts as another year, and accepts dates SWIFT refuses.

([SWIFT Standards MT, MT 103 field 32A](https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih006.htm) —
a mirror of SWIFT's User Handbook, whose own copy needs a login;
[Message Format Validation Rules (November 2006), Part II §4.1.1](https://pinas.synology.me/Swift_Manual/2006/FINAL/UTMF/PTII.PDF),
on the same mirror)

## Scope

- `packages/gmt/src/finance/parse/parseSwiftDate.ts`:
  - `parseSwiftDate(value: string): string` — The value date of a field 30 or 32A, `YYMMDD`, to an
    ISO date, in the century SWIFT's value-date rule gives: `YY` above 79 is 19`YY`, the rest
    20`YY`, and a year after 2060 is refused.
- `packages/gmt/src/finance/format/formatSwiftDate.ts`:
  - `formatSwiftDate(value: string): string` — An ISO date to `YYMMDD`. Returns the sentinel for a
    year outside 1980 to 2060, the range SWIFT accepts, so a round trip never changes a century.
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

- `parseSwiftDate`: a value that is not six digits; a `YY` from 61 to 79, a year after 2060 (T50);
  a month or day that does not exist in the year the rule gives.
- `formatSwiftDate`: a value that is not an ISO 8601 calendar date; a year before 1980 or after
  2060.

### Docs site — `apps/dox/src/content/docs/`

- Extend `guides/industries/finance-message-timestamps.mdx`: the value date, SWIFT's 1980 to 2060
  range, and why a round trip refuses a year outside it.
- Scenario `a-value-date-in-the-wrong-century.mdx`.
- Mistakes: extend `mistakes/finance.mdx`.

## Tool

**SWIFT Value Date Reader.** Enter a `YYMMDD` value and see the date SWIFT's rule gives, with the
century it chose and why; a `YY` from 61 to 79 is shown refused with T50, and 29 February is
checked in the year the rule gives. Calls `parseSwiftDate`, `formatSwiftDate`, `isValidSwiftDate`.
Teaches: a two-digit year has no century until someone states one, and for value dates SWIFT does.

## Design notes

- **The century is SWIFT's.** For value dates in fields 30 and 32A, SWIFT's validation rules fix
  the century: 1980 to 2060, limits included. So the parser takes no window. This follows the
  coding standards' rule that GMT never picks a century where it has a choice: like RFC 5322 §4.3
  and RFC 9110, SWIFT mandates the rule, so there is no choice to make, and `parseRfc2822` and
  `parseHttpDate` are the precedent for applying it exactly.
- **The edition.** The rule is cited from the November 2006 edition, the newest reachable without
  a login. If a later Standards Release moves the range, the story follows that edition and its
  rows change with it.
- **Leap days are checked in the year the rule gives.** `000229` is 29 February 2000 and `840229`
  29 February 1984; `850229` is refused. So the day check runs after the century is known.
- **The validator takes the value alone.** The century is fixed by the rule, so `isValidSwiftDate`
  needs no options. The grammar stays in `internal/`: a value is valid only once its century and
  range are known, which no pattern says.
- **A round trip never changes a century.** `formatSwiftDate` refuses a year outside 1980 to 2060
  rather than writing digits that would read back as another year.
- **A value date is a date.** The formatter takes an ISO calendar date only. A date-time has a
  calendar date only in some zone, so the caller states which by taking the date first.
- MT time indications (fields 13C and 13D) and which field carries which date are not part of this
  story.

## Authority — what each rule rests on

SWIFT is a multinational industry body. The User Handbook and the validation rules were read
through a public mirror; SWIFT's own copies need a login.

| Rule | Source |
| --- | --- |
| The date is six digits, `YYMMDD`, and must be a valid date | SWIFT MT 103, field 32A: format `6!n3!a15d`, subfield 1 Date; network validated rule "Date must be a valid date expressed as YYMMDD (Error code(s): T50)" |
| `YY` above 79 is 19`YY`, the rest 20`YY`; a year after 2060 is refused | SWIFT *Message Format Validation Rules* (November 2006), Part II §4.1.1 Value Date, for "all category 1 and category 2 messages containing fields 30 or 32A": "The valid range of value dates implemented on the SWII system is from 1980 to 2060 (limits included) … IF YY >79 THEN year = "19" \|\| "YY" ELSE year = "20" \|\| "YY" ENDIF IF year > 2060 THEN <error:'T50'>" |
| GMT applies the mandated rule and takes no window | **GMT rule**, [coding-standards](../../coding-standards.md): a mandated two-digit-year rule is applied exactly, as `parseRfc2822` and `parseHttpDate` apply RFC 5322 §4.3 and RFC 9110 |
| The grammar is internal; the public check is `isValidSwiftDate` | **GMT rule**, INT-15's: SWIFT gives a format code, not a pattern |
| `isValidSwiftDate` is true exactly when the parser returns a date | **GMT rule.** The validator calls the parser, so the two cannot disagree |
| A year outside 1980 to 2060 is refused by the formatter | **GMT rule** on SWIFT's range: SWIFT accepts no other year, and its digits would read back as another |
| A day that does not exist in the year the rule gives is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- FIN-95 — the `finance/` realm: its subpaths, its Dox industry, the guide and the mistakes page
  this story extends
- `isValidDate` — the ISO date the formatter takes

## Verification

- `parseSwiftDate('240615')` returns `2024-06-15`; `'990615'` returns `1999-06-15`
- The range limits: `'800101'` returns `1980-01-01` and `'601231'` returns `2060-12-31`
- `'610101'`, `'750101'` and `'790101'` return the sentinel: 2061, 2075 and 2079 are past 2060 (T50)
- `'000229'` returns `2000-02-29` and `'840229'` returns `1984-02-29`; `'850229'` returns the sentinel
- `'24061'`, `'2406150'`, `'241315'` and `'24-06-15'` return the sentinel
- `formatSwiftDate('2024-06-15')` returns `240615`, `'1980-01-01'` returns `800101` and `'2060-12-31'` returns `601231`; `'1979-12-31'`, `'2061-01-01'` and `'2024-06-15T10:00:00'` return the sentinel
- Round-trip: `parseSwiftDate(formatSwiftDate(d))` returns `d` for every date `d` from 1980-01-01 to 2060-12-31
- `isValidSwiftDate('240615')` and `isValidSwiftDate('000229')` are `true`; `isValidSwiftDate('750101')`, `isValidSwiftDate('241315')` and `isValidSwiftDate('850229')` are `false`
- `isValidSwiftDate` agrees with `parseSwiftDate` on every parse row above; a number and `null` are `false`
- `pnpm run validate` stays green
