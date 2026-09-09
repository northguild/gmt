# HLTH-34 — Healthcare: FHIR R4 datetime formatting and validation

**Scope:** The FHIR `date`, `dateTime` and `instant` types and their precision rules.

## Gap

FHIR defines a constrained ISO 8601 profile with rules a generic parser does not enforce: `dateTime` permits year, year-month, date or full date-time precision, but **if hours are present, minutes and seconds must be too, and a timezone offset is required**. `instant` requires full precision with an offset. `date` never carries a time or offset.

Validation that accepts any ISO 8601 string will accept invalid FHIR, and validation that demands full precision will reject valid FHIR.

## Scope

- `packages/gmt/src/health/format/formatFHIR.ts`:
  - `formatFHIR(isoString: string, type: 'date' | 'dateTime' | 'instant', options?: { precision?: FhirPrecision }): string`
- `packages/gmt/src/health/parse/parseFHIR.ts`:
  - `parseFHIR(value: string): { value: string, precision: FhirPrecision, hasOffset: boolean } | null` — Preserves the original precision rather than zero-padding it away.
- `packages/gmt/src/health/validate/isValidFHIR.ts`:
  - `isValidFHIR(value: string, type: 'date' | 'dateTime' | 'instant'): boolean`
  - `getFHIRPrecision(value: string): FhirPrecision | null`
- `FhirPrecision` is `'year' | 'month' | 'day' | 'minute' | 'second' | 'fraction'`.

## FHIR precision rules

| Type | Permitted precision | Offset |
| --- | --- | --- |
| `date` | year, month, day | Never |
| `dateTime` | year, month, day, or second and finer | Required when a time is present |
| `instant` | second or finer only | Required |

## Design notes

- **Precision must be preserved, not padded.** The original spec had `parseFHIR` zero-pad `'2024-06'` to `'2024-06-01T00:00:00Z'`, which silently converts "some time in June" into "midnight UTC on 1 June". That is a fabricated fact, and it is a clinically meaningful one — it changes ordering, age calculations and inclusion in date-ranged queries. Comparison of partial values is HLTH-35's job and needs the original precision intact.
- A `dateTime` with hours but no minutes is invalid FHIR even though it is parseable as ISO 8601. The validator must reject it.
- FHIR `instant` and the offset-bearing `dateTime` both map cleanly onto CORE-4's instant-plus-offset pair.

## Corrections

The original HLTH-2 specced `parseFHIR` to "zero-pad partial precision to full datetime". This is removed for the reason above — it destroys the information the rest of the healthcare realm depends on. `isValidFHIRPrecision` is split into `isValidFHIR` (type-aware validation) and `getFHIRPrecision` (precision reporting), because the original conflated two questions and could answer neither fully.

## What gmt provides (do not re-implement)

- `toOffsetInstant` from CORE-4 — instant-plus-offset
- `regex/` — ISO 8601 pattern matchers
- `isValidZonedDateTime` — base validation

## Verification

- `parseFHIR('2024-06')` returns precision `'month'` and does **not** pad to a full datetime
- `isValidFHIR('2024-06-15T10', 'dateTime')` returns `false` — hours without minutes
- `isValidFHIR('2024-06-15T10:30:00', 'dateTime')` returns `false` — time without an offset
- `isValidFHIR('2024-06-15T10:30:00Z', 'instant')` returns `true`
- `isValidFHIR('2024-06-15T10:30:00Z', 'date')` returns `false`
- `isValidFHIR('2024-6-15', 'date')` returns `false` — unpadded month
- Round-trip preserves precision for every `FhirPrecision` value
- `pnpm run validate` stays green
