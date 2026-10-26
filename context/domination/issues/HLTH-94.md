# HLTH-94 — Healthcare: FHIR date, dateTime and instant

**Scope:** Check, read and write the three FHIR R4 date types at the precision each allows, without padding a partial date.

## Gap

FHIR exchanges dates as a constrained profile of ISO 8601, and the constraints are the point. A
`dateTime` may be a year, a year and month, a date, or a full date-time; "if hours and minutes are
specified, a time zone SHALL be populated", and seconds "must be provided". An `instant` is always
full precision with a zone. A `date` "SHALL" have no time zone. A check that accepts any ISO 8601
string accepts invalid FHIR, and one that demands full precision rejects valid FHIR.

Partial dates are normal in clinical records: `2024` and `2024-06` are valid, and "`2022` means
the range 2022-01-01 … 2022-12-31" ([painpoints § Healthcare](../painpoints.md#healthcare)). A
parser that pads `2024-06` to `2024-06-01T00:00:00Z` turns "some time in June" into a moment, and
every ordering, age and date-range query downstream inherits the invented fact.

([FHIR R4, Datatypes §2.24.0.1 Primitive Types](https://hl7.org/fhir/R4/datatypes.html))

## Scope

- `packages/gmt/src/healthcare/parse/parseFHIR.ts`:
  - `parseFHIR(value: string): FhirDateTime | null` — Reads any FHIR `date`, `dateTime` or
    `instant` value and returns `{ value, precision, offset }`: `value` exactly as sent, its
    precision, and its offset as `±HH:MM` (`""` for a year, month or day). Nothing is padded.
- `packages/gmt/src/healthcare/format/formatFHIR.ts`:
  - `formatFHIR(value: string, type: FhirDateType, options?: { precision?: FhirPrecision }): string`
    — Writes an ISO 8601 value as a FHIR value of the named type.
- `packages/gmt/src/healthcare/validate/isValidFHIR.ts`:
  - `isValidFHIR(value: string, type: FhirDateType): boolean` — True exactly when `parseFHIR`
    returns a value at a precision `type` allows; it calls the parser, so the two cannot disagree.
    False for a value that is not a string.
- `packages/gmt/src/regex/fhir.ts` — `fhirDate`, `fhirDateTime` and `fhirInstant`, the three
  patterns FHIR R4 publishes, verbatim and anchored with `^…$`, exported from `regex/index.ts` and
  so from `@northguild/gmt/regex`. The source is the `regex` extension on `date.value`,
  `dateTime.value` and `instant.value` in the R4 StructureDefinitions; the Datatypes page prints
  the same patterns with each backslash doubled. Shape only, as `epcisEventTime` is.
- `packages/gmt/src/types/fhir.ts` — `FhirDateType` (`"date"`, `"dateTime"`, `"instant"`),
  `FhirPrecision` (`"year"`, `"month"`, `"day"`, `"second"`, `"fraction"`) and `FhirDateTime`.
- If the `healthcare/` realm does not exist yet when this story starts, this story opens it, with
  the subpaths (`validate` included) and the industry declaration its sibling story names.

### FHIR R4 precision rules

| Type | Precision | Offset |
| --- | --- | --- |
| `date` | year, month, day | never |
| `dateTime` | year, month, day, second, fraction | required when a time is present |
| `instant` | second, fraction | required |

There is no minute or hour precision: a time without seconds is invalid in every type.

### What returns the sentinel

- `parseFHIR`: a value no FHIR type accepts; a day the month does not have; a second of `60` that is
  not an inserted leap second; a fraction of more than nine digits.
- `formatFHIR`: a value that is not an ISO 8601 instant, local date-time, date, year-month or year;
  a time with no offset under `dateTime` or `instant` at second precision; a `precision` the type
  does not allow, or finer than the value carries.

### Docs site — `apps/dox/src/content/docs/`

- Extend `guides/industries/healthcare-clinical-timestamps.mdx`: the three types, precision kept and
  never padded, the zone a time requires, and leap seconds.
- Scenario `a-fhir-month-padded-to-midnight.mdx`.
- Mistakes: extend `mistakes/healthcare.mdx`.

## Tool

**FHIR Date Checker.** Paste a value and see, for each of `date`, `dateTime` and `instant`, whether
it is valid and why not; the value's precision is drawn as the span it names on a calendar strip.
Beside each verdict, whether FHIR's published pattern matches, so `2024-02-30` shows a match that
is not valid. A second panel writes an instant as each type at each precision it allows. Calls
`parseFHIR`, `isValidFHIR`, `formatFHIR`, and tests `fhirDate`, `fhirDateTime` and `fhirInstant`.
Teaches: `2024-06` is a month, not midnight on the first.

## Design notes

- **Precision is kept, not padded.** `parseFHIR` returns the value as sent, with its precision.
  Comparing two partial values is FHIRPath's precision-by-precision rule and is not this story's.
- **One parser, three validators.** `instant` and `date` are both narrower than `dateTime`, so
  `parseFHIR` reads the `dateTime` grammar and the type check is a question about the result:
  `isValidFHIR(v, "dateTime")` is true exactly when `parseFHIR(v)` returns a value;
  `"date"` adds a precision of day or coarser; `"instant"` adds second or fraction.
- **The patterns are FHIR's, and they prove shape only.** FHIR calls its regexes "informative, not
  normative", and GMT publishes them unchanged, neither loosened nor tightened, as it publishes
  GS1's EPCIS patterns. Each matches 30 February, a second of `60` on any day and a fraction of any
  length. `isValidFHIR` refuses all three, so a string it accepts always matches the type's
  pattern, and not the other way round.
- **A time without a zone is invalid, not local.** FHIR requires the zone wherever a time is
  present, so `2024-06-15T10:30:00` is invalid as every type. This differs from HL7 v2 (HLTH-93),
  where no offset is legal and means the sender's local time.
- **A leap second is checked, not pattern-matched.** FHIR allows a second of `60`. It is real on 27
  days, so it is valid only where `isLeapSecond` (SPA-48) says the second was inserted.
- **A fraction longer than nine digits is refused.** The R4 regex allows any length. Temporal holds
  nanoseconds, and GMT does not call a value valid that it cannot hold; INT-15 refuses a long EPCIS
  fraction for the same reason.
- **`Z`, `+00:00` and `-00:00` are one offset.** `offset` reads all three as `+00:00`, one spelling
  for one fact, as INT-15 reads `-00`. `value` keeps the spelling sent, and `formatFHIR` writes the
  offset the input has.
- **The formatter reads the wall clock as written.** Under `date`, an instant with an offset writes
  its local date, not its UTC date: `2024-06-15T23:30:00-05:00` is `2024-06-15`. A caller who wants
  the UTC date passes the `Z` form.

## Authority — what each rule rests on

FHIR is published by HL7 International, a multinational industry body. R4 was read at hl7.org.

| Rule | Source |
| --- | --- |
| `date` forms; no zone; valid dates | FHIR R4 Datatypes §2.24.0.1, `date`: "The format is YYYY, YYYY-MM, or YYYY-MM-DD"; "There SHALL be no time zone"; "Dates SHALL be valid dates" |
| `dateTime` forms; zone with a time; seconds required; no `24:00` | FHIR R4 §2.24.0.1, `dateTime`: "If hours and minutes are specified, a time zone SHALL be populated. Seconds must be provided due to schema type constraints"; "The time '24:00' is not allowed" |
| `instant` precision and zone | FHIR R4 §2.24.0.1, `instant`: "The time SHALL specified at least to the second and SHALL include a time zone" |
| Leap seconds are allowed | FHIR R4 §2.24.0.1, `dateTime`: "Leap Seconds are allowed"; the second field of each regex is `([0-5][0-9]\|60)` |
| Offset range `-14:00` … `+14:00`; year `0000` refused | FHIR R4 §2.24.0.1 regexes. The page calls the regexes "informative, not normative"; **GMT rule** to follow them where the prose is silent |
| `fhirDate`, `fhirDateTime`, `fhirInstant` | FHIR R4 StructureDefinitions `date`, `dateTime` and `instant`, the `regex` extension on `.value`, verbatim |
| The patterns are informative | FHIR R4 §2.24.0.1: "The regexes are provided to assist with tooling, but are informative, not normative" |
| A pattern match is shape only; validity is `isValidFHIR`'s | **GMT rule**, as for `epcisEventTime` and `isValidEpcisEventTime` (INT-15) |
| `isValidFHIR` calls `parseFHIR` | **GMT rule.** The validator calls the parser, so the two cannot disagree |
| A second of `60` only on an inserted leap second | **GMT rule**, on SPA-48's closed leap-second table |
| A fraction of more than nine digits is refused | **GMT rule.** Temporal holds nanoseconds |
| `Z`, `+00:00`, `-00:00` read as `+00:00` | **GMT rule.** One spelling for one fact |
| A month, day or time that does not exist is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `toOffsetInstant` from CORE-4 — the instant-plus-offset pair a full FHIR value is
- `isLeapSecond` from SPA-48 — checking a second of `60` against the leap-second table
- `isValidDate`, `isValidDateTime` — the ISO values the formatter takes
- `regex/utc-offset` — the `±HH:MM` shape `offset` has

## Verification

- `parseFHIR('2024-06')` returns `{ value: '2024-06', precision: 'month', offset: '' }` and pads nothing
- `parseFHIR('2015-02-07T13:28:17-05:00')` returns `precision: 'second'`, `offset: '-05:00'`; `'2017-01-01T00:00:00.000Z'` returns `precision: 'fraction'`, `offset: '+00:00'`
- `isValidFHIR('2024-06-15T10', 'dateTime')` is `false` — hours without minutes
- `isValidFHIR('2024-06-15T10:30', 'dateTime')` is `false` — no seconds
- `isValidFHIR('2024-06-15T10:30:00', 'dateTime')` is `false` — a time with no zone
- `isValidFHIR('2024-06-15T10:30:00Z', 'instant')` is `true`; `isValidFHIR('2024-06-15', 'instant')` is `false`
- `isValidFHIR('2024-06-15T10:30:00Z', 'date')` is `false`; `isValidFHIR('2024-6-15', 'date')` is `false` — unpadded month
- `isValidFHIR('2016-12-31T23:59:60Z', 'instant')` is `true`; `'2017-12-31T23:59:60Z'` is `false`
- `isValidFHIR('2024-06-15T10:30:00+14:30', 'dateTime')`, `'0000-01-01'`, `'2024-02-30'` and `'2024-06-15T24:00:00Z'` are `false`
- `formatFHIR('2024-06-15T23:30:00-05:00', 'date')` returns `2024-06-15`; with `'instant'` it returns `2024-06-15T23:30:00-05:00`; `formatFHIR('2024-06-15T10:30:00', 'instant')` returns the sentinel
- `formatFHIR('2024-06-15T10:30:00Z', 'dateTime', { precision: 'month' })` returns `2024-06`; `formatFHIR('2024-06', 'dateTime', { precision: 'day' })` returns the sentinel
- Round-trip: `parseFHIR(formatFHIR(v, 'dateTime')).precision` equals the precision of `v` for every `FhirPrecision`
- `isValidFHIR` agrees with `parseFHIR` on every row above, as the design note states
- `fhirDateTime.test('2024-06')` and `fhirInstant.test('2015-02-07T13:28:17.239+02:00')` are `true`; `fhirDate.test('2024-06-15T10:30:00Z')`, `fhirInstant.test('2024-06-15')` and `fhirDateTime.test('2024-06-15T10:30:00')` are `false`
- Each pattern's `source` is the StructureDefinition's `regex` string with `^` and `$` added, asserted against a copy kept in the test
- `fhirDateTime.test('2024-02-30')`, `fhirInstant.test('2017-12-31T23:59:60Z')` and an instant with a ten-digit fraction are `true`, and `isValidFHIR` is `false` for each: the pattern is shape only
- Every value `isValidFHIR(v, t)` accepts in the rows above matches `t`'s pattern; `isValidFHIR(20240615, 'date')` and `isValidFHIR(null, 'dateTime')` are `false`
- `pnpm run validate` stays green
