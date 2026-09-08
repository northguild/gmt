# MAR-2 — Maritime: Navigation timestamps — `navTimestamp` + `mmsiTimestamp`

**Scope:** Maritime and aerospace navigation timestamp formatting.

## Gap

Maritime and aerospace systems use specific timestamp formats. MMSI (Maritime Mobile Service Identity) encodes timestamps that need extraction/reconstruction.

## Scope

- `packages/gmt/src/maritime/navigation.ts`:
  - `navTimestamp(isoString: string): string` — Formats timestamp for maritime/aerospace navigation. ISO 8601 with UTC 'Z' suffix.
  - `mmsiTimestamp(mmsi: string, embeddedTime: string): string` — Extracts/reconstructs timestamp from MMSI. MMSI bits 20-40 encode the navigation status timestamp.

## MMSI timestamp format

MMSI is a 9-digit number. Bits 20-40 encode:
- Year (last 2 digits) — bits 20-27
- Month — bits 28-31
- Day — bits 32-36
- Hour — bits 37-41
- Minute — bits 42-47

Not all MMSI messages include timestamp data. If not encoded, return `""`.

## What gmt provides (do not re-implement)

- `formatZonedDateTime` — base formatting
- `getZonedDateTimeFields` — field extraction

## Verification

- `navTimestamp` returns valid ISO 8601 with 'Z' suffix
- `mmsiTimestamp` round-trips correctly for messages with encoded timestamps
- MMSI without timestamp data returns `""` sentinel
- Invalid MMSI format returns `""`
- `pnpm run validate` stays green
