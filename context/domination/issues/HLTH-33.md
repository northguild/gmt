# HLTH-33 — Healthcare: HL7 v2.x DTM formatting and parsing

**Scope:** HL7 v2.x timestamps, including the offset-absent ambiguity that defines the format in practice.

## Gap

HL7 v2.x uses a compact `YYYYMMDDHHMMSS[.S...][+/-ZZZZ]` timestamp that is not ISO 8601. The subtlety the first draft missed is that the offset is **optional**, and a DTM without one means "local to the sending facility" — a fact the receiving system does not have and cannot derive from the message. Silently treating it as UTC is the classic HL7 integration defect, and it shifts clinical events by hours.

## Scope

- `packages/gmt/src/health/format/formatHL7.ts`:
  - `formatHL7(isoString: string, options?: { precision?: 'second' | 'fraction', includeOffset?: boolean }): string` — ISO 8601 to HL7 DTM.
- `packages/gmt/src/health/parse/parseHL7.ts`:
  - `parseHL7(value: string): { instant: string, offset: string } | { local: string, offsetAbsent: true } | null` — Returns an instant only when the DTM carries an offset. Without one, returns the local wall time flagged as offset-absent.
  - `resolveHL7Local(local: string, facilityZone: string): string` — Resolves an offset-absent value once the caller supplies the sending facility's zone.
- `packages/gmt/src/health/validate/isValidHL7Precision.ts`:
  - `isValidHL7Precision(value: string): boolean` — HL7 DTM permits truncation to year, month, day, hour or minute.

## HL7 v2.x DTM format

| Form | Meaning |
| --- | --- |
| `YYYY`, `YYYYMM`, `YYYYMMDD` | Truncated precision, all valid |
| `YYYYMMDDHHMM`, `YYYYMMDDHHMMSS` | Time to minute or second |
| `YYYYMMDDHHMMSS.SSSS` | Fractional seconds, up to four digits |
| `...+HHMM` / `...-HHMM` | Optional offset |
| `""` (double quotes) | Explicit null in HL7, distinct from absent |

## Design notes

- **Offset-absent must not become UTC.** The union return type makes it impossible to use an offset-absent value as an instant without acknowledging it, which is the entire point. This mirrors the EDIFACT DTM qualifier handling in INT-15 — the same defect in a different industry.
- **Truncated precision is normal in HL7**, not an error. A birth date of `1965` is valid and must survive parsing; comparison of truncated values is HLTH-35's job.
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
- `resolveHL7Local` with a facility zone produces an instant differing from the naive UTC reading, asserted explicitly
- Round-trip: `parseHL7(formatHL7(iso, { includeOffset: true }))` recovers the instant
- Truncated values `'2024'` and `'202406'` parse and report their precision
- Fractional seconds to four digits are preserved
- HL7 null `'""'` is distinguished from an unparseable value
- `pnpm run validate` stays green
