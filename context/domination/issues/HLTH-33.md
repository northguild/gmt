# HLTH-33 — Healthcare: HL7 v2.x date and time types

**Scope:** HL7 v2.x timestamps — the current `DTM` and the legacy `TS`, plus `DT` and `TM` — including the offset-absent ambiguity that defines the format in practice.

## Gap

HL7 v2.x uses a compact `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]` timestamp that is not ISO 8601. The subtlety the first draft missed is that the offset is **optional**, and a DTM without one means "local to the sending facility" — a fact the receiving system does not have and cannot derive from the message. Silently treating it as UTC is the classic HL7 integration defect, and it shifts clinical events by hours.

The draft also assumed one data type. Interfaces in production are overwhelmingly v2.3.1 to v2.5.1, where the timestamp type is `TS` (2.A.77), a composite of a `DTM`-shaped time plus a "Degree of Precision" component retained "only for purposes of backward compatibility as of v 2.3" that "may not indicate greater" precision than the digits. `TS` "has been replaced by the DTM data type and … withdrawn and removed from the standard as of v 2.6", but a parser that does not accept `TS` cannot read the messages most hospitals send. `DT` (2.A.21, date only) and `TM` (2.A.75, time only, with its own optional offset restricted "to legally-defined time zones") round out the set. HL7 also states the default a receiver is tempted to invent: "if the time zone is not included, the time zone defaults to that of the local time zone of the sender" — a fact the receiver does not hold.

([HL7 v2.5.1 Chapter 2A, Data Types — 2.A.21 DT, 2.A.22 DTM, 2.A.75 TM, 2.A.77 TS](https://www.hl7.eu/HL7v2x/v251/std251/ch02a.html), [HL7 v2.6 Chapter 2A, TS withdrawal](https://www.hl7.eu/HL7v2x/v26/std26/ch02a.html))

## Scope

- `packages/gmt/src/health/format/formatHL7.ts`:
  - `formatHL7(isoString: string, options?: { precision?: 'second' | 'fraction', includeOffset?: boolean }): string` — ISO 8601 to HL7 DTM.
- `packages/gmt/src/health/parse/parseHL7.ts`:
  - `parseHL7(value: string): { instant: string, offset: string, precision: Hl7Precision } | { local: string, offsetAbsent: true, precision: Hl7Precision } | null` — Accepts `DTM` and `TS`. A `TS` degree-of-precision component equal to or coarser than the digit count lowers the reported `precision` (that is what HL7 Table 0529 permits); one finer than the digits is malformed and returns the sentinel. Returns an instant only when the value carries an offset. Without one, returns the local wall time flagged as offset-absent.
  - `resolveHL7Local(local: string, facilityZone: string): string` — Resolves an offset-absent value once the caller supplies the sending facility's zone.
  - `parseHL7Date(value: string): string | null` — `DT`: `YYYY[MM[DD]]`.
  - `parseHL7Time(value: string): { time: string, offset?: string, precision: Hl7Precision } | null` — `TM`: `HH[MM[SS[.S[S[S[S]]]]]][+/-ZZZZ]`.
- `packages/gmt/src/health/validate/isValidHL7Precision.ts`:
  - `isValidHL7Precision(value: string): boolean` — HL7 DTM permits truncation to year, month, day, hour or minute.
- `Hl7Precision` is `'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'fraction'`.

## HL7 v2.x DTM format

| Form | Meaning |
| --- | --- |
| `YYYY`, `YYYYMM`, `YYYYMMDD` | Truncated precision, all valid |
| `YYYYMMDDHHMM`, `YYYYMMDDHHMMSS` | Time to minute or second |
| `YYYYMMDDHHMMSS.SSSS` | Fractional seconds, up to four digits |
| `...+HHMM` / `...-HHMM` | Optional offset; `+0000` and `-0000` both mean UTC |
| `TS`: `DTM^D` etc. | v2.3.1–v2.5.1 composite; second component is the deprecated degree of precision |
| `""` (double quotes) | Explicit null in HL7, distinct from absent |

## Design notes

- **Offset-absent must not become UTC.** The union return type makes it impossible to use an offset-absent value as an instant without acknowledging it, which is the entire point. This mirrors the EDIFACT DTM qualifier handling in INT-15 — the same defect in a different industry.
- **Truncated precision is normal in HL7**, not an error. A birth date of `1965` is valid and must survive parsing; comparison of truncated values is HLTH-35's job.
- **The `TS` degree-of-precision component may lower precision, never raise it.** HL7 2.A.77.2 says it "is either the same as or overrides the precision indicated by the first component. It may not indicate greater". So `20240615103000^D` reports day precision (the sender is telling you the time digits are not meaningful), while `20240615^S` is malformed and returns the sentinel. Accepting `TS` is what makes the parser usable on live v2.3.1 feeds; ignoring the component would silently promote a date to a timestamp.
- **`0000` is the preceding midnight.** HL7 2.A.22: a DTM or TS "with the HHMM part set to \"0000\" represents midnight of the night extending from the previous day". The parser returns it as 00:00 on the stated date, which is the same instant, and the JSDoc records the clause so nobody "corrects" it to 24:00 of the day before.
- HL7's explicit null (`""`) is distinct from an absent field and from an unparseable value. All three are different clinical facts and must not collapse into one sentinel.

## Corrections

The original HLTH-1 specced `parseHL7` as returning "HL7 → ISO 8601 **UTC** string", which encodes the offset-absent bug directly into the signature. It also stated that invalid ISO input "throws `RangeError`", contradicting the library-wide sentinel contract, and treated the all-zeroes value `00000000000000` as the null form — HL7's null is `""`.

## What gmt provides (do not re-implement)

- `toOffsetInstant` / `resolveLocal` from CORE-4 — the instant-plus-offset pair and local resolution
- `getZonedDateTimeFields` — field extraction
- `regex/` — existing pattern matchers

## Verification

- `parseHL7('20240615103000-0500')` returns an instant and an offset
- `parseHL7('20240615103000')` returns the offset-absent form, never an instant
- `parseHL7('20240615103000^S')` (a v2.5.1 `TS`) parses identically to the bare `DTM`; `'20240615103000^D'` reports `precision: 'day'`; `'20240615^S'` returns the sentinel because the component claims more precision than the digits carry
- `resolveHL7Local` with a facility zone produces an instant differing from the naive UTC reading, asserted explicitly
- Round-trip: `parseHL7(formatHL7(iso, { includeOffset: true }))` recovers the instant
- Truncated values `'2024'` and `'202406'` parse and report their precision
- Fractional seconds to four digits are preserved
- `parseHL7Time('1030-0500')` returns a time with an offset; `parseHL7Time('1030')` returns no offset
- HL7 null `'""'` is distinguished from an unparseable value
- `pnpm run validate` stays green
