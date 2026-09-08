# HLTH-1 — Healthcare: HL7 v2.x formatting and parsing

**Scope:** Format and parse HL7 v2.x timestamps. HL7 v2.x is widely used in US healthcare systems.

## Gap

HL7 v2.x uses a compact timestamp format (YYYYMMDDHHMMSS) that is not ISO 8601-compatible.

## Scope

- `packages/gmt/src/health/hl7.ts`:
  - `formatHL7(isoString: string): string` — ISO 8601 → HL7 v2.x timestamp (YYYYMMDDHHMMSS).
  - `parseHL7(hl7String: string): string` — HL7 v2.x → ISO 8601 UTC string.
  - `formatHL7Full(isoString: string): string` — HL7 v2.x with sub-second precision (YYYYMMDDHHMMSS.SSSS).

## HL7 v2.x format details

- Base: `YYYYMMDDHHMMSS` (14 characters)
- With fraction: `YYYYMMDDHHMMSS.SSSS` (up to 4 decimal places)
- Null/unknown: `00000000000000` → return `""` sentinel

## What gmt provides (do not re-implement)

- `getZonedDateTimeFields` — extract year, month, day, hour, minute, second
- `isValidZonedDateTime` — validation
- Temporal for field reconstruction

## Verification

- Round-trip: `parseHL7(formatHL7(iso))` returns equivalent ISO string
- `formatHL7Full` preserves sub-second precision
- Invalid HL7 string returns `""` sentinel
- Invalid ISO input throws `RangeError`
- `pnpm run validate` stays green
