# HLTH-93 — Healthcare: HL7 v2 timestamps

**Scope:** Read and write the HL7 v2 date-time — the current `DTM` and the older `TS` — without turning a time with no offset into UTC.

## Gap

Clinical messages still travel as HL7 v2, and its date-time is not ISO 8601. It is
`YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]`: the number of digits sent is the precision, and
the offset is optional. HL7 states what a missing offset means: "if the time zone is not
included, the time zone defaults to that of the local time zone of the sender". The receiver does
not know the sender's zone, so a parser that reads the value as UTC moves every clinical event by
the sender's offset. painpoints.md records it: "HL7 v2 DTM without an offset means 'local to the
sending facility' — an ambiguity that must be surfaced, not silently resolved to UTC"
([painpoints § Healthcare](../painpoints.md#healthcare)).

Most live feeds are versions 2.3.1 to 2.5.1, whose time stamp is `TS`, not `DTM`. From v2.3 on,
`TS` component 1 is a `DTM`, and component 2, the degree of precision, is "Retained only for
purposes of backward compatibility as of v 2.3"; it "may not indicate greater precision" than the
digits ([painpoints § Findings — Healthcare](../painpoints.md#findings--healthcare)). A parser
that accepts only `DTM` rejects any value that still carries the degree of precision, which HL7 has
kept only for backward compatibility since v2.3. One that ignores it reads a date as a time:
`199904011200^L`, the chapter's own example, is April 1999, not 12:00.

([HL7 v2.5.1 Chapter 2A, 2.A.22 DTM and 2.A.77 TS](https://www.hl7.eu/HL7v2x/v251/std251/ch02a.html))

## Scope

- `packages/gmt/src/healthcare/parse/parseHL7.ts`:
  - `parseHL7(value: string): Hl7DateTime | null` — Reads a `DTM`, or a `TS` with its degree of
    precision after `^`. The result is one of four kinds, below.
- `packages/gmt/src/healthcare/format/formatHL7.ts`:
  - `formatHL7(value: string, options?: { precision?: Hl7Precision }): string` — Writes an ISO 8601
    value as an HL7 `DTM`. It never writes `TS`, which HL7 withdrew in v2.6.
- `packages/gmt/src/healthcare/validate/isValidHL7.ts`:
  - `isValidHL7(value: string): boolean` — True exactly when `parseHL7` returns a value; it calls
    the parser, so the two cannot disagree. The null value `'""'` is true, because it is a value.
    False for a value that is not a string.
- `internal/hl7DateTime.ts` — the one `DTM` grammar, a regex built from HL7's format picture, and
  the split of a `TS` at `^`. Not in `regex/`: HL7 publishes a format picture, not a pattern.
  It joins `context/coding-standards.md` as a scoped exception, as INT-15's EDI grammars did.
- `packages/gmt/src/types/hl7.ts` — `Hl7Precision` (`"year"`, `"month"`, `"day"`, `"hour"`,
  `"minute"`, `"second"`, `"fraction"`) and `Hl7DateTime`.
- This story opens the `healthcare/` realm: the `@northguild/gmt/healthcare`,
  `@northguild/gmt/healthcare/parse`, `@northguild/gmt/healthcare/format` and
  `@northguild/gmt/healthcare/validate` subpaths (`package.json` `exports` and `typesVersions`, the
  dox `gmt-modules.ts` barrel), and the Healthcare industry in `apps/dox/src/data/industries.json`,
  with namespace `healthcare`; its glyph in `INDUSTRY_ICON_PATHS`
  (`apps/dox/src/lib/industry-tags.ts`), and its hub text in
  `apps/dox/src/lib/industry-overview.ts`: three to five problems, each answered by a function the
  industry may name, in that file's wording rules. `context/dox/built.md` names all three as what a
  new industry takes, and `industry-tags.test.ts` and `industry-overview.test.ts` fail without them.
  Healthcare declares no `drawsOn`, so its hub text names only `healthcare` functions; if it ever
  names `isLeapSecond` (HLTH-94's check), Healthcare draws on `timescale`.

### The result of `parseHL7`

| `kind` | When | Members |
| --- | --- | --- |
| `"instant"` | An offset, and a minute or finer | `instant` (UTC, `Z`), `offset` (`±HH:MM`), `local`, `precision` |
| `"local"` | No offset, and a minute or finer | `local`, `precision` |
| `"partial"` | A year, month, day or hour | `local`, `offset` (`±HH:MM`, or `""` when none was sent), `precision` |
| `"null"` | The HL7 null value, `""` (two double quotes) | none |

`local` is the wall clock as sent, in ISO 8601 extended form at the precision sent: `2024`,
`2024-06`, `2024-06-15`, `2024-06-15T10` (ISO 8601 reduced precision; no minute is added), and
from a minute on `2024-06-15T10:30:00`, `2024-06-15T10:30:00.1234`. From a minute on, seconds are
always written, as INT-15's results write them, and `precision` says which digits were sent. A
`"local"` result's `local` is ready for `resolveLocal` once the caller supplies the sender's zone.

### What returns the sentinel

- A value that does not fit the format, or names a month, day, hour, minute or second that does
  not exist; a fraction of more than four digits; an hour of `24`; a second of `60`.
- A `TS` degree of precision that is not one of `Y`, `L`, `D`, `H`, `M`, `S`, or that is finer than
  the digits sent.
- In `formatHL7`: a value that is neither an ISO 8601 instant nor one of the forms `local` takes; a
  year outside 0000–9999; a `precision` finer than the value carries.

### Docs site — `apps/dox/src/content/docs/`

- Guide `guides/industries/healthcare-clinical-timestamps.mdx`: the four kinds, the offset that is
  not there, precision by digit count, `TS` and its degree of precision, the null value, and the
  step from a local time to an instant with the sender's zone.
- Scenarios `an-hl7-time-read-as-utc.mdx`, `a-ts-date-read-as-a-time.mdx`.
- Mistakes: `mistakes/healthcare.mdx`.
- Indexes: `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`.

## Tool

**HL7 Timestamp Reader.** Paste a `DTM` or a `TS` and see its kind, precision and offset; for a
`"local"` value, pick the sending facility's zone and see the instant beside the wrong UTC
reading. A second panel writes an instant back as a `DTM` at each precision. Calls `parseHL7`,
`formatHL7` and `resolveLocal`. Teaches: an HL7 time with no offset is the sender's local time, not
UTC.

## Design notes

- **No offset must not become UTC.** The `"local"` kind has no `instant` member, so a caller cannot
  use the value as an instant without supplying the zone. This is INT-15's rule for an EDIFACT
  `203`: the same defect in another industry.
- **A partial value names a span, not a moment.** `1965` is a valid birth date, and padding it to
  `1965-01-01T00:00:00` would state a fact the sender did not send. So a value coarser than a minute
  is `"partial"`, keeps its precision, and has no instant even when it carries an offset.
- **The degree of precision may lower the precision, never raise it.** HL7 2.A.77.2: it "is either
  the same as or overrides the precision indicated by the first component. It may not indicate
  greater precision". `20240615103000^D` is day precision, and `local` is cut to `2024-06-15`;
  `20240615^S` claims more than the digits carry and returns the sentinel. Table 0529 has no value
  for a fraction, so `^S` on a fractional value cuts it to the second. Cutting never rounds.
- **`0000` is the start of the stated day.** HL7 2.A.22: a value "with the HHMM part set to '0000'
  represents midnight of the night extending from the previous day to the day given by the
  YYYYMMDD part". `198807050000` is `1988-07-05T00:00:00`, and the JSDoc quotes the clause so
  nobody "corrects" it to the day before.
- **`+0000` and `-0000` are both UTC.** HL7 2.A.22 says so, so both read as `+00:00`.
- **The null value is a value.** HL7 ch. 2 §2.5.3: the null value "is transmitted as two double
  quote marks", and sending it "is different from omitting an optional data field" — it deletes the
  stored value. So `'""'` returns `{ kind: "null" }`, an empty string returns the sentinel, and the
  two never look alike.
- **The formatter writes the offset the value has.** An instant with `Z` writes `+0000`; an instant
  with an offset writes that offset; a local date-time writes none. A caller who must send the
  facility's wall clock passes the string `fromOffsetInstant` writes for that zone. An offset is
  never dropped or rounded.
- **One public check, no public pattern.** A `DTM` is valid only as a whole: its digit count, its
  `TS` component and its calendar together. So the public check is `isValidHL7`, and the grammar
  stays in `internal/`, as INT-15 keeps the EDI grammars.
- **The formatter cuts to the precision and never rounds**, as INT-15's formatters do. The default is
  the value's own precision, with a fraction cut to the four digits `DTM` holds.

## Authority — what each rule rests on

HL7 International publishes HL7 v2, a multinational industry standard. v2.5.1 was read through
HL7 Europe's published copy.

| Rule | Source |
| --- | --- |
| The `DTM` format; digit count is the precision | HL7 v2.5.1 ch. 2A, 2.A.22: "The number of characters populated (excluding the time zone specification) specifies the precision", with `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]` |
| No offset means the sender's local time | HL7 v2.5.1 2.A.22: "if the time zone is not included, the time zone defaults to that of the local time zone of the sender" |
| `+0000` and `-0000` are UTC | HL7 v2.5.1 2.A.22: "+0000 or -0000 both represent UTC (without offset)" |
| `0000` is the start of the stated day | HL7 v2.5.1 2.A.22, with the example `198807050000`, "Midnight of the night extending from July 4 to July 5, 1988" |
| `TS` and its degree of precision | HL7 v2.5.1 2.A.77 and 2.A.77.2; HL7 Table 0529 (`Y`, `L`, `D`, `H`, `M`, `S`) |
| `TS` is not written | [HL7 v2.6 ch. 2A, 2.A.77](https://www.hl7.eu/HL7v2x/v26/std26/ch02a.html): "The TS data type has been replaced by the DTM data type and the detail was withdrawn and removed from the standard as of v 2.6" |
| The null value `""` | [HL7 v2.5.1 ch. 2, §2.5.3](https://www.hl7.eu/HL7v2x/v251/std251/ch02.html) |
| A partial value has no instant | **GMT rule.** An instant needs a minute at least; adding digits the sender did not send states a fact the message does not hold |
| The grammar is internal; the public check is `isValidHL7` | **GMT rule**, INT-15's: HL7 publishes a format picture, not a pattern |
| `isValidHL7` is true exactly when `parseHL7` returns a value | **GMT rule.** The validator calls the parser, so the two cannot disagree |
| A second of `60` is rejected | **GMT rule.** 2.A.22 gives no leap second, and Temporal has none |
| A field out of range, or a day the year does not have, is rejected | TC39 Temporal `overflow: "reject"`; [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics) |
| Sentinels | [coding-standards § API Contract](../../coding-standards.md#api-contract) |

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `fromOffsetInstant` from CORE-4 — the instant-plus-offset pair the
  `"instant"` kind and the formatter's input are
- `resolveLocal` from CORE-4 — resolving a `"local"` value once the caller supplies the sender's
  zone
- `internal/utcOffsetString.ts` — parsing and writing a UTC offset through Temporal

## Verification

- `parseHL7('20240615103000-0500')` returns `{ kind: 'instant', instant: '2024-06-15T15:30:00Z', offset: '-05:00', local: '2024-06-15T10:30:00', precision: 'second' }`
- `parseHL7('20240615103000')` returns `{ kind: 'local', local: '2024-06-15T10:30:00', precision: 'second' }`, never an instant
- `resolveLocal(parseHL7('20240615103000').local, 'Europe/Helsinki')` returns `2024-06-15T07:30:00Z`, asserted against the naive UTC reading `2024-06-15T10:30:00Z`
- `parseHL7('20240615103000^S')` returns the same as the bare `DTM`; `'20240615103000^D'` returns `{ kind: 'partial', local: '2024-06-15', offset: '', precision: 'day' }`; `'20240615^S'` returns the sentinel
- `'2024'` and `'202406'` return `"partial"` with `precision: 'year'` and `'month'`; `'2024061510'` returns `local: '2024-06-15T10'`, `precision: 'hour'`
- `'20240615103000.1234+0000'` keeps all four fraction digits; `'20240615103000.12345'` returns the sentinel
- `'198807050000'` returns `local: '1988-07-05T00:00:00'`; `'20240615240000'` and `'20240230'` return the sentinel
- `'20240615103000-0000'` returns `offset: '+00:00'`
- `parseHL7('""')` returns `{ kind: 'null' }`; `parseHL7('')` returns the sentinel
- `formatHL7('2024-06-15T10:30:00-05:00')` returns `20240615103000-0500`; `'2024-06-15T15:30:00Z'` returns `20240615153000+0000`; `'2024-06-15T10:30:00'` returns `20240615103000`
- `formatHL7('2024-06-15T10:30:45.98765-05:00')` returns `20240615103045.9876-0500`, cut and not rounded; with `{ precision: 'minute' }` it returns `202406151030-0500`
- `formatHL7('2024-06', { precision: 'day' })` returns the sentinel
- Round-trip: `parseHL7(formatHL7(iso))` returns the instant and offset of `iso` for every instant row above
- `isValidHL7('20240615103000-0500')`, `'2024'` and `'""'` are `true`; `'20240615^S'`, `'20240230'` and `''` are `false`
- `isValidHL7` agrees with `parseHL7` on every `parseHL7` row above; `isValidHL7(20240615)` and `isValidHL7(null)` are `false`
- `pnpm run validate` stays green
