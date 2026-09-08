# HLTH-2 — Healthcare: FHIR R4 datetime formatting and parsing

**Scope:** Format and parse FHIR R4 datetime types. FHIR is the modern HL7 standard for healthcare interoperability.

## Gap

FHIR R4 defines a specific profile of ISO 8601 with precision levels (year, month, day, date-time) that require validation.

## Scope

- `packages/gmt/src/health/fhir.ts`:
  - `formatFHIR(isoString: string): string` — ISO 8601 → FHIR datetime string. Preserves full precision.
  - `parseFHIR(fhirString: string): string` — FHIR datetime → ISO 8601 UTC string. Zero-pads partial precision to full datetime.
  - `isValidFHIRPrecision(fhirString: string): boolean` — Validates FHIR datetime precision rules.

## FHIR datetime precision levels

| Precision | Example | Zero-padded ISO |
|-----------|---------|----------------|
| Year | `2024` | `2024-01-01T00:00:00Z` |
| Year-month | `2024-06` | `2024-06-01T00:00:00Z` |
| Date | `2024-06-15` | `2024-06-15T00:00:00Z` |
| Date-time | `2024-06-15T10:30:00Z` | Full precision |

## What gmt provides (do not re-implement)

- `isValidZonedDateTime` — base validation
- Temporal for field extraction/reconstruction

## Verification

- `formatFHIR` preserves sub-second precision
- `parseFHIR` zero-pads: `parseFHIR('2024-06')` → `'2024-06-01T00:00:00Z'`
- `isValidFHIRPrecision` rejects: `isValidFHIRPrecision('2024-6')` → `false`
- Invalid FHIR string returns `""` sentinel
- `pnpm run validate` stays green
